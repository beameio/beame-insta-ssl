/**
 * Created by zenit1 on 15/01/2017.
 */
"use strict";

const RequestType = {
	"RequestWithFqdn" : "RequestWithFqdn",
	"RequestWithParentFqdn" : "RequestWithParentFqdn",
	"RequestWithAuthServer" : "RequestWithAuthServer",
};

/**
 * Registration sources
 * DON'T TOUCH, should by synchronized with backend services
 * @readonly
 * @enum {Number}
 */
const RegistrationSource = {
	"Unknown":        0,
	"NodeJSSDK":      1,
	"InstaSSL":       2,
	"InstaServerSDK": 3,
	"IOSSDK":         4
};

module.exports = {
	RequestType,
	RegistrationSource
};