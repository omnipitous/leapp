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
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
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
exports.Workspace = void 0;
const session_1 = require("./session");
const uuid = __importStar(require("uuid"));
require("reflect-metadata");
const class_transformer_1 = require("class-transformer");
const constants_1 = require("./constants");
let Workspace = (() => {
    var _a;
    let __sessions_decorators;
    let __sessions_initializers = [];
    let __sessions_extraInitializers = [];
    return _a = class Workspace {
            constructor() {
                /* istanbul ignore next */
                this._sessions = __runInitializers(this, __sessions_initializers, void 0);
                this._awsSsoIntegrations = __runInitializers(this, __sessions_extraInitializers);
                this._pinned = [];
                this._sessions = [];
                this._folders = [];
                this._segments = [];
                this._defaultRegion = constants_1.constants.defaultRegion;
                this._defaultLocation = constants_1.constants.defaultLocation;
                this._macOsTerminal = constants_1.constants.macOsTerminal;
                this._idpUrls = [];
                this._profiles = [{ id: uuid.v4(), name: constants_1.constants.defaultAwsProfileName }];
                this._remoteWorkspacesSettingsMap = {};
                this._pluginsStatus = [];
                this._extensionEnabled = false;
                this._awsSsoIntegrations = [];
                this._azureIntegrations = [];
                this._proxyConfiguration = {
                    proxyProtocol: "https",
                    proxyUrl: undefined,
                    proxyPort: "8080",
                    username: undefined,
                    password: undefined,
                };
                this._notifications = [];
                this._credentialMethod = constants_1.constants.credentialFile;
                this._samlRoleSessionDuration = constants_1.constants.samlRoleSessionDuration;
                this._ssmRegionBehaviour = constants_1.constants.ssmRegionNo;
            }
            setNewWorkspaceVersion() {
                this._workspaceVersion = constants_1.constants.workspaceLastVersion;
            }
            addIpUrl(idpUrl) {
                this._idpUrls.push(idpUrl);
            }
            get macOsTerminal() {
                return this._macOsTerminal;
            }
            set macOsTerminal(value) {
                this._macOsTerminal = value;
            }
            get idpUrls() {
                return this._idpUrls;
            }
            set idpUrls(value) {
                this._idpUrls = value;
            }
            get profiles() {
                return this._profiles;
            }
            set profiles(value) {
                this._profiles = value;
            }
            get remoteWorkspacesSettingsMap() {
                return this._remoteWorkspacesSettingsMap;
            }
            set remoteWorkspacesSettingsMap(value) {
                this._remoteWorkspacesSettingsMap = value;
            }
            get sessions() {
                return this._sessions;
            }
            set sessions(value) {
                this._sessions = value;
            }
            get proxyConfiguration() {
                return this._proxyConfiguration;
            }
            set proxyConfiguration(value) {
                this._proxyConfiguration = value;
            }
            get defaultRegion() {
                return this._defaultRegion;
            }
            set defaultRegion(value) {
                this._defaultRegion = value;
            }
            get defaultLocation() {
                return this._defaultLocation;
            }
            set defaultLocation(value) {
                this._defaultLocation = value;
            }
            get awsSsoIntegrations() {
                return this._awsSsoIntegrations;
            }
            set awsSsoIntegrations(value) {
                this._awsSsoIntegrations = value;
            }
            get azureIntegrations() {
                return this._azureIntegrations;
            }
            set azureIntegrations(value) {
                this._azureIntegrations = value;
            }
            get pinned() {
                return this._pinned;
            }
            set pinned(pinned) {
                this._pinned = pinned;
            }
            get folders() {
                return this._folders;
            }
            set folders(folders) {
                this._folders = folders;
            }
            get segments() {
                return this._segments;
            }
            set segments(segments) {
                this._segments = segments;
            }
            get colorTheme() {
                return this._colorTheme;
            }
            set colorTheme(value) {
                this._colorTheme = value;
            }
            get credentialMethod() {
                return this._credentialMethod;
            }
            set credentialMethod(credentialMethod) {
                this._credentialMethod = credentialMethod;
            }
            get pluginsStatus() {
                return this._pluginsStatus;
            }
            set pluginsStatus(newPlugins) {
                this._pluginsStatus = newPlugins;
            }
            get ssmRegionBehaviour() {
                return this._ssmRegionBehaviour;
            }
            set ssmRegionBehaviour(ssmRegionBehaviour) {
                this._ssmRegionBehaviour = ssmRegionBehaviour;
            }
            get extensionEnabled() {
                return this._extensionEnabled;
            }
            set extensionEnabled(extensionEnabled) {
                this._extensionEnabled = extensionEnabled;
            }
            get samlRoleSessionDuration() {
                return this._samlRoleSessionDuration;
            }
            set samlRoleSessionDuration(duration) {
                this._samlRoleSessionDuration = duration;
            }
            get notifications() {
                return this._notifications;
            }
            set notifications(notifications) {
                this._notifications = notifications;
            }
            get requirePassword() {
                return this._requirePassword;
            }
            set requirePassword(value) {
                this._requirePassword = value;
            }
            get touchIdEnabled() {
                return this._touchIdEnabled;
            }
            set touchIdEnabled(value) {
                this._touchIdEnabled = value;
            }
        },
        (() => {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __sessions_decorators = [(0, class_transformer_1.Type)(() => session_1.Session)];
            __esDecorate(null, null, __sessions_decorators, { kind: "field", name: "_sessions", static: false, private: false, access: { has: obj => "_sessions" in obj, get: obj => obj._sessions, set: (obj, value) => { obj._sessions = value; } }, metadata: _metadata }, __sessions_initializers, __sessions_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
})();
exports.Workspace = Workspace;
