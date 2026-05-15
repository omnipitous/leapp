"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsSsoRoleSession = void 0;
const session_type_1 = require("../session-type");
const session_1 = require("../session");
class AwsSsoRoleSession extends session_1.Session {
    constructor(sessionName, region, roleArn, profileId, awsSsoConfigurationId, email) {
        super(sessionName, region);
        this.email = email;
        this.roleArn = roleArn;
        this.profileId = profileId;
        this.type = session_type_1.SessionType.awsSsoRole;
        this.awsSsoConfigurationId = awsSsoConfigurationId;
    }
}
exports.AwsSsoRoleSession = AwsSsoRoleSession;
