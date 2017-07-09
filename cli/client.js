/**
 * Created by Alexz on 27/06/2017.
 */
"use strict";
const fs = require('fs');
const tls = require('tls');
const net = require('net');
const utils = require('../lib/utils');
const beameSDK   = require('beame-sdk');
const BeameStore = beameSDK.BeameStore;
const CommonUtils = beameSDK.CommonUtils;
let bufferedWriter = {}, bufferedReader = {};

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
	const onData = (rawData, id) => {
		let written = dstSockets[id] && dstSockets[id].write(rawData);
		// console.log('srcClient written:', written);
		if(!written){
			srcClient.pause();
		}
	};
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
			// console.log('src <-> dst');


			srcClient.on('data',  (data) => {
				let id = utils.arr2str(data.slice(0, utils.uuidLength));
				if(bufferedReader[id]){
					let frame = bufferedReader[id].buildFrame(data);
					console.log('frame:', frame.finished);
					if(frame.finished){
						if(frame.data)
							onData(frame.data, id);
						else
							console.log('Got command:',frame.data.toString());
						bufferedReader[id].resetReader();
					}
				}
				else{
					let rawData = data.slice(utils.uuidLength, data.byteLength);
					onData(rawData, id);
				}
			});

			srcClient.on('error', (e)=>{
				console.error('srcClient: ',e);
			});

			srcClient.on('close', had_error => {
				console.log('srcClient close: ', had_error);
				srcClient.removeAllListeners();
				if(had_error)_startSrcClient();
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
			srcClient.on('end', () => {
				console.log('srcClient end');
				srcClient.removeAllListeners();
				process.exit();
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
		let onAppExit = (id, msg) => {
			console.log(msg);
			dstSockets[id].removeAllListeners();
			dstSockets[id] = null;
			let cmd = id+utils.disconnectedStr;
			console.log('Command: ',cmd);
			if(bufferedWriter[id])
				bufferedWriter[id].writeData(new Buffer(cmd), srcClient);
			else
				srcClient.write(new Buffer(cmd));
		};

		if(!localServer){

			localServer = net.createServer({ allowHalfOpen: true }, (socket)=> {
				let id = utils.getID();
				socket.id = id;
				if(srcClient) srcClient.id = id;
				let cmd = utils.connectedStr;
				if(!bufferedWriter[id]){
					bufferedWriter[id] = new utils.bufferedWriter();
					console.log('Creating buffered writer for <', id, '>');
				}
				if(!bufferedReader[id])
					bufferedReader[id] = new utils.bufferedReader(id);
				console.log('Command: ',cmd);
				if(bufferedWriter[id]){
					bufferedWriter[id].writeData(new Buffer(cmd), srcClient);
				}
				else
					srcClient.write(new Buffer(id+cmd));

				if(dstSockets[id]){
					dstSockets[id].removeAllListeners();
					dstSockets[id].end();
				}
				dstSockets[id] = socket;
				// dstSocket.pipe(srcClient);
				// srcClient.pipe(dstSocket);
				// socket.setTimeout(3000);

				console.log('localServer connect:',id);


				socket.on('data', (data) => {
					if(bufferedWriter[id]){
						bufferedWriter[id].writeData(new Buffer(data), srcClient);
					}
					else{
						let rawData = utils.appendBuffer(utils.str2arr(socket.id), data);

						let written = srcClient && srcClient.write(new Buffer(rawData));
						if(!written){
							console.log('srcClient pause');
							srcClient && srcClient.pause();
							dstSockets[socket.id] && dstSockets[socket.id].pause();
						}
					}

					// console.log('dstSocket <',socket.id,'> got(Bytes):', data.byteLength, ' written:',rawData.length,':',written);
					// console.log('dstSocket got(Bytes):', data.byteLength);
				});
				socket.on('end', () => {
					onAppExit(socket.id, 'dstSocket end');
					// localBuffer = [];
				});
				socket.on('drain', () => {
					console.log('dstSocket drain');
					socket.resume();
				});
				socket.on('close', () => {
					onAppExit(socket.id, 'dstSocket close');
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


module.exports = {
	make
};