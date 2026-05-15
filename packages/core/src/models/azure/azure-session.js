"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureSession = void 0;
const session_type_1 = require("../session-type");
const session_1 = require("../session");
class AzureSession extends session_1.Session {
    constructor(sessionName, region, subscriptionId, tenantId, azureIntegrationId) {
        super(sessionName, region);
        this.subscriptionId = subscriptionId;
        this.tenantId = tenantId;
        this.azureIntegrationId = azureIntegrationId;
        this.type = session_type_1.SessionType.azure;
    }
}
exports.AzureSession = AzureSession;
