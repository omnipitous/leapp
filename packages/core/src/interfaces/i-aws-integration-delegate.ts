import { GetRoleCredentialsResponse } from "@aws-sdk/client-sso";

export interface IAwsIntegrationDelegate {
  // interactive=false means the caller runs unattended (background rotation): if a login
  // would be required, the implementation must throw instead of opening a login window
  getAccessToken(configurationId: string, region: string, portalUrl: string, forceRefresh?: boolean, interactive?: boolean): Promise<string>;

  getRoleCredentials(accessToken: string, region: string, roleArn: string): Promise<GetRoleCredentialsResponse>;
}
