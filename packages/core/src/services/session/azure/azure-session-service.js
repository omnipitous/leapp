"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureSessionService = void 0;
const azure_session_1 = require("../../../models/azure/azure-session");
const session_service_1 = require("../session-service");
const log_service_1 = require("../../log-service");
const session_status_1 = require("../../../models/session-status");
const constants_1 = require("../../../models/constants");
const session_type_1 = require("../../../models/session-type");
// TODO: refactor by calling AzureIntegrationService instead of Repository
class AzureSessionService extends session_service_1.SessionService {
    constructor(iSessionNotifier, repository, fileService, executeService, azureMsalCacheFile, nativeService, azurePersistenceService, logService) {
        super(iSessionNotifier, repository);
        this.fileService = fileService;
        this.executeService = executeService;
        this.azureMsalCacheFile = azureMsalCacheFile;
        this.nativeService = nativeService;
        this.azurePersistenceService = azurePersistenceService;
        this.logService = logService;
    }
    getDependantSessions(_) {
        return [];
    }
    async create(sessionRequest) {
        const session = new azure_session_1.AzureSession(sessionRequest.sessionName, sessionRequest.region, sessionRequest.subscriptionId, sessionRequest.tenantId, sessionRequest.azureIntegrationId);
        this.repository.addSession(session);
        this.sessionNotifier.setSessions(this.repository.getSessions());
    }
    async start(sessionId) {
        const session = this.repository.getSessionById(sessionId);
        await this.stopAllOtherSessions(sessionId);
        this.sessionLoading(sessionId);
        const subscriptionIdsToStart = this.repository
            .getSessions()
            .filter((sess) => sess.type === session_type_1.SessionType.azure &&
            (sess.status !== session_status_1.SessionStatus.inactive || sess.sessionId === sessionId) &&
            sess.azureIntegrationId === session.azureIntegrationId)
            .map((sess) => sess.subscriptionId);
        let sessionTokenExpiration;
        try {
            const integration = this.repository.getAzureIntegration(session.azureIntegrationId);
            const tokenExpiration = new Date(integration.tokenExpiration).getTime();
            await this.executeService.execute(`az configure --default location=${integration.region}`);
            await this.updateProfiles(session.azureIntegrationId, subscriptionIdsToStart, session.subscriptionId);
            if (integration.tokenExpiration === undefined || this.getNextRotationTime() > tokenExpiration) {
                await this.restoreSecretsFromKeychain(session.azureIntegrationId);
                await this.executeService.execute(`az account get-access-token --subscription ${session.subscriptionId}`, undefined, true);
                const msalTokenCache = await this.azurePersistenceService.loadMsalCache();
                const accessToken = Object.values(msalTokenCache.AccessToken).find((tokenObj) => tokenObj.realm === session.tenantId);
                this.repository.updateAzureIntegration(integration.id, integration.alias, integration.tenantId, integration.region, integration.isOnline, accessToken.expires_on);
                await this.moveRefreshTokenToKeychain(msalTokenCache, session.azureIntegrationId, session.tenantId);
                sessionTokenExpiration = await this.getAccessTokenExpiration(msalTokenCache, session.tenantId);
            }
        }
        catch (err) {
            this.sessionDeactivated(sessionId);
            throw new log_service_1.LoggedException(err.message, this, log_service_1.LogLevel.warn);
        }
        this.sessionActivated(sessionId, sessionTokenExpiration);
    }
    async rotate(sessionId) {
        const session = this.repository.getSessionById(sessionId);
        const integration = this.repository.getAzureIntegration(session.azureIntegrationId);
        const tokenExpiration = new Date(integration.tokenExpiration).getTime();
        if (this.getNextRotationTime() > tokenExpiration) {
            await this.start(sessionId);
        }
    }
    async stop(sessionId) {
        if (this.isInactive(sessionId)) {
            return;
        }
        this.sessionLoading(sessionId);
        try {
            const session = this.repository.getSessionById(sessionId);
            const subscriptionId = session.subscriptionId;
            const profile = await this.azurePersistenceService.loadProfile();
            let newProfileSubscriptions = [];
            if (profile.subscriptions.length > 1) {
                newProfileSubscriptions = profile.subscriptions.filter((sub) => sub.id !== subscriptionId);
                if (newProfileSubscriptions.filter((sub) => sub.isDefault === true).length === 0) {
                    newProfileSubscriptions[0].isDefault = true;
                }
                profile.subscriptions = newProfileSubscriptions;
                await this.azurePersistenceService.saveProfile(profile);
            }
            else {
                await this.executeService.execute("az logout");
                const integration = this.repository.getAzureIntegration(session.azureIntegrationId);
                this.repository.updateAzureIntegration(integration.id, integration.alias, integration.tenantId, integration.region, integration.isOnline, undefined);
            }
        }
        catch (err) {
            this.logService.log(new log_service_1.LoggedEntry(err.message, this, log_service_1.LogLevel.warn));
        }
        finally {
            this.sessionDeactivated(sessionId);
        }
    }
    async delete(sessionId) {
        try {
            if (this.repository.getSessionById(sessionId).status !== session_status_1.SessionStatus.inactive) {
                await this.stop(sessionId);
            }
            this.repository.deleteSession(sessionId);
            this.sessionNotifier.setSessions(this.repository.getSessions());
        }
        catch (error) {
            throw new log_service_1.LoggedException(error.message, this, log_service_1.LogLevel.warn);
        }
    }
    async validateCredentials(_sessionId) {
        return false;
    }
    async getCloneRequest(session) {
        throw new log_service_1.LoggedException(`Clone is not supported for sessionType ${session.type}`, this, log_service_1.LogLevel.error, false);
    }
    update(_, __) {
        throw new log_service_1.LoggedException(`Update is not supported for Azure Session Type`, this, log_service_1.LogLevel.error, false);
    }
    async restoreSecretsFromKeychain(integrationId) {
        let msalTokenCache;
        try {
            msalTokenCache = await this.azurePersistenceService.loadMsalCache();
        }
        catch (error) {
            throw new log_service_1.LoggedException(error.message, this, log_service_1.LogLevel.warn);
        }
        const secrets = await this.azurePersistenceService.getAzureSecrets(integrationId);
        msalTokenCache.Account = { [secrets.account[0]]: secrets.account[1] };
        msalTokenCache.RefreshToken = { [secrets.refreshToken[0]]: secrets.refreshToken[1] };
        msalTokenCache.AccessToken = {};
        msalTokenCache.IdToken = {};
        await this.azurePersistenceService.saveMsalCache(msalTokenCache);
    }
    async moveRefreshTokenToKeychain(msalTokenCache, integrationId, tenantId) {
        const accessToken = Object.values(msalTokenCache.AccessToken).find((tokenObj) => tokenObj.realm === tenantId);
        const refreshTokenEntry = Object.entries(msalTokenCache.RefreshToken).find((refreshTokenArr) => refreshTokenArr[1].home_account_id === accessToken.home_account_id);
        const secrets = await this.azurePersistenceService.getAzureSecrets(integrationId);
        secrets.refreshToken = refreshTokenEntry;
        await this.azurePersistenceService.setAzureSecrets(integrationId, secrets);
        msalTokenCache.RefreshToken = {};
        await this.azurePersistenceService.saveMsalCache(msalTokenCache);
    }
    async getAccessTokenExpiration(msalTokenCache, tenantId) {
        const accessToken = Object.values(msalTokenCache.AccessToken).find((tokenObj) => tokenObj.realm === tenantId);
        const expirationTime = new Date(parseInt(accessToken.expires_on, 10) * 1000);
        return expirationTime.toISOString();
    }
    async updateProfiles(integrationId, subscriptionIdsToStart, subscriptionId) {
        const secrets = await this.azurePersistenceService.getAzureSecrets(integrationId);
        const profile = secrets.profile;
        const subscriptions = profile.subscriptions
            .filter((sub) => subscriptionIdsToStart.includes(sub.id))
            .map((sub) => Object.assign(sub, { isDefault: sub.id === subscriptionId }));
        profile.subscriptions = subscriptions;
        await this.azurePersistenceService.saveProfile(profile);
    }
    async stopAllOtherSessions(sessionId) {
        const sessionsToStop = this.repository
            .getSessions()
            .filter((sess) => sess.type === session_type_1.SessionType.azure && sess.sessionId !== sessionId && sess.status !== session_status_1.SessionStatus.inactive);
        for (const sess of sessionsToStop) {
            await this.stop(sess.sessionId);
        }
    }
    getNextRotationTime() {
        const oneMinuteMargin = 60 * 1000;
        return new Date().getTime() + constants_1.constants.sessionDuration * 1000 + oneMinuteMargin;
    }
}
exports.AzureSessionService = AzureSessionService;
