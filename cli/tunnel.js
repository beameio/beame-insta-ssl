/**
 * Created by zenit1 on 26/02/2017.
 */
"use strict";
const beameSDK   = require('beame-sdk');
const BeameStore = beameSDK.BeameStore;
const CommonUtils = beameSDK.CommonUtils;

function tunnel(fqdn, hostname, dst, proto, callback) {
	let cred, dstHost, dstPort, dstHostname;

	const _doTunnel = () => {
		return new Promise((resolve, reject) => {
				cred = BeameStore.getCredential(fqdn);
				if (!cred) {
					reject(`Certificate for FQDN ${fqdn} not found`);
					return;
				}

				if (typeof dst == 'number') {
					dstHost = 'localhost';
					dstPort = dst;
				} else {
					dst     = dst.split(':');
					dstHost = dst[0];
					dstPort = parseInt(dst[1]);
				}

				dstHostname = hostname || dstHost;

				const tunnelObj = require('../tunnel');

				console.log(`Starting tunnel https://${fqdn} -> ${proto}://${dstHost}:${dstPort}`);

				tunnelObj(fqdn, cert, dstHost, dstPort, proto, dstHostname);
			}
		);
	};

	CommonUtils.promise2callback(_doTunnel, callback);

}

module.exports = {
	tunnel
};
