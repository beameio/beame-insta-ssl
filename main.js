'use strict';

const fs = require('fs');
const path = require('path');

const args = require('minimist')(process.argv.slice(2));
const beame = require('beame-sdk');

// console.log(Object.keys(beame));
const BeameStore = new beame.BeameStore();

function getHelpMessage(fileName) {
	return fs.readFileSync(path.join(__dirname, 'help-messages', fileName), {'encoding': 'utf-8'});
}

var credsCount = BeameStore.list().length;

console.log(args);

if(!credsCount) {
	console.log(getHelpMessage('no-certificates.txt'));
	process.exit(1);
}

if(args._.length == 0) {
	console.log(getHelpMessage('no-command.txt'));
}
