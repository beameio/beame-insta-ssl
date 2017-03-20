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

function _list() {
	let store = new BeameStore();
	return store.list(null, {hasPrivateKey: true});
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
 * @returns {Promise}
 */
function syncmeta(fqdn,callback) {

	let cred = new Credential(new BeameStore());

	CommonUtils.promise2callback(cred.syncMetadata(fqdn), callback);
}
syncmeta.toText = _lineToText;


const list = _list;

list.toText = function (creds) {
	let table = new Table({
		head:      ['name', 'fqdn', 'parent','valid' ,'priv/k'],
		colWidths: [40, 65, 55, 25,10]
	});
	creds.forEach(item => {
		table.push([item.getMetadataKey("Name"), item.fqdn, item.getMetadataKey('PARENT_FQDN'),_getCertEnd(item) ,item.getKey('PRIVATE_KEY') ? 'Y' : 'N']);
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
 * @param {String} signerFqdn
 * @param {String} fqdn
 * @param {Function} callback
 */
function revokeCert(signerFqdn, fqdn, callback) {
	let cred = new Credential(new BeameStore());

	CommonUtils.promise2callback(cred.revokeCert(signerFqdn, fqdn).then(returnOK), callback);
}
revokeCert.toText = _lineToText;

/**
 * @public
 * @method Creds.revokeCert
 * @param {String|null} [signerAuthToken]
 * @param {String} fqdn
 * @param {Number|null|undefined} [validityPeriod] => in seconds
 * @param {Function} callback
 */
function renewCert(signerAuthToken, fqdn, validityPeriod, callback) {

	if (!fqdn) {
		throw new Error(`signerAuthToken or fqdn required`);
	}

	let authToken;

	if (signerAuthToken) {
		let parsed = CommonUtils.parse(signerAuthToken, false);

		if (typeof parsed == "object") {
			authToken = parsed;
		}
		else {
			authToken = CommonUtils.parse(parsed, false);
		}
	}

	let cred = new Credential(new BeameStore());



	CommonUtils.promise2callback(cred.renewCert(authToken, fqdn, validityPeriod).then(returnOK), callback);
}
renewCert.toText = _lineToText;

module.exports = {
	list,
	getCreds,
	getRegToken,
	syncmeta,
	exportCred,
	revokeCert,
	renewCert
};
