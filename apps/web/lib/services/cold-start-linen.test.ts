import { describe, expect, it } from 'vitest';

import { distributeFloorDivide, validateLinenSplit } from './cold-start-linen';

// Story 12.5 — floor-divide algorithm + split validator.
describe('distributeFloorDivide', () => {
  const rooms = [
    { id: 'r-101', number: '101' },
    { id: 'r-102', number: '102' },
    { id: 'r-103', number: '103' },
    { id: 'r-201', number: '201' },
    { id: 'r-202', number: '202' },
  ];

  it('returns base count when divisible (50 / 5 = 10 each)', () => {
    const out = distributeFloorDivide(rooms, 50);
    expect([...out.values()]).toEqual([10, 10, 10, 10, 10]);
  });

  it('hands +1 to the first N rooms by lexical number (12 / 5 = 2 base + 2 remainder)', () => {
    const out = distributeFloorDivide(rooms, 12);
    // 101 and 102 get +1; 103, 201, 202 get base.
    expect(out.get('r-101')).toBe(3);
    expect(out.get('r-102')).toBe(3);
    expect(out.get('r-103')).toBe(2);
    expect(out.get('r-201')).toBe(2);
    expect(out.get('r-202')).toBe(2);
  });

  it('returns 0 for every room when total is 0', () => {
    const out = distributeFloorDivide(rooms, 0);
    expect([...out.values()].every((v) => v === 0)).toBe(true);
  });

  it('returns empty map when no rooms (caller must guard)', () => {
    expect(distributeFloorDivide([], 10).size).toBe(0);
  });

  it('handles natural-number ordering (Room 9 before 10, not 1 → 10 → 11 → 2)', () => {
    const r = [
      { id: 'a', number: '2' },
      { id: 'b', number: '10' },
      { id: 'c', number: '9' },
    ];
    const out = distributeFloorDivide(r, 4);
    // Natural sort: 2, 9, 10. First gets +1 (4 / 3 = 1 base, 1 remainder).
    expect(out.get('a')).toBe(2);
    expect(out.get('c')).toBe(1);
    expect(out.get('b')).toBe(1);
  });
});

describe('validateLinenSplit', () => {
  const base = { totalOwned: 50, inRooms: 36, inLaundry: 8, inStorage: 6 };

  it('passes when sum matches totalOwned', () => {
    expect(validateLinenSplit(base)).toBeNull();
  });

  it('fails when sum overshoots', () => {
    expect(validateLinenSplit({ ...base, inStorage: 8 })).toMatch(/52/);
  });

  it('fails when sum undershoots', () => {
    expect(validateLinenSplit({ ...base, inStorage: 4 })).toMatch(/48/);
  });

  it('fails on negative counts', () => {
    expect(validateLinenSplit({ ...base, inLaundry: -1 })).toMatch(/non-negative/);
  });

  it('fails on non-integer counts', () => {
    expect(validateLinenSplit({ ...base, inRooms: 36.5 })).toMatch(/non-negative/);
  });
});
