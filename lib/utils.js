/**
 * Created by Alexz on 06/07/2017.
 */
"use strict";
const uuid = require('node-uuid');
const uuidLength = uuid.v4().length;

const connectedStr      = 'dstAppClientConnnnnected';
const disconnectedStr   = 'dstAppClientDisconnected';
const hostAppFailedStr  = 'hostAppConnectFaillllled';


const commandLength     = connectedStr.length;

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

module.exports = {
	uuidLength,
	commandLength,
	appendBuffer,
	arr2str,
	str2arr,
	getID,
	connectedStr,
	disconnectedStr,
	hostAppFailedStr
};