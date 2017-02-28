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

const args     = require('minimist')(process.argv.slice(2));
const beameSDK = require('beame-sdk');
const CommonUtils = beameSDK.CommonUtils;
const BeameStore = new beameSDK.BeameStore();
const Credential = beameSDK.Credential;

let commandHandled = false;

// There will be automatically imported certificates in the store.
// Filtering them out.
function list() {
	return BeameStore.list(null, {hasPrivateKey: true});
}


function expandFileName(fname, fqdn) {
	return fname.replace('@FQDN@', fqdn);
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
