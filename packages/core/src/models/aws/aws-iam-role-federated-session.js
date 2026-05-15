"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsIamRoleFederatedSession = void 0;
const session_type_1 = require("../session-type");
const session_1 = require("../session");
class AwsIamRoleFederatedSession extends session_1.Session {
    constructor(sessionName, region, idpUrlId, idpArn, roleArn, profileId, awsAccount) {
        super(sessionName, region);
        this.idpUrlId = idpUrlId;
        this.idpArn = idpArn;
        this.roleArn = roleArn;
        this.profileId = profileId;
        this.type = session_type_1.SessionType.awsIamRoleFederated;
        this.awsAccount = awsAccount;
    }
}
exports.AwsIamRoleFederatedSession = AwsIamRoleFederatedSession;
