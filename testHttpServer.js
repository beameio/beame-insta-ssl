'use strict';

const http = require('http');

const b = require("beame-sdk");
const cred = (new b.BeameStore()).getCredential(process.argv[2]);

const srv = http.createServer((req, res) =>{
	console.error('testHttpServer.js - request');
	res.writeHead(200, {'Content-Type': 'text/plain', 'Server': 'Beame.io test server'});
	res.end(process.argv[3]);
});

console.log('testHttpServer - Listening on 65500');
srv.listen(65500);
