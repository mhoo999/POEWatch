import Redis from "ioredis";

/**
 * Redis client singleton (Upstash or local). Used for caching hot read paths
 * (PRD §12 "Redis 캐싱 적용"). Connection is lazy so the app/build does not
 * require a running Redis instance.
 */
const globalForRedis = globalThis as unknown as { redis?: Redis };

function create(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set (see .env.example).");
  }
  return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
}

export const redis = globalForRedis.redis ?? create();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
