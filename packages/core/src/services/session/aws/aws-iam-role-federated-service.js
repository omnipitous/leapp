"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsIamRoleFederatedService = void 0;
const aws_iam_role_federated_session_1 = require("../../../models/aws/aws-iam-role-federated-session");
const aws_session_service_1 = require("./aws-session-service");
const session_type_1 = require("../../../models/session-type");
const log_service_1 = require("../../log-service");
const client_sts_1 = require("@aws-sdk/client-sts");
class AwsIamRoleFederatedService extends aws_session_service_1.AwsSessionService {
    constructor(iSessionNotifier, repository, fileService, awsCoreService, awsAuthenticationService, samlRoleSessionDuration) {
        super(iSessionNotifier, repository, awsCoreService, fileService);
        this.awsAuthenticationService = awsAuthenticationService;
        this.samlRoleSessionDuration = samlRoleSessionDuration;
    }
    static sessionTokenFromGetSessionTokenResponse(assumeRoleResponse) {
        return {
            sessionToken: {
                ["aws_access_key_id"]: assumeRoleResponse.Credentials.AccessKeyId.trim(),
                ["aws_secret_access_key"]: assumeRoleResponse.Credentials.SecretAccessKey.trim(),
                ["aws_session_token"]: assumeRoleResponse.Credentials.SessionToken.trim(),
            },
        };
    }
    async create(request) {
        const session = new aws_iam_role_federated_session_1.AwsIamRoleFederatedSession(request.sessionName, request.region, request.idpUrl, request.idpArn, request.roleArn, request.profileId);
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
            session.idpUrlId = updateRequest.idpUrl;
            session.idpArn = updateRequest.idpArn;
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
        return await this.fileService.replaceWriteSync(this.awsCoreService.awsCredentialPath(), credentialsFile);
    }
    generateCredentialsProxy(sessionId) {
        return this.generateCredentials(sessionId);
    }
    async generateCredentials(sessionId) {
        // Get the session in question
        const session = this.repository.getSessionById(sessionId);
        let idpUrl;
        // Check if we need to authenticate
        let needToAuthenticate;
        try {
            // Get idpUrl
            idpUrl = this.repository.getIdpUrl(session.idpUrlId);
            needToAuthenticate = await this.awsAuthenticationService.needAuthentication(idpUrl);
        }
        catch (err) {
            throw new log_service_1.LoggedException(err.message, this, log_service_1.LogLevel.warn);
        }
        // AwsSignIn: retrieve the response hook
        const samlResponse = await this.awsAuthenticationService.awsSignIn(idpUrl, needToAuthenticate);
        // Setup STS to generate the credentials
        const sts = new client_sts_1.STSClient(this.awsCoreService.stsOptions(session));
        // Params for the calls
        const params = {
            ["PrincipalArn"]: session.idpArn,
            ["RoleArn"]: session.roleArn,
            ["SAMLAssertion"]: samlResponse,
            ["DurationSeconds"]: this.samlRoleSessionDuration,
        };
        // Invoke assumeRoleWithSAML
        const assumeRoleWithSamlResponse = await this.assumeRoleWithSAML(sts, params);
        // Save session token expiration
        this.saveSessionTokenExpirationInTheSession(session, assumeRoleWithSamlResponse.Credentials);
        // Generate credentials
        return AwsIamRoleFederatedService.sessionTokenFromGetSessionTokenResponse(assumeRoleWithSamlResponse);
    }
    async getAccountNumberFromCallerIdentity(session) {
        if (session.type === session_type_1.SessionType.awsIamRoleFederated) {
            return `${session.roleArn.split("/")[0].substring(13, 25)}`;
        }
        else {
            throw new Error("AWS IAM Role Federated Session required");
        }
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
            idpArn: session.idpArn,
            idpUrl: session.idpUrlId,
        };
    }
    async assumeRoleWithSAML(sts, params) {
        try {
            const assumeRoleWithSAMLCommand = new client_sts_1.AssumeRoleWithSAMLCommand({
                ["RoleArn"]: params["RoleArn"],
                ["PrincipalArn"]: params["PrincipalArn"],
                ["SAMLAssertion"]: params["SAMLAssertion"],
                ["DurationSeconds"]: params["DurationSeconds"],
            });
            return await sts.send(assumeRoleWithSAMLCommand);
        }
        catch (err) {
            throw new log_service_1.LoggedException(err.message, this, log_service_1.LogLevel.warn);
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
exports.AwsIamRoleFederatedService = AwsIamRoleFederatedService;
