/**
 * Created by zenit1 on 10/07/2017.
 */
"use strict";

const beameSDK         = require('beame-sdk');
const module_name      = "EmailServices";
const BeameLogger      = beameSDK.Logger;
const logger           = new BeameLogger(module_name);
const store            = new (beameSDK.BeameStore)();
const provisionApi     = new (beameSDK.ProvApi)();
const AuthToken        = beameSDK.AuthToken;
const Constants = require('../constants');
class EmailServices {


	sendEmail(fqdn,name, email ,token){
		return new Promise((resolve, reject) => {

				const _emailCallback = (error, payload) => {
					if (!error) {
						resolve(payload);
					}
					else {
						reject(error);
					}
				};

				let cred = store.getCredential(fqdn);

				if(cred === null){
					logger.warn(`Credential for ${fqdn} not found`);
					reject(`Credential for ${fqdn} not found`);
					return;
				}

				let sign = AuthToken.create(new Date(),cred),
				    url  = `${Constants.EmailServerUrl}${Constants.EmailServerEndpoints.SendInvitation.endpoint}`;

				provisionApi.postRequest(url, {
					token,
					name,
					email
				}, _emailCallback, sign);
			}
		);
}
}

module.exports = EmailServices;