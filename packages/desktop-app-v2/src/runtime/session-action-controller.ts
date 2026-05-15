import { FetchHttpHandler } from "@smithy/fetch-http-handler";
import { SSO } from "@aws-sdk/client-sso";
import type { INativeService } from "../../../core/src/interfaces/i-native-service";
import { constants } from "../../../core/src/models/constants";
import type { Session } from "../../../core/src/models/session";
import { AwsCoreService } from "../../../core/src/services/aws-core-service";
import { AwsSsoOidcService } from "../../../core/src/services/aws-sso-oidc.service";
import { BehaviouralSubjectService } from "../../../core/src/services/behavioural-subject-service";
import { FileService } from "../../../core/src/services/file-service";
import { LogService } from "../../../core/src/services/log-service";
import { Repository } from "../../../core/src/services/repository";
import { AwsParentSessionFactory } from "../../../core/src/services/session/aws/aws-parent-session.factory";
import { AwsIamRoleChainedService } from "../../../core/src/services/session/aws/aws-iam-role-chained-service";
import { AwsIamUserService } from "../../../core/src/services/session/aws/aws-iam-user-service";
import { AwsSsoRoleService } from "../../../core/src/services/session/aws/aws-sso-role-service";
import type { CreateSessionRequest } from "../../../core/src/services/session/create-session-request";

const sessionType = {
  awsIamUser: "awsIamUser",
  awsIamRoleFederated: "awsIamRoleFederated",
  awsIamRoleChained: "awsIamRoleChained",
  awsSsoRole: "awsSsoRole",
  azure: "azure",
  localstack: "localstack",
} as const;

const sessionStatus = {
  inactive: 0,
  pending: 1,
  active: 2,
} as const;

type AwsCredentialInfo = {
  sessionToken: {
    aws_access_key_id: string;
    aws_secret_access_key: string;
    aws_session_token: string;
  };
};

type AwsCredentialFileService = {
  generateCredentials: (sessionId: string) => Promise<AwsCredentialInfo>;
  applyCredentials: (sessionId: string, credentialsInfo: AwsCredentialInfo) => Promise<void>;
};

type AwsCredentialFileServices = {
  getSupport: (session: Session) => SessionActionSupport;
  generateCredentials: (sessionId: string) => Promise<AwsCredentialInfo>;
  applyCredentials: (sessionId: string, credentialsInfo: AwsCredentialInfo) => Promise<void>;
};

type ExecFileFn = (file: string, args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void) => void;
function createAwsHttpHandler() {
  return new FetchHttpHandler({ requestTimeout: constants.timeout });
}

function createMfaCodePrompter() {
  return {
    promptForMFACode(sessionName: string, callback: (value: string) => void) {
      const code = window.prompt(`Enter the MFA code for ${sessionName}`)?.trim();
      callback(code || constants.confirmClosed);
    },
  };
}

function promisifyExecFile(execFile: ExecFileFn, file: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(file, args, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function openUrlInExternalBrowser(nativeService: INativeService, execFile: ExecFileFn, url: string) {
  const platform = nativeService.process?.platform;

  if (platform === "darwin") {
    await promisifyExecFile(execFile, "open", [url]);
    return;
  }

  if (platform === "win32") {
    await promisifyExecFile(execFile, "cmd", ["/c", "start", "", url]);
    return;
  }

  if (platform === "linux") {
    await promisifyExecFile(execFile, "xdg-open", [url]);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function createAwsSsoVerificationWindowService(nativeService: INativeService, execFile: ExecFileFn) {
  return {
    async openVerificationWindow(
      registerClientResponse: { clientId?: string; clientSecret?: string },
      startDeviceAuthorizationResponse: { deviceCode?: string; verificationUriComplete?: string }
    ) {
      const verificationUri = startDeviceAuthorizationResponse.verificationUriComplete?.trim();
      if (!verificationUri) {
        throw new Error("AWS SSO verification URL is missing.");
      }

      await openUrlInExternalBrowser(nativeService, execFile, verificationUri);

      return {
        clientId: registerClientResponse.clientId ?? "",
        clientSecret: registerClientResponse.clientSecret ?? "",
        deviceCode: startDeviceAuthorizationResponse.deviceCode ?? "",
      };
    },
  };
}

class DesktopKeychainBridge {
  constructor(
    private readonly nativeService: INativeService & {
      keytar?: { setPassword: Function; getPassword: Function; deletePassword?: Function; deleteSecret?: Function } | null;
    },
    private readonly execFile: ExecFileFn
  ) {}

  async saveSecret(service: string, account: string, password: string): Promise<void> {
    if (this.nativeService.keytar?.setPassword) {
      await this.nativeService.keytar.setPassword(service, account, password ?? "<EMPTY>");
      return;
    }

    await this.runMacSecurity(["add-generic-password", "-U", "-s", service, "-a", account, "-w", password ?? "<EMPTY>"]);
  }

  async getSecret(service: string, account: string): Promise<string | null> {
    if (this.nativeService.keytar?.getPassword) {
      return this.nativeService.keytar.getPassword(service, account);
    }

    try {
      const { stdout } = await this.runMacSecurity(["find-generic-password", "-s", service, "-a", account, "-w"]);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async deleteSecret(service: string, account: string): Promise<boolean> {
    if (this.nativeService.keytar?.deletePassword) {
      return this.nativeService.keytar.deletePassword(service, account);
    }

    if (this.nativeService.keytar?.deleteSecret) {
      return this.nativeService.keytar.deleteSecret(service, account);
    }

    try {
      await this.runMacSecurity(["delete-generic-password", "-s", service, "-a", account]);
      return true;
    } catch {
      return false;
    }
  }

  private async runMacSecurity(args: string[]) {
    if (this.nativeService.process?.platform !== "darwin") {
      throw new Error("Keychain bridge fallback is currently only available on macOS.");
    }

    return promisifyExecFile(this.execFile, "security", args);
  }
}

function createAwsCredentialFileServices({
  behaviouralSubjectService,
  repository,
  fileService,
  nativeService,
  logService,
  awsCoreService,
}: {
  behaviouralSubjectService: BehaviouralSubjectService;
  repository: Repository;
  fileService: FileService;
  nativeService: INativeService;
  logService: LogService;
  awsCoreService: AwsCoreService;
}): AwsCredentialFileServices {
  let initializedServices:
    | {
        iamUserService: AwsCredentialFileService;
        iamRoleChainedService: AwsCredentialFileService;
        ssoRoleService: AwsCredentialFileService;
      }
    | null = null;
  let initializationError: Error | null = null;

  const federatedCredentialFileReason =
    "Direct credential-file generation for AWS federated auth is not ported in v2 yet. Section 4 still needs the auth window and verification UI.";
  const chainedParentReason = "Chained credential-file generation in v2 currently requires an IAM user parent session.";

  const ensureInitialized = () => {
    if (initializedServices) {
      return initializedServices;
    }

    if (initializationError) {
      throw initializationError;
    }

    try {
      const execFile =
        nativeService.requireModule?.("node:child_process")?.execFile ??
        nativeService.requireModule?.("child_process")?.execFile;

      if (!execFile) {
        throw new Error("Unable to access child_process.execFile from the v2 renderer runtime.");
      }

      const keychainService = new DesktopKeychainBridge(nativeService as any, execFile as ExecFileFn);
      const mfaCodePrompter = createMfaCodePrompter();
      const unsupportedParentService: any = {
        async generateCredentialsProxy() {
          throw new Error(chainedParentReason);
        },
      };

      const iamUserService = new AwsIamUserService(
        behaviouralSubjectService,
        repository,
        mfaCodePrompter,
        mfaCodePrompter,
        keychainService,
        fileService,
        awsCoreService
      );
      const parentSessionFactory = new AwsParentSessionFactory(
        iamUserService,
        unsupportedParentService,
        unsupportedParentService
      );
      const iamRoleChainedService = new AwsIamRoleChainedService(
        behaviouralSubjectService,
        repository,
        awsCoreService,
        fileService,
        iamUserService,
        parentSessionFactory
      );
      const awsSsoOidcService = new AwsSsoOidcService(createAwsSsoVerificationWindowService(nativeService, execFile as ExecFileFn) as any, repository, true);
      const ssoRoleService = new AwsSsoRoleService(
        behaviouralSubjectService,
        repository,
        fileService,
        keychainService as any,
        awsCoreService,
        nativeService,
        awsSsoOidcService
      );
      const ssoClientsByRegion = new Map<string, SSO>();
      const notifyIntegrationChange = () => {
        behaviouralSubjectService.setIntegrations([...repository.listAwsSsoIntegrations(), ...repository.listAzureIntegrations()]);
      };

      ssoRoleService.setAwsIntegrationDelegate({
        async getAccessToken(configurationId: string, region: string, portalUrl: string, forceRefresh = false) {
          const integration = repository.getAwsSsoIntegration(configurationId);
          const accessTokenKey = `aws-sso-integration-access-token-${configurationId}`;
          const savedAccessToken = forceRefresh ? null : await keychainService.getSecret(constants.appName, accessTokenKey);
          const expiration = integration.accessTokenExpiration ? new Date(integration.accessTokenExpiration).getTime() : undefined;

          if (savedAccessToken && (!expiration || expiration > Date.now())) {
            if (!integration.isOnline) {
              repository.updateAwsSsoIntegration(
                integration.id,
                integration.alias,
                integration.region,
                integration.portalUrl,
                integration.browserOpening,
                true,
                integration.accessTokenExpiration
              );
              notifyIntegrationChange();
            }

            return savedAccessToken;
          }

          if (!portalUrl?.trim()) {
            throw new Error("The AWS SSO portal URL is missing for this integration.");
          }

          const loginResponse = await awsSsoOidcService.login(configurationId, region, portalUrl.trim());

          await keychainService.saveSecret(constants.appName, accessTokenKey, loginResponse.accessToken);
          repository.updateAwsSsoIntegration(
            integration.id,
            integration.alias,
            integration.region,
            portalUrl.trim(),
            integration.browserOpening,
            true,
            loginResponse.expirationTime.toISOString()
          );
          notifyIntegrationChange();

          return loginResponse.accessToken;
        },
        async getRoleCredentials(accessToken: string, region: string, roleArn: string) {
          const client =
            ssoClientsByRegion.get(region) ??
            (() => {
              const nextClient = new SSO({ region });
              ssoClientsByRegion.set(region, nextClient);
              return nextClient;
            })();

          return client.getRoleCredentials({
            accountId: roleArn.substring(13, 25),
            roleName: roleArn.split("/")[1],
            accessToken,
          });
        },
      });

      initializedServices = {
        iamUserService,
        iamRoleChainedService,
        ssoRoleService,
      };

      return initializedServices;
    } catch (error) {
      initializationError = error instanceof Error ? error : new Error("Unable to initialize AWS credential-file services.");
      throw initializationError;
    }
  };

  const getChainedSupport = (session: Session): SessionActionSupport => {
    const parentSessionId = (session as Session & { parentSessionId?: string }).parentSessionId;
    if (!parentSessionId) {
      return {
        canStart: false,
        startReason: "The parent session is missing for this chained AWS session.",
        canStop: true,
        canRefresh: false,
        refreshReason: "The parent session is missing for this chained AWS session.",
      };
    }

    try {
      const parentSession = repository.getSessionById(parentSessionId);
      if (parentSession.type !== sessionType.awsIamUser) {
        return {
          canStart: false,
          startReason: chainedParentReason,
          canStop: true,
          canRefresh: false,
          refreshReason: chainedParentReason,
        };
      }
    } catch {
      return {
        canStart: false,
        startReason: "The parent session is missing for this chained AWS session.",
        canStop: true,
        canRefresh: false,
        refreshReason: "The parent session is missing for this chained AWS session.",
      };
    }

    try {
      ensureInitialized();
      return {
        canStart: true,
        canStop: true,
        canRefresh: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to initialize the AWS credential-file runtime.";
      return {
        canStart: false,
        startReason: message,
        canStop: true,
        canRefresh: false,
        refreshReason: message,
      };
    }
  };

  const getSupport = (session: Session): SessionActionSupport => {
    if (session.type === sessionType.awsIamUser) {
      try {
        ensureInitialized();
        return {
          canStart: true,
          canStop: true,
          canRefresh: true,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to initialize the AWS credential-file runtime.";
        return {
          canStart: false,
          startReason: message,
          canStop: true,
          canRefresh: false,
          refreshReason: message,
        };
      }
    }

    if (session.type === sessionType.awsIamRoleChained) {
      return getChainedSupport(session);
    }

    if (session.type === sessionType.awsSsoRole) {
      const integrationId = (session as Session & { awsSsoConfigurationId?: string }).awsSsoConfigurationId;
      if (!integrationId) {
        return {
          canStart: false,
          startReason: "The AWS SSO integration is missing for this session.",
          canStop: true,
          canRefresh: false,
          refreshReason: "The AWS SSO integration is missing for this session.",
        };
      }

      try {
        repository.getAwsSsoIntegration(integrationId);
        ensureInitialized();
        return {
          canStart: true,
          canStop: true,
          canRefresh: true,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to initialize the AWS SSO runtime.";
        return {
          canStart: false,
          startReason: message,
          canStop: true,
          canRefresh: false,
          refreshReason: message,
        };
      }
    }

    if (session.type === sessionType.awsIamRoleFederated) {
      return {
        canStart: false,
        startReason: federatedCredentialFileReason,
        canStop: true,
        canRefresh: false,
        refreshReason: federatedCredentialFileReason,
      };
    }

    return {
      canStart: false,
      startReason: "This session type is not wired yet in the React dashboard.",
      canStop: false,
      stopReason: "This session type is not wired yet in the React dashboard.",
      canRefresh: false,
      refreshReason: "This session type is not wired yet in the React dashboard.",
    };
  };

  const getService = (session: Session): AwsCredentialFileService => {
    const services = ensureInitialized();

    if (session.type === sessionType.awsIamUser) {
      return services.iamUserService;
    }

    if (session.type === sessionType.awsIamRoleChained) {
      return services.iamRoleChainedService;
    }

    if (session.type === sessionType.awsSsoRole) {
      return services.ssoRoleService;
    }

    throw new Error(federatedCredentialFileReason);
  };

  return {
    getSupport,
    async generateCredentials(sessionId: string) {
      const session = repository.getSessionById(sessionId);
      return getService(session).generateCredentials(sessionId);
    },
    async applyCredentials(sessionId: string, credentialsInfo: AwsCredentialInfo) {
      const session = repository.getSessionById(sessionId);
      await getService(session).applyCredentials(sessionId, credentialsInfo);
    },
  };
}

export type SessionActionSupport = {
  canStart: boolean;
  startReason?: string;
  canStop: boolean;
  stopReason?: string;
  canRefresh: boolean;
  refreshReason?: string;
};

type SessionActionController = {
  getSupport: (session: Session) => SessionActionSupport;
  start: (sessionId: string) => Promise<void>;
  stop: (sessionId: string) => Promise<void>;
  refresh: (sessionId: string) => Promise<void>;
};

class DesktopAwsSessionService {
  constructor(
    private readonly sessionNotifier: BehaviouralSubjectService,
    private readonly repository: Repository,
    private readonly awsCoreService: AwsCoreService,
    private readonly fileService: FileService,
    private readonly credentialFileServices: AwsCredentialFileServices
  ) {}

  async start(sessionId: string): Promise<void> {
    try {
      if (this.hasOtherPendingSessionWithSameProfile(sessionId)) {
        throw new Error("Pending session with same named profile");
      }

      await this.stopActiveSessionsWithSameProfile(sessionId);
      this.sessionLoading(sessionId);
      const credentialsInfo = await this.generateCredentials(sessionId);
      await this.applyCredentials(sessionId, credentialsInfo);
      this.sessionActivated(sessionId);
    } catch (error) {
      this.sessionError(sessionId, error);
    }
  }

  async rotate(sessionId: string): Promise<void> {
    try {
      this.sessionLoading(sessionId);
      const credentialsInfo = await this.generateCredentials(sessionId);
      await this.applyCredentials(sessionId, credentialsInfo);
      this.sessionActivated(sessionId);
    } catch (error) {
      this.sessionError(sessionId, error);
    }
  }

  async stop(sessionId: string): Promise<void> {
    if (this.isInactive(sessionId)) {
      return;
    }

    try {
      await this.deApplyConfigProfileCommand(sessionId).catch(() => undefined);
      await this.deApplyCredentials(sessionId).catch(() => undefined);
      this.sessionDeactivated(sessionId);
    } catch (error) {
      this.sessionError(sessionId, error);
    }
  }

  async create(_: CreateSessionRequest): Promise<void> {
    throw new Error("Session creation is not part of the section 3 dashboard slice.");
  }

  async update(_: string, __: CreateSessionRequest): Promise<void> {
    throw new Error("Session editing stays outside the section 3 dashboard slice.");
  }

  async generateCredentialsProxy(sessionId: string) {
    return this.generateCredentials(sessionId);
  }

  async generateCredentials(sessionId: string) {
    return this.credentialFileServices.generateCredentials(sessionId);
  }

  async applyCredentials(sessionId: string, credentialsInfo: AwsCredentialInfo): Promise<void> {
    await this.credentialFileServices.applyCredentials(sessionId, credentialsInfo);
  }

  async deApplyCredentials(sessionId: string): Promise<void> {
    const session = this.repository.getSessionById(sessionId) as Session & { profileId?: string };
    const profileName = this.repository.getProfileName(session.profileId ?? "");
    const credentialsFile = await this.fileService.iniParseSync(this.awsCoreService.awsCredentialPath());
    delete credentialsFile[profileName];
    await this.fileService.replaceWriteSync(this.awsCoreService.awsCredentialPath(), credentialsFile);
  }

  removeSecrets(_: string): void {}

  async delete(_: string): Promise<void> {
    throw new Error("Session deletion stays outside the section 3 dashboard slice.");
  }

  async validateCredentials(_: string): Promise<boolean> {
    return false;
  }

  async getCloneRequest(_: Session): Promise<CreateSessionRequest> {
    throw new Error("Session cloning stays outside the section 3 dashboard slice.");
  }

  async getAccountNumberFromCallerIdentity(_: Session): Promise<string> {
    throw new Error("Account introspection is not available in the section 3 dashboard slice.");
  }

  private sessionDeactivated(sessionId: string): void {
    const sessions = this.repository.getSessions();
    const index = sessions.findIndex((session) => session.sessionId === sessionId);

    if (index > -1) {
      const currentSession = sessions[index];
      currentSession.status = sessionStatus.inactive;
      currentSession.startDateTime = undefined;
      sessions[index] = currentSession;
      this.repository.updateSessions(sessions);
      this.sessionNotifier.setSessions([...sessions]);
    }
  }

  private isInactive(sessionId: string): boolean {
    const session = this.repository.getSessions().find((item) => item.sessionId === sessionId);
    return session?.status === sessionStatus.inactive;
  }

  private sessionActivated(sessionId: string): void {
    const sessions = this.repository.getSessions();
    const index = sessions.findIndex((session) => session.sessionId === sessionId);

    if (index > -1) {
      const currentSession = sessions[index];
      currentSession.startDateTime = new Date().toISOString();
      currentSession.status = sessionStatus.active;
      sessions[index] = currentSession;
      this.repository.updateSessions(sessions);
      this.sessionNotifier.setSessions([...sessions]);
    }
  }

  private sessionLoading(sessionId: string): void {
    const sessions = this.repository.getSessions();
    const index = sessions.findIndex((session) => session.sessionId === sessionId);

    if (index > -1) {
      const currentSession = sessions[index];
      currentSession.status = sessionStatus.pending;
      sessions[index] = currentSession;
      this.repository.updateSessions(sessions);
      this.sessionNotifier.setSessions([...sessions]);
    }
  }

  private sessionError(sessionId: string, error: unknown): never {
    this.sessionDeactivated(sessionId);
    throw error;
  }

  private async applyConfigProfileCommand(sessionId: string): Promise<void> {
    const session = this.repository.getSessionById(sessionId) as Session & { profileId?: string };
    const command = `leapp session generate ${sessionId}`;
    const profileName = this.repository.getProfileName(session.profileId ?? "");
    const profile = `profile ${profileName}`;
    const credentialProcess: Record<string, { credential_process: string; region: string }> = {};

    credentialProcess[profile] = {
      credential_process: command,
      region: session.region,
    };

    await this.fileService.iniWriteSync(this.awsCoreService.awsConfigPath(), credentialProcess);
  }

  private async deApplyConfigProfileCommand(sessionId: string): Promise<void> {
    const session = this.repository.getSessionById(sessionId) as Session & { profileId?: string };
    const profileName = this.repository.getProfileName(session.profileId ?? "");
    const profile = `profile ${profileName}`;
    const credentialProcess = await this.fileService.iniParseSync(this.awsCoreService.awsConfigPath());
    delete credentialProcess[profile];
    await this.fileService.replaceWriteSync(this.awsCoreService.awsConfigPath(), credentialProcess);
  }

  private getProfileId(sessionId: string): string | undefined {
    const session = this.repository.getSessionById(sessionId) as Session & { profileId?: string };
    return session.profileId;
  }

  private hasOtherPendingSessionWithSameProfile(sessionId: string): boolean {
    const profileId = this.getProfileId(sessionId);
    const pendingSessions = this.repository.listPending();

    return pendingSessions.some((session) => {
      const pendingProfileId = (session as Session & { profileId?: string }).profileId;
      return pendingProfileId === profileId && session.sessionId !== sessionId;
    });
  }

  private async stopActiveSessionsWithSameProfile(sessionId: string): Promise<void> {
    const profileId = this.getProfileId(sessionId);
    const activeSessions = this.repository.listActive();

    for (const session of activeSessions) {
      const activeProfileId = (session as Session & { profileId?: string }).profileId;
      if (activeProfileId === profileId && session.sessionId !== sessionId) {
        await this.stop(session.sessionId);
      }
    }
  }
}

function isAwsSessionType(type: Session["type"]): boolean {
  return (
    type === sessionType.awsIamUser ||
    type === sessionType.awsIamRoleFederated ||
    type === sessionType.awsIamRoleChained ||
    type === sessionType.awsSsoRole
  );
}

export function createSessionActionController({
  behaviouralSubjectService,
  repository,
  fileService,
  nativeService,
  logService,
}: {
  behaviouralSubjectService: BehaviouralSubjectService;
  repository: Repository;
  fileService: FileService;
  nativeService: INativeService;
  logService: LogService;
}): SessionActionController {
  const awsCoreService = new AwsCoreService(createAwsHttpHandler(), nativeService, logService);
  const credentialFileServices = createAwsCredentialFileServices({
    behaviouralSubjectService,
    repository,
    fileService,
    nativeService,
    logService,
    awsCoreService,
  });
  const awsSessionService = new DesktopAwsSessionService(
    behaviouralSubjectService,
    repository,
    awsCoreService,
    fileService,
    credentialFileServices
  );

  const getSupport = (session: Session): SessionActionSupport => {
    if (session.type === sessionType.localstack) {
      return {
        canStart: false,
        startReason: "LocalStack is out of scope for the current v2 target.",
        canStop: false,
        stopReason: "LocalStack is out of scope for the current v2 target.",
        canRefresh: false,
        refreshReason: "LocalStack is out of scope for the current v2 target.",
      };
    }

    if (isAwsSessionType(session.type)) {
      return credentialFileServices.getSupport(session);
    }

    if (session.type === sessionType.azure) {
      return {
        canStart: false,
        startReason: "AWS is the active focus right now. Azure lifecycle actions wait for a later slice.",
        canStop: false,
        stopReason: "AWS is the active focus right now. Azure lifecycle actions wait for a later slice.",
        canRefresh: false,
        refreshReason: "AWS is the active focus right now. Azure lifecycle actions wait for a later slice.",
      };
    }

    return {
      canStart: false,
      startReason: "This session type is not wired yet in the React dashboard.",
      canStop: false,
      stopReason: "This session type is not wired yet in the React dashboard.",
      canRefresh: false,
      refreshReason: "This session type is not wired yet in the React dashboard.",
    };
  };

  const getService = (session: Session) => {
    if (isAwsSessionType(session.type)) {
      return awsSessionService;
    }

    return null;
  };

  const run = async (sessionId: string, action: "start" | "stop" | "refresh") => {
    const session = repository.getSessionById(sessionId);
    const support = getSupport(session);

    if (action === "start" && !support.canStart) {
      throw new Error(support.startReason ?? "Start is not available for this session.");
    }

    if (action === "stop" && !support.canStop) {
      throw new Error(support.stopReason ?? "Stop is not available for this session.");
    }

    if (action === "refresh" && !support.canRefresh) {
      throw new Error(support.refreshReason ?? "Refresh is not available for this session.");
    }

    const service = getService(session);
    if (!service) {
      throw new Error("This session type is not wired yet in the React dashboard.");
    }

    if (action === "start") {
      await service.start(sessionId);
      return;
    }

    if (action === "stop") {
      await service.stop(sessionId);
      return;
    }

    await service.rotate(sessionId);
  };

  return {
    getSupport,
    start(sessionId: string) {
      return run(sessionId, "start");
    },
    stop(sessionId: string) {
      return run(sessionId, "stop");
    },
    refresh(sessionId: string) {
      return run(sessionId, "refresh");
    },
  };
}