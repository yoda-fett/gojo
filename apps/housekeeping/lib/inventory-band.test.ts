import { describe, expect, it } from 'vitest';

import { bandForInStorage, bandLabel } from './inventory-band';

describe('bandForInStorage', () => {
  it('returns EMPTY when inStorage is 0', () => {
    expect(bandForInStorage(0, 10)).toBe('EMPTY');
  });

  it('returns LOW within 20% ceiling', () => {
    expect(bandForInStorage(2, 10)).toBe('LOW');
  });

  it('returns HEALTHY above low band', () => {
    expect(bandForInStorage(8, 10)).toBe('HEALTHY');
  });
});

describe('bandLabel', () => {
  it('maps bands to display labels', () => {
    expect(bandLabel('HEALTHY')).toBe('Healthy');
    expect(bandLabel('LOW')).toBe('Low');
    expect(bandLabel('EMPTY')).toBe('Empty');
  });
});
