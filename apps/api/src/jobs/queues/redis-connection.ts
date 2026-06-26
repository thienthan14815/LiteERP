import type { ConnectionOptions } from "bullmq";

function parseRedisUrl(url: string): ConnectionOptions {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 6379),
      password: u.password || undefined,
      username: u.username || undefined,
      db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  } catch {
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null, enableReadyCheck: false };
  }
}

let cached: ConnectionOptions | null = null;

export function getRedisConnection(): ConnectionOptions {
  if (cached) return cached;
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  cached = parseRedisUrl(url);
  return cached;
}
