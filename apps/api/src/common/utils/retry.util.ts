// Retry with exponential backoff + full jitter. Used for outbound calls to
// third-party services (Google Drive) so a transient network/5xx blip doesn't
// fail the whole operation. Only RETRYABLE errors are retried — a 400/permission
// error fails fast.

export interface RetryOptions {
  /** Max number of RETRIES after the first attempt (default 3 → up to 4 tries). */
  retries?: number;
  /** Base backoff in ms (default 300). */
  baseDelayMs?: number;
  /** Cap on a single backoff in ms (default 5000). */
  maxDelayMs?: number;
  /** Decide whether an error is worth retrying. Defaults to isTransientError. */
  isRetryable?: (err: unknown) => boolean;
  /** Notified before each retry sleep (for logging). */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

const RETRYABLE_HTTP = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_NET = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "ESOCKETTIMEDOUT",
]);

/** True for network/timeout/5xx/429 errors (transient), false otherwise. */
export function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  if (typeof e.code === "string" && RETRYABLE_NET.has(e.code)) return true;
  const status =
    (typeof e.code === "number" ? e.code : undefined) ??
    (typeof e.status === "number" ? e.status : undefined) ??
    (typeof e.response?.status === "number" ? e.response.status : undefined);
  return typeof status === "number" && RETRYABLE_HTTP.has(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 300;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const isRetryable = options.isRetryable ?? isTransientError;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !isRetryable(err)) throw err;
      const expo = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      // Full jitter: random in [0, expo]. Prevents synchronised retry storms.
      const delayMs = Math.floor(Math.random() * expo);
      options.onRetry?.(err, attempt, delayMs);
      await sleep(delayMs);
    }
  }
}
