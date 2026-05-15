"use strict";
/* eslint-disable @typescript-eslint/naming-convention */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsProcessCredentials = void 0;
class AwsProcessCredentials {
    constructor(Version, AccessKeyId, SecretAccessKey, SessionToken, Expiration) {
        this.Version = Version;
        this.AccessKeyId = AccessKeyId;
        this.SecretAccessKey = SecretAccessKey;
        this.SessionToken = SessionToken;
        this.Expiration = Expiration;
    }
}
exports.AwsProcessCredentials = AwsProcessCredentials;
