"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsSsoIntegration = void 0;
const integration_1 = require("../integration");
const integration_type_1 = require("../integration-type");
class AwsSsoIntegration extends integration_1.Integration {
    constructor(id, alias, portalUrl, region, browserOpening, accessTokenExpiration) {
        super(id, alias, integration_type_1.IntegrationType.awsSso, false);
        this.portalUrl = portalUrl;
        this.region = region;
        this.browserOpening = browserOpening;
        this.accessTokenExpiration = accessTokenExpiration;
    }
}
exports.AwsSsoIntegration = AwsSsoIntegration;
