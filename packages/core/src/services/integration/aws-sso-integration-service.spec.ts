import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { AwsSsoIntegrationService } from "./aws-sso-integration-service";
import { IntegrationType } from "../../models/integration-type";
import { Session } from "../../models/session";
import { SessionType } from "../../models/session-type";
import { constants } from "../../models/constants";
import { ThrottleService } from "../throttle-service";
import { AccountInfo, ListAccountRolesCommandInput, RoleInfo } from "@aws-sdk/client-sso";

describe("AwsSsoIntegrationService", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("validateAlias - empty alias", () => {
    const aliasParam = "";
    const actualValidationResult = AwsSsoIntegrationService.validateAlias(aliasParam);

    expect(actualValidationResult).toBe("Empty alias");
  });

  test("validateAlias - only spaces alias", () => {
    const aliasParam = "      ";
    const actualValidationResult = AwsSsoIntegrationService.validateAlias(aliasParam);

    expect(actualValidationResult).toBe("Empty alias");
  });

  test("validateAlias - valid alias", () => {
    const aliasParam = "alias";
    const actualValidationResult = AwsSsoIntegrationService.validateAlias(aliasParam);

    expect(actualValidationResult).toBe(true);
  });

  test("validatePortalUrl - invalid Url", () => {
    const portalUrlParam = "www.url.com";
    const actualValidationPortalUrl = AwsSsoIntegrationService.validatePortalUrl(portalUrlParam);

    expect(actualValidationPortalUrl).toBe("Invalid portal URL");
  });

  test("validatePortalUrl - http Url", () => {
    const portalUrlParam = "http://www.url.com";
    const actualValidationPortalUrl = AwsSsoIntegrationService.validatePortalUrl(portalUrlParam);

    expect(actualValidationPortalUrl).toBe(true);
  });

  test("validatePortalUrl - https Url", () => {
    const portalUrlParam = "https://www.url.com";
    const actualValidationPortalUrl = AwsSsoIntegrationService.validatePortalUrl(portalUrlParam);

    expect(actualValidationPortalUrl).toBe(true);
  });

  test("getIntegrations", () => {
    const expectedIntegrations = [{ id: 1 }];
    const repository = {
      listAwsSsoIntegrations: () => expectedIntegrations,
    } as any;

    const awsIntegrationsService = new AwsSsoIntegrationService(repository, null, null, null, null, null, null);

    const integrations = awsIntegrationsService.getIntegrations();

    expect(integrations).toBe(expectedIntegrations);
  });

  test("remainingHours", () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null);
    const integration = {
      accessTokenExpiration: "2022-02-24T10:30:00",
    } as any;
    (awsIntegrationService as any).getDate = () => new Date("2022-02-24T10:00:00");
    const remainingHours = awsIntegrationService.remainingHours(integration);
    expect(remainingHours).toBe("in 30 minutes");
  });

  const cases = [
    [
      [
        // awsIntegrationSessions
        { sessionName: "sessionName1", roleArn: "roleArn1", email: "email1" },
        { sessionName: "sessionName2", roleArn: "roleArn2", email: "email2" },
      ],
      [
        // sessions
        { sessionName: "sessionName1", roleArn: "roleArn1", email: "email1" },
        { sessionName: "sessionName2", roleArn: "roleArn2", email: "email2" },
      ],
      //expectedResults
      [[], []],
    ],
    [
      [
        // awsIntegrationSessions
        { sessionName: "sessionName1", roleArn: "roleArn1", email: "email1" },
        { sessionName: "sessionName2", roleArn: "roleArn2", email: "email2" },
      ],
      // sessions
      [{ sessionName: "sessionName2", roleArn: "roleArn2", email: "email2" }],
      // expectedResults
      [[{ sessionName: "sessionName1", roleArn: "roleArn1", email: "email1" }], []],
    ],
    [
      // awsIntegrationSessions
      [
        // awsIntegrationSessions
        { sessionName: "sessionName1", roleArn: "roleArn1", email: "email1" },
      ],
      // sessions
      [
        { sessionName: "sessionName1", roleArn: "roleArn1", email: "email1" },
        { sessionName: "sessionName2", roleArn: "roleArn2", email: "email2" },
      ],
      // expectedResults
      [[], [{ sessionName: "sessionName2", roleArn: "roleArn2", email: "email2" }]],
    ],
  ];
  test.each(cases)("loginAndGetSessionsDiff %#", async (caseAwsIntegrationSessions, caseSessions, expectedResults) => {
    const integrationId = "integrationId";
    const awsSsoIntegration = {
      region: "region",
      portalUrl: "portalUrl",
    };
    const aws1 = {};
    const aws2 = {};
    const azr1 = {};
    const azr2 = {};
    const awsIntegrationSessions = caseAwsIntegrationSessions;
    const repository = {
      getAwsSsoIntegration: jest.fn(() => awsSsoIntegration),
      getAwsSsoIntegrationSessions: jest.fn(() => awsIntegrationSessions),
      updateAwsSsoIntegration: jest.fn(() => {}),
      listAwsSsoIntegrations: jest.fn(() => [aws1, aws2]),
      listAzureIntegrations: jest.fn(() => [azr1, azr2]),
    };
    const behavioralNotifier = {
      setIntegrations: jest.fn(() => {}),
      getSessions: () => [],
      getSessionById: () => ({} as Session),
      setSessions: () => {},
      getIntegrations: () => [],
    };
    const accessToken = "accessToken";
    const getAccessToken = jest.fn(async () => accessToken);
    const sessions = caseSessions;
    const getSessions = jest.fn(async () => sessions);

    const awsSsoIntegrationService = new AwsSsoIntegrationService(repository as any, null, behavioralNotifier as any, null, null, null, null);

    (awsSsoIntegrationService as any).getAccessToken = getAccessToken;
    (awsSsoIntegrationService as any).getSessions = getSessions;

    const sessionDiff = await awsSsoIntegrationService.loginAndGetSessionsDiff(integrationId);

    expect(sessionDiff.sessionsToDelete).toEqual(expectedResults[0]);
    expect(sessionDiff.sessionsToAdd).toEqual(expectedResults[1]);
    expect(repository.getAwsSsoIntegration).toHaveBeenCalledWith(integrationId);
    expect(getAccessToken).toHaveBeenCalledWith(integrationId, awsSsoIntegration.region, awsSsoIntegration.portalUrl);
    expect(getSessions).toHaveBeenCalledWith(integrationId, accessToken, awsSsoIntegration.region);
    expect(repository.getAwsSsoIntegrationSessions).toHaveBeenCalledWith(integrationId);
    expect(behavioralNotifier.setIntegrations).toHaveBeenCalledWith([aws1, aws2, azr1, azr2]);
  });

  test("syncSessions", async () => {
    const integrationId = "integrationId";
    const sessionDiff = {
      sessionsToDelete: [
        {
          type: "type",
          sessionId: "sessionId",
        },
      ],
      sessionsToAdd: [
        {
          awsSsoConfigurationId: "configurationId",
        },
      ],
    };
    const loginAndGetSessionsDiff = jest.fn(async () => sessionDiff);
    const awsSsoRoleService = {
      create: jest.fn(() => {}),
    };
    const sessionService = {
      delete: jest.fn(async () => {}),
    };
    const sessionFactory = {
      getSessionService: jest.fn(() => sessionService),
    };

    const awsSsoIntegrationService = new AwsSsoIntegrationService(null, null, null, null, sessionFactory as any, null, awsSsoRoleService as any);
    (awsSsoIntegrationService as any).loginAndGetSessionsDiff = loginAndGetSessionsDiff;

    const syncedSessions = await awsSsoIntegrationService.syncSessions(integrationId, "onAuthenticatedCallback" as any);

    expect(syncedSessions).toEqual({ sessionsAdded: 1, sessionsDeleted: 1 });
    expect(loginAndGetSessionsDiff).toHaveBeenCalledWith(integrationId, "onAuthenticatedCallback");
    expect(awsSsoRoleService.create).toHaveBeenCalledWith({
      awsSsoConfigurationId: "integrationId",
    });
    expect(sessionFactory.getSessionService).toHaveBeenCalledWith("type");
    expect(sessionService.delete).toHaveBeenCalledWith("sessionId");
  });

  test("logout", async () => {
    const awsSsoIntegration = { region: "fake-region" };
    const repository = {
      getAwsSsoIntegration: jest.fn(() => awsSsoIntegration),
      unsetAwsSsoIntegrationExpiration: jest.fn(),
      listAwsSsoIntegrations: () => ["aws-integration-1"],
      listAzureIntegrations: () => ["azure-integration-1"],
    } as any;
    const keyChainService = { deleteSecret: jest.fn(async () => {}) } as any;
    const behaviouralNotifier = { setIntegrations: jest.fn() } as any;

    const awsIntegrationService = new AwsSsoIntegrationService(repository, keyChainService, behaviouralNotifier, null, null, null, null) as any;
    const savedAccessToken = "fake-access-token";
    awsIntegrationService.getAccessTokenFromKeychain = jest.fn(async () => savedAccessToken);
    awsIntegrationService.setupSsoPortalClient = jest.fn();
    const logoutFnMock = jest.fn(() => {});
    awsIntegrationService.ssoPortal = { logout: logoutFnMock };
    const fakeIntegrationAccessToken = "fake-integration-access-token";
    awsIntegrationService.getIntegrationAccessTokenKey = jest.fn(() => fakeIntegrationAccessToken);
    awsIntegrationService.setOnline = jest.fn(async () => {});

    const fakeIntegrationId = "fake-integration-id";
    await awsIntegrationService.logout(fakeIntegrationId);

    expect(repository.getAwsSsoIntegration).toHaveBeenCalledWith(fakeIntegrationId);
    expect(awsIntegrationService.getAccessTokenFromKeychain).toHaveBeenCalledWith(fakeIntegrationId);
    expect(awsIntegrationService.setupSsoPortalClient).toHaveBeenCalledWith(awsSsoIntegration.region);
    expect(logoutFnMock).toHaveBeenCalledWith({ accessToken: savedAccessToken });
    expect(keyChainService.deleteSecret).toHaveBeenCalledWith(constants.appName, fakeIntegrationAccessToken);
    expect(awsIntegrationService.getIntegrationAccessTokenKey).toHaveBeenCalledWith(fakeIntegrationId);
    expect(repository.unsetAwsSsoIntegrationExpiration).toHaveBeenCalledWith(fakeIntegrationId);
    expect(awsIntegrationService.setOnline).toHaveBeenCalledWith(awsSsoIntegration, false);
    expect(behaviouralNotifier.setIntegrations).toHaveBeenCalledWith(["aws-integration-1", "azure-integration-1"]);

    expect(awsIntegrationService.ssoPortal).toBeNull();
  });

  test("getAccessToken, token expired", async () => {
    const integration = { alias: "fake-alias", browserOpening: "fake-browser-opening" };
    const repository = { getAwsSsoIntegration: jest.fn(() => integration) } as any;
    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, null, null, null, null, null) as any;
    awsIntegrationService.isAwsSsoAccessTokenExpired = jest.fn(async () => true);
    const loginResponse = { portalUrlUnrolled: "fake-portal-url-unrolled", expirationTime: new Date(0), accessToken: "fake-access-token" };
    awsIntegrationService.login = jest.fn(async () => loginResponse);
    awsIntegrationService.configureAwsSso = jest.fn(async () => {});

    const fakeIntegrationId = "fake-integration-id";
    const fakeRegion = "fake-region";
    const fakePortalUrl = "fake-portal-url";
    const actualAccessToken = await awsIntegrationService.getAccessToken(fakeIntegrationId, fakeRegion, fakePortalUrl);
    expect(actualAccessToken).toBe(loginResponse.accessToken);

    expect(awsIntegrationService.isAwsSsoAccessTokenExpired).toHaveBeenCalledWith(fakeIntegrationId);
    expect(awsIntegrationService.login).toHaveBeenCalledWith(fakeIntegrationId, fakeRegion, fakePortalUrl);
    expect(repository.getAwsSsoIntegration).toHaveBeenCalledWith(fakeIntegrationId);
    expect(awsIntegrationService.configureAwsSso).toHaveBeenCalledWith(
      fakeIntegrationId,
      integration.alias,
      fakeRegion,
      loginResponse.portalUrlUnrolled,
      integration.browserOpening,
      "1970-01-01T00:00:00.000Z",
      loginResponse.accessToken
    );
  });

  test("getAccessToken, token not expired", async () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null) as any;
    awsIntegrationService.isAwsSsoAccessTokenExpired = jest.fn(async () => false);
    const fakeToken = "fake-token";
    awsIntegrationService.getAccessTokenFromKeychain = jest.fn(async () => fakeToken);

    const fakeIntegrationId = "fake-integration-id";
    const actualAccessToken = await awsIntegrationService.getAccessToken(fakeIntegrationId, null, null);
    expect(actualAccessToken).toBe(fakeToken);

    expect(awsIntegrationService.getAccessTokenFromKeychain).toHaveBeenCalledWith(fakeIntegrationId);
  });

  test("getRoleCredentials", async () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null) as any;
    awsIntegrationService.setupSsoPortalClient = jest.fn();
    const credentials = { credentials: "secret" };
    awsIntegrationService.ssoPortal = { getRoleCredentials: jest.fn(() => new Promise((resolve, _reject) => resolve(credentials))) };

    const fakeRegion = "fake-region";
    const fakeAccessToken = "fake-access-token";
    const actualCredentials = await awsIntegrationService.getRoleCredentials(fakeAccessToken, fakeRegion, "arn:aws:iam::123456789012/RoleName");

    expect(awsIntegrationService.setupSsoPortalClient).toHaveBeenCalledWith(fakeRegion);
    expect(awsIntegrationService.ssoPortal.getRoleCredentials).toHaveBeenCalledWith({
      accessToken: fakeAccessToken,
      accountId: "123456789012",
      roleName: "RoleName",
    });
    expect(actualCredentials).toBe(credentials);
  });

  test("getAwsSsoIntegrationTokenInfo, existing integration", async () => {
    const integration = { accessTokenExpiration: new Date(1984).toISOString() };
    const repository = { getAwsSsoIntegration: jest.fn(() => integration) } as any;
    const accessToken = "fake-access-token";
    const keyChainService = { getSecret: jest.fn(async () => accessToken) } as any;
    const awsIntegrationService = new AwsSsoIntegrationService(repository, keyChainService, null, null, null, null, null) as any;
    const awsSsoIntegrationId = "integration-id";
    const tokenInfo = await awsIntegrationService.getAwsSsoIntegrationTokenInfo(awsSsoIntegrationId);
    expect(tokenInfo).toEqual({ accessToken, expiration: 1984 });

    expect(keyChainService.getSecret).toHaveBeenCalledWith(constants.appName, `aws-sso-integration-access-token-${awsSsoIntegrationId}`);
    expect(repository.getAwsSsoIntegration).toHaveBeenCalledWith(awsSsoIntegrationId);
  });

  test("getAwsSsoIntegrationTokenInfo, integration not found", async () => {
    const repository = { getAwsSsoIntegration: () => undefined } as any;
    const accessToken = "fake-access-token";
    const keyChainService = { getSecret: async () => accessToken } as any;
    const awsIntegrationService = new AwsSsoIntegrationService(repository, keyChainService, null, null, null, null, null) as any;
    const awsSsoIntegrationId = "integration-id";
    const tokenInfo = await awsIntegrationService.getAwsSsoIntegrationTokenInfo(awsSsoIntegrationId);
    expect(tokenInfo).toEqual({ accessToken, expiration: undefined });
  });

  test("isAwsSsoAccessTokenExpired, not expired", async () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null) as any;
    awsIntegrationService.getDate = () => new Date(1984);
    awsIntegrationService.getAwsSsoIntegrationTokenInfo = jest.fn(async () => ({ expiration: 1987 }));

    const integrationId = "fake-integration-id";
    const result = await awsIntegrationService.isAwsSsoAccessTokenExpired(integrationId);

    expect(result).toBe(false);
    expect(awsIntegrationService.getAwsSsoIntegrationTokenInfo).toHaveBeenCalledWith(integrationId);
  });

  test("isAwsSsoAccessTokenExpired, expired", async () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null) as any;
    awsIntegrationService.getDate = () => new Date(1988);
    awsIntegrationService.getAwsSsoIntegrationTokenInfo = async () => ({ expiration: 1987 });

    const integrationId = "fake-integration-id";
    const result = await awsIntegrationService.isAwsSsoAccessTokenExpired(integrationId);

    expect(result).toBe(true);
  });

  test("isAwsSsoAccessTokenExpired, expired with expiration undefined", async () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null) as any;
    awsIntegrationService.getDate = () => new Date(1984);
    awsIntegrationService.getAwsSsoIntegrationTokenInfo = async () => ({});

    const integrationId = "fake-integration-id";
    const result = await awsIntegrationService.isAwsSsoAccessTokenExpired(integrationId);

    expect(result).toBe(true);
  });

  test("getDate", () => {
    jest.useFakeTimers();

    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null) as any;
    jest.setSystemTime(1984);

    const time = awsIntegrationService.getDate() as Date;
    expect(time.getTime()).toBe(1984);
  });

  test("getIntegrationAccessTokenKey", () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null);
    const integrationId = "integration1";

    const actualIntegrationAccessTokenKey = (awsIntegrationService as any).getIntegrationAccessTokenKey(integrationId);

    expect(actualIntegrationAccessTokenKey).toBe(`aws-sso-integration-access-token-${integrationId}`);
  });

  test("login", async () => {
    const portalUrl = "fake-portal-url";
    const resolvedPortalUrl = "fake-resolved-portal-url";

    const requestMock = { end: jest.fn(), on: jest.fn() };
    const httpClient = {
      request: jest.fn((actualPortalUrl, responseFn: any) => {
        expect(actualPortalUrl).toBe(portalUrl);
        responseFn({ responseUrl: resolvedPortalUrl });
        return requestMock;
      }),
    };
    const nativeService = {
      followRedirects: { https: httpClient },
    } as any;

    const generateSsoTokenResponse = { accessToken: "fake-access-token", expirationTime: "fake-expiration-time" };
    const awsSsoOidcService = {
      login: jest.fn(async () => generateSsoTokenResponse),
    } as any;

    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, nativeService, null, awsSsoOidcService, null) as any;
    awsIntegrationService.getProtocol = jest.fn(() => "https");

    const integrationId = "fake-integration-id";
    const region = "fake-region";
    const loginResponse = await awsIntegrationService.login(integrationId, region, portalUrl);
    expect(loginResponse).toEqual({
      portalUrlUnrolled: resolvedPortalUrl,
      accessToken: generateSsoTokenResponse.accessToken,
      region,
      expirationTime: generateSsoTokenResponse.expirationTime,
    });

    expect(awsIntegrationService.getProtocol).toHaveBeenCalledWith(portalUrl);
    expect(requestMock.end).toHaveBeenCalled();
    expect(awsSsoOidcService.login).toHaveBeenCalledWith(integrationId, region, resolvedPortalUrl);
  });

  test("login - falls back to the original portal URL if the redirect request fails", async () => {
    const portalUrl = "fake-portal-url";

    const requestMock = {
      end: jest.fn(),
      on: jest.fn((event: string, errorFn: any) => {
        expect(event).toBe("error");
        errorFn(new Error("network error"));
      }),
    };
    const httpClient = { request: jest.fn(() => requestMock) };
    const nativeService = { followRedirects: { https: httpClient } } as any;

    const generateSsoTokenResponse = { accessToken: "fake-access-token", expirationTime: "fake-expiration-time" };
    const awsSsoOidcService = { login: jest.fn(async () => generateSsoTokenResponse) } as any;

    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, nativeService, null, awsSsoOidcService, null) as any;
    awsIntegrationService.getProtocol = jest.fn(() => "https");

    const loginResponse = await awsIntegrationService.login("fake-integration-id", "fake-region", portalUrl);
    expect(loginResponse.portalUrlUnrolled).toBe(portalUrl);
    expect(awsSsoOidcService.login).toHaveBeenCalledWith("fake-integration-id", "fake-region", portalUrl);
  });

  test("setupSsoPortalClient, sso portal not set up", async () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null) as any;

    const fakeRegion = "fake-region";
    awsIntegrationService.setupSsoPortalClient(fakeRegion);

    const region = await awsIntegrationService.ssoPortal.config.region();
    const retryStrategy = await awsIntegrationService.ssoPortal.config.retryStrategy();
    const maxAttempts = await retryStrategy.maxAttempts();

    expect(region).toBe(fakeRegion);
    expect(maxAttempts).toBe(30);
    expect(awsIntegrationService.listAccountRolesCall).toBeInstanceOf(ThrottleService);
    expect(awsIntegrationService.listAccountRolesCall.minDelay).toBe(200);

    let actualRetryTime = retryStrategy.computeNextBackoffDelay(30);
    expect(actualRetryTime).toBeLessThanOrEqual(30000);
    expect(actualRetryTime).toBeGreaterThanOrEqual(0);

    // It tries to generate a new random custom backoff delay for 1 second;
    // if, after one second, the last generated backoff delay is still equal to
    // the original one, it means the custom backoff generation function does
    // not generate a random value.
    const startTime = Date.now();
    while (actualRetryTime === (actualRetryTime = retryStrategy.computeNextBackoffDelay(30))) {
      if (Date.now() - startTime > 1000) {
        throw new Error("customBackoff function is not randomic!");
      }
    }

    const callParams = [["mocked-access-token", "mocked-account-id", "mocked-max-results", "mocked-next-token"]];
    const callPromise = "fake-call-promise";
    awsIntegrationService.ssoPortal = {
      ["listAccountRoles"]: (args: ListAccountRolesCommandInput) => {
        expect(args).toEqual({
          accessToken: "mocked-access-token",
          accountId: "mocked-account-id",
          maxResults: "mocked-max-results",
          nextToken: "mocked-next-token",
        });
        return { promise: () => callPromise };
      },
    };
    const actualCallPromise = awsIntegrationService.listAccountRolesCall.call(...callParams).promise();
    expect(actualCallPromise).toBe(callPromise);
  });

  test("listAccounts - paginates through all pages", async () => {
    const accessToken = "fake-access-token";
    const nextToken = "fake-next-token";
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null) as any;

    let callNumber = 1;
    // The implementation reuses a mutable request object, so capture a copy of the args at call time
    const seenRequests = [];
    const listAccountsFn = jest.fn((request) => {
      seenRequests.push({ ...request });
      if (callNumber++ === 1) {
        return Promise.resolve({ accountList: ["fake-first-account"], nextToken });
      } else {
        return Promise.resolve({ accountList: ["fake-last-account"], nextToken: null });
      }
    });
    awsIntegrationService.ssoPortal = { listAccounts: listAccountsFn };

    const actualAccounts = await awsIntegrationService.listAccounts(accessToken);

    expect(actualAccounts).toEqual(["fake-first-account", "fake-last-account"]);
    expect(listAccountsFn).toHaveBeenCalledTimes(2);
    expect(seenRequests[0]).toEqual({ accessToken, maxResults: 100 });
    expect(seenRequests[1]).toEqual({ accessToken, maxResults: 100, nextToken });
  });

  test("listAccounts - tolerates pages without accountList", async () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null) as any;
    awsIntegrationService.ssoPortal = { listAccounts: jest.fn(async () => ({ nextToken: undefined })) };

    const actualAccounts = await awsIntegrationService.listAccounts("fake-access-token");
    expect(actualAccounts).toEqual([]);
  });

  test("listAccounts - propagates errors instead of hanging", async () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null) as any;
    const error = new Error("fake listAccounts error");
    awsIntegrationService.ssoPortal = {
      listAccounts: jest.fn(async () => {
        throw error;
      }),
    };

    await expect(awsIntegrationService.listAccounts("fake-access-token")).rejects.toEqual(error);
  });

  test("setupSsoPortalClient, sso portal already set up", () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null) as any;
    awsIntegrationService.ssoPortal = {
      config: {
        region: "fake-region",
      },
    };

    awsIntegrationService.setupSsoPortalClient("fake-region");

    expect(awsIntegrationService.listAccountRolesCall).toBeUndefined();
    expect(awsIntegrationService.ssoPortal).toEqual({ config: { region: "fake-region" } });
  });

  test("createIntegration", () => {
    const repository = {
      addAwsSsoIntegration: jest.fn(),
    } as any;

    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, null, null, null, null, null);

    const creationParams = {
      alias: "alias",
      portalUrl: "portalUrl",
      region: "region",
      browserOpening: "browserOpening",
      type: IntegrationType.awsSso,
    } as any;
    awsIntegrationService.createIntegration(creationParams);

    expect(repository.addAwsSsoIntegration).toHaveBeenCalledWith("portalUrl", "alias", "region", "browserOpening");
  });

  test("deleteIntegration", async () => {
    const expectedSessions = [];

    const repository = {
      deleteAwsSsoIntegration: jest.fn(),
      getSessions: () => expectedSessions,
      deleteSessions: jest.fn(),
    } as any;

    const behavioralNotifier = {
      setSession: () => {},
      getSessions: () => [],
      getSessionById: () => ({} as Session),
      setSessions: () => {},
      getIntegrations: () => [],
      setIntegrations: () => {},
      setFetchingIntegrations: () => {},
    };
    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, behavioralNotifier, null, null, null, null);

    awsIntegrationService.logout = jest.fn();

    const integrationId = "integrationId";
    await awsIntegrationService.deleteIntegration(integrationId);

    expect(awsIntegrationService.logout).toHaveBeenCalledWith(integrationId);
    expect(repository.deleteAwsSsoIntegration).toHaveBeenCalledWith(integrationId);
  });

  test("getSessions", async () => {
    const behaviouralNotifier = { setFetchingIntegrations: jest.fn() };
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, behaviouralNotifier as any, null, null, null, null) as any;
    awsIntegrationService.setupSsoPortalClient = jest.fn();
    awsIntegrationService.listAccounts = jest.fn(async () => ["account1", "account2"]);
    awsIntegrationService.getSessionsFromAccount = jest.fn(async () => ["session1", "session2"]);

    const fakeIntegrationId = "fake-integration-id";
    const fakeAccessToken = "fake-access-token";
    const fakeRegion = "fake-region";
    const sessions = await awsIntegrationService.getSessions(fakeIntegrationId, fakeAccessToken, fakeRegion);
    expect(sessions).toEqual(["session1", "session2", "session1", "session2"]);

    expect(awsIntegrationService.setupSsoPortalClient).toHaveBeenCalledWith(fakeRegion);
    expect(awsIntegrationService.listAccounts).toHaveBeenCalledWith(fakeAccessToken);
    expect(awsIntegrationService.getSessionsFromAccount).toHaveBeenNthCalledWith(1, fakeIntegrationId, "account1", fakeAccessToken);
    expect(awsIntegrationService.getSessionsFromAccount).toHaveBeenNthCalledWith(2, fakeIntegrationId, "account2", fakeAccessToken);
    expect(behaviouralNotifier.setFetchingIntegrations).toHaveBeenNthCalledWith(1, "AWS SSO: retrieving account list...");
    expect(behaviouralNotifier.setFetchingIntegrations).toHaveBeenNthCalledWith(2, "AWS SSO: found 2 accounts, fetching roles...");
    expect(behaviouralNotifier.setFetchingIntegrations).toHaveBeenNthCalledWith(3, "AWS SSO: fetched 1 of 2 accounts...");
    expect(behaviouralNotifier.setFetchingIntegrations).toHaveBeenNthCalledWith(4, "AWS SSO: fetched 2 of 2 accounts...");
    expect(behaviouralNotifier.setFetchingIntegrations).toHaveBeenNthCalledWith(5, undefined);
  });

  test("configureAwsSso", async () => {
    const isOnline = "fake-is-online";
    const repository = {
      getAwsSsoIntegration: jest.fn(() => ({ isOnline })),
      updateAwsSsoIntegration: jest.fn(),
    } as any;
    const keyChainService = {
      saveSecret: jest.fn(async () => {}),
    } as any;
    const awsIntegrationService = new AwsSsoIntegrationService(repository, keyChainService, null, null, null, null, null) as any;
    const accessTokenKey = "fake-access-token-key";
    awsIntegrationService.getIntegrationAccessTokenKey = jest.fn(() => accessTokenKey);

    const integrationId = "fake-integration-id";
    const alias = "fake-alias";
    const region = "fake-region";
    const portalUrl = "fake-portal-url";
    const browserOpening = "fake-browser-opening";
    const expirationTime = "fake-expiration-time";
    const accessToken = "fake-access-token";
    await awsIntegrationService.configureAwsSso(integrationId, alias, region, portalUrl, browserOpening, expirationTime, accessToken);
    expect(repository.getAwsSsoIntegration).toHaveBeenCalledWith(integrationId);
    expect(repository.updateAwsSsoIntegration).toHaveBeenCalledWith(
      integrationId,
      alias,
      region,
      portalUrl,
      browserOpening,
      isOnline,
      expirationTime
    );
    expect(awsIntegrationService.getIntegrationAccessTokenKey).toHaveBeenCalledWith(integrationId);
    expect(keyChainService.saveSecret).toHaveBeenCalledWith(constants.appName, accessTokenKey, accessToken);
  });

  test("getAccessTokenFromKeychain", async () => {
    const accessToken = "fake-access-token";
    const keyChainService = {
      getSecret: jest.fn(async () => accessToken),
    } as any;
    const awsIntegrationService = new AwsSsoIntegrationService(null, keyChainService, null, null, null, null, null) as any;
    const accessTokenKey = "fake-access-token-key";
    awsIntegrationService.getIntegrationAccessTokenKey = jest.fn(() => accessTokenKey);

    const integrationId = "fake-integration-id";
    const actualAccessToken = await awsIntegrationService.getAccessTokenFromKeychain(integrationId);
    expect(actualAccessToken).toBe(accessToken);
    expect(awsIntegrationService.getIntegrationAccessTokenKey).toHaveBeenCalledWith(integrationId);
    expect(keyChainService.getSecret).toHaveBeenCalledWith(constants.appName, accessTokenKey);
  });

  test("updateIntegration", () => {
    const repository = {
      getAwsSsoIntegration: jest.fn(() => ({ isOnline: true })),
      updateAwsSsoIntegration: jest.fn(),
    } as any;

    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, null, null, null, null, null);

    const updateParams = {
      alias: "alias",
      portalUrl: "portalUrl",
      region: "region",
      browserOpening: "browserOpening",
      type: IntegrationType.awsSso,
    } as any;
    awsIntegrationService.updateIntegration("1234", updateParams);

    expect(repository.getAwsSsoIntegration).toHaveBeenCalledWith("1234");
    expect(repository.updateAwsSsoIntegration).toHaveBeenCalledWith("1234", "alias", "region", "portalUrl", "browserOpening", true);
  });

  test("getIntegration", () => {
    const repository = {
      getAwsSsoIntegration: jest.fn(),
    } as any;

    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, null, null, null, null, null);
    awsIntegrationService.getIntegration("1234");

    expect(repository.getAwsSsoIntegration).toHaveBeenCalledWith("1234");
  });

  test("getOnlineIntegrations", () => {
    const repository = {
      listAwsSsoIntegrations: jest.fn(() => [
        { id: 1, isOnline: true },
        { id: 2, isOnline: true },
        { id: 3, isOnline: false },
      ]),
    } as any;

    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, null, null, null, null, null);
    const result = awsIntegrationService.getOnlineIntegrations();

    expect(repository.listAwsSsoIntegrations).toHaveBeenCalled();
    expect(result.length).toBe(2);
    expect(result.map((r) => r.id)).toStrictEqual([1, 2]);
  });

  test("getOfflineIntegrations", () => {
    const repository = {
      listAwsSsoIntegrations: jest.fn(() => [
        { id: 1, isOnline: true },
        { id: 2, isOnline: true },
        { id: 3, isOnline: false },
      ]),
    } as any;

    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, null, null, null, null, null);
    const result = awsIntegrationService.getOfflineIntegrations();

    expect(repository.listAwsSsoIntegrations).toHaveBeenCalled();
    expect(result.length).toBe(1);
    expect(result.map((r) => r.id)).toStrictEqual([3]);
  });

  test("getProtocol", () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null);
    expect((awsIntegrationService as any).getProtocol("https://www.google.test.com")).toBe("https");
    expect((awsIntegrationService as any).getProtocol("http://www.google.test.com")).toBe("http");
  });

  test("deleteDependentSessions", async () => {
    const sessions = [
      { sessionId: "1", awsSsoConfigurationId: "sso2", type: SessionType.awsSsoRole },
      { sessionId: "2", awsSsoConfigurationId: "sso2", type: SessionType.awsSsoRole },
      { sessionId: "3", awsSsoConfigurationId: "sso1", type: SessionType.awsSsoRole },
    ];

    const repository = {
      getSessions: jest.fn(() => sessions),
    } as any;

    const sessionService = {
      delete: jest.fn(async () => {}),
    };

    const sessionFactory = {
      getSessionService: jest.fn(() => sessionService),
    } as any;

    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, null, null, sessionFactory, null, null);
    await (awsIntegrationService as any).deleteDependentSessions("sso2");
    expect(repository.getSessions).toHaveBeenCalled();
    expect(sessionFactory.getSessionService).toHaveBeenCalledTimes(2);
    expect(sessionFactory.getSessionService).toHaveBeenCalledWith(SessionType.awsSsoRole);
    expect(sessionService.delete).toHaveBeenCalledTimes(2);
    expect(sessionService.delete).toHaveBeenNthCalledWith(1, "1");
    expect(sessionService.delete).toHaveBeenNthCalledWith(2, "2");
  });

  test("findOldSession", () => {
    const sessions = [
      {
        sessionId: 1,
        awsSsoConfigurationId: "2",
        type: SessionType.awsSsoRole,
        email: "test2@gmail.com",
        roleArn: `arn:aws:iam::accountId2/roleName2`,
        region: "1",
        profileId: "1",
      },
      {
        sessionId: 2,
        awsSsoConfigurationId: "2",
        type: SessionType.awsSsoRole,
        email: "test@gmail.com",
        roleArn: `arn:aws:iam::testAccountId/roleTest`,
        region: "2",
        profileId: "2",
      },
      {
        sessionId: 3,
        awsSsoConfigurationId: "1",
        type: SessionType.awsSsoRole,
        email: "test3@gmail.com",
        roleArn: `arn:aws:iam::accountId3/roleName3`,
        region: "3",
        profileId: "3",
      },
    ];

    const accountInfo: AccountInfo = {
      accountId: "testAccountId",
      accountName: "testAccountName",
      emailAddress: "test@gmail.com",
    };

    const accountRole: RoleInfo = {
      roleName: "roleTest",
      accountId: "testAccountId",
    };

    const repository = {
      getSessions: jest.fn(() => sessions),
      deleteSession: jest.fn((id) => {
        const session = sessions.find((s) => s.sessionId === id);
        sessions.splice(sessions.indexOf(session), 1);
      }),
    } as any;

    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, null, null, null, null, null);
    expect((awsIntegrationService as any).findOldSession(accountInfo, accountRole)).toStrictEqual({ region: "2", profileId: "2" });
    expect((awsIntegrationService as any).findOldSession(accountInfo, { roleName: "notTobeFoundRole", accountId: "notToBeFoundId" })).toBeUndefined();
  });

  test("getSessionsFromAccount", async () => {
    const repository = {
      getDefaultRegion: () => "fake-default-region",
      getDefaultProfileId: () => "fake-default-profile-id",
    } as any;
    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, null, null, null, null, null) as any;

    let findOldSessionCallNumber = 1;
    awsIntegrationService.findOldSession = jest.fn(() => {
      if (findOldSessionCallNumber++ === 1) {
        return undefined;
      } else {
        return { region: "fake-region", profileId: "fake-profile-id" };
      }
    });

    const accountRole1 = { roleName: "fake-role-name-1" };
    const accountRole2 = { roleName: "fake-role-name-2" };

    awsIntegrationService.listAccountRoles = async (accountInfoParam, accessToken) => {
      expect(accountInfoParam.accountId).toEqual("fake-account-id");
      expect(accessToken).toEqual("fake-access-token");
      return [accountRole1, accountRole2];
    };

    const accountInfo = {
      emailAddress: "fake-email-address",
      accountId: "fake-account-id",
      accountName: "fake-account-name",
    };
    const integrationId = "fake-integration-id";
    const actualSessions = await awsIntegrationService.getSessionsFromAccount(integrationId, accountInfo, "fake-access-token");
    expect(actualSessions).toEqual([
      {
        awsSsoConfigurationId: integrationId,
        email: accountInfo.emailAddress,
        profileId: "fake-default-profile-id",
        region: "fake-default-region",
        roleArn: `arn:aws:iam::${accountInfo.accountId}/${accountRole1.roleName}`,
        sessionName: accountInfo.accountName,
      },
      {
        awsSsoConfigurationId: integrationId,
        email: accountInfo.emailAddress,
        profileId: "fake-profile-id",
        region: "fake-region",
        roleArn: `arn:aws:iam::${accountInfo.accountId}/${accountRole2.roleName}`,
        sessionName: accountInfo.accountName,
      },
    ]);

    expect(awsIntegrationService.findOldSession).toHaveBeenCalledTimes(2);
    expect(awsIntegrationService.findOldSession).toHaveBeenNthCalledWith(1, accountInfo, accountRole1);
    expect(awsIntegrationService.findOldSession).toHaveBeenNthCalledWith(2, accountInfo, accountRole2);
  });

  test("listAccountRoles - paginates through all pages with throttling", async () => {
    const accountInfo = { accountId: "fake-account-id" };
    const accessToken = "fake-access-token";
    const nextToken = "fake-next-token";

    let callNumber = 1;
    const callWithThrottleFn = jest.fn(() => {
      if (callNumber++ === 1) {
        return Promise.resolve({ roleList: [{ roleName: "role-1" }], nextToken });
      } else {
        return Promise.resolve({ roleList: [{ roleName: "role-2" }], nextToken: null });
      }
    });

    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null);
    (awsIntegrationService as any).listAccountRolesCall = { callWithThrottle: callWithThrottleFn };

    const actualRoles = await (awsIntegrationService as any).listAccountRoles(accountInfo, accessToken);

    expect(actualRoles).toEqual([{ roleName: "role-1" }, { roleName: "role-2" }]);
    expect(callWithThrottleFn).toHaveBeenCalledTimes(2);
    expect(callWithThrottleFn).toHaveBeenNthCalledWith(1, [accessToken, accountInfo.accountId, 100, undefined]);
    expect(callWithThrottleFn).toHaveBeenLastCalledWith([accessToken, accountInfo.accountId, 100, nextToken]);
  });

  test("listAccountRoles - tolerates pages without roleList", async () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null);
    (awsIntegrationService as any).listAccountRolesCall = { callWithThrottle: jest.fn(async () => ({ nextToken: undefined })) };

    const actualRoles = await (awsIntegrationService as any).listAccountRoles({ accountId: "fake-account-id" }, "fake-access-token");
    expect(actualRoles).toEqual([]);
  });

  test("listAccountRoles - callWithThrottle throwing an error", async () => {
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, null, null, null, null, null);
    (awsIntegrationService as any).listAccountRolesCall = {
      callWithThrottle: async () => {
        throw new Error("fake error");
      },
    };

    await expect((awsIntegrationService as any).listAccountRoles({ accountId: "fake-account-id" }, "fake-access-token")).rejects.toEqual(
      new Error("fake error")
    );
  });

  test("isAuthenticationError", () => {
    expect(AwsSsoIntegrationService.isAuthenticationError({ name: "UnauthorizedException" })).toBe(true);
    expect(AwsSsoIntegrationService.isAuthenticationError({ $metadata: { httpStatusCode: 401 } })).toBe(true);
    expect(AwsSsoIntegrationService.isAuthenticationError({ name: "TooManyRequestsException" })).toBe(false);
    expect(AwsSsoIntegrationService.isAuthenticationError(new Error("generic"))).toBe(false);
    expect(AwsSsoIntegrationService.isAuthenticationError(undefined)).toBe(false);
  });

  test("setOnline - forced offline wins over valid expiration", async () => {
    const repository = { updateAwsSsoIntegration: jest.fn() } as any;
    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, null, null, null, null, null);
    const integration = {
      id: "fake-id",
      alias: "alias",
      region: "region",
      portalUrl: "url",
      browserOpening: "browser",
      accessTokenExpiration: new Date(Date.now() + 3600 * 1000).toISOString(),
      isOnline: true,
    } as any;

    await awsIntegrationService.setOnline(integration, false);

    expect(integration.isOnline).toBe(false);
    expect(repository.updateAwsSsoIntegration).toHaveBeenCalledWith("fake-id", "alias", "region", "url", "browser", false, expect.anything());
  });

  test("getAccessToken - forceRefresh triggers a new login even if the token is not expired", async () => {
    const integration = { alias: "fake-alias", browserOpening: "fake-browser-opening" };
    const repository = { getAwsSsoIntegration: jest.fn(() => integration) } as any;
    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, null, null, null, null, null) as any;
    awsIntegrationService.isAwsSsoAccessTokenExpired = jest.fn(async () => false);
    const loginResponse = { portalUrlUnrolled: "fake-portal-url-unrolled", expirationTime: new Date(0), accessToken: "fresh-access-token" };
    awsIntegrationService.login = jest.fn(async () => loginResponse);
    awsIntegrationService.configureAwsSso = jest.fn(async () => {});

    const actualAccessToken = await awsIntegrationService.getAccessToken("fake-integration-id", "fake-region", "fake-portal-url", true);

    expect(actualAccessToken).toBe("fresh-access-token");
    expect(awsIntegrationService.login).toHaveBeenCalled();
  });

  test("loginAndGetSessionsDiff - retries once with a fresh token on authentication error", async () => {
    const integrationId = "fake-integration-id";
    const awsSsoIntegration = { region: "fake-region", portalUrl: "fake-portal-url" };
    const repository = {
      getAwsSsoIntegration: jest.fn(() => awsSsoIntegration),
      getAwsSsoIntegrationSessions: jest.fn(() => []),
      listAwsSsoIntegrations: jest.fn(() => []),
      listAzureIntegrations: jest.fn(() => []),
    } as any;
    const behaviouralNotifier = { setIntegrations: jest.fn() } as any;
    const awsIntegrationService = new AwsSsoIntegrationService(repository, null, behaviouralNotifier, null, null, null, null) as any;

    const authError = Object.assign(new Error("unauthorized"), { name: "UnauthorizedException" });
    awsIntegrationService.getAccessToken = jest.fn(async (_id, _region, _portalUrl, forceRefresh) => (forceRefresh ? "fresh-token" : "stale-token"));
    awsIntegrationService.getSessions = jest.fn(async (_id, accessToken, _region) => {
      if (accessToken === "stale-token") {
        throw authError;
      }
      return [{ sessionName: "session-1", roleArn: "role-arn", email: "email" }];
    });
    awsIntegrationService.setOnline = jest.fn(async () => {});

    const diff = await awsIntegrationService.loginAndGetSessionsDiff(integrationId);

    expect(diff.sessionsToAdd.length).toBe(1);
    expect(awsIntegrationService.getAccessToken).toHaveBeenCalledTimes(2);
    expect(awsIntegrationService.getAccessToken).toHaveBeenLastCalledWith(integrationId, "fake-region", "fake-portal-url", true);
  });

  test("getSessions - aggregates account failures into a visible error", async () => {
    const behaviouralNotifier = { setFetchingIntegrations: jest.fn() };
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, behaviouralNotifier as any, null, null, null, null) as any;
    awsIntegrationService.setupSsoPortalClient = jest.fn();
    awsIntegrationService.listAccounts = jest.fn(async () => ["account1", "account2"]);
    awsIntegrationService.getSessionsFromAccount = jest.fn(async (_integrationId, account) => {
      if (account === "account2") {
        throw new Error("role listing failed");
      }
      return ["session1"];
    });

    await expect(awsIntegrationService.getSessions("fake-integration-id", "fake-access-token", "fake-region")).rejects.toThrow(
      "Failed to retrieve roles for 1 of 2 accounts. First error: role listing failed"
    );
    // The fetching indicator must always be cleared, even on failure
    expect(behaviouralNotifier.setFetchingIntegrations).toHaveBeenLastCalledWith(undefined);
  });

  test("getSessions - rethrows the original authentication error to allow a token refresh", async () => {
    const behaviouralNotifier = { setFetchingIntegrations: jest.fn() };
    const awsIntegrationService = new AwsSsoIntegrationService(null, null, behaviouralNotifier as any, null, null, null, null) as any;
    awsIntegrationService.setupSsoPortalClient = jest.fn();
    awsIntegrationService.listAccounts = jest.fn(async () => ["account1"]);
    const authError = Object.assign(new Error("unauthorized"), { name: "UnauthorizedException" });
    awsIntegrationService.getSessionsFromAccount = jest.fn(async () => {
      throw authError;
    });

    await expect(awsIntegrationService.getSessions("fake-integration-id", "fake-access-token", "fake-region")).rejects.toBe(authError);
  });
});
