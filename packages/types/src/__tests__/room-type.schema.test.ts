import { describe, expect, it } from 'vitest';

import { roomTypeCreateSchema, roomTypeUpdateSchema } from '../schemas/requests/room-type.schema.js';

const basePayload = {
  name: 'Deluxe Garden Room',
  maxOccupancy: 2,
  baseRate: 4500,
  floorRate: 4000,
  gstSlab: '12%' as const,
};

describe('roomTypeCreateSchema (Story 12.7g — ceiling removed)', () => {
  it('accepts a payload with floor-only rate bounds', () => {
    const result = roomTypeCreateSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amenities).toEqual([]);
  });

  it('strips unknown ceilingRate (zod default: ignores unknown keys)', () => {
    const result = roomTypeCreateSchema.safeParse({ ...basePayload, ceilingRate: 6500 } as any);
    expect(result.success).toBe(true);
    if (result.success) expect((result.data as any).ceilingRate).toBeUndefined();
  });

  it('rejects an invalid GST slab', () => {
    expect(roomTypeCreateSchema.safeParse({ ...basePayload, gstSlab: '5%' }).success).toBe(false);
  });

  it('accepts an amenities array', () => {
    const result = roomTypeCreateSchema.safeParse({
      ...basePayload,
      amenities: ['Wi-Fi', 'Air conditioning'],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amenities).toEqual(['Wi-Fi', 'Air conditioning']);
  });
});

describe('roomTypeUpdateSchema', () => {
  it('requires stateVersion (optimistic concurrency)', () => {
    expect(roomTypeUpdateSchema.safeParse(basePayload).success).toBe(false);
    expect(roomTypeUpdateSchema.safeParse({ ...basePayload, stateVersion: 0 }).success).toBe(true);
  });
});
