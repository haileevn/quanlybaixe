import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function createRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }
  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    client.on("error", () => {
      // Ignore background connection errors and fallback to in-memory
    });
    return client;
  } catch {
    return null;
  }
}

export function getRedis() {
  if (globalForRedis.redis === undefined) {
    globalForRedis.redis = createRedis();
  }
  return globalForRedis.redis;
}

const memory = new Map<string, { value: string; expiresAt: number }>();

function memoryGet(key: string) {
  const row = memory.get(key);
  if (!row) {
    return null;
  }
  if (Date.now() > row.expiresAt) {
    memory.delete(key);
    return null;
  }
  return row.value;
}

function memorySet(key: string, value: string, ttlSeconds: number) {
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheGet(key: string) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status === "wait") {
        await redis.connect();
      }
      return await redis.get(key);
    } catch {
      return memoryGet(key);
    }
  }
  return memoryGet(key);
}

export async function cacheSet(key: string, value: string, ttlSeconds: number) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status === "wait") {
        await redis.connect();
      }
      await redis.set(key, value, "EX", ttlSeconds);
      return;
    } catch {
      memorySet(key, value, ttlSeconds);
      return;
    }
  }
  memorySet(key, value, ttlSeconds);
}

export async function cacheDel(key: string) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status === "wait") {
        await redis.connect();
      }
      await redis.del(key);
    } catch {
      memory.delete(key);
    }
    return;
  }
  memory.delete(key);
}

export async function cacheIncr(key: string, ttlSeconds: number) {
  const current = await cacheGet(key);
  const next = String((current ? Number.parseInt(current, 10) : 0) + 1);
  await cacheSet(key, next, ttlSeconds);
  return Number.parseInt(next, 10);
}
