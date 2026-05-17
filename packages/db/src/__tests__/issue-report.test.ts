import { AppError } from '@gojo/types';
import { describe, expect, it } from 'vitest';

import { attributionStreamForEntryContext, parseIssueReportInput } from '../issue-report.js';

describe('issue report validation', () => {
  it('routes entry contexts to attribution streams', () => {
    expect(attributionStreamForEntryContext('COLD')).toBe('OTHER');
    expect(attributionStreamForEntryContext('MISSING_FROM_ROOM')).toBe('ROOM_SHORTAGE');
    expect(attributionStreamForEntryContext('DAMAGED_ON_RETURN')).toBe('LAUNDRY_SHORTAGE');
  });

  it('accepts cold entries without prefill context', () => {
    expect(parseIssueReportInput({ entryContext: 'COLD', category: 'DAMAGE_IN_ROOM', textNote: 'Broken lamp' })).toEqual({
      entryContext: 'COLD',
      category: 'DAMAGE_IN_ROOM',
      roomId: null,
      catalogItemId: null,
      vendorName: null,
      textNote: 'Broken lamp',
    });
  });

  it('requires missing-room attribution fields and locks category', () => {
    expect(parseIssueReportInput({
      entryContext: 'MISSING_FROM_ROOM',
      category: 'MISSING_ITEM',
      roomId: 'room-1',
      catalogItemId: 'linen-1',
      qty: '2',
    })).toMatchObject({ entryContext: 'MISSING_FROM_ROOM', qty: 2 });

    expect(() => parseIssueReportInput({ entryContext: 'MISSING_FROM_ROOM', category: 'MISSING_ITEM', catalogItemId: 'linen-1', qty: 1 })).toThrow(AppError);
    expect(() => parseIssueReportInput({ entryContext: 'MISSING_FROM_ROOM', category: 'DAMAGED_RETURN', roomId: 'room-1', catalogItemId: 'linen-1', qty: 1 })).toThrow(AppError);
    expect(() => parseIssueReportInput({ entryContext: 'MISSING_FROM_ROOM', category: 'MISSING_ITEM', roomId: 'room-1', catalogItemId: 'linen-1', qty: 1, vendorName: 'Vendor' })).toThrow(AppError);
  });

  it('requires damaged-return vendor context and enforces text cap', () => {
    expect(parseIssueReportInput({
      entryContext: 'DAMAGED_ON_RETURN',
      category: 'DAMAGED_RETURN',
      catalogItemId: 'linen-1',
      qty: 1,
      vendorName: 'Sparkle Laundry',
    })).toMatchObject({ entryContext: 'DAMAGED_ON_RETURN', vendorName: 'Sparkle Laundry' });

    expect(() => parseIssueReportInput({
      entryContext: 'DAMAGED_ON_RETURN',
      category: 'DAMAGED_RETURN',
      catalogItemId: 'linen-1',
      qty: 1,
      vendorName: 'Sparkle Laundry',
      textNote: 'x'.repeat(281),
    })).toThrow(AppError);
  });
});
