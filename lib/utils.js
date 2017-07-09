/**
 * Created by Alexz on 06/07/2017.
 */
"use strict";
const bufferDepth = 5;//99999
const uuid = require('node-uuid');
const uuidLength = uuid.v4().length;
const headerLength = uuidLength + bufferDepth;
const connectedStr      = 'dstAppClientConnnnnected';
const disconnectedStr   = 'dstAppClientDisconnected';
const commands = [connectedStr, disconnectedStr];
const commandLength     = connectedStr.length;
const chunkSize = 9745;
const writePeriod = 0.00001;
const cleanPeriod = 0.0001;


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
	if(!buffer1 || buffer1.length<1)return buffer2;
	if(!buffer2 || buffer2.length<1)return buffer1;
	let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
	tmp.set(new Uint8Array(buffer1), 0);
	tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
	return tmp;
}

class writeToTunnel{
	constructor(data, socket){
		this._data = data;
		this._socket = socket;
		this._fifoOut = require('fifo')();
		this.startWriter();
	}

	getOutBufferState(){
		return this._fifoOut.length;
	}

	adjustOutputBuffer(n, data){
		try{
			let index = str2arr(String(n.toString()+'.00000').slice(0, bufferDepth));
			let outCounter = new Buffer(appendBuffer(index,data));
			return outCounter;
		}
		catch(e){
			console.warn('Fuck!:',e);
			return new Buffer('00000');
		}
	}

	initWriter(data){
		let nChunks = parseInt(data.byteLength / chunkSize);
		let lastChunk = data.byteLength % chunkSize;
		let count = nChunks+1;
		let step = 0;
		let dataChunk;
		console.log('Sending ',count, ' chunks of ',data.byteLength);
		while(count > 0){
			count -= 1;
			let offset = step*chunkSize;
			if(count < 1 && (lastChunk > 0)){
				dataChunk = data.slice(offset);
				this._fifoOut.push(this.adjustOutputBuffer(count, dataChunk));
			}
			else{
				dataChunk = data.slice(offset, offset+chunkSize);
				this._fifoOut.push(this.adjustOutputBuffer(count, dataChunk));
			}
			step += 1;
		}
	}

	startWriter(){
		console.log('Building writer for:', this._socket.id,' data:', this._data.length);
		this.initWriter(this._data);
		this._writer = setInterval(()=>{
			if(this._fifoOut.length > 0){
				let data = this._fifoOut.shift();
				if(data && this._socket) {
					let out = appendBuffer(str2arr(this._socket.id), data);
					this._writable = this._socket.write(new Buffer(out));
					if(!this._writable) {
						console.log('Writer paused:',this._socket.id);
						this._socket.pause();//handle drain as usual
					}
				}
			}
		}, writePeriod);
	}
}

class bufferedWriter {

	constructor() {
		this._writable = true;
		this._nChunks = 0;
		this._socket = null;
		this._writerTimer = null;
		this._writers = [];
		this.startWriterController();

	}

	startWriterController(){
		this._writerTimer = setInterval(()=>{
			for(let i=0; i<this._writers.length; i++ ){
				if (this._writers[i] && this._writers[i].getOutBufferState() <= 0) {
					delete this._writers[i];//writer has finished writing data
				}
			}
		}, cleanPeriod);
	}

	stopWriter(){
		if(this._writerTimer){
			clearInterval(this._writerTimer);
			this._writerTimer = null;
		}
	}

	writeData(data, socket){

		if(!this._socket)
			this._socket = socket;

		let writer = new writeToTunnel(data, socket);
		this._writers.push(writer);
	}
}

class bufferedReader{
	constructor(id){
		this._packetCount = 0;
		this._data = null;
		this._id = id;
		console.log('Building reader for:', id);
	}

	resetReader(){
		this._id = null;
		this._packetCount = 1;
		this._data = null;
	}

	buildFrame(data){

		let chunkNumber = Number(data.slice(uuidLength, uuidLength+bufferDepth).toString());
		if(chunkNumber != (this._packetCount - 1) && this._data){
			console.log('Proebali packet:', chunkNumber,'!=',this._packetCount);
		}
		this._packetCount = chunkNumber > 0?chunkNumber:1;
		let rawData = data.slice(headerLength);
		let output = new Buffer(appendBuffer(this._data, rawData));//this._data?Buffer.concat(this._data, rawData):rawData;
		let id = arr2str(data.slice(0, uuidLength));
		console.log(id,'=>got data:', data.byteLength, ' id:',id, ' out:',output.byteLength,' chunk:',chunkNumber);

		if(!this._id)this._id = id;
		if(id !== this._id){
			console.log('Spizdili packet');
		}
		if(chunkNumber <= 0){
			if(output.length == commandLength) {
				let cmd = new Buffer(output).toString('ascii');
				if(commands.indexOf(cmd)>-1){
					return {cmd: cmd, finished: true};
				}
				else{
					return {data: output, finished: true};
				}
			}
			else{
				return {data: output, finished: true};
			}
		}
		else{
			this._data = output;
			return {finished: false};
		}
	}
}

module.exports = {
	uuidLength,
	commandLength,
	appendBuffer,
	arr2str,
	str2arr,
	getID,
	connectedStr,
	disconnectedStr,
	bufferedWriter,
	headerLength,
	bufferedReader
};