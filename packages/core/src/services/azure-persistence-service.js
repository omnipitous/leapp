"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzurePersistenceService = exports.DataProtectionScope = void 0;
const constants_1 = require("../models/constants");
var DataProtectionScope;
(function (DataProtectionScope) {
    DataProtectionScope["currentUser"] = "CurrentUser";
    DataProtectionScope["localMachine"] = "LocalMachine";
})(DataProtectionScope || (exports.DataProtectionScope = DataProtectionScope = {}));
class AzurePersistenceService {
    constructor(iNativeService, keychainService) {
        this.iNativeService = iNativeService;
        this.keychainService = keychainService;
    }
    async loadMsalCache() {
        const isWin = this.iNativeService.process.platform === "win32";
        const location = this.getMsalCacheLocation(isWin);
        const data = this.iNativeService.fs.readFileSync(location);
        const finalData = isWin
            ? (await this.iNativeService.msalEncryptionService.unprotectData(data, null, DataProtectionScope.currentUser)).toString()
            : data.toString();
        return JSON.parse(finalData.trim());
    }
    async saveMsalCache(cache) {
        const data = JSON.stringify(cache, null, 4);
        const isWin = this.iNativeService.process.platform === "win32";
        const location = this.getMsalCacheLocation(isWin);
        const finalData = isWin
            ? await this.iNativeService.msalEncryptionService.protectData(Buffer.from(data, "utf-8"), null, DataProtectionScope.currentUser)
            : data;
        this.iNativeService.fs.writeFileSync(location, finalData);
    }
    async loadProfile() {
        const data = this.iNativeService.fs.readFileSync(this.getProfileLocation(), "utf8");
        return JSON.parse(data.trim());
    }
    async saveProfile(profile) {
        this.iNativeService.fs.writeFileSync(this.getProfileLocation(), JSON.stringify(profile, null, 4));
    }
    async getAzureSecrets(integrationId) {
        return {
            profile: JSON.parse(await this.keychainService.getSecret(constants_1.constants.appName, this.getProfileKeychainKey(integrationId))),
            account: JSON.parse(await this.keychainService.getSecret(constants_1.constants.appName, this.getAccountKeychainKey(integrationId))),
            refreshToken: JSON.parse(await this.keychainService.getSecret(constants_1.constants.appName, this.getRefreshTokenKeychainKey(integrationId))),
        };
    }
    async setAzureSecrets(integrationId, secrets) {
        await this.keychainService.saveSecret(constants_1.constants.appName, this.getProfileKeychainKey(integrationId), JSON.stringify(secrets.profile));
        await this.keychainService.saveSecret(constants_1.constants.appName, this.getAccountKeychainKey(integrationId), JSON.stringify(secrets.account));
        await this.keychainService.saveSecret(constants_1.constants.appName, this.getRefreshTokenKeychainKey(integrationId), JSON.stringify(secrets.refreshToken));
    }
    async deleteAzureSecrets(integrationId) {
        try {
            await this.keychainService.deleteSecret(constants_1.constants.appName, this.getProfileKeychainKey(integrationId));
        }
        catch (error) { }
        try {
            await this.keychainService.deleteSecret(constants_1.constants.appName, this.getAccountKeychainKey(integrationId));
        }
        catch (error) { }
        try {
            await this.keychainService.deleteSecret(constants_1.constants.appName, this.getRefreshTokenKeychainKey(integrationId));
        }
        catch (error) { }
    }
    getMsalCacheLocation(isWin) {
        const msalTokenCacheFileExtension = isWin ? ".bin" : ".json";
        return this.iNativeService.path.join(this.iNativeService.os.homedir(), `.azure/msal_token_cache${msalTokenCacheFileExtension}`);
    }
    getProfileLocation() {
        return this.iNativeService.path.join(this.iNativeService.os.homedir(), ".azure/azureProfile.json");
    }
    getAccountKeychainKey(integrationId) {
        return `azure-integration-account-${integrationId}`;
    }
    getRefreshTokenKeychainKey(integrationId) {
        return `azure-integration-refresh-token-${integrationId}`;
    }
    getProfileKeychainKey(integrationId) {
        return `azure-integration-profile-${integrationId}`;
    }
}
exports.AzurePersistenceService = AzurePersistenceService;
