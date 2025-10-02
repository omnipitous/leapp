import { Component, Input, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators, AbstractControl } from "@angular/forms";
import { constants } from "@noovolari/leapp-core/models/constants";
import { LogService, LoggedEntry, LogLevel } from "@noovolari/leapp-core/services/log-service";
import { AppProviderService } from "src/app/services/app-provider.service";
import { AppService } from "src/app/services/app.service";
import { OptionsService } from "src/app/services/options.service";

@Component({
  selector: "app-workspace-password-dialog",
  templateUrl: "./workspace-password-dialog.component.html",
  styleUrls: ["./workspace-password-dialog.component.scss"],
})
export class WorkspacePasswordDialogComponent implements OnInit {
  @Input()
  callback: () => void;

  signinForm: FormGroup;
  password: FormControl;
  hidePassword?: boolean;
  submitting?: boolean;

  private loggingService: LogService;

  constructor(public appService: AppService, public appProviderService: AppProviderService, public optionsService: OptionsService) {
    this.password = new FormControl("", [Validators.required]);
    this.signinForm = new FormGroup({ password: this.password });
    this.hidePassword = true;
    this.loggingService = appProviderService.logService;
  }

  async setWorkspacePassword(): Promise<void> {
    this.signinForm.markAllAsTouched();

    if (this.signinForm.valid) {
      this.submitting = true;
      const formValue = this.signinForm.value;
      try {
        this.appService.closeAllMenuTriggers();
        await this.appProviderService.keychainService.saveSecret("Leapp", constants.workspacePasswordKeychainKey, formValue.password);
        const workspace = this.appProviderService.workspaceService.getWorkspace();
        this.appProviderService.fileService.aesKey = formValue.password;
        this.appProviderService.workspaceService.persistWorkspace(workspace);
        this.closeModal();
      } catch (responseException: any) {
        this.loggingService.log(new LoggedEntry(responseException, this, LogLevel.error, true));
      } finally {
        this.submitting = false;
      }
    }
  }

  getFormError(control: AbstractControl): string {
    if (control.errors?.required) {
      return "Field is required";
    }
    if (control.errors) {
      return "Unknown error";
    }
    return "";
  }

  ngOnInit(): void {}

  closeModal(): void {
    this.appService.closeModal();
  }
}
