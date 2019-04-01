/**
 * Created by zenit1 on 10/07/2017.
 */

const EmailServerUrl =  "https://p3wiktq9ccu6bsqv.tl5h1ipgobrdqsj6.v1.p.beameio.net";

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

module.exports             = {
	EmailServerUrl,
	EmailServerEndpoints,
	RegistrationSource
};