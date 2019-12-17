'use strict';

const https = require('https');

const b = require("beame-sdk");
const cred = (new b.BeameStore()).getCredential(process.argv[2]);

const srv = https.createServer(cred.getHttpsServerOptions(), (req, res) =>{
	console.error('testHttpsServer.js - request');
	res.writeHead(200, {'Content-Type': 'text/plain', 'Server': 'Beame.io test server'});
	res.end(process.argv[3]);
});

var port = parseInt(process.env.PORT) || 65000;

console.log('testHttpsServer - Listening on', port);
srv.listen(port);
