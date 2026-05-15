"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsIamUserService = void 0;
const client_sts_1 = require("@aws-sdk/client-sts");
const aws_iam_user_session_1 = require("../../../models/aws/aws-iam-user-session");
const constants_1 = require("../../../models/constants");
const aws_session_service_1 = require("./aws-session-service");
const log_service_1 = require("../../log-service");
class AwsIamUserService extends aws_session_service_1.AwsSessionService {
    constructor(iSessionNotifier, repository, localMfaCodePrompter, remoteMfaCodePrompter, keychainService, fileService, awsCoreService) {
        super(iSessionNotifier, repository, awsCoreService, fileService);
        this.localMfaCodePrompter = localMfaCodePrompter;
        this.remoteMfaCodePrompter = remoteMfaCodePrompter;
        this.keychainService = keychainService;
        this.mfaCodePrompterProxy = localMfaCodePrompter;
    }
    static isTokenExpired(tokenExpiration) {
        const now = Date.now();
        return now > new Date(tokenExpiration).getTime();
    }
    static sessionTokenFromGetSessionTokenResponse(getSessionTokenResponse) {
        if (getSessionTokenResponse.Credentials === undefined) {
            throw new log_service_1.LoggedException("an error occurred during session token generation.", this, log_service_1.LogLevel.warn);
        }
        return {
            sessionToken: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                aws_access_key_id: getSessionTokenResponse.Credentials.AccessKeyId.trim(),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                aws_secret_access_key: getSessionTokenResponse.Credentials.SecretAccessKey.trim(),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                aws_session_token: getSessionTokenResponse.Credentials.SessionToken.trim(),
            },
        };
    }
    async create(request) {
        const session = new aws_iam_user_session_1.AwsIamUserSession(request.sessionName, request.region, request.profileId, request.mfaDevice);
        if (request.sessionId) {
            session.sessionId = request.sessionId;
        }
        if (request.awsAccount) {
            session.awsAccount = request.awsAccount;
        }
        await this.keychainService.saveSecret(constants_1.constants.appName, `${session.sessionId}-iam-user-aws-session-access-key-id`, request.accessKey);
        await this.keychainService.saveSecret(constants_1.constants.appName, `${session.sessionId}-iam-user-aws-session-secret-access-key`, request.secretKey);
        this.repository.addSession(session);
        this.sessionNotifier?.setSessions(this.repository.getSessions());
    }
    async update(sessionId, updateRequest) {
        const session = this.repository.getSessionById(sessionId);
        if (session) {
            session.sessionName = updateRequest.sessionName;
            session.region = updateRequest.region;
            session.mfaDevice = updateRequest.mfaDevice;
            session.profileId = updateRequest.profileId;
            if (updateRequest.accessKey) {
                await this.keychainService.saveSecret(constants_1.constants.appName, `${session.sessionId}-iam-user-aws-session-access-key-id`, updateRequest.accessKey);
            }
            if (updateRequest.secretKey) {
                await this.keychainService.saveSecret(constants_1.constants.appName, `${session.sessionId}-iam-user-aws-session-secret-access-key`, updateRequest.secretKey);
            }
            this.repository.updateSession(sessionId, session);
            this.sessionNotifier?.setSessions(this.repository.getSessions());
        }
    }
    async applyCredentials(sessionId, credentialsInfo) {
        const session = this.repository.getSessionById(sessionId);
        const profileName = this.repository.getProfileName(session.profileId);
        const credentialObject = {};
        credentialObject[profileName] = {
            // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/naming-convention
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
        //const session = this.behaviouralSubjectService.get(sessionId);
        const session = this.repository.getSessions().find((sess) => sess.sessionId === sessionId);
        const profileName = this.repository.getProfileName(session.profileId);
        const credentialsFile = await this.fileService.iniParseSync(this.awsCoreService.awsCredentialPath());
        delete credentialsFile[profileName];
        return await this.fileService.replaceWriteSync(this.awsCoreService.awsCredentialPath(), credentialsFile);
    }
    generateCredentialsProxy(sessionId) {
        return new Promise((resolve, reject) => {
            this.mfaCodePrompterProxy = this.remoteMfaCodePrompter;
            this.generateCredentials(sessionId)
                .then((credentialsInfo) => {
                this.mfaCodePrompterProxy = this.localMfaCodePrompter;
                resolve(credentialsInfo);
            })
                .catch((err) => {
                this.mfaCodePrompterProxy = this.localMfaCodePrompter;
                reject(err);
            });
        });
    }
    async generateCredentials(sessionId) {
        // Get the session in question
        //const session = this.behaviouralSubjectService.get(sessionId);
        const session = this.repository.getSessions().find((sess) => sess.sessionId === sessionId);
        if (session === undefined) {
            throw new log_service_1.LoggedException(`session with id ${sessionId} not found.`, this, log_service_1.LogLevel.warn);
        }
        // Retrieve session token expiration
        const tokenExpiration = session.sessionTokenExpiration;
        // Check if token is expired
        if (!tokenExpiration || AwsIamUserService.isTokenExpired(tokenExpiration)) {
            // Token is Expired!
            // Retrieve access keys from keychain
            const accessKeyId = await this.getAccessKeyFromKeychain(sessionId);
            const secretAccessKey = await this.getSecretKeyFromKeychain(sessionId);
            // Get session token
            // https://docs.aws.amazon.com/STS/latest/APIReference/API_GetSessionToken.html
            // AWS.config.update({ accessKeyId, secretAccessKey });
            const credentials = {
                ["accessKeyId"]: accessKeyId,
                ["secretAccessKey"]: secretAccessKey,
            };
            // Configure sts client options
            // const sts = new AWS.STS(this.awsCoreService.stsOptions(session));
            const sts = new client_sts_1.STSClient(this.awsCoreService.stsOptions(session, true, credentials));
            // Configure sts get-session-token api call params
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const params = { DurationSeconds: constants_1.constants.sessionTokenDuration };
            // Check if MFA is needed or not
            if (session.mfaDevice) {
                // Return session token after calling MFA modal
                return this.generateSessionTokenCallingMfaModal(session, sts, params);
            }
            else {
                // Return session token in the form of CredentialsInfo
                return this.generateSessionToken(session, sts, params);
            }
        }
        else {
            // Session Token is NOT expired
            try {
                // Retrieve session token from keychain
                return JSON.parse(await this.keychainService.getSecret(constants_1.constants.appName, `${session.sessionId}-iam-user-aws-session-token`));
            }
            catch (err) {
                throw new log_service_1.LoggedException(err.message, this, log_service_1.LogLevel.warn);
            }
        }
    }
    async getAccountNumberFromCallerIdentity(session) {
        // Get credentials
        const credentialsInfo = await this.generateCredentials(session.sessionId);
        // AWS.config.update({
        //   accessKeyId: credentials.sessionToken.aws_access_key_id,
        //   secretAccessKey: credentials.sessionToken.aws_secret_access_key,
        //   sessionToken: credentials.sessionToken.aws_session_token,
        // });
        const credentials = {
            ["SessionToken"]: credentialsInfo.sessionToken.aws_session_token,
            ["AccessKeyId"]: credentialsInfo.sessionToken.aws_access_key_id,
            ["SecretAccessKey"]: credentialsInfo.sessionToken.aws_secret_access_key,
        };
        // Configure sts client options
        try {
            // const sts = new AWS.STS(this.awsCoreService.stsOptions(session));
            const sts = new client_sts_1.STSClient(this.awsCoreService.stsOptions(session, true, credentials));
            const getCallerIdentityCommand = new client_sts_1.GetCallerIdentityCommand({});
            const response = await sts.send(getCallerIdentityCommand);
            // const response = await sts.getCallerIdentity({}).promise();
            return response.Account ?? "";
        }
        catch (err) {
            throw new log_service_1.LoggedException(err.message, this, log_service_1.LogLevel.warn);
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
    async removeSecrets(sessionId) {
        await this.removeAccessKeyFromKeychain(sessionId);
        await this.removeSecretKeyFromKeychain(sessionId);
        await this.removeSessionTokenFromKeychain(sessionId);
    }
    async getCloneRequest(session) {
        const accessKey = await this.getAccessKeyFromKeychain(session.sessionId);
        const secretKey = await this.getSecretKeyFromKeychain(session.sessionId);
        return {
            profileId: session.profileId,
            region: session.region,
            sessionName: session.sessionName,
            accessKey,
            secretKey,
        };
    }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    generateSessionTokenCallingMfaModal(session, sts, params) {
        return new Promise((resolve, reject) => {
            // TODO: think about timeout management
            //  handle condition in which mfaCodePrompter is null
            //  convert promptForMFACode into an async function (without callback...)!
            this.mfaCodePrompterProxy.promptForMFACode(session.sessionName, (value) => {
                if (value !== constants_1.constants.confirmClosed) {
                    params.SerialNumber = session.mfaDevice;
                    params.TokenCode = value;
                    // Return session token in the form of CredentialsInfo
                    resolve(this.generateSessionToken(session, sts, params));
                }
                else {
                    reject(new log_service_1.LoggedException("Missing Multi Factor Authentication code", this, log_service_1.LogLevel.warn));
                }
            });
        });
    }
    async getAccessKeyFromKeychain(sessionId) {
        return await this.keychainService.getSecret(constants_1.constants.appName, `${sessionId}-iam-user-aws-session-access-key-id`);
    }
    async getSecretKeyFromKeychain(sessionId) {
        return await this.keychainService.getSecret(constants_1.constants.appName, `${sessionId}-iam-user-aws-session-secret-access-key`);
    }
    async removeAccessKeyFromKeychain(sessionId) {
        await this.keychainService.deleteSecret(constants_1.constants.appName, `${sessionId}-iam-user-aws-session-access-key-id`);
    }
    async removeSecretKeyFromKeychain(sessionId) {
        await this.keychainService.deleteSecret(constants_1.constants.appName, `${sessionId}-iam-user-aws-session-secret-access-key`);
    }
    async removeSessionTokenFromKeychain(sessionId) {
        await this.keychainService.deleteSecret(constants_1.constants.appName, `${sessionId}-iam-user-aws-session-token`);
    }
    async generateSessionToken(session, sts, params) {
        try {
            // Invoke sts get-session-token api
            // const getSessionTokenResponse: GetSessionTokenResponse = await sts.getSessionToken(params).promise();
            const getSessionTokenCommand = new client_sts_1.GetSessionTokenCommand(params);
            const getSessionTokenResponse = await sts.send(getSessionTokenCommand);
            // Save session token expiration
            this.saveSessionTokenExpirationInTheSession(session, getSessionTokenResponse.Credentials);
            // Generate correct object from session token response
            const sessionToken = AwsIamUserService.sessionTokenFromGetSessionTokenResponse(getSessionTokenResponse);
            // Save in keychain the session token
            await this.keychainService.saveSecret(constants_1.constants.appName, `${session.sessionId}-iam-user-aws-session-token`, JSON.stringify(sessionToken));
            // Return Session Token
            return sessionToken;
        }
        catch (err) {
            throw new log_service_1.LoggedException(err.message, this, log_service_1.LogLevel.warn);
        }
    }
    saveSessionTokenExpirationInTheSession(session, credentials) {
        const sessions = this.repository.getSessions();
        const index = sessions.indexOf(session);
        const currentSession = sessions[index];
        if (credentials) {
            currentSession.sessionTokenExpiration = credentials.Expiration.toISOString();
        }
        sessions[index] = currentSession;
        this.repository.updateSessions(sessions);
        this.sessionNotifier?.setSessions([...sessions]);
    }
}
exports.AwsIamUserService = AwsIamUserService;
