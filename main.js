#!/usr/bin/env node
'use strict';

const beame_js = require('./cli/beame');

beame_js();

return;

/**
 * @typedef {Object} RegistrationToken
 * Should be synchronized with token from Auth Server
 * @property {String} authToken
 * @property {String} authSrvFqdn
 * @property {String} name
 * @property {String} email
 */



// TODO: more and better input validation
// TODO: consistent usage of console.log() vs console.error()

const properties2fnames = {
	X509:        '@FQDN@.pem',
	PRIVATE_KEY: '@FQDN@.key',
	P7B:         '@FQDN@.chain.p7b',
	PKCS12:      '@FQDN@.pkcs12',
	PWD:         '@FQDN@.pkcs12.pwd'
};

const fs   = require('fs');
const path = require('path');

const args     = require('minimist')(process.argv.slice(2));
const beameSDK = require('beame-sdk');
const CommonUtils = beameSDK.CommonUtils;
const BeameStore = new beameSDK.BeameStore();
const Credential = beameSDK.Credential;

let commandHandled = false;

function getHelpMessage(fileName) {
	return fs.readFileSync(path.join(__dirname, 'help-messages', fileName), {'encoding': 'utf-8'});
}

// There will be automatically imported certificates in the store.
// Filtering them out.
function list() {
	return BeameStore.list(null, {hasPrivateKey: true});
}


if (args._[0] == 'create') {

	commandHandled = true;

	const _onCredsReceived = (metadata) => {
		console.log('');
		console.log(`Certificate created! Certificate FQDN is ${metadata.fqdn}`);
		console.log('');
		console.log(getHelpMessage('certificate-created.txt'));
		process.exit(0);
	};

	const _onCredsFailure = (e) => {
		if (e instanceof Error) {
			console.error(e.stack);
		} else {
			console.error('ERROR', e);
		}
		process.exit(1);
	};

	/** @type {RegistrationToken} */
	let token = JSON.parse(new Buffer(args._[1], 'base64').toString());
	let cred  = new Credential(BeameStore);

	cred.createEntityWithRegistrationToken(token).then(_onCredsReceived).catch(_onCredsFailure);



} else {

	let credsCount = list().length;

	if (!credsCount) {
		console.log(getHelpMessage('no-certificates.txt'));
		process.exit(1);
	}

	if (args._.length == 0) {
		console.log(getHelpMessage('no-command.txt'));
		process.exit(1);
	}
}

function expandFileName(fname, fqdn) {
	return fname.replace('@FQDN@', fqdn);
}

function parseFqdnArg(args) {
	let cert, fqdn;

	if (args.fqdn) {
		fqdn = args.fqdn;
		cert = BeameStore.getCredential(fqdn);
		if (!cert) {
			console.error(`Certificate for FQDN ${fqdn} not found`);
			process.exit(2);
		}
	} else {
		let allCerts = list();
		if (allCerts.length > 1) {
			console.log("tunnel requires --fqdn parameter because you have more than one certificate");
			console.log("Possible FQDNs are:");
			allCerts.forEach(cred => {
				console.log(`  ${cred.fqdn}`);
			});
			process.exit(2);
		}
		cert = allCerts[0];
	}

	return cert;
}

if (args._[0] == 'tunnel') {
	// TODO: more input validation
	let cert, fqdn, dstHost, dstPort, dstHostname, dstProto;

	cert = parseFqdnArg(args);
	fqdn = cert.fqdn;

	// dstHost:dstPort
	let dstHostPort = args._[1];
	if (typeof dstHostPort == 'number') {
		dstHost = 'localhost';
		dstPort = dstHostPort;
	} else {
		dstHostPort = dstHostPort.split(':');
		dstHost     = dstHostPort[0];
		dstPort     = parseInt(dstHostPort[1]);
	}

	// dstHostname
	dstHostname = args.hostname || dstHost;

	// dstProto
	dstProto = args._[2];
	if (dstProto != 'http' && dstProto != 'https' && dstProto != 'eehttp') {
		console.log('DESTINATION_PROTO must be either http or https');
		process.exit(1);
	}

	const tunnel = require('./tunnel');

	console.log(`Starting tunnel https://${fqdn} -> ${dstProto}://${dstHost}:${dstPort}`);
	try {
		tunnel(fqdn, cert, dstHost, dstPort, dstProto, dstHostname);
		commandHandled = true;
	} catch (e) {
		console.log(`Tunnel error: ${e}`);
		process.exit(3);
	}
}

if (args._[0] == 'syncmeta') {
	// TODO: more input validation
	let cert, fqdn;

	cert = parseFqdnArg(args);
	fqdn = cert.fqdn;

	cert.syncMetadata(fqdn).then(meta => {
		console.info(meta);
	}).catch(error => {
		console.error(error);
	});
	commandHandled = true;
}

if (args._[0] == 'list') {
	list().forEach(cred => {
		console.log(cred.fqdn);
	});
	process.exit(0);
}

if (args._[0] == 'export') {
	let fqdn = args._[1];
	let dir  = args._[2];
	if (!fqdn) {
		console.error(`FQDN not provided`);
		process.exit(2);
	}
	if (!dir) {
		console.error(`DESTINATION_FOLDER not provided`);
		process.exit(2);
	}
	let cert = BeameStore.getCredential(fqdn);
	if (!cert) {
		console.error(`Certificate for FQDN ${fqdn} not found. Use "beame-insta-ssl list" command to list available certificates.`);
		process.exit(2);
	}

	// Step 1: validation
	if (!fs.existsSync(dir)) {
		console.log(`ERROR: Specified DESTINATION_FOLDER ${dir} does not exist`);
		process.exit(1);
	}

	let stat = fs.statSync(dir);
	if (!stat.isDirectory()) {
		console.log(`ERROR: Specified DESTINATION_FOLDER ${dir} is not a directory`);
		process.exit(1);
	}

	for (let k in properties2fnames) {
		let dst = path.join(dir, expandFileName(properties2fnames[k], fqdn));
		console.log(dst);
		if (fs.existsSync(dst)) {
			console.log(`ERROR: File ${dst} already exists`);
			process.exit(2);
		}
		if (!cert.getKey(k)) {
			console.log(`ERROR: File ${dst} can not be created. Certificate does not have corresponding key ${k}`);
			process.exit(2);
		}
	}

	// Step 2: write all files
	for (let k in properties2fnames) {
		let dst = path.join(dir, expandFileName(properties2fnames[k], fqdn));
		console.log(`Writing ${dst}`);
		fs.writeFileSync(dst, cert.getKey(k));
	}

	console.log('Done');

	process.exit(0);
}

if (!commandHandled) {
	console.error(`Unknown command: ${args._[0]}`);
	process.exit(1);
}
