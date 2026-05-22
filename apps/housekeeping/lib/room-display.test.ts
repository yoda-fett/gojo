import { describe, expect, it } from 'vitest';

import { roomCardStatus, statusChipLabel, taskChipLabel } from './room-display';

describe('roomCardStatus', () => {
  // Epic 15: the stored cleanliness axis is housekeepingStatus (CLEAN | DIRTY).
  it('maps CLEAN to done', () => {
    expect(roomCardStatus('CLEAN')).toBe('done');
  });

  it('maps DIRTY to in-progress', () => {
    expect(roomCardStatus('DIRTY')).toBe('in-progress');
  });

  it('maps other states to pending', () => {
    expect(roomCardStatus('OCCUPIED')).toBe('pending');
  });
});

describe('labels', () => {
  it('formats status chip labels', () => {
    expect(statusChipLabel('done')).toBe('Done');
  });

  it('maps STANDARD_LAUNDRY to LINEN', () => {
    expect(taskChipLabel('STANDARD_LAUNDRY')).toBe('LINEN');
  });
});
