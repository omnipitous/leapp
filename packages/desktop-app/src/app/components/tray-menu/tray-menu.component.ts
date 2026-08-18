import { Component, OnDestroy, OnInit } from "@angular/core";
import { AppService } from "../../services/app.service";
import { environment } from "../../../environments/environment";
import { UpdaterService } from "../../services/updater.service";
import { AppProviderService } from "../../services/app-provider.service";
import { BehaviouralSubjectService } from "@noovolari/leapp-core/services/behavioural-subject-service";
import { SessionFactory } from "@noovolari/leapp-core/services/session-factory";
import { Session } from "@noovolari/leapp-core/models/session";
import { SessionType } from "@noovolari/leapp-core/models/session-type";
import { SessionStatus } from "@noovolari/leapp-core/models/session-status";
import { AwsIamRoleFederatedSession } from "@noovolari/leapp-core/models/aws/aws-iam-role-federated-session";
import { AwsIamRoleChainedSession } from "@noovolari/leapp-core/models/aws/aws-iam-role-chained-session";
import { WindowService } from "../../services/window.service";
import { AwsCoreService } from "@noovolari/leapp-core/services/aws-core-service";
import { AppNativeService } from "../../services/app-native.service";
import { MessageToasterService } from "../../services/message-toaster.service";
import { LoggedEntry, LogLevel, LogService } from "@noovolari/leapp-core/services/log-service";
import { OperatingSystem } from "@noovolari/leapp-core/models/operating-system";
import { constants } from "@noovolari/leapp-core/models/constants";

@Component({
  selector: "app-tray-menu",
  templateUrl: "./tray-menu.component.html",
  styleUrls: ["./tray-menu.component.scss"],
})
export class TrayMenuComponent implements OnInit, OnDestroy {
  // Used to define the only tray we want as active especially in linux context
  private currentTray;
  private subscribed;

  private awsCoreService: AwsCoreService;
  private loggingService: LogService;
  private sessionServiceFactory: SessionFactory;
  private behaviouralSubjectService: BehaviouralSubjectService;

  private voices = [];
  private sessions = [];
  private moreSessions = [];

  constructor(
    private appService: AppService,
    private electronService: AppNativeService,
    private updaterService: UpdaterService,
    private windowService: WindowService,
    private messageToasterService: MessageToasterService,
    private appProviderService: AppProviderService
  ) {
    this.awsCoreService = appProviderService.awsCoreService;
    this.loggingService = appProviderService.logService;
    this.sessionServiceFactory = appProviderService.sessionFactory;
    this.behaviouralSubjectService = appProviderService.behaviouralSubjectService;
  }

  async ngOnInit(): Promise<void> {
    this.subscribed = this.behaviouralSubjectService.sessions$.subscribe(() => {
      this.generateMenu();
    });
    await this.generateMenu();
  }

  getProfileId(session: Session): string {
    if (session.type !== SessionType.azure) {
      return (session as any).profileId;
    } else {
      return undefined;
    }
  }

  async generateMenu(): Promise<void> {
    try {
      await this.doGenerateMenu();
    } catch (error) {
      // The tray menu is rebuilt on every session change; a transient failure here must not
      // surface as an app error toast — log it and keep the previous menu until the next rebuild
      this.loggingService.log(new LoggedEntry(`Tray menu update failed: ${error.message}`, this, LogLevel.warn, false, error.stack));
    }
  }

  /**
   * Remove session and credential file before exiting program
   */
  async cleanBeforeExit(): Promise<void> {
    // Check if we are here
    this.loggingService.log(new LoggedEntry("Closing app with cleaning process...", this, LogLevel.info));
    // We need the Try/Catch as we have the possibility to call the method without sessions
    try {
      await this.appProviderService.sessionManagementService.stopAllSessions();
    } catch (err) {
      this.loggingService.log(new LoggedEntry("No sessions to stop, skipping...", this, LogLevel.error, false, err.stack));
    }
    // Finally quit
    this.appService.quit();
  }

  ngOnDestroy(): void {
    this.subscribed.unsubscribe();
  }

  private async doGenerateMenu(): Promise<void> {
    const sessionSubmenuThreshold = 10;
    this.voices = [];
    this.sessions = [];
    this.moreSessions = [];

    const allSessions = this.appProviderService.sessionManagementService.getSessions();
    const visibleMenuSessions = allSessions.filter((_, index) => index < sessionSubmenuThreshold);
    visibleMenuSessions.forEach((session: Session) => this.sessions.push(this.createSessionVoice(session)));

    if (allSessions.length > sessionSubmenuThreshold) {
      const moreMenuSessions = allSessions.filter((_, index) => index >= sessionSubmenuThreshold);
      moreMenuSessions.forEach((session: Session) => this.moreSessions.push(this.createSessionVoice(session)));
    }

    const extraInfo = [
      { type: "separator" },
      {
        label: "Show",
        type: "normal",
        click: () => {
          this.windowService.getCurrentWindow().show();
        },
      },
      {
        label: "About",
        type: "normal",
        click: () => {
          this.appService.about();
        },
      },
      { type: "separator" },
      {
        label: "Open Documentation",
        type: "normal",
        click: () => {
          this.windowService.openExternalUrl("https://docs.leapp.cloud/");
        },
      },
      {
        label: "Join Slack Community",
        type: "normal",
        click: () => {
          this.windowService.openExternalUrl(constants.slackUrl);
        },
      },
      {
        label: "Open Issue",
        type: "normal",
        enabled: this.appService.awsSsmPluginVersion && this.appService.awsCliVersion && this.appService.issueBody,
        click: () => {
          this.windowService.openExternalUrl(
            `https://github.com/noovolari/leapp/issues/new?labels=bug&body=${encodeURIComponent(this.appService.issueBody)}`
          );
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        type: "normal",
        click: () => {
          this.cleanBeforeExit().then(() => {});
        },
      },
    ];
    // Remove unused voices from contextual menu
    const template = [
      {
        label: "Leapp",
        submenu: [
          { label: "About", role: "about" },
          { type: "separator" },
          { label: "Hide Leapp", accelerator: "CmdOrCtrl+H", role: "hide" },
          { label: "Hide Others", accelerator: "Alt+CmdOrCtrl+H", role: "hideOthers" },
          { label: "Close Window", accelerator: "CmdOrCtrl+W", role: "close" },
          { type: "separator" },
          { label: "Quit", role: "quit" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { label: "Copy", role: "copy" },
          { label: "Paste", role: "paste" },
        ],
      },
    ];
    if (!environment.production) {
      template[0].submenu.push({ label: "Open DevTool", role: "toggledevtools" });
    }
    this.appService.getMenu().setApplicationMenu(this.appService.getMenu().buildFromTemplate(template));
    // check for dark mode
    let normalIcon = "LeappTemplate";
    if (this.appService.detectOs() === OperatingSystem.linux) {
      normalIcon = "LeappMini";
    }
    if (!this.currentTray) {
      this.currentTray = new this.electronService.tray(__dirname + `/assets/images/${normalIcon}.png`);
      if (this.appService.detectOs() !== OperatingSystem.windows && this.appService.detectOs() !== OperatingSystem.linux) {
        this.appService.getApp().dock.setBadge("");
      }
    }
    if (this.updaterService.isReady() && this.updaterService.isUpdateNeeded()) {
      this.voices.push({ type: "separator" });
      this.voices.push({ label: "Check for Updates...", type: "normal", click: () => this.updaterService.updateDialog() });
      if (this.appService.detectOs() !== OperatingSystem.windows && this.appService.detectOs() !== OperatingSystem.linux) {
        this.appService.getApp().dock.setBadge("·");
      }
    }

    this.voices = this.voices.concat([
      ...this.sessions,
      ...(this.moreSessions.length > 0 ? [{ type: "separator" }, { label: "More Sessions...", submenu: this.moreSessions }] : []),
      ...extraInfo,
    ]);

    const contextMenu = this.appService.getMenu().buildFromTemplate(this.voices);
    if (this.appService.detectOs() !== OperatingSystem.windows && this.appService.detectOs() !== OperatingSystem.linux) {
      this.currentTray.setToolTip("Leapp");
    }
    this.currentTray.setContextMenu(contextMenu);
  }

  // Menu icons are re-read from disk on every menu rebuild: a momentarily missing file
  // (e.g. a dev rebuild repopulating dist) makes Electron's buildFromTemplate throw a
  // "conversion failure" for the entire menu, so omit the icon rather than crash
  private menuIcon(fileName: string): string | undefined {
    const iconPath = __dirname + `/assets/images/${fileName}.png`;
    return this.electronService.fs.existsSync(iconPath) ? iconPath : undefined;
  }

  private createSessionVoice(session: Session) {
    let icon: string | undefined;
    let label = "";
    const profile = this.appProviderService.namedProfileService.getNamedProfiles().filter((p) => p.id === this.getProfileId(session))[0];
    const iconValue = profile && profile.name === "default" ? "home" : "user";
    const isActive = session.status === SessionStatus.active;
    switch (session.type) {
      case SessionType.awsIamUser:
        icon = this.menuIcon(`${iconValue}-${isActive ? "online" : "offline"}`);
        label = "  " + session.sessionName + " - " + "iam user";
        break;
      case SessionType.awsIamRoleFederated:
      case SessionType.awsSsoRole:
        icon = this.menuIcon(`${iconValue}-${isActive ? "online" : "offline"}`);
        label = "  " + session.sessionName + " - " + (session as AwsIamRoleFederatedSession).roleArn.split("/")[1];
        break;
      case SessionType.awsIamRoleChained:
        icon = this.menuIcon(`${iconValue}-${isActive ? "online" : "offline"}`);
        label = "  " + session.sessionName + " - " + (session as AwsIamRoleChainedSession).roleArn.split("/")[1];
        break;
      case SessionType.azure:
        icon = this.menuIcon(isActive ? "icon-online-azure" : "icon-offline");
        label = "  " + session.sessionName;
    }
    return {
      label,
      type: "normal",
      icon,
      click: async () => {
        const factorizedSessionService = this.sessionServiceFactory.getSessionService(session.type);
        if (session.status !== SessionStatus.active) {
          await factorizedSessionService.start(session.sessionId);
        } else {
          await factorizedSessionService.stop(session.sessionId);
        }
      },
    };
  }
}
