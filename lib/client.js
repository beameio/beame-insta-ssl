/**
 * Created by Alexz on 27/06/2017.
 */
"use strict";

const net = require('net');
const utils = require('./utils');
const io          = require('socket.io-client');

let dstSockets = {}, localServer;//, validatingHost = null;

function startTunnelClient(secureOptions, dstNode, srcNode, toFile, cb) {
	let srcClient;

	const _restartSioClient = () => {
		if(srcClient){
			srcClient.removeAllListeners();
			srcClient = null;
		}
		_startSioClient();
	};

	const _startSioClient = () => {

		let host = srcNode.host.includes('https://')?srcNode.host:'https://'+srcNode.host;
		let sio_options = {multiplex:false, cert: secureOptions.cert, key:secureOptions.key};
		try{
			srcClient = io.connect(host, sio_options);
			// console.log('_startSioClient');
			srcClient.on('startSession', ()=>{
				// console.log('startSession received');
			});
			srcClient.on('data',  (data) => {
				let id = utils.arr2str(data.slice(0, utils.uuidLength));

				let rawData = data.slice(utils.uuidLength, data.byteLength);
				if(dstSockets[id]){
					let written = dstSockets[id].write(rawData);
					if(!written){
						dstSockets[id].pause();
						//console.warn(id, '=> failed to write:', rawData.byteLength);
					}
				}
			});

			srcClient.on('error', (e)=>{
				console.error('srcClient: ',e);
			});

			srcClient.on('_end_', (msg)=>{
				console.error('Connection terminated:',msg);
				process.exit(1);
			});

			srcClient.on('command', (data)=>{
				let id = data.slice(0, utils.uuidLength);
				let cmd = data.slice(utils.uuidLength);
				switch(cmd){
					case utils.hostAppFailedStr:
						console.warn('Host application not started (fix on far end of the tunnel)');
						break;
					case utils.disconnectedStr:
						console.warn('Host application stopped on remote end of the tunnel');
						stopLocalServer(id);
						break;
				}

			});

			srcClient.on('close', had_error => {
				console.log('srcClient close: ', had_error);
				srcClient.removeAllListeners();
				srcClient = null;
				if(had_error)startTunnelClient();
			});

			srcClient.on('disconnect', () => {
				console.log('srcClient disconnected from: ', host);
				stopLocalServer();
			});

			srcClient.on('connect', () => {
				console.log('srcClient connected to: ',host);
				startLocalServer(dstNode, ()=>{

				});
			});
			srcClient.on('end', () => {
				console.log('srcClient end');
				srcClient.removeAllListeners();
				process.exit();
				// localBuffer = [];
			});

		}
		catch(e){
			console.error(e);
		}

	};
	const clearLocalServer = () => {
		if(localServer){
			console.warn('Trying to close local server');
			localServer.close();
			// (e)=>{
			// 	if(e)
			// 		console.warn('LocalServer:', e);
			// 	else
			// 		console.warn('local server closed');
			// 	localServer = null;
			// });
			localServer = null;
			_restartSioClient();
		}
	};
	const clearOutSocket = (id) => {
		if(id && dstSockets[id]){
			dstSockets[id].removeAllListeners();
			dstSockets[id].destroy();
			delete dstSockets[id];
		}
	};
	function stopLocalServer(id) {

		if(!dstSockets || Object.keys(dstSockets).length < 1){
			clearLocalServer();
		}
		else{

			if(id)
				clearOutSocket(id);
			else{
				let keys = Object.keys(dstSockets);
				for(let i=0; i<keys.length; i++){
					clearOutSocket(keys[i]);
				}
			}
			if(!dstSockets || Object.keys(dstSockets).length<1){
				clearLocalServer();
			}
		}
	}


	function startLocalServer(dst, cb) {

		let onAppExit = (id, msg) => {
			console.log(msg);
			let cmd = id+utils.disconnectedStr;
			console.log(id,' => destination app disconnected');
			srcClient && srcClient.emit('command',cmd);
			stopLocalServer(id);
		};

		if(!localServer){
			let safetyCount = 20;
			localServer = net.createServer({ allowHalfOpen: true }, (socket)=> {
				let id = utils.getID();
				socket.id = id;
				let cmd = id+utils.connectedStr;
				console.log(id,' => client app connected');
				srcClient.emit('command',cmd);

				// if(dstSockets[id]){
				// 	clearOutSocket(id);
				// }
				dstSockets[id] = socket;

				console.log('localServer connect:',id);

				socket.on('data', (data) => {

					let rawData = utils.appendBuffer(utils.str2arr(socket.id), data);

					srcClient && srcClient.emit('data', new Buffer(rawData));

				});
				socket.on('end', () => {
					onAppExit(socket.id, 'dstSocket end');
					// localBuffer = [];
				});
				socket.on('drain', () => {
					// console.log('dstSocket drain');
					socket.resume();
				});
				socket.on('close', () => {
					onAppExit(socket.id, 'dstSocket close');
				});
				socket.on('error', (e) => {
					console.log('dstSocket error ', e);
				});

				}).listen(dst.port, '127.0.0.1', () => {
				console.log(`TCP Server is listening on port ${dst.port}`);
				cb();
			});
			localServer.on('error', (e)=>{
				if(e.message.includes('EADDRINUSE')){
					console.error('Cannot start local tunnel => ',e.message);
				}
				else console.error('localServer: ',e);
			});
		}
		else cb();
	}
	_startSioClient();
}

module.exports = {
	startTunnelClient
};