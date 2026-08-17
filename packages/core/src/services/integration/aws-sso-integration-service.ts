import { Repository } from "../repository";
import { AwsSsoRoleService, LoginResponse, SsoRoleSession } from "../session/aws/aws-sso-role-service";
import { AwsSsoIntegration } from "../../models/aws/aws-sso-integration";
import { formatDistance } from "date-fns";
import { INativeService } from "../../interfaces/i-native-service";
import { AwsSsoOidcService } from "../aws-sso-oidc.service";
import { constants } from "../../models/constants";
import {
  AccountInfo,
  GetRoleCredentialsRequest,
  GetRoleCredentialsResponse,
  ListAccountRolesRequest,
  ListAccountsRequest,
  LogoutRequest,
  RoleInfo,
  SSO,
} from "@aws-sdk/client-sso";

import { SessionType } from "../../models/session-type";
import { AwsSsoRoleSession } from "../../models/aws/aws-sso-role-session";
import { IBehaviouralNotifier } from "../../interfaces/i-behavioural-notifier";
import { AwsSsoIntegrationTokenInfo } from "../../models/aws/aws-sso-integration-token-info";
import { SessionFactory } from "../session-factory";
import { IIntegrationService } from "../../interfaces/i-integration-service";
import { AwsSsoIntegrationCreationParams } from "../../models/aws/aws-sso-integration-creation-params";
import { ThrottleService } from "../throttle-service";
import { IKeychainService } from "../../interfaces/i-keychain-service";
import { ConfiguredRetryStrategy } from "@aws-sdk/util-retry";
import { LoggedException, LogLevel } from "../log-service";

const portalUrlValidationRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/;

export interface SsoSessionsDiff {
  sessionsToDelete: AwsSsoRoleSession[];
  sessionsToAdd: SsoRoleSession[];
}

export class AwsSsoIntegrationService implements IIntegrationService {
  private ssoPortal: SSO;
  private listAccountRolesCall: ThrottleService;

  constructor(
    public repository: Repository,
    public keyChainService: IKeychainService,
    public behaviouralNotifier: IBehaviouralNotifier,
    public nativeService: INativeService,
    public sessionFactory: SessionFactory,
    private awsSsoOidcService: AwsSsoOidcService,
    private awsSsoRoleService: AwsSsoRoleService
  ) {}

  static validateAlias(alias: string): boolean | string {
    return alias.trim() !== "" ? true : "Empty alias";
  }

  static validatePortalUrl(portalUrl: string): boolean | string {
    return portalUrlValidationRegex.test(portalUrl) ? true : "Invalid portal URL";
  }

  // AWS can invalidate an access token server-side (e.g. session duration changed by an administrator,
  // token revoked) before the expiration time Leapp saved locally, so clock-based checks are not enough.
  static isAuthenticationError(error: any): boolean {
    const authErrorNames = ["UnauthorizedException", "UnauthorizedClientException", "InvalidGrantException", "ExpiredTokenException"];
    return authErrorNames.includes(error?.name) || error?.$metadata?.httpStatusCode === 401;
  }

  async createIntegration(creationParams: AwsSsoIntegrationCreationParams, _integrationId?: string): Promise<void> {
    this.repository.addAwsSsoIntegration(creationParams.portalUrl, creationParams.alias, creationParams.region, creationParams.browserOpening);
  }

  updateIntegration(id: string, updateParams: AwsSsoIntegrationCreationParams): void {
    const isOnline = this.repository.getAwsSsoIntegration(id).isOnline;
    this.repository.updateAwsSsoIntegration(
      id,
      updateParams.alias,
      updateParams.region,
      updateParams.portalUrl,
      updateParams.browserOpening,
      isOnline
    );
  }

  getIntegration(id: string): AwsSsoIntegration {
    return this.repository.getAwsSsoIntegration(id);
  }

  getIntegrations(): AwsSsoIntegration[] {
    return this.repository.listAwsSsoIntegrations();
  }

  getOnlineIntegrations(): AwsSsoIntegration[] {
    const integrations = this.repository.listAwsSsoIntegrations();
    return integrations.filter((integration) => integration.isOnline);
  }

  getOfflineIntegrations(): AwsSsoIntegration[] {
    const integrations = this.repository.listAwsSsoIntegrations();
    return integrations.filter((integration) => !integration.isOnline);
  }

  async setOnline(integration: AwsSsoIntegration, forcedState?: boolean): Promise<void> {
    const expiration = new Date(integration.accessTokenExpiration).getTime();
    const now = this.getDate().getTime();
    const isOnline = !!integration.accessTokenExpiration && now < expiration;

    integration.isOnline = forcedState !== undefined ? forcedState : isOnline;

    this.repository.updateAwsSsoIntegration(
      integration.id,
      integration.alias,
      integration.region,
      integration.portalUrl,
      integration.browserOpening,
      integration.isOnline,
      integration.accessTokenExpiration
    );
  }

  remainingHours(integration: AwsSsoIntegration): string {
    return formatDistance(new Date(integration.accessTokenExpiration), this.getDate(), { addSuffix: true });
  }

  async loginAndGetSessionsDiff(integrationId: string, onUserAuthenticated?: () => void): Promise<SsoSessionsDiff> {
    const awsSsoIntegration = this.repository.getAwsSsoIntegration(integrationId);
    const region = awsSsoIntegration.region;
    const portalUrl = awsSsoIntegration.portalUrl;
    const accessToken = await this.getAccessToken(integrationId, region, portalUrl);
    onUserAuthenticated?.();

    let onlineSessions: SsoRoleSession[];
    try {
      onlineSessions = await this.getSessions(integrationId, accessToken, region);
    } catch (error) {
      if (!AwsSsoIntegrationService.isAuthenticationError(error)) {
        throw error;
      }
      const freshAccessToken = await this.getAccessToken(integrationId, region, portalUrl, true);
      onUserAuthenticated?.();
      onlineSessions = await this.getSessions(integrationId, freshAccessToken, region);
    }
    const persistedSessions = this.repository.getAwsSsoIntegrationSessions(integrationId);

    const sessionsToDelete: AwsSsoRoleSession[] = [];
    for (const persistedSession of persistedSessions) {
      const shouldBeDeleted = !onlineSessions.find((s) => {
        const ssoRoleSession = persistedSession as unknown as SsoRoleSession;
        return ssoRoleSession.sessionName === s.sessionName && ssoRoleSession.roleArn === s.roleArn && ssoRoleSession.email === s.email;
      });
      if (shouldBeDeleted) {
        sessionsToDelete.push(persistedSession as AwsSsoRoleSession);
      }
    }

    const sessionsToAdd = [];
    for (const onlineSession of onlineSessions) {
      const shouldBeCreated = !persistedSessions.find((persistedSession) => {
        const session = persistedSession as unknown as SsoRoleSession;
        return (
          onlineSession.sessionName === session.sessionName && onlineSession.roleArn === session.roleArn && onlineSession.email === session.email
        );
      });
      if (shouldBeCreated) {
        sessionsToAdd.push(onlineSession);
      }
    }

    await this.setOnline(awsSsoIntegration, true);
    this.behaviouralNotifier.setIntegrations([...this.repository.listAwsSsoIntegrations(), ...this.repository.listAzureIntegrations()]);

    return { sessionsToDelete, sessionsToAdd };
  }

  async syncSessions(integrationId: string, onUserAuthenticated?: () => void): Promise<any> {
    const sessionsDiff = await this.loginAndGetSessionsDiff(integrationId, onUserAuthenticated);
    const integrationName = this.repository?.getAwsSsoIntegration(integrationId)?.alias ?? "AWS SSO";
    const totalChanges = sessionsDiff.sessionsToAdd.length + sessionsDiff.sessionsToDelete.length;

    // Persisting sessions one by one can take a while for large organizations,
    // so keep reporting progress until the sync is truly complete
    try {
      if (totalChanges > 0) {
        this.behaviouralNotifier?.setFetchingIntegrations(`${integrationName}: applying session changes (0/${totalChanges})...`);
      }
      let appliedChanges = 0;
      const notifyProgress = () => {
        appliedChanges++;
        if (appliedChanges % 10 === 0 || appliedChanges === totalChanges) {
          this.behaviouralNotifier?.setFetchingIntegrations(`${integrationName}: applying session changes (${appliedChanges}/${totalChanges})...`);
        }
      };

      for (const ssoRoleSession of sessionsDiff.sessionsToAdd) {
        ssoRoleSession.awsSsoConfigurationId = integrationId;
        await this.awsSsoRoleService.create(ssoRoleSession);
        notifyProgress();
      }

      for (const ssoSession of sessionsDiff.sessionsToDelete) {
        const sessionService = this.sessionFactory.getSessionService(ssoSession.type);
        await sessionService.delete(ssoSession.sessionId);
        notifyProgress();
      }
    } finally {
      this.behaviouralNotifier?.setFetchingIntegrations(undefined);
    }

    return { sessionsDeleted: sessionsDiff.sessionsToDelete.length, sessionsAdded: sessionsDiff.sessionsToAdd.length };
  }

  async logout(integrationId: string): Promise<void> {
    // Obtain region and access token
    const integration: AwsSsoIntegration = this.repository.getAwsSsoIntegration(integrationId);
    const region = integration.region;
    const savedAccessToken = await this.getAccessTokenFromKeychain(integrationId);

    // Configure Sso Portal Client
    this.setupSsoPortalClient(region);

    // Make a logout request to Sso
    const logoutRequest: LogoutRequest = { accessToken: savedAccessToken };

    if (savedAccessToken !== null) {
      try {
        await this.ssoPortal.logout(logoutRequest);
      } catch (error) {
        // The local logout must always succeed: the remote token may already be expired,
        // revoked or invalid on the AWS side, and error messages vary between API versions
      }
    }

    // Clean clients
    this.ssoPortal = null;

    // Delete access token and remove sso integration info from workspace
    await this.keyChainService.deleteSecret(constants.appName, this.getIntegrationAccessTokenKey(integrationId));
    this.repository.unsetAwsSsoIntegrationExpiration(integrationId);
    integration.accessTokenExpiration = undefined;

    await this.setOnline(integration, false);
    this.behaviouralNotifier.setIntegrations([...this.repository.listAwsSsoIntegrations(), ...this.repository.listAzureIntegrations()]);
  }

  async getAccessToken(integrationId: string, region: string, portalUrl: string, forceRefresh: boolean = false): Promise<string> {
    const isAwsSsoAccessTokenExpired = await this.isAwsSsoAccessTokenExpired(integrationId);

    if (isAwsSsoAccessTokenExpired || forceRefresh) {
      const loginResponse = await this.login(integrationId, region, portalUrl);
      const integration: AwsSsoIntegration = this.repository.getAwsSsoIntegration(integrationId);

      await this.configureAwsSso(
        integrationId,
        integration.alias,
        region,
        loginResponse.portalUrlUnrolled,
        integration.browserOpening,
        loginResponse.expirationTime.toISOString(),
        loginResponse.accessToken
      );

      return loginResponse.accessToken;
    } else {
      return await this.getAccessTokenFromKeychain(integrationId);
    }
  }

  async getRoleCredentials(accessToken: string, region: string, roleArn: string): Promise<GetRoleCredentialsResponse> {
    this.setupSsoPortalClient(region);

    const getRoleCredentialsRequest: GetRoleCredentialsRequest = {
      accountId: roleArn.substring(13, 25),
      roleName: roleArn.split("/")[1],
      accessToken,
    };

    return this.ssoPortal.getRoleCredentials(getRoleCredentialsRequest);
  }

  async getAwsSsoIntegrationTokenInfo(awsSsoIntegrationId: string): Promise<AwsSsoIntegrationTokenInfo> {
    const accessToken = await this.keyChainService.getSecret(constants.appName, `aws-sso-integration-access-token-${awsSsoIntegrationId}`);
    const awsSsoIntegration = this.repository.getAwsSsoIntegration(awsSsoIntegrationId);
    const expiration = awsSsoIntegration ? new Date(awsSsoIntegration.accessTokenExpiration).getTime() : undefined;
    return { accessToken, expiration };
  }

  async isAwsSsoAccessTokenExpired(awsSsoIntegrationId: string): Promise<boolean> {
    const awsSsoAccessTokenInfo = await this.getAwsSsoIntegrationTokenInfo(awsSsoIntegrationId);
    return !awsSsoAccessTokenInfo.expiration || awsSsoAccessTokenInfo.expiration < this.getDate().getTime();
  }

  async deleteIntegration(integrationId: string): Promise<void> {
    await this.logout(integrationId);
    this.repository.deleteAwsSsoIntegration(integrationId);
    await this.deleteDependentSessions(integrationId);
  }

  private async getSessions(integrationId: string, accessToken: string, region: string): Promise<SsoRoleSession[]> {
    const integrationName = this.repository?.getAwsSsoIntegration(integrationId)?.alias ?? "AWS SSO";
    this.behaviouralNotifier.setFetchingIntegrations(`${integrationName}: retrieving account list...`);
    this.setupSsoPortalClient(region);
    try {
      const accounts: AccountInfo[] = await this.listAccounts(accessToken);
      this.behaviouralNotifier.setFetchingIntegrations(`${integrationName}: found ${accounts.length} accounts, fetching roles...`);

      let accountsSynced = 0;
      const results = await Promise.allSettled(
        accounts.map((account) =>
          this.getSessionsFromAccount(integrationId, account, accessToken).then((sessions) => {
            accountsSynced++;
            this.behaviouralNotifier.setFetchingIntegrations(`${integrationName}: fetched ${accountsSynced} of ${accounts.length} accounts...`);
            return sessions;
          })
        )
      );

      const failures = results.filter((result) => result.status === "rejected") as PromiseRejectedResult[];
      if (failures.length > 0) {
        // An authentication failure invalidates every account, so let the caller handle it (e.g. by re-logging in);
        // partial results must never be returned, otherwise the sync would delete the sessions of the failed accounts
        const authFailure = failures.find((failure) => AwsSsoIntegrationService.isAuthenticationError(failure.reason));
        if (authFailure) {
          throw authFailure.reason;
        }
        const firstReason = failures[0].reason;
        throw new LoggedException(
          `Failed to retrieve roles for ${failures.length} of ${accounts.length} accounts. First error: ${firstReason?.message ?? firstReason}`,
          this,
          LogLevel.error
        );
      }

      return results.map((result) => (result as PromiseFulfilledResult<SsoRoleSession[]>).value).flat();
    } finally {
      this.behaviouralNotifier.setFetchingIntegrations(undefined);
    }
  }

  private async configureAwsSso(
    integrationId: string,
    alias: string,
    region: string,
    portalUrl: string,
    browserOpening: string,
    expirationTime: string,
    accessToken: string
  ): Promise<void> {
    const isOnline = this.repository.getAwsSsoIntegration(integrationId).isOnline;
    this.repository.updateAwsSsoIntegration(integrationId, alias, region, portalUrl, browserOpening, isOnline, expirationTime);
    await this.keyChainService.saveSecret(constants.appName, this.getIntegrationAccessTokenKey(integrationId), accessToken);
  }

  private async getAccessTokenFromKeychain(integrationId: string | number): Promise<string> {
    return await this.keyChainService.getSecret(constants.appName, this.getIntegrationAccessTokenKey(integrationId));
  }

  private getIntegrationAccessTokenKey(integrationId: string | number) {
    return `aws-sso-integration-access-token-${integrationId}`;
  }

  private async login(integrationId: string | number, region: string, portalUrl: string): Promise<LoginResponse> {
    const redirectClient = this.nativeService.followRedirects[this.getProtocol(portalUrl)];
    const originalPortalUrl = portalUrl;
    portalUrl = await new Promise((resolve, _) => {
      const request = redirectClient.request(portalUrl, (response) => resolve(response.responseUrl));
      // A network error would otherwise emit an unhandled "error" event and leave this promise
      // (and the whole login) hanging forever; fall back to the original URL and let the
      // OIDC calls report a meaningful error if the network is really unavailable
      request.on("error", () => resolve(originalPortalUrl));
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

  private setupSsoPortalClient(region: string): void {
    if (!this.ssoPortal || this.ssoPortal.config.region !== region) {
      // Full jitter with a 1-second floor: the previous formula could return 0ms and hammer a throttled endpoint
      const nextBackoffDelayComputationLambda = (attempt: number) => 1000 + Math.floor(Math.random() * Math.min(attempt * 1000, 10000));
      this.ssoPortal = new SSO({
        region,
        maxAttempts: 30,
        retryStrategy: new ConfiguredRetryStrategy(30, nextBackoffDelayComputationLambda),
      });
      this.listAccountRolesCall = new ThrottleService(
        (...params) =>
          this.ssoPortal.listAccountRoles({
            accessToken: params[0][0],
            accountId: params[0][1],
            maxResults: params[0][2],
            nextToken: params[0][3],
          }),
        constants.maxSsoTps
      );
    }
  }

  private async listAccounts(accessToken: string): Promise<AccountInfo[]> {
    const listAccountsRequest: ListAccountsRequest = { accessToken, maxResults: constants.ssoPortalListMaxResults };
    const accountList: AccountInfo[] = [];

    // Errors must propagate to the caller: a swallowed rejection here used to leave the sync hanging forever
    let response;
    do {
      response = await this.ssoPortal.listAccounts(listAccountsRequest);
      accountList.push(...(response.accountList ?? []));
      listAccountsRequest.nextToken = response.nextToken || undefined;
    } while (listAccountsRequest.nextToken);

    return accountList;
  }

  private async getSessionsFromAccount(integrationId: string, accountInfo: AccountInfo, accessToken: string): Promise<SsoRoleSession[]> {
    const accountRoles: RoleInfo[] = await this.listAccountRoles(accountInfo, accessToken);

    const awsSsoSessions: SsoRoleSession[] = [];

    accountRoles.forEach((accountRole) => {
      const oldSession = this.findOldSession(accountInfo, accountRole);

      const awsSsoSession = {
        email: accountInfo.emailAddress,
        region: oldSession?.region || this.repository.getDefaultRegion() || constants.defaultRegion,
        roleArn: `arn:aws:iam::${accountInfo.accountId}/${accountRole.roleName}`,
        sessionName: accountInfo.accountName,
        profileId: oldSession?.profileId || this.repository.getDefaultProfileId(),
        awsSsoConfigurationId: integrationId,
      };

      awsSsoSessions.push(awsSsoSession);
    });

    return awsSsoSessions;
  }

  private async listAccountRoles(accountInfo: AccountInfo, accessToken: string): Promise<RoleInfo[]> {
    const listAccountRolesRequest: ListAccountRolesRequest = {
      accountId: accountInfo.accountId,
      accessToken,
      maxResults: constants.ssoPortalListMaxResults,
    };

    const accountRoles: RoleInfo[] = [];
    let response;
    do {
      response = await this.listAccountRolesCall.callWithThrottle([
        listAccountRolesRequest.accessToken,
        listAccountRolesRequest.accountId,
        listAccountRolesRequest.maxResults,
        listAccountRolesRequest.nextToken,
      ]);
      accountRoles.push(...(response.roleList ?? []));
      listAccountRolesRequest.nextToken = response.nextToken || undefined;
    } while (listAccountRolesRequest.nextToken);

    return accountRoles;
  }

  private findOldSession(accountInfo: AccountInfo, accountRole: RoleInfo): { region: string; profileId: string } {
    const oldSession = this.repository
      .getSessions()
      .find(
        (session: AwsSsoRoleSession) =>
          session.type === SessionType.awsSsoRole &&
          session.email === accountInfo.emailAddress &&
          session.roleArn === `arn:aws:iam::${accountInfo.accountId}/${accountRole.roleName}`
      );
    return oldSession ? { region: (oldSession as AwsSsoRoleSession).region, profileId: (oldSession as AwsSsoRoleSession).profileId } : undefined;
  }

  private async deleteDependentSessions(configurationId: string): Promise<void> {
    const ssoSessions = this.repository.getSessions().filter((session) => (session as any).awsSsoConfigurationId === configurationId);
    for (const session of ssoSessions) {
      const sessionService = this.sessionFactory.getSessionService(session.type);
      await sessionService.delete(session.sessionId);
    }
  }

  private getProtocol(aliasedUrl: string): string {
    let protocol = aliasedUrl.split("://")[0];
    if (protocol.indexOf("https") === -1) {
      protocol = "http";
    }
    return protocol;
  }

  private getDate(): Date {
    return new Date();
  }
}
