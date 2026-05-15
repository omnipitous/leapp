"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsParentSessionFactory = void 0;
const session_type_1 = require("../../../models/session-type");
class AwsParentSessionFactory {
    constructor(awsIamUserService, awsIamRoleFederatedService, awsSsoRoleService) {
        this.awsIamUserService = awsIamUserService;
        this.awsIamRoleFederatedService = awsIamRoleFederatedService;
        this.awsSsoRoleService = awsSsoRoleService;
    }
    getSessionService(accountType) {
        switch (accountType) {
            case session_type_1.SessionType.awsIamUser:
                return this.awsIamUserService;
            case session_type_1.SessionType.awsIamRoleFederated:
                return this.awsIamRoleFederatedService;
            case session_type_1.SessionType.awsSsoRole:
                return this.awsSsoRoleService;
        }
    }
}
exports.AwsParentSessionFactory = AwsParentSessionFactory;
