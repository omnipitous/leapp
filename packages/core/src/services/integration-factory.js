"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationFactory = void 0;
const integration_type_1 = require("../models/integration-type");
class IntegrationFactory {
    constructor(awsSsoIntegrationService, azureIntegrationService) {
        this.awsSsoIntegrationService = awsSsoIntegrationService;
        this.azureIntegrationService = azureIntegrationService;
    }
    getIntegrationService(integrationType) {
        switch (integrationType) {
            case integration_type_1.IntegrationType.awsSso:
                return this.awsSsoIntegrationService;
            case integration_type_1.IntegrationType.azure:
                return this.azureIntegrationService;
        }
    }
    async create(integrationType, creationParams) {
        const integrationService = this.getIntegrationService(integrationType);
        await integrationService.createIntegration(creationParams);
    }
    async update(integrationId, updateParams) {
        const integrationType = this.getIntegrationById(integrationId)?.type;
        if (integrationType === integration_type_1.IntegrationType.azure) {
            const currentIntegration = this.azureIntegrationService.getIntegration(integrationId);
            if (currentIntegration.tenantId !== updateParams.tenantId) {
                await this.azureIntegrationService.logout(integrationId);
            }
        }
        const integrationService = this.getIntegrationService(integrationType);
        await integrationService.updateIntegration(integrationId, updateParams);
    }
    async delete(integrationId) {
        const integrationType = this.getIntegrationById(integrationId)?.type;
        const integrationService = this.getIntegrationService(integrationType);
        await integrationService.deleteIntegration(integrationId);
    }
    async syncSessions(integrationId) {
        const integrationType = this.getIntegrationById(integrationId)?.type;
        const integrationService = this.getIntegrationService(integrationType);
        return await integrationService.syncSessions(integrationId);
    }
    async logout(integrationId) {
        const integrationType = this.getIntegrationById(integrationId)?.type;
        const integrationService = this.getIntegrationService(integrationType);
        await integrationService.logout(integrationId);
    }
    getRemainingHours(integration) {
        const integrationType = this.getIntegrationById(integration.id)?.type;
        const integrationService = this.getIntegrationService(integrationType);
        if (integrationType && integrationService) {
            return integrationService.remainingHours(integration);
        }
        else {
            return "";
        }
    }
    async setOnline(integration) {
        const integrationType = this.getIntegrationById(integration.id)?.type;
        const integrationService = this.getIntegrationService(integrationType);
        await integrationService.setOnline(integration);
    }
    getIntegrations() {
        return [...this.awsSsoIntegrationService.getIntegrations(), ...this.azureIntegrationService.getIntegrations()];
    }
    getIntegrationById(integrationId) {
        return this.getIntegrations().find((integration) => integration.id === integrationId);
    }
}
exports.IntegrationFactory = IntegrationFactory;
