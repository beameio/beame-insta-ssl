const environments = {
	dev: {
		EmailServerUrl: "https://rem064h0jljfwh4f.mpk3nobb568nycf5.v1.d.beameio.net"
	},

	prod: {
		EmailServerUrl: "https://p3wiktq9ccu6bsqv.tl5h1ipgobrdqsj6.v1.p.beameio.net"
	},
};
const SelectedProfile = require('beame-sdk').makeEnv(environments);
const EmailServerUrl = SelectedProfile.EmailServerUrl;

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
	EmailServerUrl,
	EmailServerEndpoints,
	RegistrationSource
};