"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsSsoRoleService = void 0;
const aws_sso_role_session_1 = require("../../../models/aws/aws-sso-role-session");
const aws_session_service_1 = require("./aws-session-service");
const session_type_1 = require("../../../models/session-type");
const log_service_1 = require("../../log-service");
class AwsSsoRoleService extends aws_session_service_1.AwsSessionService {
    constructor(sessionNotifier, repository, fileService, keyChainService, awsCoreService, nativeService, awsSsoOidcService) {
        super(sessionNotifier, repository, awsCoreService, fileService);
        this.sessionNotifier = sessionNotifier;
        this.repository = repository;
        this.keyChainService = keyChainService;
        this.nativeService = nativeService;
        this.awsSsoOidcService = awsSsoOidcService;
        awsSsoOidcService.appendListener(this);
    }
    static sessionTokenFromGetSessionTokenResponse(getRoleCredentialResponse) {
        return {
            sessionToken: {
                ["aws_access_key_id"]: getRoleCredentialResponse.roleCredentials.accessKeyId.trim(),
                ["aws_secret_access_key"]: getRoleCredentialResponse.roleCredentials.secretAccessKey.trim(),
                ["aws_session_token"]: getRoleCredentialResponse.roleCredentials.sessionToken.trim(),
            },
        };
    }
    setAwsIntegrationDelegate(delegate) {
        this.awsIntegrationDelegate = delegate;
    }
    async catchClosingBrowserWindow() {
        const sessions = this.repository.listAwsSsoRoles();
        for (let i = 0; i < sessions.length; i++) {
            // Stop session
            const currentSession = sessions[i];
            await this.stop(currentSession.sessionId).then((_) => { });
        }
    }
    async create(request) {
        const session = new aws_sso_role_session_1.AwsSsoRoleSession(request.sessionName, request.region, request.roleArn, request.profileId, request.awsSsoConfigurationId, request.email);
        this.repository.addSession(session);
        this.sessionNotifier?.setSessions(this.repository.getSessions());
    }
    update(_, __) {
        throw new log_service_1.LoggedException(`Update is not supported for AWS SSO Role Session Type`, this, log_service_1.LogLevel.error, false);
    }
    async applyCredentials(sessionId, credentialsInfo) {
        const session = this.repository.getSessionById(sessionId);
        const profileName = this.repository.getProfileName(session.profileId);
        const credentialObject = {};
        credentialObject[profileName] = {
            ["aws_access_key_id"]: credentialsInfo.sessionToken.aws_access_key_id,
            ["aws_secret_access_key"]: credentialsInfo.sessionToken.aws_secret_access_key,
            ["aws_session_token"]: credentialsInfo.sessionToken.aws_session_token,
            region: session.region,
        };
        return await this.fileService.iniWriteSync(this.awsCoreService.awsCredentialPath(), credentialObject);
    }
    async deApplyCredentials(sessionId) {
        const session = this.repository.getSessionById(sessionId);
        const profileName = this.repository.getProfileName(session.profileId);
        const credentialsFile = await this.fileService.iniParseSync(this.awsCoreService.awsCredentialPath());
        delete credentialsFile[profileName];
        await this.fileService.replaceWriteSync(this.awsCoreService.awsCredentialPath(), credentialsFile);
    }
    generateCredentialsProxy(sessionId) {
        return this.generateCredentials(sessionId);
    }
    async generateCredentials(sessionId) {
        const session = this.repository.getSessionById(sessionId);
        const awsSsoConfiguration = this.repository.getAwsSsoIntegration(session.awsSsoConfigurationId);
        const region = awsSsoConfiguration.region;
        const portalUrl = awsSsoConfiguration.portalUrl;
        const roleArn = session.roleArn;
        let accessToken = await this.awsIntegrationDelegate.getAccessToken(session.awsSsoConfigurationId, region, portalUrl);
        let credentials;
        try {
            credentials = await this.awsIntegrationDelegate.getRoleCredentials(accessToken, region, roleArn);
        }
        catch (err) {
            accessToken = await this.awsIntegrationDelegate.getAccessToken(session.awsSsoConfigurationId, region, portalUrl, true);
            credentials = await this.awsIntegrationDelegate.getRoleCredentials(accessToken, region, roleArn);
        }
        const awsCredentials = {
            ["accessKeyId"]: credentials.roleCredentials.accessKeyId,
            ["secretAccessKey"]: credentials.roleCredentials.secretAccessKey,
            ["sessionToken"]: credentials.roleCredentials.sessionToken,
            ["expiration"]: new Date(credentials.roleCredentials.expiration),
        };
        // Save session token expiration
        this.saveSessionTokenExpirationInTheSession(session, awsCredentials);
        return AwsSsoRoleService.sessionTokenFromGetSessionTokenResponse(credentials);
    }
    async getAccountNumberFromCallerIdentity(session) {
        if (session.type === session_type_1.SessionType.awsSsoRole) {
            return `${session.roleArn.split("/")[0].substring(13, 25)}`;
        }
        else {
            throw new Error("AWS SSO Role Session required");
        }
    }
    sessionDeactivated(sessionId) {
        super.sessionDeactivated(sessionId);
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
        throw new log_service_1.LoggedException(`Clone is not supported for sessionType ${session.type}`, this, log_service_1.LogLevel.error, false);
    }
    saveSessionTokenExpirationInTheSession(session, credentials) {
        const sessions = this.repository.getSessions();
        const index = sessions.indexOf(session);
        const currentSession = sessions[index];
        if (credentials !== undefined) {
            currentSession.sessionTokenExpiration = credentials.expiration.toISOString();
        }
        sessions[index] = currentSession;
        this.repository.updateSessions(sessions);
        this.sessionNotifier?.setSessions([...sessions]);
    }
}
exports.AwsSsoRoleService = AwsSsoRoleService;
