"use strict";
const beame       = require('beame-sdk');
const ProxyClient = beame.ProxyClient;
const BeameLogger = beame.Logger;
const logger      = new BeameLogger("BIS-Tunnel");
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
 */
function tunnel(cred, targetHost, targetPort, targetProto, targetHostName) {

	if (targetProto !== 'http' && targetProto !== 'https' && targetProto !== 'eehttp') {
		throw new Error("httpsTunnel: targetProto must be either http or https");
	}

		/** @type {Object} **/
		let serverCerts = cred.getHttpsServerOptions();

		let proxyClient;

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

module.exports = tunnel;
