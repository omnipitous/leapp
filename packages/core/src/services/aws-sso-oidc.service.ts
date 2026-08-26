import { constants } from "../models/constants";
import { Repository } from "./repository";
import {
  GenerateSSOTokenResponse,
  RegisterClientResponse,
  StartDeviceAuthorizationResponse,
  VerificationResponse,
} from "./session/aws/aws-sso-role-service";
import { IAwsSsoOidcVerificationWindowService } from "../interfaces/i-aws-sso-oidc-verification-window-service";
import { BrowserWindowClosing } from "../interfaces/i-browser-window-closing";
import { LoggedException, LogLevel } from "./log-service";
import { CreateTokenRequest, RegisterClientRequest, SSOOIDC, StartDeviceAuthorizationRequest } from "@aws-sdk/client-sso-oidc";

export class AwsSsoOidcService {
  public readonly listeners: BrowserWindowClosing[];
  private ssoOidc: SSOOIDC;
  private generateSSOTokenResponse: GenerateSSOTokenResponse;
  private setIntervalQueue: Array<any>;
  private mainIntervalId: any;
  private loginMutex: boolean;
  private timeoutOccurred: boolean;
  private interruptOccurred: boolean;
  private errorOccurred: Error;

  constructor(
    private verificationWindowService: IAwsSsoOidcVerificationWindowService,
    private repository: Repository,
    private disableInAppBrowser: boolean = false
  ) {
    this.listeners = [];
    this.ssoOidc = null;
    this.generateSSOTokenResponse = null;
    this.setIntervalQueue = [];
    this.loginMutex = false;
    this.timeoutOccurred = false;
    this.interruptOccurred = false;
    this.errorOccurred = null;
  }

  getListeners(): BrowserWindowClosing[] {
    return this.listeners;
  }

  appendListener(listener: BrowserWindowClosing): void {
    this.listeners.push(listener);
  }

  async login(configurationId: string | number, region: string, portalUrl: string): Promise<GenerateSSOTokenResponse> {
    if (!this.loginMutex && this.setIntervalQueue.length === 0) {
      this.loginMutex = true;

      this.ssoOidc = new SSOOIDC({ region });
      this.generateSSOTokenResponse = null;
      this.setIntervalQueue = [];
      this.timeoutOccurred = false;
      this.interruptOccurred = false;
      this.errorOccurred = null;

      // Any failure in this flow MUST release the mutex and signal queued waiters, otherwise
      // every later login queues forever behind a dead one and only a force-kill recovers the app
      try {
        const registerClientResponse = await this.registerSsoOidcClient();
        const startDeviceAuthorizationResponse = await this.startDeviceAuthorization(registerClientResponse, portalUrl);
        const windowModality = this.repository.getAwsSsoIntegration(configurationId).browserOpening;

        // The device code has a fixed lifetime; once it elapses no verification can succeed,
        // so give the whole verification+token phase a deadline. The verification window may
        // never settle its promise (e.g. the AWS page just displays an error), and without
        // this deadline that would leave the mutex locked forever.
        const deviceCodeLifetimeSeconds = startDeviceAuthorizationResponse.expiresIn || 600;
        let deadlineId: any;
        const deadline = new Promise<never>((_, reject) => {
          deadlineId = setTimeout(() => {
            this.timeoutOccurred = true;
            reject(new LoggedException("AWS SSO login expired before it was completed. Please retry the login procedure.", this, LogLevel.warn));
          }, (deviceCodeLifetimeSeconds + 30) * 1000);
        });

        try {
          const verificationResponse = await Promise.race([
            this.verificationWindowService.openVerificationWindow(registerClientResponse, startDeviceAuthorizationResponse, windowModality, () =>
              this.closeVerificationWindow()
            ),
            deadline,
          ]);
          this.generateSSOTokenResponse = await Promise.race([this.createToken(configurationId, verificationResponse), deadline]);
        } finally {
          clearTimeout(deadlineId);
        }
      } catch (err) {
        this.errorOccurred = err;
        this.loginMutex = false;
        throw err;
      }

      this.loginMutex = false;
      return this.generateSSOTokenResponse;
    } else if (!this.loginMutex && this.setIntervalQueue.length > 0) {
      return this.generateSSOTokenResponse;
    } else {
      return new Promise((resolve, reject) => {
        const repeatEvery = 500; // 0.5 second, we can make these more speedy as they just check a variable, no external calls here

        const resolved = setInterval(async () => {
          if (this.interruptOccurred) {
            clearInterval(resolved);

            const resolvedIndex = this.setIntervalQueue.indexOf(resolved);
            this.setIntervalQueue.splice(resolvedIndex, 1);
            reject(new LoggedException("AWS SSO Interrupted.", this, LogLevel.info));
          } else if (this.generateSSOTokenResponse) {
            clearInterval(resolved);

            const resolvedIndex = this.setIntervalQueue.indexOf(resolved);
            this.setIntervalQueue.splice(resolvedIndex, 1);

            resolve(this.generateSSOTokenResponse);
          } else if (this.timeoutOccurred) {
            clearInterval(resolved);

            const resolvedIndex = this.setIntervalQueue.indexOf(resolved);
            this.setIntervalQueue.splice(resolvedIndex, 1);
            reject(new LoggedException("AWS SSO Timeout occurred. Please redo login procedure.", this, LogLevel.error));
          } else if (this.errorOccurred) {
            // The login this waiter piggybacked on failed for a non-timeout reason
            // (network error, window closed, token rejected): fail the waiter too
            // instead of leaving it polling forever
            clearInterval(resolved);

            const resolvedIndex = this.setIntervalQueue.indexOf(resolved);
            this.setIntervalQueue.splice(resolvedIndex, 1);
            reject(this.errorOccurred);
          }
        }, repeatEvery);

        this.setIntervalQueue.push(resolved);
      });
    }
  }

  closeVerificationWindow(): void {
    this.loginMutex = false;

    this.getListeners().forEach((listener) => {
      listener.catchClosingBrowserWindow();
    });
  }

  interrupt(): void {
    clearInterval(this.mainIntervalId);
    this.interruptOccurred = true;
    this.loginMutex = false;
  }

  private getAwsSsoOidcClient(): SSOOIDC {
    return this.ssoOidc;
  }

  private async registerSsoOidcClient(): Promise<RegisterClientResponse> {
    const registerClientRequest: RegisterClientRequest = { clientName: "leapp", clientType: "public" };
    return await this.getAwsSsoOidcClient().registerClient(registerClientRequest);
  }

  private async startDeviceAuthorization(
    registerClientResponse: RegisterClientResponse,
    portalUrl: string
  ): Promise<StartDeviceAuthorizationResponse> {
    const startDeviceAuthorizationRequest: StartDeviceAuthorizationRequest = {
      clientId: registerClientResponse.clientId,
      clientSecret: registerClientResponse.clientSecret,
      startUrl: portalUrl,
    };

    return await this.getAwsSsoOidcClient().startDeviceAuthorization(startDeviceAuthorizationRequest);
  }

  private async createToken(configurationId: string | number, verificationResponse: VerificationResponse): Promise<GenerateSSOTokenResponse> {
    const createTokenRequest: CreateTokenRequest = {
      clientId: verificationResponse.clientId,
      clientSecret: verificationResponse.clientSecret,
      grantType: "urn:ietf:params:oauth:grant-type:device_code",
      deviceCode: verificationResponse.deviceCode,
    };

    let createTokenResponse;
    // disableInAppBrowser is a client-specific parameter. If disableInAppBrowser is true, the client will open aws sso
    // login page using the Browser instead of the Electron BrowserWindow, regardless the value specified in Leapp
    // configuration's browserOpening parameter.
    if (!this.disableInAppBrowser && this.repository.getAwsSsoIntegration(configurationId).browserOpening === constants.inApp) {
      createTokenResponse = await this.getAwsSsoOidcClient().createToken(createTokenRequest);
    } else {
      createTokenResponse = await this.waitForToken(createTokenRequest);
    }

    const expirationTime: Date = new Date(Date.now() + createTokenResponse.expiresIn * 1000);
    return { accessToken: createTokenResponse.accessToken, expirationTime };
  }

  private async waitForToken(createTokenRequest: CreateTokenRequest): Promise<any> {
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
              reject(new LoggedException("AWS SSO Timeout occurred. Please redo login procedure.", this, LogLevel.error));
            }
          });
      }, intervalInMilliseconds);
    });
  }
}
