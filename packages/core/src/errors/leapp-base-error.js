"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeappBaseError = void 0;
class LeappBaseError extends Error {
    constructor(name, context, severity, message) {
        super(message);
        this.name = name;
        this._context = context;
        this._severity = severity;
        Object.setPrototypeOf(this, new.target.prototype);
    }
    get severity() {
        return this._severity;
    }
    get context() {
        return this._context;
    }
}
exports.LeappBaseError = LeappBaseError;
