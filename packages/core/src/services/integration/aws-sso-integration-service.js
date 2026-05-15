"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsSsoIntegrationService = void 0;
const date_fns_1 = require("date-fns");
const constants_1 = require("../../models/constants");
const client_sso_1 = require("@aws-sdk/client-sso");
const session_type_1 = require("../../models/session-type");
const throttle_service_1 = require("../throttle-service");
const util_retry_1 = require("@aws-sdk/util-retry");
const portalUrlValidationRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/;
class AwsSsoIntegrationService {
    constructor(repository, keyChainService, behaviouralNotifier, nativeService, sessionFactory, awsSsoOidcService, awsSsoRoleService) {
        this.repository = repository;
        this.keyChainService = keyChainService;
        this.behaviouralNotifier = behaviouralNotifier;
        this.nativeService = nativeService;
        this.sessionFactory = sessionFactory;
        this.awsSsoOidcService = awsSsoOidcService;
        this.awsSsoRoleService = awsSsoRoleService;
    }
    static validateAlias(alias) {
        return alias.trim() !== "" ? true : "Empty alias";
    }
    static validatePortalUrl(portalUrl) {
        return portalUrlValidationRegex.test(portalUrl) ? true : "Invalid portal URL";
    }
    async createIntegration(creationParams, _integrationId) {
        this.repository.addAwsSsoIntegration(creationParams.portalUrl, creationParams.alias, creationParams.region, creationParams.browserOpening);
    }
    updateIntegration(id, updateParams) {
        const isOnline = this.repository.getAwsSsoIntegration(id).isOnline;
        this.repository.updateAwsSsoIntegration(id, updateParams.alias, updateParams.region, updateParams.portalUrl, updateParams.browserOpening, isOnline);
    }
    getIntegration(id) {
        return this.repository.getAwsSsoIntegration(id);
    }
    getIntegrations() {
        return this.repository.listAwsSsoIntegrations();
    }
    getOnlineIntegrations() {
        const integrations = this.repository.listAwsSsoIntegrations();
        return integrations.filter((integration) => integration.isOnline);
    }
    getOfflineIntegrations() {
        const integrations = this.repository.listAwsSsoIntegrations();
        return integrations.filter((integration) => !integration.isOnline);
    }
    async setOnline(integration, forcedState) {
        const expiration = new Date(integration.accessTokenExpiration).getTime();
        const now = this.getDate().getTime();
        const isOnline = !!integration.accessTokenExpiration && now < expiration;
        integration.isOnline = forcedState || isOnline;
        this.repository.updateAwsSsoIntegration(integration.id, integration.alias, integration.region, integration.portalUrl, integration.browserOpening, integration.isOnline, integration.accessTokenExpiration);
    }
    remainingHours(integration) {
        return (0, date_fns_1.formatDistance)(new Date(integration.accessTokenExpiration), this.getDate(), { addSuffix: true });
    }
    async loginAndGetSessionsDiff(integrationId, onUserAuthenticated) {
        const awsSsoIntegration = this.repository.getAwsSsoIntegration(integrationId);
        const region = awsSsoIntegration.region;
        const portalUrl = awsSsoIntegration.portalUrl;
        const accessToken = await this.getAccessToken(integrationId, region, portalUrl);
        onUserAuthenticated?.();
        const onlineSessions = await this.getSessions(integrationId, accessToken, region);
        const persistedSessions = this.repository.getAwsSsoIntegrationSessions(integrationId);
        const sessionsToDelete = [];
        for (const persistedSession of persistedSessions) {
            const shouldBeDeleted = !onlineSessions.find((s) => {
                const ssoRoleSession = persistedSession;
                return ssoRoleSession.sessionName === s.sessionName && ssoRoleSession.roleArn === s.roleArn && ssoRoleSession.email === s.email;
            });
            if (shouldBeDeleted) {
                sessionsToDelete.push(persistedSession);
            }
        }
        const sessionsToAdd = [];
        for (const onlineSession of onlineSessions) {
            const shouldBeCreated = !persistedSessions.find((persistedSession) => {
                const session = persistedSession;
                return (onlineSession.sessionName === session.sessionName && onlineSession.roleArn === session.roleArn && onlineSession.email === session.email);
            });
            if (shouldBeCreated) {
                sessionsToAdd.push(onlineSession);
            }
        }
        await this.setOnline(awsSsoIntegration, true);
        this.behaviouralNotifier.setIntegrations([...this.repository.listAwsSsoIntegrations(), ...this.repository.listAzureIntegrations()]);
        return { sessionsToDelete, sessionsToAdd };
    }
    async syncSessions(integrationId, onUserAuthenticated) {
        const sessionsDiff = await this.loginAndGetSessionsDiff(integrationId, onUserAuthenticated);
        for (const ssoRoleSession of sessionsDiff.sessionsToAdd) {
            ssoRoleSession.awsSsoConfigurationId = integrationId;
            await this.awsSsoRoleService.create(ssoRoleSession);
        }
        for (const ssoSession of sessionsDiff.sessionsToDelete) {
            const sessionService = this.sessionFactory.getSessionService(ssoSession.type);
            await sessionService.delete(ssoSession.sessionId);
        }
        return { sessionsDeleted: sessionsDiff.sessionsToDelete.length, sessionsAdded: sessionsDiff.sessionsToAdd.length };
    }
    async logout(integrationId) {
        // Obtain region and access token
        const integration = this.repository.getAwsSsoIntegration(integrationId);
        const region = integration.region;
        const savedAccessToken = await this.getAccessTokenFromKeychain(integrationId);
        // Configure Sso Portal Client
        this.setupSsoPortalClient(region);
        // Make a logout request to Sso
        const logoutRequest = { accessToken: savedAccessToken };
        if (savedAccessToken !== null) {
            try {
                await this.ssoPortal.logout(logoutRequest);
            }
            catch (error) {
                if (!(error.message === "Session token not found or invalid")) {
                    throw error;
                }
            }
        }
        // Clean clients
        this.ssoPortal = null;
        // Delete access token and remove sso integration info from workspace
        await this.keyChainService.deleteSecret(constants_1.constants.appName, this.getIntegrationAccessTokenKey(integrationId));
        this.repository.unsetAwsSsoIntegrationExpiration(integrationId);
        await this.setOnline(integration, false);
        this.behaviouralNotifier.setIntegrations([...this.repository.listAwsSsoIntegrations(), ...this.repository.listAzureIntegrations()]);
    }
    async getAccessToken(integrationId, region, portalUrl) {
        const isAwsSsoAccessTokenExpired = await this.isAwsSsoAccessTokenExpired(integrationId);
        if (isAwsSsoAccessTokenExpired) {
            const loginResponse = await this.login(integrationId, region, portalUrl);
            const integration = this.repository.getAwsSsoIntegration(integrationId);
            await this.configureAwsSso(integrationId, integration.alias, region, loginResponse.portalUrlUnrolled, integration.browserOpening, loginResponse.expirationTime.toISOString(), loginResponse.accessToken);
            return loginResponse.accessToken;
        }
        else {
            return await this.getAccessTokenFromKeychain(integrationId);
        }
    }
    async getRoleCredentials(accessToken, region, roleArn) {
        this.setupSsoPortalClient(region);
        const getRoleCredentialsRequest = {
            accountId: roleArn.substring(13, 25),
            roleName: roleArn.split("/")[1],
            accessToken,
        };
        return this.ssoPortal.getRoleCredentials(getRoleCredentialsRequest);
    }
    async getAwsSsoIntegrationTokenInfo(awsSsoIntegrationId) {
        const accessToken = await this.keyChainService.getSecret(constants_1.constants.appName, `aws-sso-integration-access-token-${awsSsoIntegrationId}`);
        const awsSsoIntegration = this.repository.getAwsSsoIntegration(awsSsoIntegrationId);
        const expiration = awsSsoIntegration ? new Date(awsSsoIntegration.accessTokenExpiration).getTime() : undefined;
        return { accessToken, expiration };
    }
    async isAwsSsoAccessTokenExpired(awsSsoIntegrationId) {
        const awsSsoAccessTokenInfo = await this.getAwsSsoIntegrationTokenInfo(awsSsoIntegrationId);
        return !awsSsoAccessTokenInfo.expiration || awsSsoAccessTokenInfo.expiration < this.getDate().getTime();
    }
    async deleteIntegration(integrationId) {
        await this.logout(integrationId);
        this.repository.deleteAwsSsoIntegration(integrationId);
        await this.deleteDependentSessions(integrationId);
    }
    async getSessions(integrationId, accessToken, region) {
        this.behaviouralNotifier.setFetchingIntegrations("");
        this.setupSsoPortalClient(region);
        const accounts = await this.listAccounts(accessToken);
        let accountSynced = 0;
        let errorFetching = false;
        const promiseArray = accounts.map((account) => this.getSessionsFromAccount(integrationId, account, accessToken).finally(() => {
            if (errorFetching)
                return;
            accountSynced++;
            this.behaviouralNotifier.setFetchingIntegrations(`Fetched ${accountSynced} of ${accounts.length} accounts...`);
        }));
        return (await Promise.all(promiseArray).finally(() => {
            errorFetching = true;
            this.behaviouralNotifier.setFetchingIntegrations(undefined);
        })).flat();
    }
    async configureAwsSso(integrationId, alias, region, portalUrl, browserOpening, expirationTime, accessToken) {
        const isOnline = this.repository.getAwsSsoIntegration(integrationId).isOnline;
        this.repository.updateAwsSsoIntegration(integrationId, alias, region, portalUrl, browserOpening, isOnline, expirationTime);
        await this.keyChainService.saveSecret(constants_1.constants.appName, this.getIntegrationAccessTokenKey(integrationId), accessToken);
    }
    async getAccessTokenFromKeychain(integrationId) {
        return await this.keyChainService.getSecret(constants_1.constants.appName, this.getIntegrationAccessTokenKey(integrationId));
    }
    getIntegrationAccessTokenKey(integrationId) {
        return `aws-sso-integration-access-token-${integrationId}`;
    }
    async login(integrationId, region, portalUrl) {
        const redirectClient = this.nativeService.followRedirects[this.getProtocol(portalUrl)];
        portalUrl = await new Promise((resolve, _) => {
            const request = redirectClient.request(portalUrl, (response) => resolve(response.responseUrl));
            request.end();
        });
        const generateSsoTokenResponse = await this.awsSsoOidcService.login(integrationId, region, portalUrl);
        return {
            portalUrlUnrolled: portalUrl,
            accessToken: generateSsoTokenResponse.accessToken,
            region,
            expirationTime: generateSsoTokenResponse.expirationTime,
        };
    }
    setupSsoPortalClient(region) {
        if (!this.ssoPortal || this.ssoPortal.config.region !== region) {
            const nextBackoffDelayComputationLambda = (attempt) => Math.floor(Math.random() * attempt * 1000);
            this.ssoPortal = new client_sso_1.SSO({
                region,
                maxAttempts: 30,
                retryStrategy: new util_retry_1.ConfiguredRetryStrategy(30, nextBackoffDelayComputationLambda),
            });
            this.listAccountRolesCall = new throttle_service_1.ThrottleService((...params) => this.ssoPortal.listAccountRoles({
                accessToken: params[0][0],
                accountId: params[0][1],
                maxResults: params[0][2],
                nextToken: params[0][3],
            }), constants_1.constants.maxSsoTps);
        }
    }
    async listAccounts(accessToken) {
        const listAccountsRequest = { accessToken, maxResults: 30 };
        const accountList = [];
        return new Promise((resolve, _) => {
            this.recursiveListAccounts(accountList, listAccountsRequest, resolve);
        });
    }
    recursiveListAccounts(accountList, listAccountsRequest, promiseCallback) {
        this.ssoPortal.listAccounts(listAccountsRequest).then((response) => {
            accountList.push(...response.accountList);
            if (response.nextToken !== null && response.nextToken !== undefined) {
                listAccountsRequest.nextToken = response.nextToken;
                this.recursiveListAccounts(accountList, listAccountsRequest, promiseCallback);
            }
            else {
                promiseCallback(accountList);
            }
        });
    }
    async getSessionsFromAccount(integrationId, accountInfo, accessToken) {
        const listAccountRolesRequest = {
            accountId: accountInfo.accountId,
            accessToken,
            maxResults: 30, // TODO: find a proper value
        };
        const accountRoles = [];
        await new Promise((resolve, reject) => {
            this.recursiveListRoles(accountRoles, listAccountRolesRequest, resolve, reject);
        });
        const awsSsoSessions = [];
        accountRoles.forEach((accountRole) => {
            const oldSession = this.findOldSession(accountInfo, accountRole);
            const awsSsoSession = {
                email: accountInfo.emailAddress,
                region: oldSession?.region || this.repository.getDefaultRegion() || constants_1.constants.defaultRegion,
                roleArn: `arn:aws:iam::${accountInfo.accountId}/${accountRole.roleName}`,
                sessionName: accountInfo.accountName,
                profileId: oldSession?.profileId || this.repository.getDefaultProfileId(),
                awsSsoConfigurationId: integrationId,
            };
            awsSsoSessions.push(awsSsoSession);
        });
        return awsSsoSessions;
    }
    recursiveListRoles(accountRoles, listAccountRolesRequest, resolve, reject) {
        this.listAccountRolesCall
            .callWithThrottle([
            listAccountRolesRequest.accessToken,
            listAccountRolesRequest.accountId,
            listAccountRolesRequest.maxResults,
            listAccountRolesRequest.nextToken,
        ])
            .then((response) => {
            accountRoles.push(...response.roleList);
            if (response.nextToken !== null && response.nextToken !== undefined) {
                listAccountRolesRequest.nextToken = response.nextToken;
                this.recursiveListRoles(accountRoles, listAccountRolesRequest, resolve, reject);
            }
            else {
                resolve();
            }
        })
            .catch((error) => reject(error));
    }
    findOldSession(accountInfo, accountRole) {
        const oldSession = this.repository
            .getSessions()
            .find((session) => session.type === session_type_1.SessionType.awsSsoRole &&
            session.email === accountInfo.emailAddress &&
            session.roleArn === `arn:aws:iam::${accountInfo.accountId}/${accountRole.roleName}`);
        return oldSession ? { region: oldSession.region, profileId: oldSession.profileId } : undefined;
    }
    async deleteDependentSessions(configurationId) {
        const ssoSessions = this.repository.getSessions().filter((session) => session.awsSsoConfigurationId === configurationId);
        for (const session of ssoSessions) {
            const sessionService = this.sessionFactory.getSessionService(session.type);
            await sessionService.delete(session.sessionId);
        }
    }
    getProtocol(aliasedUrl) {
        let protocol = aliasedUrl.split("://")[0];
        if (protocol.indexOf("https") === -1) {
            protocol = "http";
        }
        return protocol;
    }
    getDate() {
        return new Date();
    }
}
exports.AwsSsoIntegrationService = AwsSsoIntegrationService;
