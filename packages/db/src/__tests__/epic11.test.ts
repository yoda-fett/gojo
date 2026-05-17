import { describe, expect, it } from 'vitest';

import { assertCatalogItemPatchAllowed } from '../catalog-item.js';
import { DEFAULT_ASSIGNMENT_TASKS, assertDefaultAssignmentTasks } from '../room-assignment.js';
import { istDateKey, todayInIST } from '../ist-calendar-day.js';
import {
  calculateParRestorationQtyUsed,
  distributeLaundryReceiveFifo,
  evidenceCapsAreValid,
} from '../housekeeping-logging.js';

describe('epic 11 catalog validation', () => {
  it('rejects itemType mutation and mismatched field sets', () => {
    expect(() => assertCatalogItemPatchAllowed('AMENITY', { itemType: 'LINEN' })).toThrow(/itemType/);
    expect(() => assertCatalogItemPatchAllowed('LINEN', { expectedQtyPerStay: 2 })).toThrow(/Field not allowed/);
    expect(() => assertCatalogItemPatchAllowed('AMENITY', { restockThreshold: 5 })).not.toThrow();
  });
});

describe('epic 11 task logging helpers', () => {
  it('computes par-restoration qtyUsed from authoritative par', () => {
    expect(calculateParRestorationQtyUsed(4, 1)).toBe(3);
    expect(calculateParRestorationQtyUsed(4, 4)).toBe(0);
    expect(() => calculateParRestorationQtyUsed(4, 5)).toThrow(/between zero and par/);
  });

  it('distributes laundry receive FIFO and reports shortages', () => {
    const result = distributeLaundryReceiveFifo(
      [
        { id: 'old', remainingQty: 3 },
        { id: 'new', remainingQty: 4 },
      ],
      5,
    );

    expect(result.applied).toEqual([
      { sourceLaundryLogItemId: 'old', qty: 3, remainingQty: 0 },
      { sourceLaundryLogItemId: 'new', qty: 2, remainingQty: 2 },
    ]);
    expect(result.shortageQty).toBe(2);
    expect(result.overReceivedQty).toBe(0);
  });

  it('enforces evidence text and voice caps', () => {
    expect(evidenceCapsAreValid({ note: 'x'.repeat(280), voiceSeconds: 60 })).toBe(true);
    expect(evidenceCapsAreValid({ note: 'x'.repeat(281), voiceSeconds: 60 })).toBe(false);
    expect(evidenceCapsAreValid({ note: 'ok', voiceSeconds: 61 })).toBe(false);
  });
});

describe('epic 11 room assignments', () => {
  it('locks the default task bundle without periodic laundry', () => {
    expect(DEFAULT_ASSIGNMENT_TASKS).toEqual(['CLEAN', 'REFILL', 'STANDARD_LAUNDRY']);
    expect(DEFAULT_ASSIGNMENT_TASKS).not.toContain('PERIODIC_LAUNDRY');
    expect(() => assertDefaultAssignmentTasks(DEFAULT_ASSIGNMENT_TASKS)).not.toThrow();
    expect(() => assertDefaultAssignmentTasks(['CLEAN', 'REFILL', 'STANDARD_LAUNDRY', 'PERIODIC_LAUNDRY'])).toThrow();
  });

  it('computes the IST calendar day', () => {
    const lateUtc = new Date('2026-05-13T19:00:00.000Z');
    expect(istDateKey(lateUtc)).toBe('2026-05-14');
    expect(todayInIST(lateUtc).toISOString()).toBe('2026-05-13T18:30:00.000Z');
  });
});
