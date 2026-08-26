import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { AwsSsoOidcService } from "./aws-sso-oidc.service";

describe("AwsSsoOidcService", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  const makeService = (verificationWindowService: any, expiresIn: number = 600): any => {
    const repository = { getAwsSsoIntegration: jest.fn(() => ({ browserOpening: "In-app" })) } as any;
    const service = new AwsSsoOidcService(verificationWindowService, repository, false) as any;
    service.registerSsoOidcClient = jest.fn(async () => ({ clientId: "fake-client-id", clientSecret: "fake-client-secret" }));
    service.startDeviceAuthorization = jest.fn(async () => ({ deviceCode: "fake-device-code", expiresIn }));
    return service;
  };

  test("login - a failed verification window releases the mutex so the next login can run", async () => {
    const windowError = new Error("AWS SSO login window was closed before authentication was completed.");
    const verificationWindowService = {
      openVerificationWindow: jest.fn(async () => {
        throw windowError;
      }),
    };
    const service = makeService(verificationWindowService);

    await expect(service.login("fake-configuration-id", "fake-region", "fake-portal-url")).rejects.toBe(windowError);

    // Before the fix, the mutex stayed locked forever after such a failure and every later
    // login queued behind it until the app was force-killed
    await expect(service.login("fake-configuration-id", "fake-region", "fake-portal-url")).rejects.toBe(windowError);
    expect(verificationWindowService.openVerificationWindow).toHaveBeenCalledTimes(2);
  });

  test("login - a queued login fails together with the login it piggybacked on", async () => {
    let rejectWindow: (error: any) => void;
    const verificationWindowService = {
      openVerificationWindow: jest.fn(
        () =>
          new Promise((_, reject) => {
            rejectWindow = reject;
          })
      ),
    };
    const service = makeService(verificationWindowService);

    const firstLogin = service.login("fake-configuration-id", "fake-region", "fake-portal-url");
    // Give the first login a tick to acquire the mutex before the second one queues up
    await new Promise((resolve) => setTimeout(resolve, 10));
    const secondLogin = service.login("fake-configuration-id", "fake-region", "fake-portal-url");

    const windowError = new Error("network gone");
    rejectWindow(windowError);

    await expect(firstLogin).rejects.toBe(windowError);
    // Before the fix, this waiter polled forever (it only knew about success, timeout and interrupt)
    await expect(secondLogin).rejects.toBe(windowError);
  });

  test("login - a verification window that never settles is failed when the device code lifetime elapses", async () => {
    jest.useFakeTimers("modern");
    const verificationWindowService = {
      openVerificationWindow: jest.fn(() => new Promise(() => {})),
    };
    const service = makeService(verificationWindowService, 1);

    const login = service.login("fake-configuration-id", "fake-region", "fake-portal-url");
    const assertion = expect(login).rejects.toThrow("AWS SSO login expired before it was completed");

    // Flush the async steps that precede the deadline race, then jump past the deadline (expiresIn + 30s)
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
    jest.advanceTimersByTime(32 * 1000);

    await assertion;
    // The mutex must be free again after the deadline fired
    expect((service as any).loginMutex).toBe(false);
  });
});
