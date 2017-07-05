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

				_startTunnelClient({pfx: cert.PKCS12, passphrase: cert.PWD}, dst, src, file, () => {
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
let localBuffer = [], localServer;

function _startTunnelClient(secureOptions, dstNode, srcNode, toFile, cb) {
	let srcClient, dstSocket, srcClientConnected;

	const _startSrcClient = () => {
		let secureContext = tls.createSecureContext({pfx:secureOptions.pfx, passphrase:secureOptions.passphrase});
		let serverName = srcNode.host === 'localhost'?null:srcNode.host;
		let options = {host:srcNode.host, port: srcNode.port, secureContext:secureContext, servername:serverName};
		try{
			srcClient = tls.connect(options, () => {
				srcClientConnected = true;
				console.log('src client connected ', srcClient.authorized ? 'authorized' : 'not authorized');
				if(!dstSocket){
					startLocalServer(111, dstNode, ()=>{
					// _startDstClient(()=>{
						// dstSocket.pipe(srcClient);
						// srcClient.pipe(dstSocket);
					});
				}
			});
			console.log('src <-> dst');
			// dstSocket && srcClient.pipe(dstSocket).pipe(srcClient);

			srcClient.on('data',  (data) => {
				console.log('srcClient received', typeof data,'(Bytes):', data.byteLength);
				if(!dstSocket){
					localBuffer = localBuffer.push.apply(localBuffer, data);
				}
				// process.nextTick( () => {
				let written = dstSocket && dstSocket.write(data);
					console.log('srcClient written:', written);
					if(!written)srcClient.pause();
				// });

				//dstSocket.end();
			});

			srcClient.on('error', (e)=>{
				console.error('srcClient: ',e);
			});
			srcClient.on('close', had_error => {
				console.log('srcClient close: ', had_error);
				localBuffer = [];
			});

			srcClient.on('connect', had_error => {
				console.log('srcClient connect: ', had_error);
			});
			srcClient.on('lookup', () => {
				console.log('srcClient lookup');
			});
			srcClient.on('timeout', had_error => {
				console.log('srcClient timeout: ', had_error);
			});
			srcClient.on('end', had_error => {
				console.log('srcClient end: ', had_error);
				localBuffer = [];
			});
			srcClient.on('drain', () => {
				console.log('srcClient drain');
				srcClient.resume();
			});
		}
		catch(e){
			console.error(e);
			//srcClientConnected?dstSocket=null:console.error(e);
		}

	};

	const _startDstClient = (cb) => {
		if(dstNode){

			dstSocket = new net.Socket({readable: true, writable:true, allowHalfOpen: true});

			try{
				// if(!srcClient)_startSrcClient();
				dstSocket.connect(dstNode.port, dstNode.host, (something) => {
					console.log('destination client connected:',something);
					cb();
				});

				dstSocket.on('data', (data)=>{

					let written = srcClient && srcClient.write(data);
					console.log('dstSocket got(Bytes):',data.byteLength, ' written:',written);
					if(!written)dstSocket && dstSocket.pause();
					console.log('dstSocket got(Bytes):',data.byteLength);

				});

				dstSocket.on('close', had_error => {
					console.log('dstSocket close: ', had_error);
				});

				dstSocket.on('connect', had_error => {
					console.log('dstSocket connect: ', localBuffer && localBuffer.length);

					if (localBuffer.length > 0) {
						if(dstSocket.write(new Buffer(localBuffer))){
							localBuffer = [];
						}

					}
				});
				dstSocket.on('lookup', had_error => {
					console.log('dstSocket lookup: ', had_error);
				});
				dstSocket.on('timeout', had_error => {
					console.log('dstSocket timeout: ', had_error);
				});
				dstSocket.on('end', had_error => {
					console.log('dstSocket end: ', had_error);
				});
				dstSocket.on('drain', had_error => {
					console.log('dstSocket drain: ', had_error);
					dstSocket.resume();
				});
				dstSocket.on('error', (e)=>{
					console.error('dstSocket: ',e);
					dstSocket.removeAllListeners();
					dstSocket.end();
					dstSocket = null;
					// _startDstClient();
					// _startSrcClient();
				});

			}
			catch (e){
				console.error(e);
			}

		}

	};

	function startLocalServer(id, dst, cb) {
		if(!localServer && id){

			localServer = net.createServer({ allowHalfOpen: true }, (socket)=> {
				srcClient && srcClient.write(new Buffer('dstAppClientConnected'));
				let initialData = new Buffer(localBuffer);
				console.log('local TCP socket connected:',initialData.length);
				if(dstSocket){
					console.log('dstSocket removing listeners');
					dstSocket.removeAllListeners();
				}
				dstSocket = socket;
				// dstSocket.pipe(srcClient);
				// srcClient.pipe(dstSocket);
				// socket.setTimeout(3000);
				// socket.on('timeout', ()=>{
				// 	console.log('LocalServer timeout');
				// 	socket.end();
				// });
				console.log('localServer connect: ', initialData.length);
				if (initialData.length > 1) {
					localBuffer = [];
					console.log('written:',socket.write(initialData));
				}

				socket.on('data', (data) => {
					let written = srcClient && srcClient.write(data);
					if(!written)srcClient && srcClient.pause();
					console.log('dstSocket got(Bytes):', data.byteLength, ' written:',written);
					// console.log('dstSocket got(Bytes):', data.byteLength);
				});
				socket.on('end', () => {
					console.log('dstSocket end');
					localBuffer = [];
				});
				socket.on('drain', () => {
					console.log('dstSocket drain');
					socket.resume();
				});
				socket.on('close', () => {
					console.log('dstSocket close');
					localBuffer = [];
					dstSocket = null;
				});
				socket.on('error', (e) => {
					console.log('dstSocket error ', e);
				});

			}).listen(dst.port, () => {
				console.log(`TCP Server is listening on port ${dst.port}`);
				cb();
			});
			localServer.on('error', (e)=>{
				console.error('localServer: ',e);
			})
		}
		else cb();
	}
	_startSrcClient();
	// _startDstClient();
}



module.exports = {
	make
};