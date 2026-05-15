"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionStatus = void 0;
var SessionStatus;
(function (SessionStatus) {
    SessionStatus[SessionStatus["inactive"] = 0] = "inactive";
    SessionStatus[SessionStatus["pending"] = 1] = "pending";
    SessionStatus[SessionStatus["active"] = 2] = "active";
})(SessionStatus || (exports.SessionStatus = SessionStatus = {}));
