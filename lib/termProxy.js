"use strict";
const beame       = require('beame-sdk');
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
function startHttpsTerminatingProxy(certs, proxyPort, targetHost, targetPort, targetHostName) {
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
			proxy.listen(proxyPort, () => {
				// console.log(proxy._server.address().port);
				resolve(proxy._server.address().port);
			});
		}
		catch (error) {
			reject(error);
		}
	});
}

module.exports = startHttpsTerminatingProxy;
