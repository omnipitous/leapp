"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsIamUserSession = void 0;
const session_type_1 = require("../session-type");
const session_1 = require("../session");
class AwsIamUserSession extends session_1.Session {
    constructor(sessionName, region, profileId, mfaDevice, awsAccount) {
        super(sessionName, region);
        this.mfaDevice = mfaDevice;
        this.type = session_type_1.SessionType.awsIamUser;
        this.profileId = profileId;
        this.awsAccount = awsAccount;
    }
}
exports.AwsIamUserSession = AwsIamUserSession;
