import { isTransientError, withRetry } from "./retry.util";

describe("isTransientError", () => {
  it("flags network error codes", () => {
    expect(isTransientError({ code: "ETIMEDOUT" })).toBe(true);
    expect(isTransientError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientError({ code: "EAI_AGAIN" })).toBe(true);
  });

  it("flags retryable HTTP statuses (numeric code, status, response.status)", () => {
    expect(isTransientError({ code: 503 })).toBe(true);
    expect(isTransientError({ status: 500 })).toBe(true);
    expect(isTransientError({ response: { status: 429 } })).toBe(true);
    expect(isTransientError({ code: 408 })).toBe(true);
  });

  it("does NOT flag non-retryable client errors", () => {
    expect(isTransientError({ code: 400 })).toBe(false);
    expect(isTransientError({ response: { status: 404 } })).toBe(false);
    expect(isTransientError({ code: "EPERM" })).toBe(false);
  });

  it("handles non-object inputs safely", () => {
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError("boom")).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns on first success without retrying", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure then succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce({ code: "ETIMEDOUT" })
      .mockResolvedValue("ok");
    await expect(withRetry(fn, { baseDelayMs: 1, maxDelayMs: 2 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a non-transient error", async () => {
    const err = { code: 400 };
    const fn = jest.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after exhausting the retry budget", async () => {
    const err = { code: 503 };
    const fn = jest.fn().mockRejectedValue(err);
    await expect(
      withRetry(fn, { retries: 2, baseDelayMs: 1, maxDelayMs: 2 }),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
