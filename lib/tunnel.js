"use strict";
const beame       = require('beame-sdk');
const ProxyClient = beame.ProxyClient;
const BeameLogger = beame.Logger;
const logger      = new BeameLogger("BIS-Tunnel");
const utils       = require('./utils');
const net = require('net');
const tls = require('tls');

const connectedStr = 'dstAppClientConnected';
let localSockets = [], localServer, terminatingSockets = [], localPort;

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
				let rawData = utils.appendBuffer(utils.str2arr(id), data);
				let written = terminatingSockets[id] && terminatingSockets[id].write(new Buffer(rawData));
				// console.log('localSockets[id] got(Bytes):',data.byteLength, ' written:',written);
				if(!written)localSockets[id] && localSockets[id].pause();

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
			});
			localSockets[id].on('error', (e)=>{
				console.error('localSockets[',id,']: ',e);
				localSockets[id].removeAllListeners();
				localSockets[id].end();
				localSockets[id] = null;
			});

		}
		catch (e){
			console.error(e);
		}
	}
};

// let terminatingSocket = null;

let localBuffer = [];
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
						// console.log('terminatingSocket got (Bytes): ', data.byteLength, ' from: ',id);
						let rawData = data.slice(utils.uuidLength, data.byteLength);
						if((rawData.length == connectedStr.length) &&
							(new Buffer(rawData).toString('ascii') === connectedStr)){

							localBuffer = [];
							socket.id = id;//TODO: check if id (built of padded source ip:port) already exists, to kill the old one
							terminatingSockets[socket.id] = socket;
							// console.log('localSockets[',socket.id,'] got(Bytes):',data.byteLength);
							_startDstClient(socket.id);
						}
						else{
							if(!localSockets[id]){
								localBuffer.push.apply(localBuffer,rawData);//seems irrelevant
							}
							else {
								let written = localSockets[id] && localSockets[id].write(rawData);
								// console.log('terminatingSocket got (Bytes): ', data.byteLength, ' written:', written, '=>', rawData.length);
								if (!written && localSockets[id]) localSockets[id].pause();
							}
						}
					})
					socket.on('connect',()=>{
						console.log('terminatingSocket connect');
					})
					socket.on('end',()=>{
						console.log('terminatingSocket end');
						localBuffer = [];
					})
					socket.on('drain',()=>{
						console.log('terminatingSocket drain');
						socket.resume();
					})
					socket.on('close',(had_error)=>{
						console.log('terminatingSocket close:', had_error);
						localBuffer = [];
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
