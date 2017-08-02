/**
 * Created by zenit1 on 26/02/2017.
 */
"use strict";

const beameSDK    = require('beame-sdk');
const CommonUtils = beameSDK.CommonUtils;
const BeameStore  = beameSDK.BeameStore;
const Credential  = beameSDK.Credential;
const BeameLogger = beameSDK.Logger;
const logger      = new BeameLogger("BIS-Credentials");
const fs          = require('fs');
const path        = require('path');
const Table       = require('cli-table2');
const sdkCreds    = beameSDK.creds;

const properties2fnames = {
	X509:        '@FQDN@.pem',
	PRIVATE_KEY: '@FQDN@.key',
	P7B:         '@FQDN@.chain.p7b',
	PKCS12:      '@FQDN@.pkcs12',
	PWD:         '@FQDN@.pkcs12.pwd'
};

function _lineToText(line) {
	let table = new Table();
	for (let k in line) {
		//noinspection JSUnfilteredForInLoop
		table.push({[k]: line[k] ? line[k].toString() : null});

	}

	return table;
}

/**
 *
 * @param {String|null|undefined} [regToken]
 * @param {String|null|undefined} [fqdn]
 * @param {String|null|undefined} [name]
 * @param {String|null|undefined} [email]
 * @param callback
 */
function getCreds(regToken, fqdn, name, email, callback) {

	if (!fqdn && !regToken) {
		logger.fatal(`Auth Token or Fqdn required`);
		return;
	}

	let promise,
	    cred            = new Credential(new BeameStore()),
	    parsedAuthToken = regToken ? CommonUtils.parse(regToken) : null;

	if (parsedAuthToken) {
		promise = cred.createEntityWithRegistrationToken(parsedAuthToken);
	}
	else if (fqdn) {
		promise = cred.createEntityWithLocalCreds(fqdn, name, email);
	}

	CommonUtils.promise2callback(promise, callback);
}
getCreds.toText = _lineToText;

/**
 * @param {String} fqdn
 * @param {String|null|undefined} [name]
 * @param {String|null|undefined} [email]
 * @param {Number|null|undefined} [ttl]
 * @param {Function} callback
 */
function getRegToken(fqdn, name, email, ttl, callback) {
	if (!fqdn) {
		logger.fatal(`Fqdn required`);
		return;
	}

	function _get() {
		return new Promise((resolve, reject) => {

				let cred = new Credential(new BeameStore());

				cred.createRegistrationToken({fqdn, name, email, ttl}).then(resolve).catch(reject);
			}
		);
	}

	CommonUtils.promise2callback(_get(), callback);

}
getRegToken.toText = x => x;

/**
 * @param {String} fqdn
 * @param {String|null|undefined} [name]
 * @param {String|null|undefined} [email]
 * @param {Number|null|undefined} [ttl]
 * @param {Function} callback
 */
function invite(fqdn, name, email, ttl, callback) {
	if (!fqdn) {
		logger.fatal(`Fqdn required`);
		return;
	}

	if (!email) {
		logger.fatal(`Email required`);
		return;
	}

	const emailServices= new (require('../lib/email'))();
	const Constants = require('../constants');

	function _onTokenReceived(token){

		return new Promise((resolve, reject) => {
			logger.info(`Registration token received`);
			emailServices.sendEmail(fqdn, name, email, token).then(()=>{
				logger.info(`Registration token sent successfully to ${email}`);
				resolve(token);
			}).catch(reject);
			}
		);
	}

	function _get() {
		return new Promise((resolve, reject) => {

				let cred = new Credential(new BeameStore()),
					regToken = {fqdn, name, email, ttl, src:Constants.RegistrationSource.InstaSSL};

				//noinspection JSCheckFunctionSignatures
				cred.createRegistrationToken(regToken).then(_onTokenReceived).then(resolve).catch(reject);
			}
		);
	}

	CommonUtils.promise2callback(_get(), callback);

}
invite.toText = x => x;

/**
 * @param {String} fqdn
 * @param {Function} callback
 * @returns {Promise}
 */
function syncmeta(fqdn,callback) {

	let cred = new Credential(new BeameStore());

	CommonUtils.promise2callback(cred.syncMetadata(fqdn), callback);
}
syncmeta.toText = _lineToText;

/**
 * Return list of credentials
 * @public
 * @method Creds.list
 * @param {String|null} [regex] entity fqdn
 * @param {Boolean|null} hasPrivateKey
 * @param {Number|null} expiration in days
 * @param {Boolean|null} anyParent
 * @param {string} [filter]
 * @returns {Array.<Credential>}
 */
function list(regex, hasPrivateKey, expiration, anyParent, filter) {
	return(sdkCreds.list(regex, hasPrivateKey, expiration, anyParent, filter));
}
list.toText = function (creds) {
	let table = new Table({
		head:      ['name', 'fqdn', 'parent','valid' ,'priv/k'],
		colWidths: [35, 55, 55, 25,10]
	});
	creds.forEach(item => {
		table.push([item.getMetadataKey("Name"), item.fqdn, item.getMetadataKey('PARENT_FQDN'),_getCertEnd(item) ,item.getKey('PRIVATE_KEY') ? 'Y' : 'N']);
	});
	return table;
};
/**
 * Return list of credentials
 * @public
 * @method Creds.list
 * @param {String|null} [regex] entity fqdn
 * @param {Boolean|null} hasPrivateKey
 * @param {Number|null} expiration in days
 * @param {Boolean|null} anyParent
 * @param {string} [filter]
 * @returns {Array.<Credential>}
 */
function list(regex, hasPrivateKey, expiration, anyParent, filter) {
	return(sdkCreds.list(regex, hasPrivateKey, expiration, anyParent, filter));
}

function signers(callback){
	const store = new BeameStore();

	CommonUtils.promise2callback(store.getActiveLocalCreds(), callback);
}
signers.toText =  function (creds) {
	let table = new Table({
		head:      ['name', 'fqdn'],
		colWidths: [120, 120]
	});

	const _setStyle = (value, cred) => {
		let val = value || '';
		return cred.expired === true ? colors.red(val) : val;
	};

	creds.forEach(item => {

		table.push([_setStyle(item.name, item), _setStyle(item.fqdn, item)]);
	});
	return table;
};

function _getCertEnd(item){

	try {
		return (new Date(item.certData.validity.end)).toLocaleString();
	} catch (e) {
		return null;
	}
}

function expandFileName(fname, fqdn) {
	return fname.replace('@FQDN@', fqdn);
}
/**
 *
 * @param {String} fqdn
 * @param {String} dir
 * @returns {Promise}
 */
function exportCred(fqdn, dir) {
	return new Promise((resolve, reject) => {

			if (!fqdn) {
				reject(`FQDN not provided`);
				return;
			}
			if (!dir) {
				reject(`DESTINATION_FOLDER not provided`);
				return;
			}
			let cred = (new BeameStore()).getCredential(fqdn);
			if (!cred) {
				reject(`Certificate for FQDN ${fqdn} not found. Use "beame-insta-ssl list" command to list available certificates.`);
				return;
			}

			// Step 1: validation
			if (!fs.existsSync(dir)) {
				reject(`ERROR: Specified DESTINATION_FOLDER ${dir} does not exist`);
				return;
			}

			let stat = fs.statSync(dir);
			if (!stat.isDirectory()) {
				reject(`ERROR: Specified DESTINATION_FOLDER ${dir} is not a directory`);
				return;
			}

			for (let k in properties2fnames) {
				let dst = path.join(dir, expandFileName(properties2fnames[k], fqdn));
				console.log(dst);
				if (fs.existsSync(dst)) {
					reject(`ERROR: File ${dst} already exists`);
					return;
				}
				if (!cred.getKey(k)) {
					reject(`ERROR: File ${dst} can not be created. Certificate does not have corresponding key ${k}`);
					return;
				}
			}

			// Step 2: write all files
			for (let k in properties2fnames) {
				let dst = path.join(dir, expandFileName(properties2fnames[k], fqdn));
				logger.info(`Writing ${dst}`);
				fs.writeFileSync(dst, cred.getKey(k));
			}

			resolve('Done');
		}
	);
}

function returnOK() {
	return Promise.resolve({status: 'ok'});
}

/**
 * @public
 * @method Creds.revokeCert
 * @param {String|null} signerAuthToken
 * @param {String} signerFqdn
 * @param {String} fqdn
 * @param {Function} callback
 */
function revokeCert(signerAuthToken, signerFqdn, fqdn, callback) {

	if (!signerAuthToken && !signerFqdn) {
		throw new Error(`SignerAuthToken or SignerFqdn required`);
	}

	if (!fqdn) {
		throw new Error(`Fqdn required`);
	}

	let authToken;

	if (signerAuthToken) {
		let parsed = CommonUtils.parse(signerAuthToken, false);

		if (typeof parsed === "object") {
			authToken = parsed;
		}
		else {
			authToken = CommonUtils.parse(parsed, false);
		}
	}

	let cred = new Credential(new BeameStore());

	CommonUtils.promise2callback(cred.revokeCert(authToken, signerFqdn, fqdn), callback);
	//CommonUtils.promise2callback(cred.revokeCert(signerAuthToken,signerFqdn, fqdn).then(returnOK), callback);
}
revokeCert.toText = _lineToText;

/**
 * @public
 * @method Creds.revokeCert
 * @param {String|null} [signerAuthToken]
 * @param {String} fqdn
 * @param {Number|null|undefined} [validityPeriod] => in seconds
 * @param {String} [filter]
 * @param {String} [regex]
 * @param {Function} callback
 */
function renewCert(signerAuthToken, fqdn, validityPeriod, filter, regex, callback) {
	sdkCreds.renew(signerAuthToken, fqdn, validityPeriod, filter, regex, (err, data) => {
		if(err)logger.error(err);
		else returnOK();
	});
	// if (!fqdn) {
	// 	throw new Error(`signerAuthToken or fqdn required`);
	// }
	//
	// let authToken;
	//
	// if (signerAuthToken) {
	// 	let parsed = CommonUtils.parse(signerAuthToken, false);
	//
	// 	if (typeof parsed == "object") {
	// 		authToken = parsed;
	// 	}
	// 	else {
	// 		authToken = CommonUtils.parse(parsed, false);
	// 	}
	// }
	//
	// let cred = new Credential(new BeameStore());
	//
	// CommonUtils.promise2callback(cred.renewCert(authToken, fqdn, validityPeriod).then(returnOK), callback);
}
renewCert.toText = _lineToText;


/**
 * @public
 * @method Creds.checkOcsp
 * @param {String} fqdn
 * @param {Boolean|string|null} [forceCheck] => ignoring cache, when set to true
 * @param {Function} callback
 */
function checkOcsp(fqdn, forceCheck, callback){
	if (!fqdn) {
		throw new Error(`Fqdn required`);
	}

	let cred = (new BeameStore()).getCredential(fqdn);

	if(!cred){
		throw new Error(`Credential for ${fqdn} not found`);
	}

	let check = !!(forceCheck && forceCheck === "true");

	CommonUtils.promise2callback(cred.checkOcspStatus(cred,check), callback);
}
checkOcsp.toText = x => {
	return x.status === true ? `Certificate ${x.fqdn} is valid` : x.message;
};

/**
 * @public
 * @method Creds.setDns
 * @param {String} fqdn
 * @param {String|null|undefined} [value] => dns record value
 * @param {Boolean|null} [useBestProxy]
 * @param {String|null|undefined} [dnsFqdn] => using for any alt-names which is not CN
 * @param callback
 */
function setDns(fqdn, value, useBestProxy, dnsFqdn, callback) {
	let cred = new Credential(new BeameStore());

	CommonUtils.promise2callback(cred.setDns(fqdn, value, useBestProxy || !value, dnsFqdn), callback);

}
setDns.toText = x => `DNS set to ${x}`;

/**
 * @public
 * @method Creds.deleteDns
 * @param {String} fqdn
 * @param {String|null|undefined} [dnsFqdn] => using for any alt-names which is not CN
 * @param callback
 */
function deleteDns(fqdn, dnsFqdn, callback) {
	let cred = new Credential(new BeameStore());

	CommonUtils.promise2callback(cred.deleteDns(fqdn, dnsFqdn), callback);

}
deleteDns.toText = x => `DNS record for ${x} has been deleted`;

/**
 * Check if two creds have common relative up to highestFqdn
 * @public
 * @method Creds.verifyAncestry
 * @param {String} fqdn - lowest fqdn to start from
 * @param {String} targetFqdn
 * @param {String} highestFqdn
 * @param {int} trustDepth
 * @param {Function} callback
 */
function verifyAncestry(fqdn, targetFqdn, highestFqdn, trustDepth, callback) {
	if(typeof trustDepth !== 'undefined' && trustDepth!= null){
		if(!Number.isInteger(trustDepth) || trustDepth<=0){
			console.error('trustDepth should be >= 1 (omit it to allow infinite depth)');
			process.exit(1);
		}
	}
	const store = new BeameStore();
	store.verifyAncestry(fqdn, targetFqdn, highestFqdn, trustDepth, (error, related) => {
		if(!error){
			console.log(fqdn,' & ',targetFqdn,' related => ', related?'YES':'NO');
		}
		else{
			console.error(error);
		}
		callback(error, related);
	});
}

/**
 * Fetch creds up to L0
 * @public
 * @method Creds.listCredChain
 * @param {String} fqdn - lowest fqdn in required chain
 * @param {Function} callback
 */
function listCredChain(fqdn, callback) {
	const store = new BeameStore();
	store.fetchCredChain(fqdn, null,(error, list) => {
		if(!error){
			callback(null, list);
		}
		else{
			callback(error, false);
		}
	});
}

listCredChain.toText = function (list) {
	let table = new Table({
		head:      ['level', 'fqdn'],
		colWidths: [16, 64]
	});

	const _setStyle = (value, cred) => {
		let val = value || '';
		return cred.expired === true ? colors.red(val) : val;
	};
	for(let i=0; i<list.length; i++){
		table.push([_setStyle(list[i].metadata.level, list[i]), _setStyle(list[i].fqdn, list[i])]);
	}
	return table;
};


module.exports = {
	list,
	signers,
	getCreds,
	getRegToken,
	invite,
	syncmeta,
	exportCred,
	revokeCert,
	renewCert,
	checkOcsp,
	setDns,
	deleteDns,
	listCredChain,
	verifyAncestry
};
