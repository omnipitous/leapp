"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsSessionService = void 0;
const leapp_base_error_1 = require("../../../errors/leapp-base-error");
const aws_process_credential_1 = require("../../../models/aws/aws-process-credential");
const session_status_1 = require("../../../models/session-status");
const session_type_1 = require("../../../models/session-type");
const log_service_1 = require("../../log-service");
const session_service_1 = require("../session-service");
const constants_1 = require("../../../models/constants");
class AwsSessionService extends session_service_1.SessionService {
    /* This service manage the session manipulation as we need top generate credentials and maintain them for a specific duration */
    constructor(sessionNotifier, repository, awsCoreService, fileService) {
        super(sessionNotifier, repository);
        this.sessionNotifier = sessionNotifier;
        this.repository = repository;
        this.awsCoreService = awsCoreService;
        this.fileService = fileService;
    }
    getDependantSessions(sessionId) {
        return this.repository.listIamRoleChained(this.repository.getSessionById(sessionId));
    }
    async start(sessionId) {
        try {
            if (this.isThereAnotherPendingSessionWithSameNamedProfile(sessionId)) {
                throw new leapp_base_error_1.LeappBaseError("Pending session with same named profile", this, log_service_1.LogLevel.info, "Pending session with same named profile");
            }
            await this.stopAllWithSameNameProfile(sessionId);
            this.sessionLoading(sessionId);
            if (this.repository.getWorkspace().credentialMethod === constants_1.constants.credentialFile) {
                const credentialsInfo = await this.generateCredentials(sessionId);
                await this.applyCredentials(sessionId, credentialsInfo);
            }
            else {
                await this.applyConfigProfileCommand(sessionId);
            }
            this.sessionActivated(sessionId);
        }
        catch (error) {
            this.sessionError(sessionId, error);
        }
    }
    async rotate(sessionId) {
        try {
            // We don't need to rotate credentials when in  credential process mode
            if (this.repository.getWorkspace().credentialMethod === constants_1.constants.credentialFile) {
                this.sessionLoading(sessionId);
                const credentialsInfo = await this.generateCredentials(sessionId);
                await this.applyCredentials(sessionId, credentialsInfo);
                this.sessionActivated(sessionId);
            }
        }
        catch (error) {
            this.sessionError(sessionId, error);
        }
    }
    async stop(sessionId) {
        if (this.isInactive(sessionId)) {
            return;
        }
        try {
            if (this.repository.getWorkspace().credentialMethod === constants_1.constants.credentialFile) {
                await this.deApplyCredentials(sessionId);
            }
            else {
                await this.deApplyConfigProfileCommand(sessionId);
            }
            this.sessionDeactivated(sessionId);
        }
        catch (error) {
            this.sessionError(sessionId, error);
        }
    }
    async delete(sessionId) {
        try {
            if (this.repository.getSessionById(sessionId).status === session_status_1.SessionStatus.active) {
                await this.stop(sessionId);
            }
            for (const sess of this.getDependantSessions(sessionId)) {
                if (sess.status === session_status_1.SessionStatus.active) {
                    await this.stop(sess.sessionId);
                }
                this.repository.deleteSession(sess.sessionId);
            }
            this.repository.deleteSession(sessionId);
            this.sessionNotifier?.setSessions(this.repository.getSessions());
            await this.removeSecrets(sessionId);
        }
        catch (error) {
            this.sessionError(sessionId, error);
        }
    }
    async generateProcessCredentials(sessionId) {
        const session = this.repository.getSessionById(sessionId);
        if (session.type !== session_type_1.SessionType.azure) {
            const credentials = await this.generateCredentialsProxy(sessionId);
            const token = credentials.sessionToken;
            return new aws_process_credential_1.AwsProcessCredentials(1, token.aws_access_key_id, token.aws_secret_access_key, token.aws_session_token, session.sessionTokenExpiration);
        }
        else {
            throw new Error("only AWS sessions are supported");
        }
    }
    async applyConfigProfileCommand(sessionId) {
        try {
            const session = this.repository.getSessionById(sessionId);
            const command = `leapp session generate ${sessionId}`;
            const profileName = this.repository.getProfileName(session.profileId);
            const profile = `profile ${profileName}`;
            const credentialProcess = {};
            credentialProcess[profile] = {
                ["credential_process"]: command,
                region: session.region,
            };
            await this.fileService.iniWriteSync(this.awsCoreService.awsConfigPath(), credentialProcess);
        }
        catch (error) {
            this.sessionError(sessionId, error);
        }
    }
    async deApplyConfigProfileCommand(sessionId) {
        const session = this.repository.getSessionById(sessionId);
        const profileName = this.repository.getProfileName(session.profileId);
        const profile = `profile ${profileName}`;
        const credentialProcess = await this.fileService.iniParseSync(this.awsCoreService.awsConfigPath());
        delete credentialProcess[profile];
        await this.fileService.replaceWriteSync(this.awsCoreService.awsConfigPath(), credentialProcess);
    }
    isThereAnotherPendingSessionWithSameNamedProfile(sessionId) {
        const session = this.repository.getSessionById(sessionId);
        const profileId = session.profileId;
        const pendingSessions = this.repository.listPending();
        for (let i = 0; i < pendingSessions.length; i++) {
            if (pendingSessions[i].profileId === profileId && pendingSessions[i].sessionId !== sessionId) {
                return true;
            }
        }
        return false;
    }
    async stopAllWithSameNameProfile(sessionId) {
        // Get profile to check
        const session = this.repository.getSessionById(sessionId);
        const profileId = session.profileId;
        // Get all active sessions
        const activeSessions = this.repository.listActive();
        // Stop all that shares the same profile
        for (let i = 0; i < activeSessions.length; i++) {
            const sess = activeSessions[i];
            if (sess.profileId === profileId) {
                await this.stop(sess.sessionId);
            }
        }
    }
}
exports.AwsSessionService = AwsSessionService;
