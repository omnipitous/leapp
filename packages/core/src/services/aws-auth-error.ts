// AWS can invalidate an access token server-side (e.g. session duration changed by an administrator,
// token revoked) before the expiration time Leapp saved locally, so clock-based checks are not enough.
// Shared here because both AwsSsoIntegrationService and AwsSsoRoleService need it and the former
// already imports the latter (a static on either one would create a circular import).
export const isAwsAuthenticationError = (error: any): boolean => {
  const authErrorNames = ["UnauthorizedException", "UnauthorizedClientException", "InvalidGrantException", "ExpiredTokenException"];
  return authErrorNames.includes(error?.name) || error?.$metadata?.httpStatusCode === 401;
};
