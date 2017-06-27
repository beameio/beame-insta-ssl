/**
 * Created by Alexz on 27/06/2017.
 */
"use strict";
const fs = require('fs');
const tls = require('tls');


const beameSDK   = require('beame-sdk');
const BeameStore = beameSDK.BeameStore;
const CommonUtils = beameSDK.CommonUtils;

function make(fqdn, dst, src, file, callback) {
	let cert, dstHost, dstPort, srcHost, srcPort, dstFile;

	const _parseNetNode = (data, host, port) => {
		if (typeof data === 'number') {
			host = 'localhost';
			port = data;
		} else {
			src     = data.split(':');
			host = data[0];
			port = parseInt(data[1]);
		}
	};

	const _doClient = () => {
		return new Promise((resolve, reject) => {
			try{
				cert = (new BeameStore).getCredential(fqdn);
				if (!cert) {
					reject(`Certificate for FQDN ${fqdn} not found`);
					return;
				}
				_parseNetNode(dst);
				_parseNetNode(src);
				// if (typeof dst === 'number') {
				// 	dstHost = 'localhost';
				// 	dstPort = dst;
				// } else {
				// 	dst     = dst.split(':');
				// 	dstHost = dst[0];
				// 	dstPort = parseInt(dst[1]);
				// }
				//
				// if (typeof src === 'number') {
				// 	srcHost = 'localhost';
				// 	srcPort = src;
				// } else {
				// 	src     = src.split(':');
				// 	srcHost = src[0];
				// 	srcPort = parseInt(src[1]);
				// }

				_startProxyClient({pfx: cert.PKCS12, passphrase: cert.PWD}, {host: dstHost, port: dstPort}, {addr: srcHost, port: srcPort}, file, () => {
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

function _startProxyClient(secureOptions, dstNode, srcNode, toFile, cb) {
	let srcClient, dstClient;

	const _startSrcClient = () => {
		let secureContext = tls.createSecureContext(secureOptions);
		let serverName = srcNode.host === 'localhost'?null:srcNode.host;

		srcClient = tls.connect({srcNode, secureContext:secureContext, servername:serverName}, function () {
			console.log('crs client connected ', srcClient.authorized ? 'authorized' : 'not authorized');
		});

		srcClient.on('data', function (data) {
			console.log('received(Bytes):', data.byteLength);
			try{
				dstClient && dstClient.write(data);
			}
			catch(e){
				dstClient = null;
			}
			// srcClient.end();
		});
	};

	const _startDstClient = () => {
		if(dstNode){
			let net = require('net');
			dstClient = new net.Socket;
			dstClient.connect(dstNode.port, dstNode.host, () => {
				console.log('destination client connected');
			})
		}
		_startSrcClient();
	};
	_startDstClient();
}



module.exports = {
	make
};