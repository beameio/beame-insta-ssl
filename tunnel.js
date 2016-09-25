"use strict";
const beame = require('beame-sdk');
const ProxyClient = beame.ProxyClient;

/**
 * @param {Object} certs
 * @param {String} targetHost
 * @param {Number} targetPort
 * @returns {Promise}
 */
function startHttpsTerminatingProxy(certs, targetHost, targetPort, targetHostName) {
	// certs - key, cert, ca
	return new Promise((resolve, reject) => {
		var httpProxy = require('http-proxy');
		const proxy = httpProxy.createProxyServer({
			target: {
				host: targetHost,
				port: targetPort
			},
			ssl: {
				key:  certs.key,
				cert: certs.cert
			},
			headers: {
				host: targetHostName
			}
		});
		proxy.listen(0, () => {
			// console.log(proxy._server.address().port);
			resolve(proxy._server.address().port);
		});
	});
}

/**
 * @param {String} fqdn
 * @param {Credential} creds
 * @param {String} targetHost
 * @param {Number} targetPort
 * @param {String} targetProto
 */
function httpsTunnel(fqdn, creds, targetHost, targetPort, targetProto, targetHostName) {

	if(targetProto != 'http' && targetProto != 'https') {
		throw new Error("httpsTunnel: targetProto must be either http or https");
	}

	const edge_fqdn = creds.getMetadataKey('edge_fqdn');

	if(!edge_fqdn){
		throw new Error(`FQDN ${fqdn} can not be used for tunnel - edge server address missing`);
	}

	/** @type {typeof ServerCertificates} **/
	var serverCerts = {
		key:  creds.PRIVATE_KEY,
		cert: creds.P7B,
		ca:   creds.CA
	};

	if(targetProto == 'http') {
		startHttpsTerminatingProxy(serverCerts, targetHost, targetPort, targetHostName || targetHost)
			.then(terminatingProxyPort => {
				new ProxyClient("HTTPS", fqdn,
					edge_fqdn, 'localhost',
					terminatingProxyPort, {},
					null, serverCerts);
			})
			.catch(e => {
				throw new Error(`Error starting HTTPS terminaring proxy: ${e}`);
			});
	} else {

		new ProxyClient("HTTPS", fqdn,
			edge_fqdn, targetHost,
			targetPort, {},
			null, serverCerts);
	}
}

module.exports = {
	httpsTunnel
};
