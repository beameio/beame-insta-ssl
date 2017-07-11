/**
 * Created by zenit1 on 10/07/2017.
 */

const EmailServerUrl =  "https://rem064h0jljfwh4f.mpk3nobb568nycf5.v1.d.beameio.net";

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