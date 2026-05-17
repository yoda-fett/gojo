import { describe, expect, it } from 'vitest';

import { roomCardStatus, statusChipLabel, taskChipLabel } from './room-display';

describe('roomCardStatus', () => {
  it('maps AVAILABLE to done', () => {
    expect(roomCardStatus('AVAILABLE')).toBe('done');
  });

  it('maps DIRTY to in-progress', () => {
    expect(roomCardStatus('DIRTY')).toBe('in-progress');
  });

  it('maps other states to pending', () => {
    expect(roomCardStatus('CLEAN')).toBe('pending');
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
