/**
 * Created by zenit1 on 26/02/2017.
 */
"use strict";
const beameSDK   = require('beame-sdk');
const BeameStore = beameSDK.BeameStore;
const CommonUtils = beameSDK.CommonUtils;

function tunnel(fqdn, hostname, dstHostPort, dstProto, callback) {
	let cred, fqdn, dstHost, dstPort, dstHostname, dstProto;


	const _doTunnel = () => {
		return new Promise((resolve, reject) => {
				cred = BeameStore.getCredential(fqdn);
				if (!cred) {
					reject(`Certificate for FQDN ${fqdn} not found`);
					return;
				}

				if (typeof dstHostPort == 'number') {
					dstHost = 'localhost';
					dstPort = dstHostPort;
				} else {
					dstHostPort = dstHostPort.split(':');
					dstHost     = dstHostPort[0];
					dstPort     = parseInt(dstHostPort[1]);
				}

				dstHostname = hostname || dstHost;

				const tunnelObj = require('../tunnel');

				console.log(`Starting tunnel https://${fqdn} -> ${dstProto}://${dstHost}:${dstPort}`);

				tunnelObj(fqdn, cert, dstHost, dstPort, dstProto, dstHostname);
			}
		);
	};

	CommonUtils.promise2callback(_doTunnel, callback);

}

module.exports = tunnel;