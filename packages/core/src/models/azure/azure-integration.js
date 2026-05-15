"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureIntegration = void 0;
const integration_1 = require("../integration");
const integration_type_1 = require("../integration-type");
class AzureIntegration extends integration_1.Integration {
    constructor(id, alias, tenantId, region) {
        super(id, alias, integration_type_1.IntegrationType.azure, false);
        this.tenantId = tenantId;
        this.region = region;
    }
    set tokenExpiration(tokenExpiration) {
        this._tokenExpiration = tokenExpiration;
    }
    get tokenExpiration() {
        return this._tokenExpiration;
    }
}
exports.AzureIntegration = AzureIntegration;
