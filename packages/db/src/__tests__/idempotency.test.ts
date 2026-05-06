import { AppError } from '@gojo/types';
import { describe, expect, it, vi } from 'vitest';

import { withIdempotency } from '../idempotency.js';

describe('withIdempotency', () => {
  it('runs the function once and caches the result', async () => {
    const db = {
      idempotencyKey: {
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };

    const result = await withIdempotency('test-key', db as never, async () => 'done');

    expect(result).toBe('done');
    expect(db.idempotencyKey.create).toHaveBeenCalled();
    expect(db.idempotencyKey.update).toHaveBeenCalledWith({
      where: { key: 'test-key' },
      data: {
        status: 'COMPLETE',
        response: 'done',
        error: null,
      },
    });
  });

  it('throws a conflict when an existing key stays pending', async () => {
    vi.useFakeTimers();

    const db = {
      idempotencyKey: {
        create: vi.fn().mockRejectedValue({ code: 'P2002' }),
        findUnique: vi.fn().mockResolvedValue({ status: 'PENDING' }),
      },
    };

    const promise = withIdempotency('test-key', db as never, async () => 'done').then(
      () => new Error('Expected conflict'),
      (error) => error,
    );
    await vi.advanceTimersByTimeAsync(5_100);

    const error = await promise;
    expect(error).toBeInstanceOf(AppError);
    vi.useRealTimers();
  });
});
