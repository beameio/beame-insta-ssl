/**
 * Created by Alexz on 27/06/2017.
 */
"use strict";
const fs = require('fs');
const tls = require('tls');
const net = require('net');

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
			console.log('src <-> dst');
			// dstClient && srcClient.pipe(dstClient).pipe(srcClient);

			srcClient.on('data', function (data) {
				console.log('received', typeof data,'(Bytes):', data.byteLength);
				// process.nextTick( () => {
				let written = dstClient && dstClient.write(data);
					console.log('srcClient written:', written);
					if(!written)srcClient.pause();
				// });

				//dstClient.end();
			});

			srcClient.on('error', (e)=>{
				console.error('srcClient: ',e);
			});
			srcClient.on('close', had_error => {
				console.log('srcClient close: ', had_error);
			});

			srcClient.on('connect', had_error => {
				console.log('srcClient connect: ', had_error);
			});
			srcClient.on('lookup', had_error => {
				console.log('srcClient lookup: ', had_error);
			});
			srcClient.on('timeout', had_error => {
				console.log('srcClient timeout: ', had_error);
			});
			srcClient.on('end', had_error => {
				console.log('srcClient end: ', had_error);
			});
			srcClient.on('drain', had_error => {
				console.log('srcClient drain: ', had_error);
				srcClient.resume();
			});
		}
		catch(e){
			console.error(e);
			//srcClientConnected?dstClient=null:console.error(e);
		}

	};

	const _startDstClient = () => {
		if(dstNode){

			dstClient = new net.Socket({readable: true, writable:true, allowHalfOpen: true});
			if(!srcClient)_startSrcClient();
			try{
				dstClient.connect(dstNode.port, dstNode.host, (something) => {
					console.log('destination client connected:',something);

				});

				dstClient.on('data', (data)=>{
					try{
						let written = srcClient && srcClient.write(data);
						console.log('dstClient got(Bytes):',data.byteLength, ' written:',written);
						if(!written)dstClient.pause();
					}
					catch(e){
						console.warn('dstClient/data:',e);
					}
				});

				dstClient.on('close', had_error => {
					console.log('dstClient close: ', had_error);
				});

				dstClient.on('connect', had_error => {
					console.log('dstClient connect: ', had_error);
				});
				dstClient.on('lookup', had_error => {
					console.log('dstClient lookup: ', had_error);
				});
				dstClient.on('timeout', had_error => {
					console.log('dstClient timeout: ', had_error);
				});
				dstClient.on('end', had_error => {
					console.log('dstClient end: ', had_error);
				});
				dstClient.on('drain', had_error => {
					console.log('dstClient drain: ', had_error);
					dstClient.resume();
				});
				dstClient.on('error', (e)=>{
					console.error('dstClient: ',e);
					dstClient.removeAllListeners();
					dstClient.end();
					dstClient = null;
					_startDstClient();
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