"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsIamRoleChainedSession = void 0;
const session_type_1 = require("../session-type");
const session_1 = require("../session");
class AwsIamRoleChainedSession extends session_1.Session {
    constructor(sessionName, region, roleArn, profileId, parentSessionId, roleSessionName, awsAccount) {
        super(sessionName, region);
        this.roleArn = roleArn;
        this.profileId = profileId;
        this.parentSessionId = parentSessionId;
        this.type = session_type_1.SessionType.awsIamRoleChained;
        this.roleSessionName = roleSessionName ? roleSessionName : `assumed-from-leapp`;
        this.awsAccount = awsAccount;
    }
}
exports.AwsIamRoleChainedSession = AwsIamRoleChainedSession;
