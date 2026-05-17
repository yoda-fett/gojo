import { describe, expect, it } from 'vitest';

import { rateMultiplierSchema } from '../schemas/requests/rate-multiplier.schema.js';

const seasonal = {
  name: 'Diwali Peak',
  type: 'SEASONAL' as const,
  multiplier: 1.4,
  startDate: '2026-10-29T00:00:00.000Z',
  endDate: '2026-11-05T00:00:00.000Z',
};

const channel = {
  name: 'Booking.com',
  type: 'CHANNEL' as const,
  multiplier: 1.18,
  channel: 'Booking.com',
};

describe('rateMultiplierSchema (Story 12.7f)', () => {
  it('accepts a valid SEASONAL multiplier', () => {
    expect(rateMultiplierSchema.safeParse(seasonal).success).toBe(true);
  });

  it('rejects SEASONAL without dates', () => {
    expect(rateMultiplierSchema.safeParse({ ...seasonal, startDate: undefined, endDate: undefined }).success).toBe(false);
  });

  it('rejects SEASONAL with end before start', () => {
    expect(rateMultiplierSchema.safeParse({ ...seasonal, startDate: seasonal.endDate, endDate: seasonal.startDate }).success).toBe(false);
  });

  it('accepts a valid CHANNEL multiplier', () => {
    expect(rateMultiplierSchema.safeParse(channel).success).toBe(true);
  });

  it('rejects CHANNEL without channel name', () => {
    expect(rateMultiplierSchema.safeParse({ ...channel, channel: undefined }).success).toBe(false);
  });

  it('rejects non-positive multiplier', () => {
    expect(rateMultiplierSchema.safeParse({ ...channel, multiplier: 0 }).success).toBe(false);
  });
});
