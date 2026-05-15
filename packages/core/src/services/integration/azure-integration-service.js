"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureIntegrationService = void 0;
const log_service_1 = require("../log-service");
const session_type_1 = require("../../models/session-type");
const session_status_1 = require("../../models/session-status");
class AzureIntegrationService {
    constructor(repository, behaviouralNotifier, nativeService, sessionFactory, executeService, azureSessionService, azurePersistenceService) {
        this.repository = repository;
        this.behaviouralNotifier = behaviouralNotifier;
        this.nativeService = nativeService;
        this.sessionFactory = sessionFactory;
        this.executeService = executeService;
        this.azureSessionService = azureSessionService;
        this.azurePersistenceService = azurePersistenceService;
    }
    static validateAlias(alias) {
        return alias.trim() !== "" ? true : "Empty alias";
    }
    static validateTenantId(tenantId) {
        return tenantId.trim() !== "" ? true : "Empty tenant id";
    }
    async checkCliVersion() {
        let output;
        try {
            output = await this.executeService.execute("az --version");
        }
        catch (stdError) {
            throw new log_service_1.LoggedException("Azure CLI is not installed.", this, log_service_1.LogLevel.error, true);
        }
        const tokens = output.split(/\s+/);
        const versionToken = tokens.find((token) => token.match(/^\d+\.\d+\.\d+$/));
        if (versionToken) {
            const [major, minor] = versionToken.split(".").map((v) => parseInt(v, 10));
            if (major < 2 || (major === 2 && minor < 30)) {
                throw new log_service_1.LoggedException("Unsupported Azure CLI version (< 2.30). Please update Azure CLI.", this, log_service_1.LogLevel.error, true);
            }
        }
        else {
            throw new log_service_1.LoggedException("Unknown Azure CLI version.", this, log_service_1.LogLevel.error, true);
        }
    }
    async createIntegration(creationParams, _integrationId) {
        await this.checkCliVersion();
        const defaultLocation = this.repository.getDefaultLocation();
        this.repository.addAzureIntegration(creationParams.alias, creationParams.tenantId, creationParams.region ?? defaultLocation);
    }
    updateIntegration(id, updateParams) {
        const isOnline = this.repository.getAzureIntegration(id).isOnline;
        const defaultLocation = this.repository.getDefaultLocation();
        const tokenExpiration = this.repository.getAzureIntegration(id).tokenExpiration;
        this.repository.updateAzureIntegration(id, updateParams.alias, updateParams.tenantId, defaultLocation, isOnline, tokenExpiration);
    }
    async deleteIntegration(id) {
        await this.logout(id);
        this.repository.deleteAzureIntegration(id);
    }
    getIntegration(integrationId) {
        return this.repository.getAzureIntegration(integrationId);
    }
    getIntegrations() {
        return this.repository.listAzureIntegrations();
    }
    async setOnline(integration, forcedState) {
        if (forcedState !== undefined) {
            integration.isOnline = forcedState;
        }
        else {
            const secret = await this.azurePersistenceService.getAzureSecrets(integration.id);
            const isAlreadyOnline = !!secret.profile && !!secret.account && !!secret.refreshToken;
            if (integration.isOnline && !isAlreadyOnline) {
                await this.logout(integration.id);
            }
            integration.isOnline = isAlreadyOnline;
        }
        this.repository.updateAzureIntegration(integration.id, integration.alias, integration.tenantId, integration.region, integration.isOnline, integration.tokenExpiration);
    }
    async logout(integrationId) {
        const integration = this.getIntegration(integrationId);
        if (integration.isOnline) {
            await this.azurePersistenceService.deleteAzureSecrets(integrationId);
        }
        await this.setOnline(integration, false);
        await this.deleteDependentSessions(integrationId);
        this.notifyIntegrationChanges();
    }
    remainingHours(_integration) {
        // Todo: handle azure remaining time if necessary
        return "90 days";
    }
    async syncSessions(integrationId) {
        const integration = this.getIntegration(integrationId);
        try {
            // TODO: remove/clean msal_token_cache!!!
            await this.executeService.execute(`az login --tenant ${integration.tenantId} 2>&1`);
        }
        catch (err) {
            const errorObject = JSON.parse(JSON.stringify(err));
            if (errorObject.code === 1 &&
                !errorObject.killed &&
                errorObject.signal === null &&
                errorObject.stdout.indexOf("ERROR: No subscriptions found for") !== -1) {
                await this.deleteDependentSessions(integrationId);
                // TODO: remove/clean msal_token_cache!!!
                throw new log_service_1.LoggedException(`No Azure Subscriptions found for integration: ${integration.alias}`, this, log_service_1.LogLevel.warn, true);
            }
            if (errorObject.code === null && errorObject.killed) {
                throw new log_service_1.LoggedException(`Timeout error during Azure login with integration: ${integration.alias}`, this, log_service_1.LogLevel.error, true);
            }
            throw new log_service_1.LoggedException(err.toString(), this, log_service_1.LogLevel.error, false);
        }
        const azureProfile = await this.azurePersistenceService.loadProfile();
        await this.moveSecretsToKeychain(integration, azureProfile);
        await this.setOnline(integration, true);
        this.notifyIntegrationChanges();
        // TODO: region is a parameter that is conceptually associated with the integration, not the session
        let sessionCreationRequests = azureProfile.subscriptions.map((sub) => ({
            region: integration.region,
            subscriptionId: sub.id,
            tenantId: integration.tenantId,
            sessionName: sub.name,
            azureIntegrationId: integrationId,
        }));
        const azureSessions = this.repository
            .getSessions()
            .filter((session) => session.type === session_type_1.SessionType.azure)
            .map((session) => session);
        for (const azureSession of azureSessions.filter((session) => session.azureIntegrationId !== integrationId && session.status !== session_status_1.SessionStatus.inactive)) {
            await this.azureSessionService.stop(azureSession.sessionId);
        }
        let sessionsToDelete = 0;
        const integrationSessions = azureSessions.filter((session) => session.azureIntegrationId === integrationId);
        for (const azureSession of integrationSessions) {
            const creationRequest = sessionCreationRequests.find((request) => azureSession.sessionName === request.sessionName &&
                azureSession.tenantId === request.tenantId &&
                azureSession.subscriptionId === request.subscriptionId &&
                azureSession.region === request.region);
            const isSessionToDelete = creationRequest === undefined;
            if (isSessionToDelete) {
                sessionsToDelete++;
                await this.azureSessionService.delete(azureSession.sessionId);
            }
            else {
                if (azureSession.status !== session_status_1.SessionStatus.inactive) {
                    await this.azureSessionService.stop(azureSession.sessionId);
                    await this.azureSessionService.start(azureSession.sessionId);
                }
                sessionCreationRequests = sessionCreationRequests.filter((request) => request !== creationRequest);
            }
        }
        for (const creationRequest of sessionCreationRequests) {
            await this.azureSessionService.create(creationRequest);
        }
        return { sessionsAdded: sessionCreationRequests.length, sessionsDeleted: sessionsToDelete };
    }
    notifyIntegrationChanges() {
        this.behaviouralNotifier.setIntegrations([...this.repository.listAwsSsoIntegrations(), ...this.repository.listAzureIntegrations()]);
    }
    async moveSecretsToKeychain(integration, azureProfile) {
        const msalTokenCache = await this.azurePersistenceService.loadMsalCache();
        const accessToken = Object.values(msalTokenCache.AccessToken).find((tokenObj) => tokenObj.realm === integration.tenantId);
        const accountEntry = Object.entries(msalTokenCache.Account).find((accountArr) => accountArr[1].home_account_id === accessToken.home_account_id);
        const refreshTokenEntry = Object.entries(msalTokenCache.RefreshToken).find((refreshTokenArr) => refreshTokenArr[1].home_account_id === accessToken.home_account_id);
        await this.azurePersistenceService.setAzureSecrets(integration.id, {
            profile: azureProfile,
            account: accountEntry,
            refreshToken: refreshTokenEntry,
        });
        await this.executeService.execute("az logout");
    }
    async deleteDependentSessions(integrationId) {
        const azureSessions = this.repository.getSessions().filter((session) => session.azureIntegrationId === integrationId);
        for (const session of azureSessions) {
            await this.azureSessionService.delete(session.sessionId);
        }
    }
}
exports.AzureIntegrationService = AzureIntegrationService;
