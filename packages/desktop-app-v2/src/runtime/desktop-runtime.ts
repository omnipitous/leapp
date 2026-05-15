import "reflect-metadata";

import type { Integration } from "../../../core/src/models/integration";
import type { Session } from "../../../core/src/models/session";
import type { SessionSelectionState } from "../../../core/src/models/session-selection-state";
import { BehaviouralSubjectService } from "../../../core/src/services/behavioural-subject-service";
import { FileService } from "../../../core/src/services/file-service";
import { LogService, LogLevel } from "../../../core/src/services/log-service";
import { Repository } from "../../../core/src/services/repository";
import { WorkspaceConsistencyService } from "../../../core/src/services/workspace-consistency-service";
import { WorkspaceService } from "../../../core/src/services/workspace-service";
import { createSessionActionController, type SessionActionSupport } from "./session-action-controller";

type Listener = () => void;

type RuntimeActionName = "start" | "stop" | "refresh";

type NamedProfileSnapshot = {
  id: string;
  name: string;
};

export type DesktopRuntimeSnapshot = {
  workspaceExists: boolean;
  workspaceFileName: string;
  defaultRegion: string;
  defaultLocation: string;
  workspaceCredentialMethod: string;
  sessions: Session[];
  integrations: Integration[];
  profiles: NamedProfileSnapshot[];
  sessionSelections: SessionSelectionState[];
  sessionCapabilities: Record<string, SessionActionSupport>;
  busySessionId: string | null;
  busyAction: RuntimeActionName | null;
  lastActionError: string | null;
};

export type DesktopRuntime = {
  subscribe: (listener: Listener) => () => void;
  getSnapshot: () => DesktopRuntimeSnapshot;
  actions: {
    refreshWorkspaceSnapshot: () => void;
    selectSession: (sessionId: string) => void;
    clearSessionSelection: () => void;
    startSession: (sessionId: string) => Promise<void>;
    stopSession: (sessionId: string) => Promise<void>;
    refreshSession: (sessionId: string) => Promise<void>;
    clearLastActionError: () => void;
  };
};

let runtimeSingleton: DesktopRuntime | null = null;

function createDesktopNativeService() {
  const electronWindow = window as Window & {
    process?: unknown;
    require?: (moduleId: string) => any;
  };

  if (!electronWindow.require) {
    throw new Error("Electron node integration is unavailable in the v2 renderer.");
  }

  const fs = electronWindow.require("fs-extra");
  const os = electronWindow.require("os");
  const path = electronWindow.require("path");
  const ini = electronWindow.require("js-ini");
  const machineId = electronWindow.require("node-machine-id").machineIdSync();
  const childProcess = electronWindow.require("child_process");
  const nodeIpcModule = electronWindow.require("node-ipc");

  let keytar: unknown = null;
  try {
    keytar = electronWindow.require("keytar");
  } catch {
    keytar = null;
  }

  return {
    url: null,
    fs,
    rimraf: null,
    os,
    ini,
    exec: childProcess.exec,
    unzip: null,
    copydir: { sync: () => undefined },
    sudo: null,
    path,
    semver: null,
    machineId,
    keytar,
    followRedirects: null,
    httpProxyAgent: null,
    httpsProxyAgent: null,
    process: electronWindow.process ?? null,
    nodeIpc: nodeIpcModule.default ?? nodeIpcModule,
    msalEncryptionService: {} as any,
    hashElement: null,
    requireModule: electronWindow.require,
    crypto: null,
    tar: null,
    fetch: window.fetch.bind(window),
    systemPreferences: null,
  };
}

function createLogger() {
  return {
    log(message: string, level: LogLevel) {
      if (level === LogLevel.error) {
        console.error(message);
        return;
      }

      if (level === LogLevel.warn) {
        console.warn(message);
        return;
      }

      console.log(message);
    },
    show(message: string, level: LogLevel) {
      this.log(message, level);
    },
  };
}

function createDesktopRuntime(): DesktopRuntime {
  const nativeService = createDesktopNativeService();
  const fileService = new FileService(nativeService as any);
  const logService = new LogService(createLogger());
  const workspaceConsistencyService = new WorkspaceConsistencyService(fileService, nativeService as any, logService);
  const repository = new Repository(nativeService as any, fileService, workspaceConsistencyService);
  const workspaceService = new WorkspaceService(repository);
  const behaviouralSubjectService = new BehaviouralSubjectService(repository);
  const sessionActionController = createSessionActionController({
    behaviouralSubjectService,
    repository,
    fileService,
    nativeService: nativeService as any,
    logService,
  });

  const listeners = new Set<Listener>();
  let busySessionId: string | null = null;
  let busyAction: RuntimeActionName | null = null;
  let lastActionError: string | null = null;

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  const readSnapshot = (): DesktopRuntimeSnapshot => {
    const workspace = workspaceService.getWorkspace();
    const sessions = behaviouralSubjectService.getSessions();
    const sessionCapabilities = sessions.reduce<Record<string, SessionActionSupport>>((accumulator, session) => {
      accumulator[session.sessionId] = sessionActionController.getSupport(session);
      return accumulator;
    }, {});

    return {
      workspaceExists: workspaceService.workspaceExists(),
      workspaceFileName: workspaceService.getWorkspaceFileName(),
      defaultRegion: workspace.defaultRegion,
      defaultLocation: workspace.defaultLocation,
      workspaceCredentialMethod: workspace.credentialMethod,
      sessions,
      integrations: behaviouralSubjectService.getIntegrations(),
      profiles: repository.getProfiles().map((profile) => ({ id: profile.id, name: profile.name })),
      sessionSelections: behaviouralSubjectService.sessionSelections,
      sessionCapabilities,
      busySessionId,
      busyAction,
      lastActionError,
    };
  };

  let currentSnapshot = readSnapshot();

  const syncSnapshotAndNotify = () => {
    currentSnapshot = readSnapshot();
    notify();
  };

  behaviouralSubjectService.sessions$.subscribe(syncSnapshotAndNotify);
  behaviouralSubjectService.integrations$.subscribe(syncSnapshotAndNotify);
  behaviouralSubjectService.sessionSelections$.subscribe(syncSnapshotAndNotify);

  const runSessionAction = async (sessionId: string, actionName: RuntimeActionName, executor: () => Promise<void>) => {
    busySessionId = sessionId;
    busyAction = actionName;
    lastActionError = null;
    currentSnapshot = readSnapshot();
    notify();

    try {
      await executor();
      workspaceService.reloadWorkspace();
      behaviouralSubjectService.reloadSessionsAndIntegrationsFromRepository();
    } catch (error) {
      lastActionError = error instanceof Error ? error.message : "Unexpected runtime action error.";
    } finally {
      busySessionId = null;
      busyAction = null;
      syncSnapshotAndNotify();
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return currentSnapshot;
    },
    actions: {
      refreshWorkspaceSnapshot() {
        workspaceService.reloadWorkspace();
        behaviouralSubjectService.reloadSessionsAndIntegrationsFromRepository();
        syncSnapshotAndNotify();
      },
      selectSession(sessionId: string) {
        behaviouralSubjectService.selectSession(sessionId);
      },
      clearSessionSelection() {
        behaviouralSubjectService.unselectSessions();
      },
      startSession(sessionId: string) {
        return runSessionAction(sessionId, "start", () => sessionActionController.start(sessionId));
      },
      stopSession(sessionId: string) {
        return runSessionAction(sessionId, "stop", () => sessionActionController.stop(sessionId));
      },
      refreshSession(sessionId: string) {
        return runSessionAction(sessionId, "refresh", () => sessionActionController.refresh(sessionId));
      },
      clearLastActionError() {
        lastActionError = null;
        syncSnapshotAndNotify();
      },
    },
  };
}

export function getDesktopRuntime() {
  if (!runtimeSingleton) {
    runtimeSingleton = createDesktopRuntime();
  }

  return runtimeSingleton;
}