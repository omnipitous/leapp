"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeappAwsStsError = void 0;
const leapp_base_error_1 = require("./leapp-base-error");
const log_service_1 = require("../services/log-service");
class LeappAwsStsError extends leapp_base_error_1.LeappBaseError {
    constructor(context, message) {
        super("Leapp Aws Sts Error", context, log_service_1.LogLevel.warn, message);
    }
}
exports.LeappAwsStsError = LeappAwsStsError;
