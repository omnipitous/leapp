"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeappNotification = exports.LeappNotificationType = void 0;
var LeappNotificationType;
(function (LeappNotificationType) {
    LeappNotificationType[LeappNotificationType["info"] = 0] = "info";
    LeappNotificationType[LeappNotificationType["warning"] = 1] = "warning";
    LeappNotificationType[LeappNotificationType["danger"] = 2] = "danger";
    LeappNotificationType[LeappNotificationType["success"] = 3] = "success";
})(LeappNotificationType || (exports.LeappNotificationType = LeappNotificationType = {}));
class LeappNotification {
    constructor(uuid, type, title, buttonActionName, description, read, link, icon, popup) {
        this.uuid = uuid;
        this.type = type;
        this.title = title;
        this.buttonActionName = buttonActionName;
        this.description = description;
        this.read = read;
        this.link = link;
        this.icon = icon;
        this.popup = popup;
    }
}
exports.LeappNotification = LeappNotification;
