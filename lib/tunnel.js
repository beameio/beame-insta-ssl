"use strict";
const beame       = require('beame-sdk');
const ProxyClient = beame.ProxyClient;
const BeameLogger = beame.Logger;
const logger      = new BeameLogger("BIS-Tunnel");
const utils       = require('./utils');
const net = require('net');

var https = require('https');
let allowedGroup = null;
let localSockets = {}, localServer, terminatingSockets = {}, localPort;

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
 * @param {String} group
 */
function tunnel(cred, targetHost, targetPort, targetProto, targetHostName, group) {

	if (targetProto !== 'http' && targetProto !== 'https' && targetProto !== 'eehttp' && targetProto !== 'tcp') {
		throw new Error("httpsTunnel: targetProto must be either http, https, eehttp or tcp");
	}
	allowedGroup = group;
	/** @type {Object} **/
	let serverCerts = cred.getHttpsServerOptions();


	let proxyClient;

	switch(targetProto) {
		case 'tcp':
			localPort = targetPort;
			startTCPproxy(cred, 0, (port) => {
				if(!proxyClient && port){
					proxyClient = new ProxyClient("HTTPS", cred, 'localhost', port, {}, null, serverCerts, true);
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

	startTerminatingHttpsServer(cred, targetPort).then((port)=>{
		cb(port);
	}).catch(e=>{
		console.error(e);
		cb(0);
	});

}

const _startDstClient = (id) => {

	const onSocketEnd = (id) => {
		localSockets[id].removeAllListeners();
		delete localSockets[id];
	}

	if(id && !localSockets[id]){
		localSockets[id] = new net.Socket({readable: true, writable:true, allowHalfOpen: true});

		try{

			localSockets[id].connect(localPort, '127.0.0.1', () => {
				console.log('Host app connected:',id);
			});

			localSockets[id].on('data', (data)=>{
				let rawData = utils.appendBuffer(utils.str2arr(id), data);
				terminatingSockets[id] && terminatingSockets[id].emit('data', new Buffer(rawData));
				// console.log('localSockets[id] got(Bytes):',data.byteLength, ' written:',written);
				// if(!written)terminatingSockets[id] && terminatingSockets[id].pause();

			});

			localSockets[id].on('close', had_error => {
				console.log('localSockets[',id,'] close: ', had_error);
				onSocketEnd(id);
			});

			localSockets[id].on('connect', () => {
				// console.log('localSockets[',id,'] connect');

				if (localBuffer.length > 0) {
					if(localSockets[id].write(new Buffer(localBuffer))){
						localBuffer = [];
					}
				}
			});
			localSockets[id].on('lookup', () => {
				// console.log('localSockets[',id,'] lookup');
			});
			localSockets[id].on('timeout', () => {
				console.warn('localSockets[',id,'] timeout: ');
			});
			localSockets[id].on('end', had_error => {
				// console.log('localSockets[',id,'] end: ', had_error);
				onSocketEnd(id);
			});
			localSockets[id].on('drain', () => {
				// console.log('localSockets[',id,'] drain');
				localSockets[id].resume();
			});
			localSockets[id].on('error', (e)=>{
				if(e.message.includes('ECONNREFUSED')){
					let cmd = id+utils.hostAppFailedStr;
					console.warn(e.message,' => Local app unreachable, please verify (Informing client)');
					terminatingSockets[id] && terminatingSockets[id].emit('command',cmd);
				}
				else console.error('localSockets[',id,']: ',e);
			});

		}
		catch (e){
			console.error(e);
		}
	}
};


let localBuffer = [];//, bufferedWriter = {};
// function startTerminatingTcpServer(cred, targetPort) {
// 	console.log('starting TerminatingTcpServer on:', targetPort);
// 	return new Promise((resolve, reject) => {
//
// 		try {
//
// 			const opts = {
// 				pfx: cred.PKCS12,
// 				passphrase: cred.PWD,
// 				requestCert: true,
// 				allowHalfOpen: true
// 			};
// 			const srv = tls.createServer(opts, (socket) =>{//{certs, requestCert: false}, (socket) =>{
// 				const onData = (rawData, id) => {
// 					if(!localSockets[id]){
// 						localBuffer.push.apply(localBuffer,rawData);//seems irrelevant
// 					}
// 					else {
// 						// bufferedWriter[id].writeData(rawData, localSockets[id]);
// 						let written = localSockets[id] && localSockets[id].write(rawData);
//
// 						if (!written && localSockets[id]) localSockets[id].pause();
// 					}
// 				}
//
// 				const setId = (cont) => {
// 					console.log('Building terminating server connection');
// 					cont();
// 				}
// 				setId(()=>{
//
// 					socket.on('error',(e)=>{
// 						console.error(e);
// 					})
// 					socket.on('data', (data)=>{
//
// 						let id = utils.arr2str(data.slice(0, utils.uuidLength));
//
// 						let rawData = data.slice(utils.uuidLength, data.byteLength);
//
// 						if(rawData.length == utils.commandLength){
// 							let cmd = new Buffer(rawData).toString('ascii');
// 							if(cmd === utils.connectedStr){
// 								console.log('Remote app started. Creating local connection');
// 								localBuffer = [];
// 								socket.id = id;
// 								terminatingSockets[socket.id] = socket;
// 								// if(!bufferedWriter[socket.id]){
// 								// 	bufferedWriter[socket.id] = new utils.bufferedWriter();
// 								// 	console.log('Creating buffered writer for <', socket.id, '>');
// 								// }
//
// 								// console.log('localSockets[',socket.id,'] got(Bytes):',data.byteLength);
// 								_startDstClient(socket.id);
// 							}
// 							else if(cmd === utils.disconnectedStr){
// 								if(localSockets[id]){
// 									localSockets[id].removeAllListeners();
// 									delete localSockets[id];
// 								}
// 							}
// 							else onData(rawData, id);
//
// 						}
// 						else{
// 							onData(rawData, id);
// 						}
// 					})
// 					socket.on('connect',()=>{
// 						console.log('terminatingSocket connect');
// 					})
// 					socket.on('end',()=>{
// 						console.log('terminatingSocket end');
// 						localBuffer = [];
// 						if(terminatingSockets[socket.id]){
// 							terminatingSockets[socket.id].removeAllListeners();
// 							delete terminatingSockets[socket.id];
// 						}
// 					})
// 					socket.on('drain',()=>{
// 						console.log('terminatingSocket <', socket.id,'> drain');
// 						socket.resume();
// 					})
// 					socket.on('close',(had_error)=>{
// 						console.log('terminatingSocket',socket.id,'close:', had_error);
// 						// bufferedWriter[socket.id] = null;
// 						localBuffer = [];
// 					})
// 				});
// 				let peerData = socket.getPeerCertificate();
// 				console.log('startTerminatingTcpServer:',socket.id, ' connected: ', peerData.subject.CN);
// 				if(allowedGroup){
// 					if(!peerData.subject.CN.includes('.'+allowedGroup+'.') || !peerData.subject.CN.endsWith('.beameio.net'))
// 						socket.end();
// 				}
// 				// if(terminatingSocket)
// 				// 	terminatingSocket.removeAllListeners();
//
// 			});
// 			srv.listen(targetPort, ()=>{
// 				resolve();
// 				console.log('Terminating TCP server listening on:',targetPort);
// 			});
// 			srv.on('resumeSession',(a,b)=>{
// 				console.log('resumeSession:',a,' b:',b);
// 			})
// 			//resolve();
// 		}
// 		catch (error) {
// 			reject(error);
// 		}
// 	});
// }


function startTerminatingHttpsServer(cred, targetPort) {
	let httpsServer;

	return new Promise((resolve, reject) => {

		try {

			const opts = {
				pfx: cred.PKCS12,
				passphrase: cred.PWD,
				requestCert: true,
				allowHalfOpen: true,
				rejectUnauthorized: true
			};
			 httpsServer = https.createServer(opts, (req, res) => {
				res.writeHead(200, {'Content-Type': 'text/plain'});
				res.end('ok');
			});
			const io = require('socket.io')(httpsServer);
			io.on('connection', (socket) =>{
				const onData = (rawData, id) => {
					if(!localSockets[id]){
						localBuffer = rawData;
						console.warn('Trying to reconnect local app');
						_startDstClient(id);
					}
					else {
						let written = localSockets[id] && localSockets[id].write(rawData);
						// console.log('terminatingSocket got (Bytes): ', rawData.byteLength,
						// 	' written:', written, '=>', rawData.length);
						if (!written && localSockets[id]) localSockets[id].pause();
					}
				}

				const setId = (cont) => {
					console.log('Building terminating server connection');
					cont();
				}
				setId(()=>{

					socket.on('error',(e)=>{
						console.error(e);
					})
					socket.on('command', (data)=>{
						let id = data.slice(0, utils.uuidLength);
						let cmd = data.slice(utils.uuidLength);
						if(cmd === utils.connectedStr){
							localBuffer = [];
							socket.id = id;
							terminatingSockets[socket.id] = socket;

							// console.log('localSockets[',socket.id,'] got(Bytes):',data.byteLength);
							_startDstClient(socket.id);
						}
						else if(cmd === utils.disconnectedStr){
							console.warn(id,' => Client app disconnected');
							localBuffer = [];
							if(localSockets[id]){
								localSockets[id].removeAllListeners();
								delete localSockets[id];
							}
						}
					})
					socket.on('data', (data)=>{

						let id = utils.arr2str(data.slice(0, utils.uuidLength));

						let rawData = data.slice(utils.uuidLength, data.byteLength);

						onData(rawData, id);

					})
					socket.on('connect',()=>{
						// console.log('terminatingSocket connect');
					})
					socket.on('end',()=>{
						// console.log('terminatingSocket end');
						localBuffer = [];
						if(terminatingSockets[socket.id]){
							terminatingSockets[socket.id].removeAllListeners();
							delete terminatingSockets[socket.id];
						}
					})
					socket.on('close',(had_error)=>{
						console.log('terminatingSocket',socket.id,'close:', had_error);
						localBuffer = [];
					})
				});
				let peerData = socket.client.request.client.getPeerCertificate();

				if(allowedGroup){
					if(!(peerData.subject.CN.includes('.'+allowedGroup+'.') || peerData.subject.CN.startsWith(allowedGroup)) || !peerData.subject.CN.endsWith('.beameio.net')){
						console.warn('Failed to verify certificate <',peerData.subject.CN,'> for: ', allowedGroup);
						socket.disconnect();
						return;
					}

				}

				console.log('TerminatingServer => ',socket.id, ' connected verified: ', peerData.subject.CN);
				socket.emit('startSession');

			});
			httpsServer.listen(targetPort, '127.0.0.1', ()=>{
				console.log('Terminating server started');//,httpsServer.address().port);
				resolve(httpsServer && httpsServer.address().port);
			});
		}
		catch (error) {
			reject(error);
		}
	});
}

module.exports = tunnel;
