"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Repository = void 0;
const class_transformer_1 = require("class-transformer");
const aws_sso_integration_1 = require("../models/aws/aws-sso-integration");
const constants_1 = require("../models/constants");
const session_status_1 = require("../models/session-status");
const session_type_1 = require("../models/session-type");
const uuid = __importStar(require("uuid"));
const log_service_1 = require("./log-service");
const azure_integration_1 = require("../models/azure/azure-integration");
class Repository {
    constructor(nativeService, fileService, workspaceConsistencyService) {
        this.nativeService = nativeService;
        this.fileService = fileService;
        this.workspaceConsistencyService = workspaceConsistencyService;
        this.workspaceFileName = constants_1.constants.lockFileDestination;
        this.createWorkspace();
    }
    // WORKSPACE
    get workspace() {
        return this.getWorkspace();
    }
    set workspace(value) {
        this._workspace = value;
    }
    get workspaceFileName() {
        return this._workspaceFileName;
    }
    set workspaceFileName(value) {
        this._workspaceFileName = value;
        this.workspaceConsistencyService.workspaceFileName = value;
    }
    reloadWorkspace() {
        this._workspace = this.workspaceConsistencyService.getWorkspace();
    }
    getWorkspace() {
        if (!this._workspace) {
            this.reloadWorkspace();
        }
        return this._workspace;
    }
    createWorkspace() {
        if (!this.fileService.existsSync(this.nativeService.os.homedir() + "/" + this.workspaceFileName)) {
            this.fileService.newDir(this.nativeService.os.homedir() + "/.Leapp", { recursive: true });
            this._workspace = this.workspaceConsistencyService.createNewWorkspace();
            this.persistWorkspace(this._workspace);
        }
    }
    removeWorkspace() {
        if (this.fileService.existsSync(this.nativeService.os.homedir() + "/" + this.workspaceFileName)) {
            this.fileService.removeFileSync(this.nativeService.os.homedir() + "/" + this.workspaceFileName);
        }
    }
    persistWorkspace(workspace) {
        const path = this.nativeService.os.homedir() + "/" + this.workspaceFileName;
        this.fileService.writeFileSync(path, this.fileService.encryptText((0, class_transformer_1.serialize)(workspace)));
    }
    // SESSIONS
    getSessions() {
        const workspace = this.getWorkspace();
        return workspace.sessions;
    }
    getSessionById(sessionId) {
        const workspace = this.getWorkspace();
        const session = workspace.sessions.find((sess) => sess.sessionId === sessionId);
        if (session === undefined) {
            throw new log_service_1.LoggedException(`session with id ${sessionId} not found.`, this, log_service_1.LogLevel.warn);
        }
        return session;
    }
    addSession(session) {
        const workspace = this.getWorkspace();
        workspace.sessions = [...workspace.sessions, session];
        this.persistWorkspace(workspace);
    }
    updateSession(sessionId, session) {
        const sessions = this.getSessions();
        for (let i = 0; i < sessions.length; i++) {
            if (sessions[i].sessionId === sessionId) {
                sessions[i] = session;
            }
        }
        this.updateSessions(sessions);
    }
    updateSessions(sessions) {
        const workspace = this.getWorkspace();
        workspace.sessions = sessions;
        this.persistWorkspace(workspace);
    }
    deleteSession(sessionId) {
        const workspace = this.getWorkspace();
        const index = workspace.sessions.findIndex((sess) => sess.sessionId === sessionId);
        if (index > -1) {
            workspace.sessions.splice(index, 1);
            this.persistWorkspace(workspace);
        }
    }
    listPending() {
        return this.getSessionsOrDefault().filter((session) => session.status === session_status_1.SessionStatus.pending);
    }
    listActive() {
        return this.getSessionsOrDefault().filter((session) => session.status === session_status_1.SessionStatus.active);
    }
    listActiveAndPending() {
        return this.getSessionsOrDefault().filter((s) => s.status === session_status_1.SessionStatus.active || s.status === session_status_1.SessionStatus.pending);
    }
    listAwsSsoRoles() {
        return this.getSessionsOrDefault().filter((session) => session.type === session_type_1.SessionType.awsSsoRole);
    }
    listAssumable() {
        return this.getSessionsOrDefault().filter((session) => session.type !== session_type_1.SessionType.azure);
    }
    listIamRoleChained(parentSession) {
        let childSession = this.getSessionsOrDefault().filter((session) => session.type === session_type_1.SessionType.awsIamRoleChained);
        if (parentSession) {
            childSession = childSession.filter((session) => session.parentSessionId === parentSession.sessionId);
        }
        return childSession;
    }
    createPluginStatus(pluginId) {
        this._workspace.pluginsStatus.push({ id: pluginId, active: true });
    }
    getPluginStatus(pluginId) {
        return this._workspace.pluginsStatus.find((pluginStatus) => pluginStatus.id === pluginId);
    }
    setPluginStatus(pluginId, newStatus) {
        this._workspace.pluginsStatus = this._workspace.pluginsStatus.map((pluginStatus) => (pluginStatus.id === pluginId ? newStatus : pluginStatus));
    }
    // REGION AND LOCATION
    getDefaultRegion() {
        return this.getWorkspace().defaultRegion;
    }
    getDefaultLocation() {
        return this.getWorkspace().defaultLocation;
    }
    updateDefaultRegion(defaultRegion) {
        const workspace = this.getWorkspace();
        workspace.defaultRegion = defaultRegion;
        this.persistWorkspace(workspace);
    }
    updateDefaultLocation(defaultLocation) {
        const workspace = this.getWorkspace();
        workspace.defaultLocation = defaultLocation;
        this.persistWorkspace(workspace);
    }
    // IDP URLS
    getIdpUrl(idpUrlId) {
        const workspace = this.getWorkspace();
        const idpUrlFiltered = workspace.idpUrls.find((url) => url.id === idpUrlId);
        return idpUrlFiltered ? idpUrlFiltered.url : null;
    }
    getIdpUrls() {
        return this.getWorkspace().idpUrls;
    }
    addIdpUrl(idpUrl) {
        const workspace = this.getWorkspace();
        workspace.addIpUrl(idpUrl);
        this.persistWorkspace(workspace);
    }
    updateIdpUrl(id, url) {
        const workspace = this.getWorkspace();
        const index = workspace.idpUrls.findIndex((u) => u.id === id);
        if (index > -1) {
            workspace.idpUrls[index].url = url;
            this.persistWorkspace(workspace);
        }
    }
    removeIdpUrl(id) {
        const workspace = this.getWorkspace();
        const index = workspace.idpUrls.findIndex((u) => u.id === id);
        workspace.idpUrls.splice(index, 1);
        this.persistWorkspace(workspace);
    }
    getProfiles() {
        return this.getWorkspace().profiles;
    }
    getProfileName(profileId) {
        const profileFiltered = this.getWorkspace().profiles.find((profile) => profile.id === profileId);
        if (profileFiltered === undefined) {
            throw new log_service_1.LoggedException(`named profile with id ${profileId} not found.`, this, log_service_1.LogLevel.warn);
        }
        return profileFiltered.name;
    }
    doesProfileExist(profileId) {
        return this.getWorkspace().profiles.find((profile) => profile.id === profileId) !== undefined;
    }
    getDefaultProfileId() {
        const workspace = this.getWorkspace();
        const profileFiltered = workspace.profiles.find((profile) => profile.name === constants_1.constants.defaultAwsProfileName);
        if (profileFiltered === undefined) {
            throw new log_service_1.LoggedException("no default named profile found.", this, log_service_1.LogLevel.warn);
        }
        return profileFiltered.id;
    }
    addProfile(profile) {
        const workspace = this.getWorkspace();
        workspace.profiles.push(profile);
        this.persistWorkspace(workspace);
    }
    updateProfile(profileId, newName) {
        const workspace = this.getWorkspace();
        const profileIndex = workspace.profiles.findIndex((p) => p.id === profileId);
        if (profileIndex > -1) {
            workspace.profiles[profileIndex].name = newName;
            this.persistWorkspace(workspace);
        }
    }
    removeProfile(profileId) {
        const workspace = this.getWorkspace();
        const profileIndex = workspace.profiles.findIndex((p) => p.id === profileId);
        workspace.profiles.splice(profileIndex, 1);
        this.persistWorkspace(workspace);
    }
    // AWS SSO INTEGRATION
    listAwsSsoIntegrations() {
        const workspace = this.getWorkspace();
        return workspace.awsSsoIntegrations;
    }
    getAwsSsoIntegration(id) {
        return this.getWorkspace().awsSsoIntegrations.filter((ssoConfig) => ssoConfig.id === id)[0];
    }
    getAwsSsoIntegrationSessions(id) {
        return this.workspace.sessions.filter((sess) => sess.awsSsoConfigurationId === id);
    }
    addAwsSsoIntegration(portalUrl, alias, region, browserOpening) {
        const workspace = this.getWorkspace();
        workspace.awsSsoIntegrations.push(new aws_sso_integration_1.AwsSsoIntegration(uuid.v4(), alias, portalUrl, region, browserOpening, undefined));
        this.persistWorkspace(workspace);
    }
    updateAwsSsoIntegration(id, alias, region, portalUrl, browserOpening, isOnline, expirationTime) {
        const workspace = this.getWorkspace();
        const index = workspace.awsSsoIntegrations.findIndex((sso) => sso.id === id);
        if (index > -1) {
            workspace.awsSsoIntegrations[index].alias = alias;
            workspace.awsSsoIntegrations[index].region = region;
            workspace.awsSsoIntegrations[index].portalUrl = portalUrl;
            workspace.awsSsoIntegrations[index].browserOpening = browserOpening;
            workspace.awsSsoIntegrations[index].isOnline = isOnline;
            if (expirationTime) {
                workspace.awsSsoIntegrations[index].accessTokenExpiration = expirationTime;
            }
            this.persistWorkspace(workspace);
        }
    }
    unsetAwsSsoIntegrationExpiration(id) {
        const workspace = this.getWorkspace();
        const index = workspace.awsSsoIntegrations.findIndex((sso) => sso.id === id);
        if (index > -1) {
            workspace.awsSsoIntegrations[index].accessTokenExpiration = undefined;
            this.persistWorkspace(workspace);
        }
    }
    deleteAwsSsoIntegration(id) {
        const workspace = this.getWorkspace();
        const index = workspace.awsSsoIntegrations.findIndex((awsSsoIntegration) => awsSsoIntegration.id === id);
        if (index > -1) {
            workspace.awsSsoIntegrations.splice(index, 1);
            this.persistWorkspace(workspace);
        }
    }
    addAzureIntegration(alias, tenantId, region) {
        const workspace = this.getWorkspace();
        workspace.azureIntegrations.push(new azure_integration_1.AzureIntegration(uuid.v4(), alias, tenantId, region));
        this.persistWorkspace(workspace);
    }
    updateAzureIntegration(id, alias, tenantId, region, isOnline, tokenExpiration) {
        const workspace = this.getWorkspace();
        const index = workspace.azureIntegrations.findIndex((integration) => integration.id === id);
        if (index > -1) {
            workspace.azureIntegrations[index].alias = alias;
            workspace.azureIntegrations[index].tenantId = tenantId;
            workspace.azureIntegrations[index].isOnline = isOnline;
            workspace.azureIntegrations[index].region = region;
            workspace.azureIntegrations[index].tokenExpiration = tokenExpiration;
            this.persistWorkspace(workspace);
        }
    }
    deleteAzureIntegration(id) {
        const workspace = this.getWorkspace();
        const index = workspace.azureIntegrations.findIndex((azureIntegration) => azureIntegration.id === id);
        if (index > -1) {
            workspace.azureIntegrations.splice(index, 1);
            this.persistWorkspace(workspace);
        }
    }
    getAzureIntegration(id) {
        return this.getWorkspace().azureIntegrations.filter((azureIntegration) => azureIntegration.id === id)[0];
    }
    listAzureIntegrations() {
        const workspace = this.getWorkspace();
        return workspace.azureIntegrations;
    }
    // PROXY CONFIGURATION
    getProxyConfiguration() {
        return this.getWorkspace().proxyConfiguration;
    }
    updateProxyConfiguration(proxyConfiguration) {
        const workspace = this.getWorkspace();
        workspace.proxyConfiguration = proxyConfiguration;
        this.persistWorkspace(workspace);
    }
    // SEGMENTS
    getSegments() {
        const workspace = this.getWorkspace();
        return workspace.segments;
    }
    getSegment(segmentName) {
        const workspace = this.getWorkspace();
        return workspace.segments.find((s) => s.name === segmentName);
    }
    setSegments(segments) {
        const workspace = this.getWorkspace();
        workspace.segments = segments;
        this.persistWorkspace(workspace);
    }
    removeSegment(segment) {
        const workspace = this.getWorkspace();
        const index = workspace.segments.findIndex((s) => s.name === segment.name);
        if (index > -1) {
            workspace.segments.splice(index, 1);
            this.persistWorkspace(workspace);
        }
    }
    // FOLDERS
    getFolders() {
        const workspace = this.getWorkspace();
        return workspace.folders;
    }
    setFolders(folders) {
        const workspace = this.getWorkspace();
        workspace.folders = folders;
        this.persistWorkspace(workspace);
    }
    // MACOS TERMINAL
    updateMacOsTerminal(macOsTerminal) {
        const workspace = this.getWorkspace();
        workspace.macOsTerminal = macOsTerminal;
        this.persistWorkspace(workspace);
    }
    updateColorTheme(colorTheme) {
        const workspace = this.getWorkspace();
        workspace.colorTheme = colorTheme;
        this.persistWorkspace(workspace);
    }
    getColorTheme() {
        const workspace = this.getWorkspace();
        return workspace.colorTheme;
    }
    writeFile(data) {
        this.nativeService.fs.writeFileSync(__dirname + "/register-client-response", JSON.stringify(data));
    }
    get globalSettings() {
        const workspace = this.getWorkspace();
        return {
            colorTheme: workspace.colorTheme,
            credentialMethod: workspace.credentialMethod,
            defaultLocation: workspace.defaultLocation,
            defaultRegion: workspace.defaultRegion,
            extensionEnabled: workspace.extensionEnabled,
            macOsTerminal: workspace.macOsTerminal,
            pluginsStatus: workspace.pluginsStatus,
            samlRoleSessionDuration: workspace.samlRoleSessionDuration,
            pinned: workspace.pinned,
            segments: workspace.segments,
            ssmRegionBehaviour: workspace.ssmRegionBehaviour,
            notifications: workspace.notifications,
            requirePassword: workspace.requirePassword,
            touchIdEnabled: workspace.touchIdEnabled,
            remoteWorkspacesSettingsMap: workspace.remoteWorkspacesSettingsMap,
        };
    }
    set globalSettings(globalSettingsInput) {
        const workspace = this.getWorkspace();
        workspace.colorTheme = globalSettingsInput.colorTheme;
        workspace.credentialMethod = globalSettingsInput.credentialMethod;
        workspace.defaultLocation = globalSettingsInput.defaultLocation;
        workspace.defaultRegion = globalSettingsInput.defaultRegion;
        workspace.extensionEnabled = globalSettingsInput.extensionEnabled;
        workspace.macOsTerminal = globalSettingsInput.macOsTerminal;
        workspace.pluginsStatus = globalSettingsInput.pluginsStatus;
        workspace.samlRoleSessionDuration = globalSettingsInput.samlRoleSessionDuration;
        workspace.pinned = globalSettingsInput.pinned;
        workspace.segments = globalSettingsInput.segments;
        workspace.ssmRegionBehaviour = globalSettingsInput.ssmRegionBehaviour;
        workspace.notifications = globalSettingsInput.notifications;
        workspace.requirePassword = globalSettingsInput.requirePassword;
        workspace.touchIdEnabled = globalSettingsInput.touchIdEnabled;
        workspace.remoteWorkspacesSettingsMap = globalSettingsInput.remoteWorkspacesSettingsMap;
        this.persistWorkspace(workspace);
    }
    // NOTIFICATIONS
    /**
     * Get Notifications
     * Get all the notifications that the user has received
     *
     * @return LeappNotification[] - the notification array
     */
    getNotifications() {
        const workspace = this.getWorkspace();
        return workspace.notifications;
    }
    /**
     * Set Notifications
     * Set the array of new notifications , it can be used to re-update the current array, i.e. after a read message
     *
     * @param notifications - the notification array
     */
    setNotifications(notifications) {
        const workspace = this.getWorkspace();
        workspace.notifications = notifications;
        this.persistWorkspace(workspace);
    }
    // PRIVATE
    getSessionsOrDefault() {
        const workspace = this.getWorkspace();
        if (workspace.sessions)
            return workspace.sessions;
        else
            return [];
    }
}
exports.Repository = Repository;
