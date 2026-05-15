"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceService = void 0;
class WorkspaceService {
    constructor(repository) {
        this.repository = repository;
    }
    getWorkspace() {
        return this.repository.getWorkspace();
    }
    persistWorkspace(workspace) {
        this.repository.persistWorkspace(workspace);
    }
    workspaceExists() {
        return this.getWorkspace() !== undefined && this.getWorkspace() !== null;
    }
    getDefaultProfileId() {
        return this.repository.getDefaultProfileId();
    }
    createWorkspace() {
        this.repository.createWorkspace();
    }
    removeWorkspace() {
        this.repository.removeWorkspace();
    }
    reloadWorkspace() {
        this.repository.reloadWorkspace();
    }
    setWorkspaceFileName(value) {
        this.repository.workspaceFileName = value;
    }
    getWorkspaceFileName() {
        return this.repository.workspaceFileName;
    }
    extractGlobalSettings(userId, teamId, localSessions) {
        const globalSettings = this.repository.globalSettings;
        if (userId && teamId && localSessions) {
            // Remote workspace -> Local workspace
            const namedProfiles = this.repository.getProfiles();
            const remoteWorkspaceSettings = {};
            for (const localSession of localSessions) {
                if (localSession.profileId !== undefined) {
                    remoteWorkspaceSettings[localSession.sessionId] = {
                        profileName: namedProfiles.find((profile) => profile.id === localSession.profileId).name,
                        region: localSession.region,
                    };
                }
                globalSettings.remoteWorkspacesSettingsMap[`${teamId}-${userId}`] = remoteWorkspaceSettings;
            }
        }
        return globalSettings;
    }
    applyGlobalSettings(globalSettings, localSessions, remoteSessionIds) {
        if (remoteSessionIds) {
            // Local workspace -> Remote workspace
            const localSessionIds = localSessions.map((session) => session.sessionId);
            const localPinned = globalSettings.pinned.filter((sessionId) => localSessionIds.includes(sessionId));
            const remotePinned = globalSettings.pinned.filter((sessionId) => !localSessionIds.includes(sessionId));
            const purgedPinned = remotePinned.filter((remoteSessionId) => remoteSessionIds.includes(remoteSessionId));
            globalSettings.pinned = [...localPinned, ...purgedPinned];
        }
        this.repository.globalSettings = globalSettings;
    }
}
exports.WorkspaceService = WorkspaceService;
