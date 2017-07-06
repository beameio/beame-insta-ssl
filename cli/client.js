/**
 * Created by Alexz on 27/06/2017.
 */
"use strict";
const fs = require('fs');
const tls = require('tls');
const net = require('net');
const uuid = require('node-uuid');
const beameSDK   = require('beame-sdk');
const BeameStore = beameSDK.BeameStore;
const CommonUtils = beameSDK.CommonUtils;
const uuidLength = uuid.v4().length;
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
let dstSockets = [], localServer;

function _startTunnelClient(secureOptions, dstNode, srcNode, toFile, cb) {
	let srcClient;

	const _startSrcClient = () => {
		let secureContext = tls.createSecureContext({pfx:secureOptions.pfx, passphrase:secureOptions.passphrase});
		let serverName = srcNode.host === 'localhost'?null:srcNode.host;
		let options = {host:srcNode.host, port: srcNode.port, secureContext:secureContext, servername:serverName};
		try{
			srcClient = tls.connect(options, () => {

				console.log('src client connected ', srcClient.authorized ? 'authorized' : 'not authorized');

				startLocalServer(dstNode, ()=>{
					// dstSocket.pipe(srcClient);
					// srcClient.pipe(dstSocket);
				});
			});
			console.log('src <-> dst');
			// dstSocket && srcClient.pipe(dstSocket).pipe(srcClient);

			srcClient.on('data',  (data) => {
				let id = arr2str(data.slice(0, uuidLength));

				let rawData = data.slice(uuidLength, data.byteLength);
				console.log('srcClient received (Bytes): ', data.byteLength, ' from: ',id, '=>', rawData.length);
				// if(!dstSockets[id]){
				// 	localBuffer = localBuffer.push.apply(localBuffer, rawData);
				// }
				// process.nextTick( () => {
				let written = dstSockets[id] && dstSockets[id].write(rawData);
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
				srcClient.removeAllListeners();
				if(had_error)_startSrcClient();
				// localBuffer = [];
			});

			srcClient.on('connect', () => {
				console.log('srcClient connect');
			});
			srcClient.on('lookup', () => {
				console.log('srcClient lookup');
			});
			srcClient.on('timeout', had_error => {
				console.log('srcClient timeout: ', had_error);
			});
			srcClient.on('end', had_error => {
				console.log('srcClient end: ', had_error);
				// localBuffer = [];
			});
			srcClient.on('drain', () => {
				console.log('srcClient drain');
				srcClient.resume();
			});
		}
		catch(e){
			console.error(e);
		}

	};

	function startLocalServer(dst, cb) {
		if(!localServer){

			localServer = net.createServer({ allowHalfOpen: true }, (socket)=> {
				let id = uuid.v4();//String("ZZZZZZZZZZZZZZZ" + socket.localAddress + ":" + socket.localPort).slice(-23);
				socket.id = id;
				srcClient && srcClient.write(new Buffer(id+'dstAppClientConnected'));


				if(dstSockets[id]){
					dstSockets[id].removeAllListeners();
					dstSockets[id].end();
				}
				dstSockets[id] = socket;
				// dstSocket.pipe(srcClient);
				// srcClient.pipe(dstSocket);
				// socket.setTimeout(3000);
				// socket.on('timeout', ()=>{
				// 	console.log('LocalServer timeout');
				// 	socket.end();
				// });
				console.log('localServer connect:',id);
				// if (initialData.length > 1) {
				// 	// localBuffer = [];
				// 	console.log('written:',socket.write(initialData));
				// }

				socket.on('data', (data) => {
					let aaa = str2arr(socket.id);
					let bbb = arr2str(aaa);

					let rawData = appendBuffer(str2arr(socket.id), data);

					aaa = rawData.slice(0, uuidLength);
					bbb = arr2str(aaa);
					let written = srcClient && srcClient.write(new Buffer(rawData));
					if(!written)srcClient && srcClient.pause();
					console.log('dstSocket <',socket.id,'> got(Bytes):', data.byteLength, ' written:',rawData.length,':',written);
					// console.log('dstSocket got(Bytes):', data.byteLength);
				});
				socket.on('end', () => {
					console.log('dstSocket end');
					// localBuffer = [];
				});
				socket.on('drain', () => {
					console.log('dstSocket drain');
					socket.resume();
				});
				socket.on('close', () => {
					console.log('dstSocket close');
					// localBuffer = [];
					dstSockets[socket.id].removeAllListeners();
					dstSockets[socket.id] = null;
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
}

function str2arr(str) {
	let arr = new Uint8Array(str.length);
	for (let i = 0, strLen = str.length; i < strLen; i++) {
		arr[i] = str.charCodeAt(i);
	}
	return arr;
}
function arr2str(buffer) {
	let str = '',bytes  = new Uint8Array(buffer),len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		str += String.fromCharCode(bytes[i]);
	}
	return str;
}

function appendBuffer (buffer1, buffer2) {
	let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
	tmp.set(new Uint8Array(buffer1), 0);
	tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
	return tmp;
}

module.exports = {
	make
};