"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionFactory = void 0;
const session_type_1 = require("../models/session-type");
class SessionFactory {
    constructor(awsIamUserService, awsIamRoleFederatedService, awsIamRoleChainedService, awsSsoRoleService, azureSessionService, localstackSessionService) {
        this.awsIamUserService = awsIamUserService;
        this.awsIamRoleFederatedService = awsIamRoleFederatedService;
        this.awsIamRoleChainedService = awsIamRoleChainedService;
        this.awsSsoRoleService = awsSsoRoleService;
        this.azureSessionService = azureSessionService;
        this.localstackSessionService = localstackSessionService;
    }
    getSessionService(sessionType) {
        switch (sessionType) {
            case session_type_1.SessionType.awsIamUser:
                return this.awsIamUserService;
            case session_type_1.SessionType.awsIamRoleFederated:
                return this.awsIamRoleFederatedService;
            case session_type_1.SessionType.awsIamRoleChained:
                return this.awsIamRoleChainedService;
            case session_type_1.SessionType.awsSsoRole:
                return this.awsSsoRoleService;
            case session_type_1.SessionType.azure:
                return this.azureSessionService;
            case session_type_1.SessionType.localstack:
                return this.localstackSessionService;
            case session_type_1.SessionType.anytype:
                return this.azureSessionService;
        }
    }
    async createSession(sessionType, sessionRequest) {
        const sessionService = this.getSessionService(sessionType);
        await sessionService.create(sessionRequest);
    }
    getCompatibleTypes(sessionType) {
        if (sessionType === session_type_1.SessionType.aws) {
            return [session_type_1.SessionType.awsIamUser, session_type_1.SessionType.awsIamRoleFederated, session_type_1.SessionType.awsIamRoleChained, session_type_1.SessionType.awsSsoRole];
        }
        else if (sessionType === session_type_1.SessionType.anytype) {
            return [session_type_1.SessionType.azure, session_type_1.SessionType.alibaba, ...this.getCompatibleTypes(session_type_1.SessionType.aws)];
        }
        else if (this.getCompatibleTypes(session_type_1.SessionType.anytype).includes(sessionType)) {
            return [sessionType];
        }
        return [];
    }
}
exports.SessionFactory = SessionFactory;
