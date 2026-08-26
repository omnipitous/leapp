import { constants } from "@noovolari/leapp-core/models/constants";
import { Injectable } from "@angular/core";
import {
  RegisterClientResponse,
  StartDeviceAuthorizationResponse,
  VerificationResponse,
} from "@noovolari/leapp-core/services/session/aws/aws-sso-role-service";
import { IAwsSsoOidcVerificationWindowService } from "@noovolari/leapp-core/interfaces/i-aws-sso-oidc-verification-window-service";
import { WindowService } from "./window.service";
import { MessageToasterService, ToastLevel } from "./message-toaster.service";
import { AppProviderService } from "./app-provider.service";

@Injectable({ providedIn: "root" })
export class AppVerificationWindowService implements IAwsSsoOidcVerificationWindowService {
  constructor(private windowService: WindowService, private toasterService: MessageToasterService, private appProviderService: AppProviderService) {}

  async openVerificationWindow(
    registerClientResponse: RegisterClientResponse,
    startDeviceAuthorizationResponse: StartDeviceAuthorizationResponse,
    windowModality: string,
    onWindowClose: () => void
  ): Promise<VerificationResponse> {
    const openWindowInApp = constants.inApp.toString();

    // The code is shown as a toast only: the modal dialog that used to duplicate it forced an
    // extra click on every login for information the toast (and the AWS page itself) already shows
    if (startDeviceAuthorizationResponse.verificationUriComplete.indexOf("?user_code=") > -1) {
      const code = startDeviceAuthorizationResponse.verificationUriComplete.split("?user_code=")[1];
      this.toasterService.toast(`Your AWS user code for this SSO request is: ${code}`, ToastLevel.info, "SSO Security Code");
    }

    if (windowModality === openWindowInApp) {
      return this.openVerificationBrowserWindow(registerClientResponse, startDeviceAuthorizationResponse, onWindowClose);
    } else {
      return this.openExternalVerificationBrowserWindow(registerClientResponse, startDeviceAuthorizationResponse);
    }
  }

  private async openVerificationBrowserWindow(
    registerClientResponse: RegisterClientResponse,
    startDeviceAuthorizationResponse: StartDeviceAuthorizationResponse,
    onWindowClose: () => void
  ): Promise<VerificationResponse> {
    const parentWindowPosition = this.windowService.getCurrentWindow().getPosition();
    const verificationWindow = this.windowService.newWindow(
      startDeviceAuthorizationResponse.verificationUriComplete,
      true,
      "Portal url - Client verification",
      parentWindowPosition[0] + 200,
      parentWindowPosition[1] + 50
    );

    verificationWindow.loadURL(startDeviceAuthorizationResponse.verificationUriComplete);

    return new Promise((resolve, reject) => {
      // This promise MUST always settle: a login left pending forever holds the OIDC login mutex
      // and every later login (manual or not) queues behind it until the app is force-killed
      let settled = false;
      let deadlineId: any = null;
      const settle = (finalize: () => void, destroyWindow: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(deadlineId);
        if (destroyWindow) {
          try {
            // destroy() skips the "close" handler below, so a programmatic teardown never
            // runs the abort path (which stops sessions via onWindowClose)
            verificationWindow.destroy();
          } catch (e) {}
        }
        finalize();
      };

      // The device code has a fixed lifetime; once it elapses the AWS page can only display an
      // error and nothing would ever settle this promise. Close the window and fail the login.
      const deviceCodeLifetimeSeconds = startDeviceAuthorizationResponse.expiresIn || 600;
      deadlineId = setTimeout(() => {
        settle(() => reject("AWS SSO login window expired before authentication was completed. Please retry the login."), true);
      }, deviceCodeLifetimeSeconds * 1000);

      // The user closing the window aborts the login: notify listeners and settle the promise
      // (the window is allowed to actually close; it used to be kept alive by preventDefault)
      verificationWindow.on("close", () => {
        onWindowClose();
        settle(() => reject("AWS SSO login window was closed before authentication was completed."), false);
      });

      // When the code is verified and the user has been logged in, the window can be closed
      verificationWindow.webContents.session.webRequest.onCompleted(
        {
          urls: this.getAssociateTokenUrls(),
        },
        (details, callback) => {
          if (details.method === "POST" && details.statusCode === 200) {
            const verificationResponse: VerificationResponse = {
              clientId: registerClientResponse.clientId,
              clientSecret: registerClientResponse.clientSecret,
              deviceCode: startDeviceAuthorizationResponse.deviceCode,
            };
            settle(() => resolve(verificationResponse), true);
          }

          callback({
            requestHeaders: details.requestHeaders,
            url: details.url,
          });
        }
      );

      verificationWindow.webContents.session.webRequest.onErrorOccurred((details) => {
        if (
          details.error.indexOf("net::ERR_ABORTED") < 0 &&
          details.error.indexOf("net::ERR_FAILED") < 0 &&
          details.error.indexOf("net::ERR_CACHE_MISS") < 0 &&
          details.error.indexOf("net::ERR_CONNECTION_REFUSED") < 0
        ) {
          settle(() => reject(details.error.toString()), true);
        }
      });
    });
  }

  private getAssociateTokenUrls() {
    return this.appProviderService.awsCoreService
      .getRegions()
      .map((region) => `https://oidc.${region.region}.amazonaws.com/device_authorization/associate_token`);
  }

  private async openExternalVerificationBrowserWindow(
    registerClientResponse: RegisterClientResponse,
    startDeviceAuthorizationResponse: StartDeviceAuthorizationResponse
  ): Promise<VerificationResponse> {
    const uriComplete = startDeviceAuthorizationResponse.verificationUriComplete;
    return new Promise((resolve) => {
      // Open external browser window and let authentication begins
      this.windowService.openExternalUrl(uriComplete);

      // Return the code to be used after
      const verificationResponse: VerificationResponse = {
        clientId: registerClientResponse.clientId,
        clientSecret: registerClientResponse.clientSecret,
        deviceCode: startDeviceAuthorizationResponse.deviceCode,
      };

      resolve(verificationResponse);
    });
  }
}
