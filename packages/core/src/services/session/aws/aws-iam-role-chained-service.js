"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsIamRoleChainedService = void 0;
const client_sts_1 = require("@aws-sdk/client-sts");
const leapp_aws_sts_error_1 = require("../../../errors/leapp-aws-sts-error");
const leapp_not_found_error_1 = require("../../../errors/leapp-not-found-error");
const aws_iam_role_chained_session_1 = require("../../../models/aws/aws-iam-role-chained-session");
const aws_session_service_1 = require("./aws-session-service");
const session_type_1 = require("../../../models/session-type");
const constants_1 = require("../../../models/constants");
class AwsIamRoleChainedService extends aws_session_service_1.AwsSessionService {
    constructor(iSessionNotifier, repository, awsCoreService, fileService, awsIamUserService, parentSessionServiceFactory) {
        super(iSessionNotifier, repository, awsCoreService, fileService);
        this.awsIamUserService = awsIamUserService;
        this.parentSessionServiceFactory = parentSessionServiceFactory;
    }
    static sessionTokenFromAssumeRoleResponse(assumeRoleResponse) {
        return {
            sessionToken: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                aws_access_key_id: assumeRoleResponse.Credentials.AccessKeyId.trim(),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                aws_secret_access_key: assumeRoleResponse.Credentials.SecretAccessKey.trim(),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                aws_session_token: assumeRoleResponse.Credentials.SessionToken.trim(),
            },
        };
    }
    async create(request) {
        const session = new aws_iam_role_chained_session_1.AwsIamRoleChainedSession(request.sessionName, request.region, request.roleArn, request.profileId, request.parentSessionId, request.roleSessionName);
        if (request.sessionId) {
            session.sessionId = request.sessionId;
        }
        if (request.awsAccount) {
            session.awsAccount = request.awsAccount;
        }
        this.repository.addSession(session);
        this.sessionNotifier?.setSessions(this.repository.getSessions());
    }
    async update(sessionId, updateRequest) {
        const session = this.repository.getSessionById(sessionId);
        if (session) {
            session.sessionName = updateRequest.sessionName;
            session.region = updateRequest.region;
            session.roleArn = updateRequest.roleArn;
            session.roleSessionName = updateRequest.roleSessionName;
            session.parentSessionId = updateRequest.parentSessionId;
            session.profileId = updateRequest.profileId;
            this.repository.updateSession(sessionId, session);
            this.sessionNotifier?.setSessions(this.repository.getSessions());
        }
    }
    async applyCredentials(sessionId, credentialsInfo) {
        const session = this.repository.getSessionById(sessionId);
        const profileName = this.repository.getProfileName(session.profileId);
        const credentialObject = {};
        credentialObject[profileName] = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            aws_access_key_id: credentialsInfo.sessionToken.aws_access_key_id,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            aws_secret_access_key: credentialsInfo.sessionToken.aws_secret_access_key,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            aws_session_token: credentialsInfo.sessionToken.aws_session_token,
            region: session.region,
        };
        return await this.fileService.iniWriteSync(this.awsCoreService.awsCredentialPath(), credentialObject);
    }
    async deApplyCredentials(sessionId) {
        const session = this.repository.getSessionById(sessionId);
        const profileName = this.repository.getProfileName(session.profileId);
        const credentialsFile = await this.fileService.iniParseSync(this.awsCoreService.awsCredentialPath());
        delete credentialsFile[profileName];
        return await this.fileService.replaceWriteSync(this.awsCoreService.awsCredentialPath(), credentialsFile);
    }
    generateCredentialsProxy(sessionId) {
        return this.generateCredentials(sessionId);
    }
    async generateCredentials(sessionId) {
        // Retrieve Session
        const session = this.repository.getSessionById(sessionId);
        // Retrieve Parent Session
        let parentSession;
        try {
            parentSession = this.repository.getSessionById(session.parentSessionId);
        }
        catch (err) {
            throw new leapp_not_found_error_1.LeappNotFoundError(this, `Parent Account Session  not found for Chained Account ${session.sessionName}`);
        }
        // Generate a credential set from Parent Session
        const parentSessionService = this.parentSessionServiceFactory.getSessionService(parentSession.type);
        const parentCredentialsInfo = await parentSessionService.generateCredentialsProxy(parentSession.sessionId);
        const parentCredentials = {
            ["sessionToken"]: parentCredentialsInfo.sessionToken.aws_session_token,
            ["accessKeyId"]: parentCredentialsInfo.sessionToken.aws_access_key_id,
            ["secretAccessKey"]: parentCredentialsInfo.sessionToken.aws_secret_access_key,
        };
        // Assume Role from parent
        // Prepare session credentials set parameters and client
        const sts = new client_sts_1.STSClient(this.awsCoreService.stsOptions(session, true, parentCredentials));
        // Configure IamRoleChained Account session parameters
        const roleSessionName = session.roleSessionName;
        const params = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            RoleSessionName: roleSessionName ? roleSessionName : constants_1.constants.roleSessionName,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            RoleArn: session.roleArn,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            DurationSeconds: constants_1.constants.samlRoleSessionDuration,
        };
        // Generate Session token
        return this.generateSessionToken(session, sts, params);
    }
    validateCredentials(sessionId) {
        return new Promise((resolve, _) => {
            this.generateCredentials(sessionId)
                .then((__) => {
                resolve(true);
            })
                .catch((__) => {
                resolve(false);
            });
        });
    }
    removeSecrets(_) { }
    async getCloneRequest(session) {
        return {
            profileId: session.profileId,
            region: session.region,
            sessionName: session.sessionName,
            roleArn: session.roleArn,
            parentSessionId: session.parentSessionId,
            roleSessionName: session.roleSessionName,
        };
    }
    async getAccountNumberFromCallerIdentity(session) {
        if (session.type === session_type_1.SessionType.awsIamRoleChained) {
            return `${session.roleArn.split("/")[0].substring(13, 25)}`;
        }
        else {
            throw new Error("AWS IAM Role Chained Session required");
        }
    }
    async generateSessionToken(session, sts, params) {
        try {
            // Assume Role
            const assumeRoleCommand = new client_sts_1.AssumeRoleCommand(params);
            const assumeRoleResponse = await sts.send(assumeRoleCommand);
            // Save session token expiration
            this.saveSessionTokenExpirationInTheSession(session, assumeRoleResponse.Credentials);
            // Generate correct object from session token response and return
            return AwsIamRoleChainedService.sessionTokenFromAssumeRoleResponse(assumeRoleResponse);
        }
        catch (err) {
            throw new leapp_aws_sts_error_1.LeappAwsStsError(this, err.message);
        }
    }
    saveSessionTokenExpirationInTheSession(session, credentials) {
        const sessions = this.repository.getSessions();
        const index = sessions.indexOf(session);
        const currentSession = sessions[index];
        if (credentials !== undefined) {
            currentSession.sessionTokenExpiration = credentials.Expiration.toISOString();
        }
        sessions[index] = currentSession;
        this.repository.updateSessions(sessions);
        this.sessionNotifier?.setSessions([...sessions]);
    }
}
exports.AwsIamRoleChainedService = AwsIamRoleChainedService;
