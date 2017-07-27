#!/usr/bin/env node

"use strict";

const fs   = require('fs');
const path = require('path');

const argv        = require('minimist')(process.argv.slice(2));
const _           = require('underscore');
const beameSDK    = require('beame-sdk');
const BeameStore  = beameSDK.BeameStore;
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger("BeameInstaSSL");
const pem         = require('pem');

let commands = {};
['creds', 'tunnel', 'system', 'tunnelClient'].forEach(cmdName => {
	commands[cmdName] = require('./' + cmdName + '.js');
});

const parametersSchema = {
	'data':               {required: true},
	'developerEmail':     {required: true},
	'developerFqdn':      {required: true},
	'developerName':      {required: true},
	'format':             {required: false, options: ['text', 'json'], default: 'text'},
	'fqdn':               {required: false},
	'signingFqdn':        {required: false},
	'signature':          {required: true},
	'regex':              {required: false},
	'uid':                {required: true},
	'targetFqdn':         {required: true},
	'file':               {required: false},
	'signerFqdn':         {required: true},
	'authorizationFqdn':  {required: false},
	'authenticationFqdn': {required: false},
	'pk':                 {required: true},
	'requiredLevel':      {required: false, options: ['Default', 'AuthenticationServer', 'AuthorizationServer']},
	'count':              {required: false, default: 1},
	'sharedFolder':       {required: false},
	'localIp':            {required: false},
	'localPort':          {required: true},
	'sharedSecret':       {required: false},
	'secret':             {required: false},
	// createWithToken
	'signWithFqdn':       {required: false},
	'parent_fqdn':        {required: false},
	'dataToSign':         {required: false},
	'authSrvFqdn':        {required: false},
	'authToken':          {required: true, base64: true},
	'signerAuthToken':    {required: false, base64: true},
	'regToken':           {required: false, base64: true},
	'name':               {required: false},
	'email':              {required: false},
	'encryptedData':      {required: true, base64: true, json: true},
	'signedData':         {required: true, base64: true, json: true},
	'ttl':                {required: false, default: 60 * 60 * 24 * 2},
	'src':                {required: false},
	'serviceName':        {required: false},
	'matchingFqdn':       {required: false},
	'serviceId':          {required: false},
	'userId':             {required: false},
	// CLI branch new keys
	'dir':                {required: true},
	'hostname':           {required: false},
	'dst':                {required: true},
	'proto':              {required: true},
	'token':              {required: true, base64: true, json: true},
	'value':              {required: false},
	'useBestProxy':       {required: false},
	'validityPeriod':     {required: false},
	'dnsFqdn':            {required: false},
	'forceCheck':         {required: false},
	'highestFqdn':        {required: false},
	'trustDepth':         {required: false},
	'noAuth':             {required: false},
	'filter':             {required: false},
	'hasPrivateKey':      {required: false, default: 'true'},
	'expiration':         {required: false},
	'anyParent':          {required: false}
};

function InvalidArgv(message) {
	this.name    = 'InvalidArgv';
	this.message = message;
}

InvalidArgv.prototype = Error.prototype;

function getHelpMessage(fileName) {
	return fs.readFileSync(path.join(__dirname, '..', 'help-messages', fileName), {'encoding': 'utf-8'});
}

function defaultTheOnlyFqdn(args) {
	let cert, fqdn;

	if (args.fqdn) {
		return args.fqdn;
	}

	let allCerts = require('./creds').list(null, 'true');
	if (allCerts.length > 1) {
		console.log("--fqdn parameter is required because you have more than one certificate");
		console.log("Possible FQDNs are:");
		allCerts.forEach(cred => {
			console.log(`  ${cred.fqdn}`);
		});
		process.exit(2);
	}
	args.fqdn = allCerts[0].fqdn;
}

function getParamsNames(fun) {
	const names       = fun.toString().match(/^[\s(]*function[^(]*\(([^)]*)\)/)[1]
		.replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
		.replace(/\s+/g, '').split(',');
	let ret           = (names.length == 1 && !names[0] ? [] : names),
	      useCallback = false;

	ret             = ret.filter(paramName => {
		if (paramName == 'callback') {
			useCallback = true;
			return false;
		} else {
			return true;
		}
	});
	ret.hasFormat   = !!fun.toText;
	ret.useCallback = useCallback;
	return ret;
}

function main() {
	let cmdName, subCmdName, cmd;

	if (pem.version) {
		pem.config({sync: true});
		pem.version((err, data) => {
			if (err) {
				throw Error("Could not run openssl. beame-insta-ssl requires openssl. Please make sure openssl is installed and is in PATH");
			}
		});
		pem.config({sync: false});
	} else {
		if (!process.env.BEAME_NO_PEM_WARNING) {
			logger.info("WARNING: Using 'pem' module without 'config' function. Not checking for openssl availability.");
		}
	}

	// getHelpMessage() is only defined in this file.
	commands.creds.getCreds.toText = (metadata) => `Certificate created! Certificate FQDN is ${metadata.fqdn}\n\n` + getHelpMessage('certificate-created.txt');

	// Old CLI compatibility - start
	let do_warn = false, orig_command = argv._[0];
	if (argv._[0] == 'list') {
		do_warn                    = true;
		argv._                     = ['creds', 'list'];
		commands.creds.list.toText = (list) => list.map(cred => cred.fqdn).join('\n');
	}
	if (argv._[0] == 'syncmeta') {
		do_warn = true;
		argv._  = ['creds', 'syncmeta'];
		defaultTheOnlyFqdn(argv);
	}
	if (argv._[0] == 'export') {
		do_warn   = true;
		argv.fqdn = argv._[1];
		argv.dir  = argv._[2];
		argv._    = ['creds', 'exportCred'];
	}
	if (argv._[0] == 'tunnel') {
		if (argv._[1] && ((typeof argv._[1] == 'number') || argv._[1].indexOf(':') > -1)) {
			do_warn    = true;
			argv.dst   = argv._[1];
			argv.proto = argv._[2];
			argv.highestFqdn = argv._[3];
			argv._     = ['tunnel', 'make'];
		}
	}
	if (do_warn) {
		console.warn(`+---------------------------------------------------------------------`)
		console.warn(`| Warning: you are using deprecated command "${orig_command}". Use "${argv._.join(' ')}" instead.`)
		console.warn(`| Run beame-insta-ssl without any arguments to see all the commands and swithces.`);
		console.warn(`+---------------------------------------------------------------------`)
	}

	// Old CLI compatibility - end

	cmdName    = argv._[0];
	subCmdName = argv._[1];
	cmd        = commands[cmdName];

	if (`${cmdName} ${subCmdName}` != 'creds getCreds' && argv.format != 'json') {
		let credsCount = require('./creds').list().length;

		if (!credsCount) {
			console.log(getHelpMessage('no-certificates.txt'));
			process.exit(1);
		}
	}

	if (argv._.length < 2) {
		usage();
		process.exit(1);
	}

	if (`${cmdName} ${subCmdName}` == 'tunnel make') {
		defaultTheOnlyFqdn(argv);
	}
	/*
	 if (argv._[0] == 'complete') {
	 if (argv._[1] == 'commands') {
	 console.log(_.keys(commands).join(' '));
	 process.exit(0);
	 }
	 if (argv._[1] == 'sub-commands') {
	 console.log(_.keys(commands[argv._[2]]).join(' '));
	 process.exit(0);
	 }
	 if (argv._[1] == 'switches') {
	 let f           = commands[argv._[2]][argv._[3]],
	 paramsNames = getParamsNames(f);
	 if (paramsNames.hasFormat) {
	 paramsNames.push('format');
	 }
	 let switches = paramsNames.map(function (p) {
	 return "--" + p;
	 }).join(' ');
	 console.log(switches);
	 process.exit(0);
	 }
	 if (argv._[1] == 'switch-value') {
	 let sw = argv._[2];
	 if (sw == 'fqdn') {
	 let store   = new BeameStore();
	 let results = store.list();
	 console.log(_.map(results, r => r.fqdn).join(' '));
	 process.exit(0);
	 }
	 if (parametersSchema[sw].options) {
	 console.log(parametersSchema[sw].options.join(' '));
	 process.exit(0);
	 }
	 process.exit(0);
	 }
	 process.exit(1);
	 }
	 */

	if (!cmd) {
		logger.fatal("Command '" + cmdName + "' not found. Valid top-level commands are: " + Object.keys(commands));
	}

	if (!commands[cmdName][subCmdName]) {
		logger.fatal("Sub-command '" + subCmdName + "' for command '" + cmdName + "' not found. Valid sub-commands are: " + Object.keys(commands[cmdName]));
	}

	// TODO: handle boolean such as in "--fqdn --some-other-switch" or "--no-fqdn"
	// Validate argv and build arguments for the function
	let paramsNames = getParamsNames(commands[cmdName][subCmdName]),
	    args        = _.map(paramsNames, function (paramName) {

		    // Required parameter missing
		    if (parametersSchema[paramName].required && !_.has(argv, paramName)) {
			    logger.fatal("Command '" + cmdName + ' ' + subCmdName + "' - required argument '" + paramName + "' is missing.");
		    }

		    // Optional parameter missing
		    if (!parametersSchema[paramName].required && !_.has(argv, paramName)) {
			    if (parametersSchema[paramName].default) {
				    return parametersSchema[paramName].default;
			    }
			    return null;
		    }

		    // Parameter must be one of the specified values ("options")
		    if (parametersSchema[paramName].options) {
			    if (_.indexOf(parametersSchema[paramName].options, argv[paramName]) == -1) {
				    logger.fatal("Command '" + cmdName + ' ' + subCmdName + "' - argument '" + paramName + "' must be one of: " + parametersSchema[paramName].options.join(','));
			    }
		    }

		    let arg = argv[paramName];

		    // Optionally decode base64-encoded argument.
		    // Do not decode what appears to be JSON.
		    if (parametersSchema[paramName].base64 && arg[0] != '{' && arg[0] != '"' && arg[0] != '[') {
			    arg = new Buffer(arg, 'base64').toString();
		    }

		    if (parametersSchema[paramName].json) {
			    //noinspection ES6ModulesDependencies,NodeModulesDependencies
			    arg = JSON.parse(arg);
		    }

		    return arg;
	    });

	/**
	 *
	 * @param {Object} error
	 * @param {Object} output
	 */
	function commandResultsReady(error, output) {

		if (error) {
			if (typeof error == 'string') {
				logger.fatal(error);
			}
			if (error instanceof Error) {
				logger.error(error.stack);
			}
			logger.fatal(error.message, error.data, error.module);
		}

		if (output === undefined) {
			return;
		}
		if (argv.format == 'json' || !commands[cmdName][subCmdName].toText) {

			//noinspection ES6ModulesDependencies,NodeModulesDependencies
			output = JSON.stringify(output);
		} else {
			output = commands[cmdName][subCmdName].toText(output).toString();
		}

		console.log(output);
	}

	// Run the command
	if (paramsNames.useCallback) {
		args.push(commandResultsReady);
		commands[cmdName][subCmdName].apply(null, args);
	} else {
		let output = commands[cmdName][subCmdName].apply(null, args);
		commandResultsReady(null, output);
	}
}

function usage() {
	const path   = require('path');
	const myname = 'beame-insta-ssl';
	console.log("Usage:");
	_.each(commands, function (subCommands, cmdName) {
		_.each(subCommands, function (subCmdFunc, subCmdName) {
			let paramsNames = getParamsNames(subCmdFunc);
			if (paramsNames.hasFormat) {
				paramsNames.push('format');
			}
			let params = paramsNames.map(function (paramName) {
				let ret = '--' + paramName;
				if (!parametersSchema[paramName]) {
					console.log(`Internal coding error: missing ${paramName} in parametersSchema`);
					throw new Error(`Internal coding error: missing ${paramName} in parametersSchema`);
				}
				if (parametersSchema[paramName].options) {
					ret = ret + ' {' + parametersSchema[paramName].options.join('|') + '}';
				} else {
					ret = ret + ' ' + paramName;
				}
				if (!parametersSchema[paramName].required) {
					ret = '[' + ret + ']';
				}
				return ret;
			});
			console.log('  ' + myname + ' ' + cmdName + ' ' + subCmdName + ' ' + params.join(' '));
		});
	});
	console.log(getHelpMessage('no-command.txt'));
	process.exit(1);
}

module.exports = main;
