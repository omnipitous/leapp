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

type Listener = () => void;

export type DesktopRuntimeSnapshot = {
  workspaceExists: boolean;
  workspaceFileName: string;
  defaultRegion: string;
  defaultLocation: string;
  sessions: Session[];
  integrations: Integration[];
  sessionSelections: SessionSelectionState[];
};

export type DesktopRuntime = {
  subscribe: (listener: Listener) => () => void;
  getSnapshot: () => DesktopRuntimeSnapshot;
  actions: {
    refreshWorkspaceSnapshot: () => void;
    selectSession: (sessionId: string) => void;
    clearSessionSelection: () => void;
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

  return {
    url: null,
    fs,
    rimraf: null,
    os,
    ini,
    exec: null,
    unzip: null,
    copydir: { sync: () => undefined },
    sudo: null,
    path,
    semver: null,
    machineId,
    keytar: null,
    followRedirects: null,
    httpProxyAgent: null,
    httpsProxyAgent: null,
    process: electronWindow.process ?? null,
    nodeIpc: {} as any,
    msalEncryptionService: {} as any,
    hashElement: null,
    requireModule: null,
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

  const listeners = new Set<Listener>();

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  const readSnapshot = (): DesktopRuntimeSnapshot => {
    const workspace = workspaceService.getWorkspace();

    return {
      workspaceExists: workspaceService.workspaceExists(),
      workspaceFileName: workspaceService.getWorkspaceFileName(),
      defaultRegion: workspace.defaultRegion,
      defaultLocation: workspace.defaultLocation,
      sessions: behaviouralSubjectService.getSessions(),
      integrations: behaviouralSubjectService.getIntegrations(),
      sessionSelections: behaviouralSubjectService.sessionSelections,
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
    },
  };
}

export function getDesktopRuntime() {
  if (!runtimeSingleton) {
    runtimeSingleton = createDesktopRuntime();
  }

  return runtimeSingleton;
}