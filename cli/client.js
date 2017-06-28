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
	let cert;

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
				cert = (new BeameStore).getCredential(fqdn);
				if (!cert) {
					reject(`Certificate for FQDN ${fqdn} not found`);
					return;
				}
				dst = _parseNetNode(dst);
				src = _parseNetNode(src);
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

				_startProxyClient({pfx: cert.PKCS12, passphrase: cert.PWD}, dst, src, file, () => {
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
	let srcClient, dstClient, srcClientConnected;

	const _startSrcClient = () => {
		let secureContext = tls.createSecureContext({pfx:secureOptions.pfx, passphrase:secureOptions.passphrase});
		let serverName = srcNode.host === 'localhost'?null:srcNode.host;
		let options = {host:srcNode.host, port: srcNode.port, secureContext:secureContext, servername:serverName};
		try{
			srcClient = tls.connect(options, function () {
				srcClientConnected = true;
				console.log('crs client connected ', srcClient.authorized ? 'authorized' : 'not authorized');
				//dstClient && dstClient.pipe(srcClient);
			});

			srcClient.on('data', function (data) {
				console.log('received(Bytes):', data.byteLength);
				process.nextTick(function () {
					dstClient && dstClient.write(data);
				});

				//dstClient.end();
			});

			srcClient.on('disconnect', function (data) {
				console.log('srcClient disconnect');
			});
			srcClient.on('error', (e)=>{
				console.error('srcClient: ',e);
			})
		}
		catch(e){
			console.error(e);
			//srcClientConnected?dstClient=null:console.error(e);
		}

	};

	const _startDstClient = () => {
		if(dstNode){
			let net = require('net');
			dstClient = new net.Socket;
			try{
				dstClient.connect(dstNode.port, dstNode.host, () => {
					console.log('destination client connected');

				});
				_startSrcClient();
				dstClient.on('data', (data)=>{
					try{
						console.log('dstClient got(Bytes):',data.byteLength);
						srcClient && srcClient.write(data);
					}
					catch(e){
						console.warn('dstClient/data:',e);
					}
				});

				dstClient.on('error', (e)=>{
					console.error('dstClient: ',e);
				});

			}
			catch (e){
				console.error(e);
			}

		}

	};
	_startDstClient();
}



module.exports = {
	make
};