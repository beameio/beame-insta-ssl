/**
 * Created by Alexz on 10/07/2017.
 */
"use strict";
const beameSDK   = require('beame-sdk');
const BeameStore = beameSDK.BeameStore;
const CommonUtils = beameSDK.CommonUtils;
function make(fqdn, dst, src, file, callback) {
	let cert, secData = null;

	const _parseNetNode = (data) => {
		let host, port;
		if (typeof data === 'number') {
			host = 'localhost';
			port = data;
		} else {
			data     = data.split(':');
			host = data[0];
			port = parseInt(data[1]);
		}
		return {host: host, port: port};
	};

	const _doClient = () => {
		return new Promise((resolve, reject) => {
			try{
				if(fqdn){
					cert = (new BeameStore).getCredential(fqdn);
					if (!cert) {
						reject(`Certificate for FQDN ${fqdn} not found`);
						return;
					}
					secData = {pfx: cert.PKCS12, passphrase: cert.PWD, cert: cert.X509, key: cert.PRIVATE_KEY};
				}

				dst = _parseNetNode(dst);
				src = _parseNetNode(src);
				const tc = require('../lib/client');

				tc.startTunnelClient(secData, dst, src, file, () => {
						resolve('client OK');
					});
			}
			catch(e){
				reject(e);
			}

		});
	};

	CommonUtils.promise2callback(_doClient(), callback);
}

module.exports = {
	make
};