"use strict";
const beame       = require('beame-sdk');
const ProxyClient = beame.ProxyClient;
const BeameLogger = beame.Logger;
const logger      = new BeameLogger("BIS-Tunnel");
const utils       = require('./utils');
const net = require('net');
const tls = require('tls');

const https = require('https');

let localSockets = [], localServer, terminatingSockets = [], localPort;
let localBuffer = [], bufferedWriter = {}, bufferedReader = {};


/**
 * @param {Object} certs
 * @param {String} targetHost
 * @param {Number} targetPort
 * @param {String} targetHostName
 * @returns {Promise}
 */
function startHttpsTerminatingProxy(certs, targetHost, targetPort, targetHostName) {
	// certs - key, cert, ca
	return new Promise((resolve, reject) => {
		const httpProxy = require('http-proxy');
		try {
			const proxy = httpProxy.createProxyServer({
				target:  {
					host: targetHost,
					port: targetPort
				},
				ssl:     {
					key:  certs.key,
					cert: certs.cert
				},
				headers: {
					host: targetHostName
				}
			});
			proxy.on('error', e => {
				console.error(`Error connecting to ${targetHost}:${targetPort} - ${e}`);
			});
			proxy.listen(0, () => {
				// console.log(proxy._server.address().port);
				resolve(proxy._server.address().port);
			});
		}
		catch (error) {
			reject(error);
		}
	});
}

/**
 * @param {Credential} cred
 * @param {String} targetHost
 * @param {Number} targetPort
 * @param {String} targetProto
 * @param {String} targetHostName
 * @param {Boolean} isTCPproxy
 */
function tunnel(cred, targetHost, targetPort, targetProto, targetHostName, isTCPproxy) {

	if (targetProto !== 'http' && targetProto !== 'https' && targetProto !== 'eehttp' && targetProto !== 'tcp') {
		throw new Error("httpsTunnel: targetProto must be either http, https, eehttp or tcp");
	}

	/** @type {Object} **/
	let serverCerts = cred.getHttpsServerOptions();


	let proxyClient;

	switch(targetProto) {
		case 'tcp':
			localPort = targetPort;
			startTCPproxy(cred, 55333, (flag) => {
				if(!proxyClient && flag){
					proxyClient = new ProxyClient("HTTPS", cred, 'localhost', 55333, {}, null, serverCerts);
					proxyClient.start().then(() => {
						console.error(`Proxy client started on ${cred.fqdn}`);
					}).catch(e => {
						throw new Error(`Error starting HTTPS terminating proxy: ${e}`);
					});
				}
				else
					console.warn('Not started');
			})
			break;
		case 'http':
			startHttpsTerminatingProxy(serverCerts, targetHost, targetPort, targetHostName || targetHost)
				.then(terminatingProxyPort => {
					proxyClient =	new ProxyClient("HTTPS",cred, 'localhost', terminatingProxyPort, {}, null, serverCerts);
					proxyClient.start().then(()=>{
						console.error(`Proxy client started on ${cred.fqdn}`);
					}).catch(e => {
						throw new Error(`Error starting HTTPS terminating proxy: ${e}`);
					});
				})
				.catch(e => {
					throw new Error(`Error starting HTTPS terminating proxy: ${e}`);
				});
			break;
		case 'https':
			proxyClient = new ProxyClient("HTTPS", cred, targetHost, targetPort, {}, null, serverCerts);
			proxyClient.start().then(()=>{
				console.error(`Proxy client started on ${cred.fqdn}`);
			}).catch(e => {
				throw new Error(`Error starting HTTPS terminating proxy: ${e}`);
			});
			break;
		case 'eehttp':
			console.error("WARNING: You are using unsupported protocol 'eehttp'. This feature will be broken in future.");
			proxyClient = new ProxyClient("HTTP", cred, targetHost, targetPort, {});
			proxyClient.start();
			break;
		default: return;
	}

}


function startTCPproxy(cred, targetPort, cb) {

	startTerminatingTcpServer(cred, targetPort).then(()=>{
		cb(true);
	}).catch(e=>{
		console.error(e);
		cb(false);
	});

}

const _startDstClient = (id) => {
	if(id){
		localSockets[id] = new net.Socket({readable: true, writable:true, allowHalfOpen: true});

		try{

			localSockets[id].connect(localPort, '127.0.0.1', () => {
				console.log('destination client connected:',id);
			});

			localSockets[id].on('data', (data)=>{

				if(bufferedWriter[id]){
					bufferedWriter[id].writeData(new Buffer(data), terminatingSockets[id]);
				}
				else{
					let rawData = utils.appendBuffer(utils.str2arr(id), data);
					let written = terminatingSockets[id] && terminatingSockets[id].write(new Buffer(rawData));
					// console.log('localSockets[id] got(Bytes):',data.byteLength, ' written:',written);
					if (!written && localSockets[id] && terminatingSockets[id]) {
						console.log('localSockets[id] got(Bytes):',data.byteLength, ' written:',written);
						// console.log('localSockets pause');
						terminatingSockets[id].pause();
					}
				}


			});

			localSockets[id].on('close', had_error => {
				console.log('localSockets[',id,'] close: ', had_error);
			});

			localSockets[id].on('connect', () => {
				console.log('localSockets[',id,'] connect');

				if (localBuffer.length > 0) {
					if(localSockets[id].write(new Buffer(localBuffer))){
						localBuffer = [];
					}
				}
			});
			localSockets[id].on('lookup', () => {
				console.log('localSockets[',id,'] lookup');
			});
			localSockets[id].on('timeout', () => {
				console.log('localSockets[',id,'] timeout: ');
			});
			localSockets[id].on('end', had_error => {
				console.log('localSockets[',id,'] end: ', had_error);
				localSockets[id].removeAllListeners();
				localSockets[id] = null;
			});
			localSockets[id].on('drain', () => {
				console.log('localSockets[',id,'] drain');
				localSockets[id].resume();
				terminatingSockets[id].resume();
			});
			localSockets[id].on('error', (e)=>{
				console.error('localSockets[',id,']: ',e);
				localSockets[id].removeAllListeners();
				localSockets[id].end();
				delete localSockets[id];
				if(localSockets.length < 1 && terminatingSockets[id]){
					if(bufferedWriter[id]){
						bufferedWriter[id].writeData(new Buffer(utils.disconnectedStr), terminatingSockets[id]);
					}
					else {
						let cmd = id + utils.disconnectedStr;
						console.log('Command: ', cmd);
						terminatingSockets[id] && terminatingSockets[id].write(new Buffer(cmd));
					}
				}
			});
		}
		catch (e){
			console.error(e);
		}
	}
};

// let terminatingSocket = null;


function startTerminatingTcpServer(cred, targetPort) {
	console.log('starting TerminatingTcpServer on:', targetPort);
	return new Promise((resolve, reject) => {

		try {

			const opts = {
				pfx: cred.PKCS12,
				passphrase: cred.PWD,
				requestCert: true,
				allowHalfOpen: true
			};
			const srv = tls.createServer(opts, (socket) =>{//{certs, requestCert: false}, (socket) =>{
				const onData = (rawData, id) => {
					if(!localSockets[id]){
						localBuffer.push.apply(localBuffer,rawData);//seems irrelevant
					}
					else {
						let written = localSockets[id] && localSockets[id].write(rawData);
						console.log('terminatingSocket got (Bytes): ', rawData.byteLength,
							' written:', written, '=>', rawData.length);
						if (!written && localSockets[id] && terminatingSockets[id]) {
							localSockets[id].pause();
							// terminatingSockets[id].pause();
						}
					}
				}
				const onSocketEnd = (id) => {
					if(terminatingSockets[socket.id]){
						terminatingSockets[socket.id].removeAllListeners();
						terminatingSockets[socket.id] = null;
					}
					if(bufferedWriter[id])
						delete bufferedWriter[id];
					localBuffer = [];
					if(bufferedReader[id])
						delete bufferedReader[id];
				}

				const setId = (cont) => {
					console.log('Building terminating server connection');
					cont();
				}
				setId(()=>{

					socket.on('error',(e)=>{
						console.error(e);
					})
					socket.on('data', (data)=>{

						let id = utils.arr2str(data.slice(0, utils.uuidLength));

						// let rawData = data.slice(utils.uuidLength, data.byteLength);
						if(!bufferedReader[id])
							bufferedReader[id] = new utils.bufferedReader(id);
						let frame = bufferedReader[id].buildFrame(data);
						console.log('frame:', frame.finished);
						if(frame.finished){
							if(frame.cmd){
								if(frame.cmd === utils.connectedStr){
									localBuffer = [];
									socket.id = id;//TODO: check if id (built of padded source ip:port) already exists, to kill the old one
									terminatingSockets[socket.id] = socket;
									if(!bufferedWriter[socket.id]){
										bufferedWriter[socket.id] = new utils.bufferedWriter();
										console.log('Creating buffered writer for <', socket.id, '>');
									}

									// console.log('localSockets[',socket.id,'] got(Bytes):',data.byteLength);
									_startDstClient(socket.id);
								}
								else if(frame.cmd === utils.disconnectedStr){
									if(localSockets[id]){
										localSockets[id].removeAllListeners();
										localSockets[id] = null;
									}
								}
							}
							else{
								onData(frame.data, id);
							}
							bufferedReader[id].resetReader();
						}

					})
					socket.on('connect',()=>{
						console.log('terminatingSocket connect');
					})
					socket.on('end',()=>{
						console.log('terminatingSocket end');
						onSocketEnd();
					})
					socket.on('drain',()=>{
						console.log('terminatingSocket <', socket.id,'> drain');
						socket.resume();
					})
					socket.on('close',(had_error)=>{
						console.log('terminatingSocket',socket.id,'close:', had_error);
						onSocketEnd();
					})
				});
				let peerData = socket.getPeerCertificate();
				console.log('startTerminatingTcpServer:',socket.id, ' connected: ', peerData.subject.CN);

				// if(terminatingSocket)
				// 	terminatingSocket.removeAllListeners();

			});
			srv.listen(targetPort, ()=>{
				resolve();
				console.log('Terminating TCP server listening on:',targetPort);
			});
			srv.on('resumeSession',(a,b)=>{
				console.log('resumeSession:',a,' b:',b);
			})
			//resolve();
		}
		catch (error) {
			reject(error);
		}
	});
}


module.exports = tunnel;
