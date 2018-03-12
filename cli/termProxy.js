/**
 * Created by zenit1 on 26/02/2017.
 */
"use strict";
const beameSDK   = require('beame-sdk');
const BeameStore = beameSDK.BeameStore;
const CommonUtils = beameSDK.CommonUtils;

function start(fqdn, listenPort, dst, hostname, proto, highestFqdn, trustDepth, noAuth, callback) {
	let cert, dstHost, dstPort, dstHostname;

	if(typeof trustDepth !== 'undefined' && trustDepth!= null){
		if(!Number.isInteger(trustDepth) || trustDepth<=0){
			console.error('trustDepth should be >= 1 (omit it to allow infinite depth)');
			process.exit(1);
		}
	}
	const _doTerminatingProxy = () => {
		return new Promise((resolve, reject) => {
				cert = (new BeameStore).getCredential(fqdn);
				if (!cert) {
					reject(`Certificate for FQDN ${fqdn} not found`);
					return;
				}

				if (typeof dst === 'number') {
					dstHost = 'localhost';
					dstPort = dst;
				} else {
					dst     = dst.split(':');
					dstHost = dst[0];
					dstPort = parseInt(dst[1]);
				}

				dstHostname = hostname || fqdn;

				const proxyObj = require('../lib/termProxy');

				console.log(`Starting terminating proxy https://${fqdn} -> ${proto}://${dstHost}:${dstPort}`);

				proxyObj(cert, listenPort, dstHost, dstPort, dstHostname, highestFqdn || cert.fqdn, trustDepth,
						!!(noAuth && (noAuth === 'true' || noAuth == true)));
			}
		);
	};

	CommonUtils.promise2callback(_doTerminatingProxy(), callback);

}

module.exports = {
	start
};
