"use strict";
const beame       = require('beame-sdk');
const ProxyClient = beame.ProxyClient;
const BeameLogger = beame.Logger;
const logger      = new BeameLogger("BIS-Tunnel");

const net = require('net');
const tls = require('tls');
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
			startTCPproxy(targetPort, cred, 55333, function () {
				proxyClient = new ProxyClient("HTTPS", cred, 'localhost', 55333, {}, null, serverCerts);
				proxyClient.start().then(() => {
					console.error(`Proxy client started on ${cred.fqdn}`);
				}).catch(e => {
					throw new Error(`Error starting HTTPS terminating proxy: ${e}`);
				});
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
let localSocket;
function startTCPproxy(localPort, cred, targetPort, cb) {

	// var writable = require('fs').createWriteStream('test.txt');

	startTerminatingTcpServer(cred, targetPort).then(()=>{
		console.log('creating local TCP server on:', localPort);
		const opts = {
			pfx: cred.PKCS12,
			passphrase: cred.PWD,
			allowHalfOpen: true
		};
		// let localServer = tls.createServer(opts, (socket)=> {
		let localServer = net.createServer({ allowHalfOpen: true }, (socket)=> {

			console.log('local TCP socket connected');
			if(localSocket){
				console.log('localSocket removing listeners');
				localSocket.removeAllListeners();
			}

			localSocket = socket;
			socket.on('data', (data) => {

				console.log('got ', typeof data,' (Bytes):', data.byteLength);
				try{
					//terminatingSocket.write(data);
					let written = terminatingSocket && terminatingSocket.write(data);
					console.log('sent:',written);
					if(!written)terminatingSocket.pause();
				}
				catch (e){// client disconnected, here to manage data integrity
					console.log('terminatingSocket: ',e);
					terminatingSocket = null;
				}
			});
			socket.on('end', () => {
				console.log('localSocket end');
			});
			socket.on('drain', () => {
				console.log('localSocket drain');
				socket.resume();
			});
			socket.on('close', () => {
				console.log('localSocket close');
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
	}).catch(e=>{
		console.error(e);
	});


}

let terminatingSocket = null;
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
				console.log('Connected: ', socket.getPeerCertificate(true));
				if(terminatingSocket)
					terminatingSocket.removeAllListeners();
				terminatingSocket = socket;
				terminatingSocket.on('error',(e)=>{
					console.error(e);
				})
				terminatingSocket.on('data', (data)=>{
					let written = localSocket && localSocket.write(data);
					console.log('terminatingSocket got (Bytes): ', data.byteLength, ' ', data, ' written:', written);
					if(!written)localSocket.pause();
				})
				terminatingSocket.on('end',()=>{
					console.log('terminatingSocket end');
				})
				terminatingSocket.on('drain',()=>{
					console.log('terminatingSocket drain');
					terminatingSocket.resume();
				})
				terminatingSocket.on('close',(had_error)=>{
					console.log('terminatingSocket close:', had_error);
				})
			});
			srv.listen(targetPort, ()=>{
				console.log('Terminating TCP server listening on:',targetPort);
			});
			srv.on('resumeSession',(a,b)=>{
				console.log('resumeSession:',a,' b:',b);
			})
			resolve();
		}
		catch (error) {
			reject(error);
		}
	});
}

module.exports = tunnel;
