'use strict';

const fs = require('fs');
const path = require('path');

const args = require('minimist')(process.argv.slice(2));
const beame = require('beame-sdk');

// console.log(Object.keys(beame));
const BeameStore = new beame.BeameStore();
const Credential = beame.Credential;


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

if(args._[0] == 'create') {
	let token = JSON.parse(args._[1]);
	let cred = new Credential(BeameStore);

	cred.createEntityWithAuthServer(token.authToken, token.authSrvFqdn, token.name, token.email).then(metadata=> {
		console.log('');
		console.log('OK. Certificate created. Certificate information follows:');
		console.log('');
		for(let k in metadata) {
			console.log(k, ' = ', metadata[k]);
		};
		console.log(getHelpMessage('certificate-created.txt'));
		process.exit(0);
	}).catch(e => {
		console.log('ERROR', e);
		process.exit(1);
	});

}
