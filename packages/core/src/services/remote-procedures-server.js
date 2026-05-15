"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteProceduresServer = exports.arrayToUInt8Array = exports.uInt8ArrayToArray = void 0;
const constants_1 = require("../models/constants");
const uInt8ArrayToArray = (uint8array) => {
    if (uint8array === null || uint8array === undefined)
        return null;
    return [...uint8array.values()];
};
exports.uInt8ArrayToArray = uInt8ArrayToArray;
const arrayToUInt8Array = (serializedArray) => {
    if (!serializedArray)
        return null;
    return Buffer.from(serializedArray);
};
exports.arrayToUInt8Array = arrayToUInt8Array;
class RemoteProceduresServer {
    constructor(keychainService, nativeService, verificationWindowService, awsAuthenticationService, integrationFactory, mfaCodePrompter, repository, behaviouralSubjectService, teamService, workspaceService, uiSafeFn, serverId = constants_1.constants.ipcServerId) {
        this.keychainService = keychainService;
        this.nativeService = nativeService;
        this.verificationWindowService = verificationWindowService;
        this.awsAuthenticationService = awsAuthenticationService;
        this.integrationFactory = integrationFactory;
        this.mfaCodePrompter = mfaCodePrompter;
        this.repository = repository;
        this.behaviouralSubjectService = behaviouralSubjectService;
        this.teamService = teamService;
        this.workspaceService = workspaceService;
        this.uiSafeFn = uiSafeFn;
        this.serverId = serverId;
        this.rpcMethods = new Map([
            ["isDesktopAppRunning", this.isDesktopAppRunning],
            ["needAuthentication", this.needAuthentication],
            ["needMFA", this.needMfa],
            ["awsSignIn", this.awsSignIn],
            ["openVerificationWindow", this.openVerificationWindow],
            ["refreshIntegrations", this.refreshIntegrations],
            ["refreshSessions", this.refreshSessions],
            ["msalProtectData", this.msalProtectData],
            ["msalUnprotectData", this.msalUnprotectData],
            ["keychainSaveSecret", this.keychainSaveSecret],
            ["keychainGetSecret", this.keychainGetSecret],
            ["keychainDeleteSecret", this.keychainDeleteSecret],
            ["refreshWorkspaceState", this.refreshWorkspaceState],
        ]);
    }
    startServer() {
        const ipc = this.nativeService.nodeIpc;
        ipc.config.id = this.serverId;
        ipc.serve(() => {
            ipc.server.on("message", (data, ipcSocket) => {
                const emitFunction = (socket, event, value) => ipc.server.emit(socket, event, value);
                const rpcFunction = this.rpcMethods.get(data.method);
                if (rpcFunction) {
                    rpcFunction.call(this, emitFunction, ipcSocket, data);
                }
                else {
                    ipcSocket.destroy();
                }
            });
        });
        ipc.server.start();
    }
    stopServer() {
        this.nativeService.nodeIpc.server.stop();
    }
    isDesktopAppRunning(emitFunction, socket) {
        emitFunction(socket, "message", { result: true });
    }
    needMfa(emitFunction, socket, data) {
        try {
            this.mfaCodePrompter.promptForMFACode(data.params.sessionName, (result) => {
                emitFunction(socket, "message", { result });
            });
        }
        catch (error) {
            emitFunction(socket, "message", { error: error.message });
        }
    }
    needAuthentication(emitFunction, socket, data) {
        this.awsAuthenticationService
            .needAuthentication(data.params.idpUrl)
            .then((result) => {
            emitFunction(socket, "message", { result });
        })
            .catch((error) => emitFunction(socket, "message", { error: error.message }));
    }
    awsSignIn(emitFunction, socket, data) {
        this.awsAuthenticationService
            .awsSignIn(data.params.idpUrl, data.params.needToAuthenticate)
            .then((result) => emitFunction(socket, "message", { result }))
            .catch((error) => emitFunction(socket, "message", { error: error.message }));
    }
    openVerificationWindow(emitFunction, socket, data) {
        this.verificationWindowService
            .openVerificationWindow(data.params.registerClientResponse, data.params.startDeviceAuthorizationResponse, data.params.windowModality, () => emitFunction(socket, "message", { callbackId: "onWindowClose" }))
            .then((result) => emitFunction(socket, "message", { result }))
            .catch((error) => emitFunction(socket, "message", { error: error.message }));
    }
    refreshIntegrations(emitFunction, socket) {
        try {
            this.repository.reloadWorkspace();
            this.uiSafeFn(() => {
                const workspace = this.repository.getWorkspace();
                workspace.awsSsoIntegrations = this.repository.listAwsSsoIntegrations();
                workspace.azureIntegrations = this.repository.listAzureIntegrations();
                this.repository.persistWorkspace(workspace);
                this.behaviouralSubjectService.setIntegrations(this.integrationFactory.getIntegrations());
            });
            emitFunction(socket, "message", {});
        }
        catch (error) {
            emitFunction(socket, "message", { error: error.message });
        }
    }
    refreshSessions(emitFunction, socket) {
        try {
            this.repository.reloadWorkspace();
            this.uiSafeFn(() => {
                this.behaviouralSubjectService.setSessions(this.repository.getSessions());
            });
            emitFunction(socket, "message", {});
        }
        catch (error) {
            emitFunction(socket, "message", { error: error.message });
        }
    }
    async msalProtectData(emitFunction, socket, data) {
        try {
            const protectedData = await this.nativeService.msalEncryptionService.protectData((0, exports.arrayToUInt8Array)(data.params.dataToEncrypt), (0, exports.arrayToUInt8Array)(data.params.optionalEntropy), data.params.scope);
            emitFunction(socket, "message", { result: (0, exports.uInt8ArrayToArray)(protectedData) });
        }
        catch (error) {
            emitFunction(socket, "message", { error: error.message });
        }
    }
    async msalUnprotectData(emitFunction, socket, data) {
        try {
            const protectedData = await this.nativeService.msalEncryptionService.unprotectData((0, exports.arrayToUInt8Array)(data.params.encryptedData), (0, exports.arrayToUInt8Array)(data.params.optionalEntropy), data.params.scope);
            emitFunction(socket, "message", { result: (0, exports.uInt8ArrayToArray)(protectedData) });
        }
        catch (error) {
            emitFunction(socket, "message", { error: error.message });
        }
    }
    async keychainSaveSecret(emitFunction, socket, data) {
        try {
            await this.keychainService.saveSecret(data.params.service, data.params.account, data.params.password);
            emitFunction(socket, "message", {});
        }
        catch (error) {
            emitFunction(socket, "message", { error: error.message });
        }
    }
    async keychainGetSecret(emitFunction, socket, data) {
        try {
            const result = await this.keychainService.getSecret(data.params.service, data.params.account);
            emitFunction(socket, "message", { result });
        }
        catch (error) {
            emitFunction(socket, "message", { error: error.message });
        }
    }
    async keychainDeleteSecret(emitFunction, socket, data) {
        try {
            const result = await this.keychainService.deleteSecret(data.params.service, data.params.account);
            emitFunction(socket, "message", { result });
        }
        catch (error) {
            emitFunction(socket, "message", { error: error.message });
        }
    }
    async refreshWorkspaceState(emitFunction, socket, _data) {
        try {
            this.uiSafeFn(async () => {
                await this.teamService.refreshWorkspaceState(async () => this.workspaceService.reloadWorkspace());
            });
            emitFunction(socket, "message", {});
        }
        catch (error) {
            emitFunction(socket, "message", { error: error.message });
        }
    }
}
exports.RemoteProceduresServer = RemoteProceduresServer;
