// Story 12.5 — pure helpers for cold-start linen distribution.
// Kept side-effect-free so the floor-divide algorithm is testable without
// hitting the DB.

export type RoomRef = { id: string; number: string };

/**
 * Floor-divide + remainder distribution.
 *
 * Given `total` units of linen and a set of `rooms`, return a Map of
 * { roomId -> qty } such that every room gets `floor(total / N)` units and
 * the first `total % N` rooms (sorted by lexical `number`) get one extra.
 *
 * Lexical-number ordering chosen because it is the most operator-intuitive
 * tie-break (Room 101 gets the extra before Room 207). Stable across runs
 * for a given (total, rooms) input — important for audit reasoning.
 *
 * If `rooms.length === 0`, returns an empty Map (caller must guard upstream).
 * Negative `total` is treated as 0.
 */
export function distributeFloorDivide(rooms: RoomRef[], total: number): Map<string, number> {
  const result = new Map<string, number>();
  if (rooms.length === 0 || total <= 0) {
    for (const r of rooms) result.set(r.id, 0);
    return result;
  }
  const sorted = [...rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  const base = Math.floor(total / sorted.length);
  const remainder = total % sorted.length;
  sorted.forEach((r, i) => {
    result.set(r.id, base + (i < remainder ? 1 : 0));
  });
  return result;
}

/**
 * Validate the `inRooms + inLaundry + inStorage == totalOwned` invariant
 * for a single linen item. Returns `null` if valid, or a human-readable
 * error string if not.
 */
export function validateLinenSplit(input: {
  totalOwned: number;
  inRooms: number;
  inLaundry: number;
  inStorage: number;
}): string | null {
  if ([input.inRooms, input.inLaundry, input.inStorage].some((n) => !Number.isInteger(n) || n < 0)) {
    return 'Counts must be non-negative whole numbers.';
  }
  const sum = input.inRooms + input.inLaundry + input.inStorage;
  if (sum !== input.totalOwned) {
    return `Distribution must total ${input.totalOwned} (currently ${sum}).`;
  }
  return null;
}
