import { describe, expect, it } from 'vitest';

import {
  roomCreateSchema,
  roomRangeCreateSchema,
  roomUpdateSchema,
} from '../schemas/requests/room.schema.js';

const base = { number: '101', roomTypeId: 'rt_1' };

describe('roomCreateSchema (Story 12.7d)', () => {
  it('accepts the minimal payload (number + roomTypeId)', () => {
    const result = roomCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.accessible).toBe(false);
  });

  it('rejects an empty room number', () => {
    expect(roomCreateSchema.safeParse({ ...base, number: '' }).success).toBe(false);
  });

  it('accepts optional flags + notes', () => {
    const result = roomCreateSchema.safeParse({
      ...base,
      floor: 1,
      notes: 'Balcony',
      accessible: true,
      connectingRoomId: 'rm_other',
    });
    expect(result.success).toBe(true);
  });
});

describe('roomUpdateSchema', () => {
  it('requires stateVersion (optimistic concurrency)', () => {
    expect(roomUpdateSchema.safeParse(base).success).toBe(false);
    expect(roomUpdateSchema.safeParse({ ...base, stateVersion: 0 }).success).toBe(true);
  });
});

describe('roomRangeCreateSchema (AC3)', () => {
  it('accepts a valid range', () => {
    expect(
      roomRangeCreateSchema.safeParse({ start: 101, end: 110, roomTypeId: 'rt_1', floor: 1 }).success,
    ).toBe(true);
  });

  it('rejects end < start', () => {
    expect(
      roomRangeCreateSchema.safeParse({ start: 110, end: 101, roomTypeId: 'rt_1' }).success,
    ).toBe(false);
  });

  it('rejects a range exceeding 100 rooms', () => {
    expect(
      roomRangeCreateSchema.safeParse({ start: 1, end: 200, roomTypeId: 'rt_1' }).success,
    ).toBe(false);
  });
});
