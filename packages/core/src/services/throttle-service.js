"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThrottleService = void 0;
class ThrottleService {
    constructor(call, maxCallsPerSecond) {
        this.call = call;
        this.maxCallsPerSecond = maxCallsPerSecond;
        this.lastCallId = -1;
        this.totalCalls = 0;
        this.pendingCalls = 0;
        this.lastCallTime = 0;
        this.minDelay = (1 / maxCallsPerSecond) * 1000;
    }
    async waitFor(delayInMs) {
        return new Promise((resolve) => setTimeout(resolve, delayInMs));
    }
    async callWithThrottle(...params) {
        const callId = this.totalCalls++;
        while (this.lastCallId !== callId - 1 || this.pendingCalls >= this.maxCallsPerSecond || Date.now() - this.lastCallTime < this.minDelay) {
            await this.waitFor(1);
        }
        this.pendingCalls++;
        this.lastCallId = callId;
        this.lastCallTime = Date.now();
        try {
            return await this.call(...params);
        }
        finally {
            this.pendingCalls--;
        }
    }
}
exports.ThrottleService = ThrottleService;
