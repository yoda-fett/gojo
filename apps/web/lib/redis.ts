import Redis from 'ioredis';

import { env } from '../env';

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();

class MemoryRedis {
  set(key: string, value: string, exFlag?: 'EX', ttlSeconds?: number, nxFlag?: 'NX') {
    void exFlag;
    const existing = memoryStore.get(key);
    if (existing && existing.expiresAt > Date.now() && nxFlag === 'NX') {
      return Promise.resolve<null>(null);
    }

    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Number.MAX_SAFE_INTEGER;
    memoryStore.set(key, { value, expiresAt });
    return Promise.resolve('OK');
  }

  get(key: string) {
    const entry = memoryStore.get(key);
    if (!entry) {
      return Promise.resolve<null>(null);
    }

    if (entry.expiresAt <= Date.now()) {
      memoryStore.delete(key);
      return Promise.resolve<null>(null);
    }

    return Promise.resolve(entry.value);
  }
}

class ResilientRedis {
  private client: Redis | null;

  constructor(client: Redis | null) {
    this.client = client;
  }

  async set(key: string, value: string, exFlag?: 'EX', ttlSeconds?: number, nxFlag?: 'NX') {
    if (!this.client) {
      return new MemoryRedis().set(key, value, exFlag, ttlSeconds, nxFlag);
    }

    try {
      if (exFlag && typeof ttlSeconds === 'number' && nxFlag) {
        return await this.client.set(key, value, exFlag, ttlSeconds, nxFlag);
      }

      if (exFlag && typeof ttlSeconds === 'number') {
        return await this.client.set(key, value, exFlag, ttlSeconds);
      }

      return await this.client.set(key, value);
    } catch {
      return new MemoryRedis().set(key, value, exFlag, ttlSeconds, nxFlag);
    }
  }

  async get(key: string) {
    if (!this.client) {
      return new MemoryRedis().get(key);
    }

    try {
      return await this.client.get(key);
    } catch {
      return new MemoryRedis().get(key);
    }
  }
}

const globalForRedis = globalThis as typeof globalThis & {
  gojoRedis?: ResilientRedis;
};

export function getRedisClient() {
  if (globalForRedis.gojoRedis) {
    return globalForRedis.gojoRedis;
  }

  const client = env.REDIS_URL ? new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) : null;
  globalForRedis.gojoRedis = new ResilientRedis(client);
  return globalForRedis.gojoRedis;
}
