export class ThrottleService {
  private totalCalls: number;
  private pendingCalls: number;
  private lastCallId: number;
  private lastCallTime: number;
  private readonly minDelay: number;

  constructor(private call: (...params: any) => Promise<any>, private maxCallsPerSecond: number) {
    this.lastCallId = -1;
    this.totalCalls = 0;
    this.pendingCalls = 0;
    this.lastCallTime = 0;
    this.minDelay = (1 / maxCallsPerSecond) * 1000;
  }

  async waitFor(delayInMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayInMs));
  }

  async callWithThrottle(...params: any): Promise<any> {
    const callId = this.totalCalls++;
    while (this.lastCallId !== callId - 1 || this.pendingCalls >= this.maxCallsPerSecond || Date.now() - this.lastCallTime < this.minDelay) {
      // Sleep until close to this call's estimated slot instead of polling every
      // millisecond: with hundreds of queued calls (e.g. a large AWS organization)
      // a 1ms poll across all waiters would keep the CPU busy for the whole sync
      const callsAhead = callId - this.lastCallId - 1;
      const delayUntilNextSlot = this.minDelay - (Date.now() - this.lastCallTime);
      await this.waitFor(Math.max(callsAhead * this.minDelay, delayUntilNextSlot, 5));
    }
    this.pendingCalls++;
    this.lastCallId = callId;
    this.lastCallTime = Date.now();
    try {
      return await this.call(...params);
    } finally {
      this.pendingCalls--;
    }
  }
}
