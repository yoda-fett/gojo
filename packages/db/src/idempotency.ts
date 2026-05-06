import { AppError } from '@gojo/types';

import type { Prisma, PrismaClient } from './generated/client/index.js';

const POLL_INTERVAL_MS = 100;
const TIMEOUT_MS = 5_000;

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function withIdempotency<T extends Prisma.JsonValue>(
  key: string,
  db: PrismaClient,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    await db.idempotencyKey.create({
      data: {
        key,
        status: 'PENDING',
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < TIMEOUT_MS) {
      const existing = await db.idempotencyKey.findUnique({ where: { key } });

      if (existing?.status === 'COMPLETE') {
        return existing.response as T;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new AppError('IDEMPOTENCY_CONFLICT', 'Idempotent request is still pending', 409);
  }

  try {
    const response = await fn();
    await db.idempotencyKey.update({
      where: { key },
      data: {
        status: 'COMPLETE',
        response: response as Prisma.InputJsonValue,
        error: null,
      },
    });
    return response;
  } catch (error) {
    await db.idempotencyKey.update({
      where: { key },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}
