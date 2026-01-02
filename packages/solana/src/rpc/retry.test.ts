import { describe, test, expect, mock } from "bun:test";
import { withRetry } from "./retry";

describe("withRetry", () => {
  test("returns result on first success", async () => {
    const fn = mock(() => Promise.resolve("success"));

    const result = await withRetry(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("retries on retryable error and succeeds", async () => {
    let attempts = 0;
    const fn = mock(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error("timeout"));
      }
      return Promise.resolve("success");
    });

    const result = await withRetry(fn, { baseDelayMs: 10 });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("throws immediately on non-retryable error", async () => {
    const fn = mock(() => Promise.reject(new Error("invalid signature")));

    await expect(withRetry(fn, { baseDelayMs: 10 })).rejects.toThrow(
      "invalid signature",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("throws after max attempts on retryable error", async () => {
    const fn = mock(() => Promise.reject(new Error("rate limit exceeded")));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 }),
    ).rejects.toThrow("rate limit exceeded");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("retries on network errors", async () => {
    const networkErrors = [
      "ECONNRESET",
      "ECONNREFUSED",
      "socket hang up",
      "network error",
    ];

    for (const errorMsg of networkErrors) {
      let attempts = 0;
      const fn = mock(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error(errorMsg));
        }
        return Promise.resolve("success");
      });

      const result = await withRetry(fn, { baseDelayMs: 10 });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });

  test("retries on HTTP 429/502/503/504 errors", async () => {
    const httpErrors = ["429", "502", "503", "504", "too many requests"];

    for (const errorMsg of httpErrors) {
      let attempts = 0;
      const fn = mock(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error(`HTTP ${errorMsg}`));
        }
        return Promise.resolve("success");
      });

      const result = await withRetry(fn, { baseDelayMs: 10 });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });

  test("respects maxAttempts config", async () => {
    const fn = mock(() => Promise.reject(new Error("timeout")));

    await expect(
      withRetry(fn, { maxAttempts: 5, baseDelayMs: 10 }),
    ).rejects.toThrow("timeout");
    expect(fn).toHaveBeenCalledTimes(5);
  });

  test("applies exponential backoff", async () => {
    const callTimes: number[] = [];

    const fn = mock(() => {
      callTimes.push(Date.now());
      return Promise.reject(new Error("timeout"));
    });

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 50, maxDelayMs: 1000 }),
    ).rejects.toThrow();

    expect(callTimes.length).toBe(3);

    const firstDelay = callTimes[1]! - callTimes[0]!;
    const secondDelay = callTimes[2]! - callTimes[1]!;

    expect(firstDelay).toBeGreaterThanOrEqual(40);
    expect(secondDelay).toBeGreaterThan(firstDelay);
  });

  test("respects maxDelayMs cap", async () => {
    const callTimes: number[] = [];

    const fn = mock(() => {
      callTimes.push(Date.now());
      return Promise.reject(new Error("timeout"));
    });

    await expect(
      withRetry(fn, { maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 150 }),
    ).rejects.toThrow();

    const delays = callTimes.slice(1).map((t, i) => t - callTimes[i]!);

    for (const delay of delays) {
      expect(delay).toBeLessThanOrEqual(300);
    }
  });
});
