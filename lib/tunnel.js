"use strict";
const beame       = require('beame-sdk');
const ProxyClient = beame.ProxyClient;
const BeameLogger = beame.Logger;
const logger      = new BeameLogger("BIS-Tunnel");
const utils       = require('./utils');
const net = require('net');
const BeameStore  = beame.BeameStore;

const https = require('https');
let highAncestor = null, lowCredLevel = 99;
let localSockets = {}, terminatingSockets = {}, localPort;
let store;

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
				// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Proto
				headers: {
					host: targetHostName,
					'X-Forwarded-Proto': 'https',
					'Front-End-Https': 'on',
					'X-Forwarded-Protocol': 'https',
					'X-Forwarded-Ssl': 'on',
					'X-Url-Scheme': 'https'
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
 * @param {String} highestFqdn
 * @param {int} trustDepth
 */
function tunnel(cred, targetHost, targetPort, targetProto, targetHostName, highestFqdn, trustDepth, noAuth) {

	if (targetProto !== 'http' && targetProto !== 'https' && targetProto !== 'eehttp' && targetProto !== 'tcp') {
		throw new Error("httpsTunnel: targetProto must be either http, https, eehttp or tcp");
	}

	if(!noAuth && highestFqdn){
		highAncestor = highestFqdn;
		store = new BeameStore();
		if(Number.isInteger(trustDepth))lowCredLevel = trustDepth;
	}
	/** @type {Object} **/
	let serverCerts = cred.getHttpsServerOptions();

	let proxyClient;

	switch(targetProto) {
		case 'tcp':
			localPort = targetPort;
			startTCPproxy(cred, targetHost, noAuth, (port) => {
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
			});
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


function startTCPproxy(cred, targetHostName, noAuth, cb) {

	startTerminatingHttpsServer(cred, targetHostName, noAuth).then((port)=>{
		cb(port);
	}).catch(e=>{
		console.error(e);
		cb(0);
	});

}

const _startDstClient = (id, targetHostName) => {
	const destroyLocalSocket = (id) => {
		if(localSockets[id]){
			localSockets[id].removeAllListeners();
			localSockets[id].destroy();
			delete localSockets[id];
		}
	};
	const onSocketEnd = (id) => {
		console.log('Local connection <',id,'> ended');
		if(terminatingSockets[id]){
			let cmd = id+utils.disconnectedStr;
			console.log(id,' => local app disconnected');
			terminatingSockets[id].emit('command',cmd);
		}
		destroyLocalSocket(id);
	};

	if(id && !localSockets[id]){
		localSockets[id] = new net.Socket({readable: true, writable:true, allowHalfOpen: true});

		try{

			localSockets[id].connect(localPort, targetHostName, () => {
				console.log('Host app connected:',id);
				if(!terminatingSockets[id]){
					localSockets[id].destroy();
					delete localSockets[id];
				}
			});

			localSockets[id].on('data', (data)=>{
				let rawData = utils.appendBuffer(utils.str2arr(id), data);
				terminatingSockets[id] && terminatingSockets[id].emit('data', new Buffer(rawData));

			});

			localSockets[id].on('close', had_error => {
				// console.log('localSockets[',id,'] close: ', had_error);
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
			localSockets[id].on('timeout', () => {
				console.warn('localSockets[',id,'] timeout: ');
			});
			localSockets[id].on('end', had_error => {
				if(had_error) logger.error(`localSockets[',id,'] end:, ${had_error}`);
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


let localBuffer = [];


function startTerminatingHttpsServer(cred, targetHostName, noAuth) {
	let httpsServer;
	let hasAuth = !noAuth;
	return new Promise((resolve, reject) => {

		try {

			const opts = {
				pfx: cred.PKCS12,
				passphrase: cred.PWD,
				requestCert: hasAuth,
				allowHalfOpen: true,
				rejectUnauthorized: hasAuth
			};
			 httpsServer = https.createServer(opts, (req, res) => {
				res.writeHead(200, {'Content-Type': 'text/plain'});
				res.end('ok');
			});
			const io = require('socket.io')(httpsServer);
			//noinspection JSUnresolvedFunction
			io.on('connection', (socket) =>{
				const onData = (rawData, id) => {
					if(!localSockets[id]){
						localBuffer = rawData;
						console.warn('Trying to reconnect local app');
						_startDstClient(id, targetHostName);
					}
					else {
						let written = localSockets[id] && localSockets[id].write(rawData);
						// console.log('terminatingSocket got (Bytes): ', rawData.byteLength,
						// 	' written:', written, '=>', rawData.length);
						if (!written && localSockets[id]) {
							// console.log('localSockets[',id,'] pause');
							localSockets[id].pause();
						}
					}
				};

				const onEnd = socket => {
					localBuffer = [];
					if(terminatingSockets[socket.id]){
						terminatingSockets[socket.id].removeAllListeners();
						delete terminatingSockets[socket.id];
					}
				};

				const initSocket = (socket) => {
					console.log('Building terminating server connection');

					socket.on('error',(e)=>{
						console.error(e);
					});

					socket.on('command', (data)=>{
						let id = data.slice(0, utils.uuidLength);
						let cmd = data.slice(utils.uuidLength);
						if(cmd === utils.connectedStr){
							console.log(id,' => Client app connected');
							localBuffer = [];
							socket.id = id;
							terminatingSockets[socket.id] = socket;

							_startDstClient(socket.id, targetHostName);
						}
						else if(cmd === utils.disconnectedStr){
							console.warn(id,' => Client app disconnected');
							localBuffer = [];
							if(localSockets[id]){
								localSockets[id].removeAllListeners();
								localSockets[id].destroy();
								delete localSockets[id];
							}
						}
					});



					socket.on('data', (data)=>{

						let id = utils.arr2str(data.slice(0, utils.uuidLength));

						let rawData = data.slice(utils.uuidLength, data.byteLength);

						onData(rawData, id);

					});
					socket.on('connect',()=>{
						// console.log('terminatingSocket connect');
					});
					socket.on('end',()=>{
						// console.log('terminatingSocket end');
						onEnd(socket);
					});
					socket.on('close',(had_error)=>{
						console.log('terminatingSocket',socket.id,'close:', had_error);
						onEnd(socket);
						localBuffer = [];
					});
					socket.emit('startSession');
				};

				const onClientAllowed = (client) => {
					console.log('TerminatingServer => ',socket.id, ' connected verified: ', client?client:'unauthenticated');
					initSocket(socket);
				};

				//noinspection JSUnresolvedVariable,JSUnresolvedFunction
				let cn = null;
				if(hasAuth){
					let peerData = socket.client.request.client.getPeerCertificate();
					cn = peerData.subject.CN;
				}

				if(highAncestor && hasAuth){
					store.verifyAncestry(cred.fqdn, cn, highAncestor, lowCredLevel, (error, related) => {
						if(!related) {
							console.warn('Failed to verify certificate <', cn, '> for: ', cred.fqdn);
							socket.emit('_end_','Client certificate validation failed');
							socket.disconnect();
						}
						else onClientAllowed(cn);
					});
				}
				else onClientAllowed(cn);

			});
			httpsServer.listen(0, '127.0.0.1', ()=>{
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
