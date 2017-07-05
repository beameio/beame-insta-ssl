"use strict";
const beame       = require('beame-sdk');
const ProxyClient = beame.ProxyClient;
const BeameLogger = beame.Logger;
const logger      = new BeameLogger("BIS-Tunnel");

const net = require('net');
const tls = require('tls');
const uuid = require('node-uuid');
const connectedStr = 'dstAppClientConnected';
let localSocket, localServer, terminatingSocketId, localPort;

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

	if (targetProto !== 'http' && targetProto !== 'https' && targetProto !== 'eehttp') {
		throw new Error("httpsTunnel: targetProto must be either http or https");
	}

		/** @type {Object} **/
		let serverCerts = cred.getHttpsServerOptions();


		let proxyClient;
		if(isTCPproxy && (isTCPproxy == true || isTCPproxy === 'true')) {
			localPort = targetPort;
			startTCPproxy(cred, 55333, function () {
				if(!proxyClient){
					proxyClient = new ProxyClient("HTTPS", cred, 'localhost', 55333, {}, null, serverCerts);
					proxyClient.start().then(() => {
						console.error(`Proxy client started on ${cred.fqdn}`);
					}).catch(e => {
						throw new Error(`Error starting HTTPS terminating proxy: ${e}`);
					});
				}
			})
		}
		else
		switch(targetProto) {
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

let terminatingSockets = [];

function startTCPproxy(cred, targetPort, cb) {

	// var writable = require('fs').createWriteStream('test.txt');

	startTerminatingTcpServer(cred, targetPort).then(()=>{
		cb();
	}).catch(e=>{
		console.error(e);
	});

}

const _startDstClient = (id) => {
	if(!localSocket && id){
		localSocket = new net.Socket({readable: true, writable:true, allowHalfOpen: true});

		try{
			// if(!srcClient)_startSrcClient();
			localSocket.connect(localPort, '127.0.0.1', (something) => {
				console.log('destination client connected:',something);
			});

			localSocket.on('data', (data)=>{

					let written = terminatingSockets[id] && terminatingSockets[id].write(data);
					console.log('localSocket got(Bytes):',data.byteLength, ' written:',written);
					if(!written)localSocket && localSocket.pause();

			});

			localSocket.on('close', had_error => {
				console.log('localSocket close: ', had_error);
			});

			localSocket.on('connect', () => {
				console.log('localSocket connect: ', localBuffer && localBuffer.length);

				if (localBuffer.length > 0) {
					if(localSocket.write(new Buffer(localBuffer))){
						localBuffer = [];
					}

				}
			});
			localSocket.on('lookup', () => {
				console.log('localSocket lookup');
			});
			localSocket.on('timeout', had_error => {
				console.log('localSocket timeout: ', had_error);
			});
			localSocket.on('end', had_error => {
				console.log('localSocket end: ', had_error);
			});
			localSocket.on('drain', () => {
				console.log('localSocket drain');
				localSocket.resume();
			});
			localSocket.on('error', (e)=>{
				console.error('localSocket: ',e);
				localSocket.removeAllListeners();
				localSocket.end();
				localSocket = null;
				// _startDstClient();
				// _startSrcClient();
			});

		}
		catch (e){
			console.error(e);
		}
	}
};

function startLocalServer(id, cb) {
	if(!localServer && id){
		terminatingSocketId = id;
		localServer = net.createServer({ allowHalfOpen: true }, (socket)=> {

			let initialData = new Buffer(localBuffer);
			console.log('local TCP socket connected:',initialData.length);
			if(localSocket){
				console.log('localSocket removing listeners');
				localSocket.removeAllListeners();
			}
			localSocket = socket;
			// localSocket.pipe(terminatingSockets[id]);
			// terminatingSockets[id].pipe(localSocket);
			socket.setTimeout(3000);
			socket.on('timeout', ()=>{
				console.log('LocalServer timeout');
				socket.end();
			})
			console.log('localServer connect: ', initialData.length);
			if (initialData.length > 1) {
				localBuffer = [];
				console.log('written:',socket.write(initialData));
			}

			socket.on('data', (data) => {
				let written = terminatingSockets[id] && terminatingSockets[id].write(data);
				if(!written)terminatingSockets[id] && terminatingSockets[id].pause();
				console.log('localSocket got(Bytes):', data.byteLength, ' written:',written);
				console.log('localSocket got(Bytes):', data.byteLength);
			});
			socket.on('end', () => {
				console.log('localSocket end');
				localBuffer = [];
			});
			socket.on('drain', () => {
				console.log('localSocket drain');
				socket.resume();
			});
			socket.on('close', () => {
				console.log('localSocket close');
				localBuffer = [];
				localSocket = null;
			});
			socket.on('error', (e) => {
				console.log('localSocket error ', e);
			});

		}).listen(localPort, () => {
			console.log(`TCP Server is listening on port ${localPort}`);
			cb();
		});
		localServer.on('error', (e)=>{
			console.error('localServer: ',e);
		})
	}
	else cb();
}

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
					socket.id = uuid.v4();
					console.log('Building terminating server connection:', socket.id);

					localBuffer = [];
					cont();
					// startLocalServer(socket.id, cont);
				}
				setId(()=>{
					terminatingSockets[socket.id] = socket;

					socket.on('error',(e)=>{
						console.error(e);
					})
					socket.on('data', (data)=>{
						console.log('terminatingSocket got (Bytes): ', data.byteLength);
						if((data.length == connectedStr.length) &&
							(new Buffer(data).toString('ascii') === connectedStr)){
							console.log('localSocket got(Bytes):',data.byteLength);
							_startDstClient(socket.id);
							// resolve();
						}
						else{
							if(!localSocket){
								localBuffer.push.apply(localBuffer,data);
							}
							else {
								let written = localSocket && localSocket.write(data);
								console.log('terminatingSocket got (Bytes): ', data.byteLength, ' ', data, ' written:', written);
								if (!written && localSocket) localSocket.pause();
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
