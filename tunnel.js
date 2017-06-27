"use strict";
const beame       = require('beame-sdk');
const ProxyClient = beame.ProxyClient;
const BeameLogger = beame.Logger;
const logger      = new BeameLogger("BIS-Tunnel");

const net = require('net');

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
			startTCPproxy(targetPort, serverCerts, 55333, function () {
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

function startTCPproxy(localPort, certs, targetPort, cb) {

	// var writable = require('fs').createWriteStream('test.txt');

	startTerminatingTcpServer(certs, targetPort).then(()=>{
		net.createServer(function (socket) {
			console.log('socket connected');
			socket.on('data', function(data) {
				var line = data.toString();
				console.log('got:', line);
				try{
					terminatingSocket && terminatingSocket.write(data);
				}
				catch (e){// client disconnected, here to manage data integrity
					terminatingSocket = null;
				}
			});
			socket.on('end', function() {
				// console.log('end');
			});
			socket.on('close', function() {
				// console.log('close');
			});
			socket.on('error', function(e) {
				console.log('error ', e);
			});

		}).listen(localPort, function() {
			console.log(`TCP Server is listening on port ${localPort}`);
			cb();
		});
	}).catch(e=>{
		console.error(e);
	});
}

let terminatingSocket = null;
function startTerminatingTcpServer(certs, targetPort) {
	return new Promise((resolve, reject) => {
		const tls = require('tls');
		try {
			const srv = tls.createServer(certs, (socket) =>{
				terminatingSocket = socket;
			});
			srv.listen(targetPort, ()=>{
				console.log('Terminating TCP server listening on:',targetPort);
			});
			resolve();
		}
		catch (error) {
			reject(error);
		}
	});
}

module.exports = tunnel;
