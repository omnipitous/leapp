"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeappNotFoundError = void 0;
const leapp_base_error_1 = require("./leapp-base-error");
const log_service_1 = require("../services/log-service");
class LeappNotFoundError extends leapp_base_error_1.LeappBaseError {
    constructor(context, message) {
        super("Leapp Not Found Error", context, log_service_1.LogLevel.warn, message);
    }
}
exports.LeappNotFoundError = LeappNotFoundError;
