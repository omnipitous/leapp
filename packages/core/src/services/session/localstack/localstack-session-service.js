"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalstackSessionService = void 0;
const leapp_base_error_1 = require("../../../errors/leapp-base-error");
const session_status_1 = require("../../../models/session-status");
const session_type_1 = require("../../../models/session-type");
const log_service_1 = require("../../log-service");
const session_service_1 = require("../session-service");
const constants_1 = require("../../../models/constants");
const localstack_session_1 = require("../../../models/localstack/localstack-session");
class LocalstackSessionService extends session_service_1.SessionService {
    /* This service manage the session manipulation as we need top generate credentials and maintain them for a specific duration */
    constructor(sessionNotifier, repository, awsCoreService, fileService) {
        super(sessionNotifier, repository);
        this.sessionNotifier = sessionNotifier;
        this.repository = repository;
        this.awsCoreService = awsCoreService;
        this.fileService = fileService;
        this.generateCredentials = () => {
            const credentials = {
                sessionToken: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    aws_access_key_id: "test",
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    aws_secret_access_key: "test",
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    endpoint_url: "http://localhost:4566",
                },
            };
            return Promise.resolve(credentials);
        };
    }
    async create(request) {
        const session = new localstack_session_1.LocalstackSession(request.sessionName, request.region, request.profileId);
        if (request.sessionId) {
            session.sessionId = request.sessionId;
        }
        this.repository.addSession(session);
        this.sessionNotifier?.setSessions(this.repository.getSessions());
    }
    async update(sessionId, updateRequest) {
        const session = this.repository.getSessionById(sessionId);
        if (session) {
            session.sessionName = updateRequest.sessionName;
            session.region = updateRequest.region;
            session.profileId = updateRequest.profileId;
            this.repository.updateSession(sessionId, session);
            this.sessionNotifier?.setSessions(this.repository.getSessions());
        }
    }
    async start(sessionId) {
        try {
            if (this.isThereAnotherPendingSessionWithSameNamedProfile(sessionId)) {
                throw new leapp_base_error_1.LeappBaseError("Pending session with same named profile", this, log_service_1.LogLevel.info, "Pending session with same named profile");
            }
            await this.stopAllWithSameNameProfile(sessionId);
            this.sessionLoading(sessionId);
            if (this.repository.getWorkspace().credentialMethod === constants_1.constants.credentialFile) {
                const credentialsInfo = await this.generateCredentials();
                await this.applyCredentials(sessionId, credentialsInfo);
            }
            else {
                await this.generateProcessCredentials(undefined);
            }
            this.sessionActivated(sessionId);
        }
        catch (error) {
            this.sessionError(sessionId, error);
        }
    }
    async rotate(sessionId) {
        console.log(`localstack session ${sessionId} opened not need to refresh`);
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
            this.repository.deleteSession(sessionId);
            this.sessionNotifier?.setSessions(this.repository.getSessions());
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
    applyCredentials(sessionId, credentialsInfo) {
        const session = this.repository.getSessionById(sessionId);
        if (session.type === session_type_1.SessionType.localstack) {
            const localStackSession = session;
            const profileName = this.repository.getProfileName(localStackSession.profileId);
            const credentialObject = {};
            credentialObject[profileName] = {
                // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/naming-convention
                aws_access_key_id: credentialsInfo.sessionToken.aws_access_key_id,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                aws_secret_access_key: credentialsInfo.sessionToken.aws_secret_access_key,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                endpoint_url: credentialsInfo.sessionToken.endpoint_url,
                region: session.region,
            };
            return this.fileService.iniWriteSync(this.awsCoreService.awsCredentialPath(), credentialObject);
        }
    }
    async generateProcessCredentials(_) {
        throw new Error("Localstack only support Credential file method, please switch back to it in the option panel.");
    }
    async deApplyCredentials(sessionId) {
        const session = this.repository.getSessions().find((sess) => sess.sessionId === sessionId);
        if (session.type === session_type_1.SessionType.localstack) {
            const localStackSession = session;
            const profileName = this.repository.getProfileName(localStackSession.profileId);
            const credentialsFile = await this.fileService.iniParseSync(this.awsCoreService.awsCredentialPath());
            delete credentialsFile[profileName];
            return await this.fileService.replaceWriteSync(this.awsCoreService.awsCredentialPath(), credentialsFile);
        }
    }
    // eslint-disable-next-line no-unused-vars
    getCloneRequest(session) {
        return Promise.resolve(undefined);
    }
    // eslint-disable-next-line no-unused-vars
    getDependantSessions(sessionId) {
        return [];
    }
    // eslint-disable-next-line no-unused-vars
    validateCredentials(sessionId) {
        return Promise.resolve(false);
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
exports.LocalstackSessionService = LocalstackSessionService;
