import { describe, expect, it, vi } from 'vitest';

import { GET } from './route';

describe('health route', () => {
  it('returns ok status with an ISO timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T00:00:00.000Z'));

    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'ok',
      timestamp: '2026-04-25T00:00:00.000Z',
    });

    vi.useRealTimers();
  });
});
