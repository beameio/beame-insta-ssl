/**
 * Created by Alexz on 06/07/2017.
 */
"use strict";
const uuid = require('node-uuid');
const uuidLength = uuid.v4().length;

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

function getID() {
	return uuid.v4();
}

function appendBuffer (buffer1, buffer2) {
	let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
	tmp.set(new Uint8Array(buffer1), 0);
	tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
	return tmp;
}

// class bufferedWriter {
//
// 	constructor() {
// 		this._writable = true;
// 		this._fifo = require('fifo')();
// 		this._mutex = false;
// 	}
//
// 	writeData(data, socket){
// 		if(this._writable)
// 			this._writable = socket.write(data);
// 		else{
// 			console.log('Buffering <',socket.id,'> ',this._fifo.length);
// 			this._fifo.push(data);
// 		}
// 	}
//
// 	drainData(socket){
// 		console.log('draining <',socket.id,'> ',this._nChunks);
// 		let tmpWritable = false;
// 		let safetyTimer;
//
// 		while(this._fifo.length){
// 			safetyTimer = 1000;
// 			tmpWritable = socket.write(this._fifo.shift);
// 			this._writable = tmpWritable && (this._fifo.length < 1);
// 			while(!tmpWritable && safetyTimer--){
// 				setTimeout(()=>{
// 					// nop();
// 				},0.001)
// 			}
// 		}
// 	}
// }

module.exports = {
	uuidLength,
	appendBuffer,
	arr2str,
	str2arr,
	getID
};