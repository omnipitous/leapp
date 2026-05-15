"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogService = exports.LoggedException = exports.LoggedEntry = exports.LogLevel = void 0;
const package_json_1 = __importDefault(require("../../package.json"));
/* istanbul ignore next */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["success"] = 0] = "success";
    LogLevel[LogLevel["info"] = 1] = "info";
    LogLevel[LogLevel["warn"] = 2] = "warn";
    LogLevel[LogLevel["error"] = 3] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class LoggedEntry extends Error {
    constructor(message, context, level, display = false, customStack) {
        super(message);
        this.context = context;
        this.level = level;
        this.display = display;
        this.customStack = customStack;
    }
}
exports.LoggedEntry = LoggedEntry;
class LoggedException extends LoggedEntry {
    constructor(message, context, level, display = true, customStack) {
        super(message, context, level, display, customStack);
        this.context = context;
        this.level = level;
        this.display = display;
        this.customStack = customStack;
    }
}
exports.LoggedException = LoggedException;
class LogService {
    constructor(logger) {
        this.logger = logger;
    }
    log(loggedEntry) {
        const contextPart = loggedEntry.context ? [`[${loggedEntry.context.constructor["name"]}]`] : [];
        if (loggedEntry.level === LogLevel.error)
            this.logger.log([...contextPart, loggedEntry.customStack ?? loggedEntry.stack].join(" "), loggedEntry.level);
        else
            this.logger.log(loggedEntry.message, loggedEntry.level);
        if (loggedEntry.display) {
            this.logger.show(loggedEntry.message, loggedEntry.level);
        }
    }
    getCoreVersion() {
        return package_json_1.default.version;
    }
}
exports.LogService = LogService;
