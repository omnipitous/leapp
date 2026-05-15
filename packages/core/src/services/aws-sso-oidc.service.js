"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsSsoOidcService = void 0;
const constants_1 = require("../models/constants");
const log_service_1 = require("./log-service");
const client_sso_oidc_1 = require("@aws-sdk/client-sso-oidc");
class AwsSsoOidcService {
    constructor(verificationWindowService, repository, disableInAppBrowser = false) {
        this.verificationWindowService = verificationWindowService;
        this.repository = repository;
        this.disableInAppBrowser = disableInAppBrowser;
        this.listeners = [];
        this.ssoOidc = null;
        this.generateSSOTokenResponse = null;
        this.setIntervalQueue = [];
        this.loginMutex = false;
        this.timeoutOccurred = false;
        this.interruptOccurred = false;
    }
    getListeners() {
        return this.listeners;
    }
    appendListener(listener) {
        this.listeners.push(listener);
    }
    async login(configurationId, region, portalUrl) {
        if (!this.loginMutex && this.setIntervalQueue.length === 0) {
            this.loginMutex = true;
            this.ssoOidc = new client_sso_oidc_1.SSOOIDC({ region });
            this.generateSSOTokenResponse = null;
            this.setIntervalQueue = [];
            this.timeoutOccurred = false;
            this.interruptOccurred = false;
            const registerClientResponse = await this.registerSsoOidcClient();
            const startDeviceAuthorizationResponse = await this.startDeviceAuthorization(registerClientResponse, portalUrl);
            const windowModality = this.repository.getAwsSsoIntegration(configurationId).browserOpening;
            const verificationResponse = await this.verificationWindowService.openVerificationWindow(registerClientResponse, startDeviceAuthorizationResponse, windowModality, () => this.closeVerificationWindow());
            try {
                this.generateSSOTokenResponse = await this.createToken(configurationId, verificationResponse);
            }
            catch (err) {
                this.loginMutex = false;
                throw err;
            }
            this.loginMutex = false;
            return this.generateSSOTokenResponse;
        }
        else if (!this.loginMutex && this.setIntervalQueue.length > 0) {
            return this.generateSSOTokenResponse;
        }
        else {
            return new Promise((resolve, reject) => {
                const repeatEvery = 500; // 0.5 second, we can make these more speedy as they just check a variable, no external calls here
                const resolved = setInterval(async () => {
                    if (this.interruptOccurred) {
                        clearInterval(resolved);
                        const resolvedIndex = this.setIntervalQueue.indexOf(resolved);
                        this.setIntervalQueue.splice(resolvedIndex, 1);
                        reject(new log_service_1.LoggedException("AWS SSO Interrupted.", this, log_service_1.LogLevel.info));
                    }
                    else if (this.generateSSOTokenResponse) {
                        clearInterval(resolved);
                        const resolvedIndex = this.setIntervalQueue.indexOf(resolved);
                        this.setIntervalQueue.splice(resolvedIndex, 1);
                        resolve(this.generateSSOTokenResponse);
                    }
                    else if (this.timeoutOccurred) {
                        clearInterval(resolved);
                        const resolvedIndex = this.setIntervalQueue.indexOf(resolved);
                        this.setIntervalQueue.splice(resolvedIndex, 1);
                        reject(new log_service_1.LoggedException("AWS SSO Timeout occurred. Please redo login procedure.", this, log_service_1.LogLevel.error));
                    }
                }, repeatEvery);
                this.setIntervalQueue.push(resolved);
            });
        }
    }
    closeVerificationWindow() {
        this.loginMutex = false;
        this.getListeners().forEach((listener) => {
            listener.catchClosingBrowserWindow();
        });
    }
    interrupt() {
        clearInterval(this.mainIntervalId);
        this.interruptOccurred = true;
        this.loginMutex = false;
    }
    getAwsSsoOidcClient() {
        return this.ssoOidc;
    }
    async registerSsoOidcClient() {
        const registerClientRequest = { clientName: "leapp", clientType: "public" };
        return await this.getAwsSsoOidcClient().registerClient(registerClientRequest);
    }
    async startDeviceAuthorization(registerClientResponse, portalUrl) {
        const startDeviceAuthorizationRequest = {
            clientId: registerClientResponse.clientId,
            clientSecret: registerClientResponse.clientSecret,
            startUrl: portalUrl,
        };
        return await this.getAwsSsoOidcClient().startDeviceAuthorization(startDeviceAuthorizationRequest);
    }
    async createToken(configurationId, verificationResponse) {
        const createTokenRequest = {
            clientId: verificationResponse.clientId,
            clientSecret: verificationResponse.clientSecret,
            grantType: "urn:ietf:params:oauth:grant-type:device_code",
            deviceCode: verificationResponse.deviceCode,
        };
        let createTokenResponse;
        // disableInAppBrowser is a client-specific parameter. If disableInAppBrowser is true, the client will open aws sso
        // login page using the Browser instead of the Electron BrowserWindow, regardless the value specified in Leapp
        // configuration's browserOpening parameter.
        if (!this.disableInAppBrowser && this.repository.getAwsSsoIntegration(configurationId).browserOpening === constants_1.constants.inApp) {
            createTokenResponse = await this.getAwsSsoOidcClient().createToken(createTokenRequest);
        }
        else {
            createTokenResponse = await this.waitForToken(createTokenRequest);
        }
        const expirationTime = new Date(Date.now() + createTokenResponse.expiresIn * 1000);
        return { accessToken: createTokenResponse.accessToken, expirationTime };
    }
    async waitForToken(createTokenRequest) {
        return new Promise((resolve, reject) => {
            const intervalInMilliseconds = 5000;
            this.mainIntervalId = setInterval(() => {
                this.getAwsSsoOidcClient()
                    .createToken(createTokenRequest)
                    .then((createTokenResponse) => {
                    clearInterval(this.mainIntervalId);
                    resolve(createTokenResponse);
                })
                    .catch((err) => {
                    if (err.toString().indexOf("AuthorizationPendingException") === -1) {
                        // AWS SSO Timeout occurred
                        clearInterval(this.mainIntervalId);
                        this.timeoutOccurred = true;
                        reject(new log_service_1.LoggedException("AWS SSO Timeout occurred. Please redo login procedure.", this, log_service_1.LogLevel.error));
                    }
                });
            }, intervalInMilliseconds);
        });
    }
}
exports.AwsSsoOidcService = AwsSsoOidcService;
