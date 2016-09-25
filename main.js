#!/usr/bin/env node
'use strict';

// TODO: more and better input validation
// TODO: consistent usage of console.log() vs console.error()

const properties2fnames = {
	X509: '@FQDN@.pem',
	PRIVATE_KEY: '@FQDN@.key',
	CA: '@FQDN@.ca',
	PKCS7: '@FQDN@.chain.pkcs7',
	PKCS12: '@FQDN@.pkcs12',
	PWD: '@FQDN@.pkcs12.pwd'
};

const fs = require('fs');
const path = require('path');

const args = require('minimist')(process.argv.slice(2));
const beame = require('beame-sdk');

// console.log(Object.keys(beame));
const BeameStore = new beame.BeameStore();
const Credential = beame.Credential;

var commandHandled = false;

function getHelpMessage(fileName) {
	return fs.readFileSync(path.join(__dirname, 'help-messages', fileName), {'encoding': 'utf-8'});
}

var credsCount = BeameStore.list().length;

if(!credsCount) {
	console.log(getHelpMessage('no-certificates.txt'));
	process.exit(1);
}

if(args._.length == 0) {
	console.log(getHelpMessage('no-command.txt'));
	process.exit(1);
}

// JSON.stringify({authToken: '{"signedData":{"created_at":1474546705,"valid_till":1474719505,"data":"16c37e11f70584587cbe75f75ba49924df3026b826447e2a6326f512"},"signedBy":"p2payp4q8f5ruo22.q6ujqecc83gg6fod.v1.d.beameio.net","signature":"Tp8ATg1IcO1LZYRygom7B7gl3MiTpXQFq1gj5UpsrAP48QOhW5vOX7p0O8vNYglWNtY9KUeXYBqNEMOgr+ZMy6o4iegQQzE8hJgKkGoQv1GJkOYMzvNI0/+tx4bMKnEJpf6v15z6e+qdTJbh0tnH7q95kMiuj6fFPk7xMxdMahWSql4GAZbNd10eWfWQLEmAaNH77HRkQMz6oNRWwKNM3DEMlg+r0BnBTLV6sKh8gtsrEHuMqp2dMmQ4s6q1PgRV+srZBNldPLySG04/JXqt9Gfx3WYafOwxptOWU+7f4ir3Mg1RlPglDyGmpNku4s4id9nsDzZYCvLVndkDfphxVg=="}', authSrvFqdn: 'p2payp4q8f5ruo22.q6ujqecc83gg6fod.v1.d.beameio.net', name: 'ilya', email: 'is+dev01@beame.io'})

function expandFileName(fname, fqdn) {
	return fname.replace('@FQDN@', fqdn);
}

if(args._[0] == 'create') {
	let token = JSON.parse(args._[1]);
	let cred = new Credential(BeameStore);

	commandHandled = true;

	cred.createEntityWithAuthServer(token.authToken, token.authSrvFqdn, token.name, token.email).then(metadata=> {
		console.log('');
		console.log(`Certificate created! Certificate FQDN is ${metadata.fqdn}`);
		console.log('');
		console.log(getHelpMessage('certificate-created.txt'));
		process.exit(0);
	}).catch(e => {
		console.log('ERROR', e);
		process.exit(1);
	});
}

if(args._[0] == 'tunnel') {
	// TODO: more input validation
	let cert, fqdn, dstHost, dstPort, dstHostname, dstProto;

	// FQDN
	if(args.fqdn) {
		fqdn = args.fqdn;
	} else {
		let allCerts = BeameStore.list();
		if(allCerts.length > 1) {
			console.log("tunnel requires --fqdn parameter because you have more than one certificate");
			console.log("Possible FQDNs are:");
			allCerts.forEach(cred => {
				console.log(`  ${cred.fqdn}`);
			});
			process.exit(2);
		}
	}
	cert = BeameStore.getCredential(fqdn);
	if(!cert) {
		console.error(`Certificate for FQDN ${fqdn} not found`);
		process.exit(2);
	}

	// dstHost:dstPort
	var dstHostPort = args._[1];
	if(typeof dstHostPort == 'number') {
		dstHost = 'localhost';
		dstPort = dstHostPort;
	} else {
		dstHostPort = dstHostPort.split(':');
		dstHost = dstHostPort[0];
		dstPort = parseInt(dstHostPort[1]);
	}

	// dstHostname
	dstHostname = args.hostname || dstHost;

	// dstProto
	dstProto = args._[2];
	if(dstProto != 'http' && dstProto != 'https') {
		console.log('DESTINATION_PROTO must be either http or https');
		process.exit(1);
	}

	const tunnel = require('./tunnel');

	console.log(`Starting tunnel ${fqdn} -> ${dstHost}:${dstPort} ${dstProto}`);
	try {
		tunnel.httpsTunnel(fqdn, cert, dstHost, dstPort, dstProto, dstHostname);
		commandHandled = true;
	} catch(e) {
		console.log(`Tunnel error: ${e}`);
		process.exit(3);
	}
}

if(args._[0] == 'list') {
	BeameStore.list().forEach(cred => {
		console.log(cred.fqdn);
	});
	process.exit(0);
}

if(args._[0] == 'export') {
	let fqdn = args._[1];
	let dir = args._[2];
	if(!fqdn) {
		console.error(`FQDN not provided`);
		process.exit(2);
	}
	if(!dir) {
		console.error(`DESTINATION_FOLDER not provided`);
		process.exit(2);
	}
	let cert = BeameStore.getCredential(fqdn);
	if(!cert) {
		console.error(`Certificate for FQDN ${fqdn} not found. Use "beame-insta-ssl list" command to list available certificates.`);
		process.exit(2);
	}

	// Step 1: validation
	if(!fs.existsSync(dir)) {
		console.log(`ERROR: Specified DESTINATION_FOLDER ${dir} does not exist`);
		process.exit(1);
	}

	let stat = fs.statSync(dir);
	if(!stat.isDirectory()) {
		console.log(`ERROR: Specified DESTINATION_FOLDER ${dir} is not a directory`);
		process.exit(1);
	}

	for(let k in properties2fnames) {
		let dst = path.join(dir, expandFileName(properties2fnames[k], fqdn));
		console.log(dst);
		if(fs.existsSync(dst)) {
			console.log(`ERROR: File ${dst} already exists`);
			process.exit(2);
		}
		if(!cert.getKey(k)) {
			console.log(`ERROR: File ${dst} can not be created. Certificate does not have corresponding key ${k}`);
			process.exit(2);
		}
	}

	// Step 2: write all files
	for(let k in properties2fnames) {
		let dst = path.join(dir, expandFileName(properties2fnames[k], fqdn));
		console.log(`Writing ${dst}`);
		fs.writeFileSync(dst, cert.getKey(k));
	}

	console.log('Done');

	process.exit(0);
}

if(!commandHandled) {
	console.error(`Unkonwn command: ${args._[0]}`);
	process.exit(1);
}
