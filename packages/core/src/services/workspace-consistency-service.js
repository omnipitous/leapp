"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceConsistencyService = void 0;
const log_service_1 = require("./log-service");
const workspace_1 = require("../models/workspace");
const constants_1 = require("../models/constants");
const class_transformer_1 = require("class-transformer");
const integration_type_1 = require("../models/integration-type");
class WorkspaceConsistencyService {
    constructor(fileService, nativeService, logService) {
        this.fileService = fileService;
        this.nativeService = nativeService;
        this.logService = logService;
    }
    get fileLockPath() {
        return this.nativeService.os.homedir() + "/" + constants_1.constants.lockFileDestination;
    }
    get fileLockBackupPath() {
        return this.nativeService.os.homedir() + "/" + constants_1.constants.lockFileBackupPath;
    }
    get workspaceFileName() {
        return this._workspaceFileName;
    }
    set workspaceFileName(value) {
        this._workspaceFileName = value;
    }
    getWorkspace() {
        try {
            const workspace = this.loadWorkspace();
            this.checkConsistency(workspace);
            if (this.workspaceFileName === constants_1.constants.lockFileDestination) {
                this.saveBackup(workspace);
            }
            return workspace;
        }
        catch (error) {
            this.logService.log(new log_service_1.LoggedEntry(error.message, this, log_service_1.LogLevel.error, false, error.stack));
            const path = this.nativeService.os.homedir() + "/" + this.workspaceFileName;
            if (this.workspaceFileName === constants_1.constants.lockFileDestination && this.fileService.existsSync(path)) {
                try {
                    return this.restoreBackup();
                }
                catch (restoreError) {
                    this.logService.log(new log_service_1.LoggedEntry(restoreError.message, this, log_service_1.LogLevel.error, false, restoreError.stack));
                    return this.cleanWorkspace();
                }
            }
            else {
                return this.cleanWorkspace();
            }
        }
    }
    createNewWorkspace() {
        const workspace = new workspace_1.Workspace();
        workspace.setNewWorkspaceVersion();
        return workspace;
    }
    checkConsistency(workspace) {
        const sessionIds = new Set(workspace.sessions.map((session) => session.sessionId));
        if (sessionIds.size !== workspace.sessions.length) {
            throw new Error("Sessions with duplicated ids");
        }
        const awsSsoIntegrationIds = new Set(workspace.awsSsoIntegrations.map((integration) => integration.id));
        if (awsSsoIntegrationIds.size !== workspace.awsSsoIntegrations.length) {
            throw new Error("AWS SSO integrations with duplicated ids");
        }
        const azureIntegrationIds = new Set(workspace.azureIntegrations.map((integration) => integration.id));
        if (azureIntegrationIds.size !== workspace.azureIntegrations.length) {
            throw new Error("Azure integrations with duplicated ids");
        }
        const awsProfileIds = new Set(workspace.profiles.map((profile) => profile.id));
        if (awsProfileIds.size !== workspace.profiles.length) {
            throw new Error("AWS named profiles with duplicated ids");
        }
        const idpUrlIds = new Set(workspace.idpUrls.map((idpUrl) => idpUrl.id));
        if (idpUrlIds.size !== workspace.idpUrls.length) {
            throw new Error("AWS IdP URLs with duplicated ids");
        }
        for (const session of workspace.sessions) {
            if (session.profileId && !awsProfileIds.has(session.profileId)) {
                throw new Error(`Session ${session.sessionName} has an invalid profileId`);
            }
            if (session.idpUrlId && !idpUrlIds.has(session.idpUrlId)) {
                throw new Error(`Session ${session.sessionName} has an invalid idpUrlId`);
            }
            if (session.awsSsoConfigurationId && !awsSsoIntegrationIds.has(session.awsSsoConfigurationId)) {
                throw new Error(`Session ${session.sessionName} has an invalid awsSsoConfigurationId`);
            }
            if (session.azureIntegrationId && !azureIntegrationIds.has(session.azureIntegrationId)) {
                throw new Error(`Session ${session.sessionName} has an invalid azureIntegrationId`);
            }
            if (session.parentSessionId && !sessionIds.has(session.parentSessionId)) {
                throw new Error(`Session ${session.sessionName} has an invalid parentSessionId`);
            }
        }
        for (let i = 0; i < workspace.awsSsoIntegrations.length; i++) {
            if (!workspace.awsSsoIntegrations[i].type) {
                workspace.awsSsoIntegrations[i].type = integration_type_1.IntegrationType.awsSso;
            }
        }
        this.save(workspace);
    }
    saveBackup(workspace) {
        this.fileService.writeFileSync(this.fileLockBackupPath, this.fileService.encryptText((0, class_transformer_1.serialize)(workspace)));
    }
    save(workspace) {
        const path = `${this.fileService.homeDir()}/${this.workspaceFileName}`;
        this.fileService.writeFileSync(path, this.fileService.encryptText((0, class_transformer_1.serialize)(workspace)));
    }
    loadWorkspace() {
        const path = this.fileService.homeDir() + "/" + this.workspaceFileName;
        const workspaceJSON = this.fileService.decryptText(this.fileService.readFileSync(path));
        return (0, class_transformer_1.deserialize)(workspace_1.Workspace, workspaceJSON);
    }
    restoreBackup() {
        const backupWorkspaceContents = this.fileService.readFileSync(this.fileLockBackupPath);
        this.fileService.writeFileSync(this.fileLockPath, backupWorkspaceContents);
        const workspace = (0, class_transformer_1.deserialize)(workspace_1.Workspace, this.fileService.decryptText(backupWorkspaceContents));
        this.checkConsistency(workspace);
        this.logService.log(new log_service_1.LoggedEntry("Leapp-lock.json was corrupted and has been restored from the latest backup.", this, log_service_1.LogLevel.error, true));
        return workspace;
    }
    cleanWorkspace() {
        const newWorkspace = this.createNewWorkspace();
        const encryptedWorkspace = this.fileService.encryptText((0, class_transformer_1.serialize)(newWorkspace));
        const path = this.fileService.homeDir() + "/" + this.workspaceFileName;
        this.fileService.writeFileSync(path, encryptedWorkspace);
        if (this.workspaceFileName === constants_1.constants.lockFileDestination) {
            this.fileService.writeFileSync(this.fileLockBackupPath, encryptedWorkspace);
        }
        this.logService.log(new log_service_1.LoggedEntry("Leapp failed to restore the latest Leapp-lock.json backup. Leapp-lock.json was reinitialized.", this, log_service_1.LogLevel.error, true));
        return newWorkspace;
    }
}
exports.WorkspaceConsistencyService = WorkspaceConsistencyService;
