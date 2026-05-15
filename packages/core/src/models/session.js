"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const uuid = __importStar(require("uuid"));
const session_status_1 = require("./session-status");
const constants_1 = require("./constants");
/**
 * This class contains metadata that represents a Leapp Session;
 * it has a concrete implementation for each specific Leapp Session type.
 * It implements an expired method used to tell whether the Session needs to be rotated or not.
 * In addition, this object is persisted in the Leapp configuration file (Leapp-lock.json).
 */
class Session {
    constructor(sessionName, region) {
        this.sessionName = sessionName;
        this.region = region;
        this.sessionId = uuid.v4();
        this.status = session_status_1.SessionStatus.inactive;
        this.startDateTime = undefined;
    }
    expired() {
        if (this.startDateTime === undefined) {
            return false;
        }
        const currentTime = new Date().getTime();
        const startTime = new Date(this.startDateTime).getTime();
        return (currentTime - startTime) / 1000 > constants_1.constants.sessionDuration;
    }
}
exports.Session = Session;
