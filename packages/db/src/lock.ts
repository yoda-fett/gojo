import { AppError } from '@gojo/types';
import Redlock from 'redlock';
import type Redis from 'ioredis';

import type { PrismaClient } from './generated/client/index.js';

const LOCK_TTL_MS = 10_000;
const MAX_ATTEMPTS = 3;

async function acquireRoomLock(redlock: Redlock, resource: string) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await redlock.acquire([resource], LOCK_TTL_MS);
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw new AppError('LOCK_TIMEOUT', 'Could not acquire room lock', 423, { cause: error });
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  throw new AppError('LOCK_TIMEOUT', 'Could not acquire room lock', 423);
}

export async function withRoomLock<T>(
  roomId: string,
  redis: Redis | null,
  db: PrismaClient,
  fn: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<T>,
) {
  const runTransaction = () =>
    db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM rooms WHERE id = $1 FOR UPDATE', roomId);
      return fn(tx);
    });

  // No Redis configured: the Postgres `FOR UPDATE` row lock inside the
  // transaction still serialises concurrent mutations on this room within
  // the database. Redlock is an extra cross-process guard, not the sole
  // correctness mechanism — degrade to the DB lock rather than failing.
  if (!redis) {
    return runTransaction();
  }

  const redlock = new Redlock([redis], { retryCount: 0 });
  const resource = `lock:room:${roomId}`;

  const lock = await acquireRoomLock(redlock, resource);

  try {
    return await runTransaction();
  } finally {
    await lock.release();
  }
}
