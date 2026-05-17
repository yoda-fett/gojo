import Redis from 'ioredis';

type MemoryEntry = { value: string; expiresAt: number };

const memoryStore = new Map<string, MemoryEntry>();

class MemoryRedis {
  set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Number.MAX_SAFE_INTEGER;
    memoryStore.set(key, { value, expiresAt });
    return Promise.resolve('OK');
  }

  get(key: string): Promise<string | null> {
    const entry = memoryStore.get(key);
    if (!entry) return Promise.resolve(null);
    if (entry.expiresAt <= Date.now()) {
      memoryStore.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value);
  }

  del(key: string): Promise<number> {
    const existed = memoryStore.delete(key);
    return Promise.resolve(existed ? 1 : 0);
  }
}

export interface DbRedis {
  set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

class ResilientRedis implements DbRedis {
  private client: Redis | null;
  private fallback = new MemoryRedis();

  constructor(client: Redis | null) {
    this.client = client;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    if (!this.client) return this.fallback.set(key, value, ttlSeconds);
    try {
      if (typeof ttlSeconds === 'number') {
        return await this.client.set(key, value, 'EX', ttlSeconds);
      }
      return await this.client.set(key, value);
    } catch {
      return this.fallback.set(key, value, ttlSeconds);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return this.fallback.get(key);
    try {
      return await this.client.get(key);
    } catch {
      return this.fallback.get(key);
    }
  }

  async del(key: string): Promise<number> {
    if (!this.client) return this.fallback.del(key);
    try {
      return await this.client.del(key);
    } catch {
      return this.fallback.del(key);
    }
  }
}

const globalForRedis = globalThis as typeof globalThis & {
  gojoDbRedis?: DbRedis;
};

export function getDbRedis(): DbRedis {
  if (globalForRedis.gojoDbRedis) return globalForRedis.gojoDbRedis;

  const url = process.env.REDIS_URL;
  const client = url ? new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 }) : null;
  globalForRedis.gojoDbRedis = new ResilientRedis(client);
  return globalForRedis.gojoDbRedis;
}

/**
 * Test-only: override the singleton (e.g. with an in-memory or mocked client).
 */
export function setDbRedisForTests(client: DbRedis): void {
  globalForRedis.gojoDbRedis = client;
}

/**
 * Test-only: clear the singleton and the memory fallback.
 */
export function resetDbRedisForTests(): void {
  delete globalForRedis.gojoDbRedis;
  memoryStore.clear();
}
