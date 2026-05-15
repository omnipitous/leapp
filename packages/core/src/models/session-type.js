"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionType = void 0;
var SessionType;
(function (SessionType) {
    SessionType["anytype"] = "any";
    SessionType["aws"] = "aws";
    SessionType["awsIamRoleFederated"] = "awsIamRoleFederated";
    SessionType["awsIamUser"] = "awsIamUser";
    SessionType["awsIamRoleChained"] = "awsIamRoleChained";
    SessionType["awsSsoRole"] = "awsSsoRole";
    SessionType["azure"] = "azure";
    SessionType["google"] = "google";
    SessionType["alibaba"] = "alibaba";
    SessionType["localstack"] = "localstack";
})(SessionType || (exports.SessionType = SessionType = {}));
