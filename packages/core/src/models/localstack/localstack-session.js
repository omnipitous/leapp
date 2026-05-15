"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalstackSession = void 0;
const session_type_1 = require("../session-type");
const session_1 = require("../session");
class LocalstackSession extends session_1.Session {
    constructor(sessionName, region, profileId) {
        super(sessionName, region);
        this.endPointUrl = "http://localhost:4566";
        this.type = session_type_1.SessionType.localstack;
        this.profileId = profileId;
    }
}
exports.LocalstackSession = LocalstackSession;
