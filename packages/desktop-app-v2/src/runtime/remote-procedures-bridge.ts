import type { IKeychainService } from "../../../core/src/interfaces/i-keychain-service";
import type { INativeService } from "../../../core/src/interfaces/i-native-service";
import { constants } from "../../../core/src/models/constants";
import type { Integration } from "../../../core/src/models/integration";
import type { BehaviouralSubjectService } from "../../../core/src/services/behavioural-subject-service";
import type { LogService } from "../../../core/src/services/log-service";
import { RemoteProceduresServer } from "../../../core/src/services/remote-procedures-server";
import type { Repository } from "../../../core/src/services/repository";
import type { WorkspaceService } from "../../../core/src/services/workspace-service";

type ExecFileFn = (file: string, args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void) => void;

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

class DesktopKeychainBridge implements IKeychainService {
  constructor(
    private nativeService: INativeService & { keytar?: { setPassword: Function; getPassword: Function; deletePassword?: Function; deleteSecret?: Function } | null },
    private execFile: ExecFileFn
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

export function createRemoteProceduresBridge({
  nativeService,
  repository,
  behaviouralSubjectService,
  workspaceService,
  logService: _logService,
  promptForMfaCode,
  uiSafeRun,
}: {
  nativeService: INativeService;
  repository: Repository;
  behaviouralSubjectService: BehaviouralSubjectService;
  workspaceService: WorkspaceService;
  logService: LogService;
  promptForMfaCode?: (sessionName: string) => string;
  uiSafeRun?: (uiSafeBlock: () => void) => void;
}) {
  const execFile = nativeService.requireModule?.("node:child_process")?.execFile ?? nativeService.requireModule?.("child_process")?.execFile;

  if (!nativeService.nodeIpc || !execFile) {
    return {
      start() {},
      stop() {},
    };
  }

  const keychainService = new DesktopKeychainBridge(nativeService as any, execFile as ExecFileFn);

  const remoteProceduresServer = new RemoteProceduresServer(
    keychainService,
    nativeService,
    {
      async openVerificationWindow() {
        throw new Error("AWS SSO verification is not wired in the v2 renderer yet.");
      },
    },
    {
      async needAuthentication() {
        throw new Error("AWS federated authentication is not wired in the v2 renderer yet.");
      },
      async awsSignIn() {
        throw new Error("AWS federated authentication is not wired in the v2 renderer yet.");
      },
      async closeAuthenticationWindow() {},
    },
    {
      getIntegrations(): Integration[] {
        return [...repository.listAwsSsoIntegrations(), ...repository.listAzureIntegrations()];
      },
    } as any,
    {
      promptForMFACode(sessionName: string, callback: (value: string) => void) {
        const code = promptForMfaCode?.(sessionName)?.trim();
        if (!code) {
          throw new Error("MFA prompt is not available in the current v2 runtime.");
        }
        callback(code);
      },
    },
    repository,
    behaviouralSubjectService,
    {
      async refreshWorkspaceState(callback?: () => Promise<void>) {
        if (callback) {
          await callback();
        }
      },
    },
    workspaceService,
    uiSafeRun ?? ((uiSafeBlock) => uiSafeBlock()),
    constants.ipcServerId
  );

  let started = false;

  return {
    start() {
      if (started) {
        return;
      }

      remoteProceduresServer.startServer();
      started = true;
    },
    stop() {
      if (!started) {
        return;
      }

      remoteProceduresServer.stopServer();
      started = false;
    },
  };
}