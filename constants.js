const environments = {
	dev: {
		AuthServerUrl: 'https://p2payp4q8f5ruo22.q6ujqecc83gg6fod.v1.d.beameio.net',
		EmailServerUrl: 'https://rem064h0jljfwh4f.mpk3nobb568nycf5.v1.d.beameio.net'
	},

	prod: {
		AuthServerUrl: 'https://ypxf72akb6onjvrq.ohkv8odznwh5jpwm.v1.p.beameio.net',
		EmailServerUrl: 'https://p3wiktq9ccu6bsqv.tl5h1ipgobrdqsj6.v1.p.beameio.net'
	},
};
const SelectedProfile = require('beame-sdk').makeEnv(environments);
const EmailServerEndpoints = {
	"SendInvitation": {
		"endpoint": "/send/insta-ssl/invitation"
	}
};
const RegistrationSource = {
	"Unknown":        0,
	"NodeJSSDK":      1,
	"InstaSSL":       2,
	"BeameGatekeeper": 3,
	"IOSSDK":         4
};

module.exports = {
	SelectedProfile,
	EmailServerEndpoints,
	RegistrationSource
};