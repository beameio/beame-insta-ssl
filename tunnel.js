"use strict";
const beame       = require('beame-sdk');
const ProxyClient = beame.ProxyClient;

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
 * @param {String} fqdn
 * @param {Credential} creds
 * @param {String} targetHost
 * @param {Number} targetPort
 * @param {String} targetProto
 * @param {String} targetHostName
 */
function tunnel(fqdn, creds, targetHost, targetPort, targetProto, targetHostName) {

	if (targetProto != 'http' && targetProto != 'https' && targetProto != 'eehttp') {
		throw new Error("httpsTunnel: targetProto must be either http or https");
	}

	const edge_fqdn = creds.getMetadataKey('edge_fqdn');

	if (!edge_fqdn) {
		throw new Error(`FQDN ${fqdn} can not be used for tunnel - edge server address missing. Try running "beame-insta-ssl creds syncmeta" command.`);
	}

	/** @type {Object} **/
	let serverCerts = {
		key:  creds.getKey("PRIVATE_KEY"),
		cert: creds.getKey("P7B"),
		ca:   creds.getKey("CA")
	};

	switch(targetProto) {
	case 'http':
		startHttpsTerminatingProxy(serverCerts, targetHost, targetPort, targetHostName || targetHost)
			.then(terminatingProxyPort => {
				new ProxyClient("HTTPS", fqdn, edge_fqdn, 'localhost', terminatingProxyPort, {}, null, serverCerts);
			})
			.catch(e => {
				throw new Error(`Error starting HTTPS terminating proxy: ${e}`);
			});
		break;
	case 'https':
		new ProxyClient("HTTPS", fqdn, edge_fqdn, targetHost, targetPort, {}, null, serverCerts);
		break;
	case 'eehttp':
		console.error("WARNING: You are using unsupported protocol 'eehttp'. This feature will be broken in future.");
		new ProxyClient("HTTP", fqdn, edge_fqdn, targetHost, targetPort, {});
	}
}

module.exports = tunnel;
