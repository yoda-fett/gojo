import { describe, expect, it } from 'vitest';

import {
  ConversionArcConfigSchema,
  DEFAULT_CONVERSION_ARC_CONFIG,
} from '../conversion-arc.js';

describe('ConversionArcConfigSchema', () => {
  it('accepts the default config', () => {
    const parsed = ConversionArcConfigSchema.parse(DEFAULT_CONVERSION_ARC_CONFIG);
    expect(parsed.touchpoints).toHaveLength(9);
  });

  it('rejects negative dayOffset', () => {
    const bad = { touchpoints: [{ dayOffset: -1, type: 'EMAIL_NUDGE' }] };
    expect(() => ConversionArcConfigSchema.parse(bad)).toThrow();
  });

  it('rejects dayOffset > 365', () => {
    const bad = { touchpoints: [{ dayOffset: 400, type: 'EMAIL_NUDGE' }] };
    expect(() => ConversionArcConfigSchema.parse(bad)).toThrow();
  });

  it('rejects unknown touchpoint type', () => {
    const bad = { touchpoints: [{ dayOffset: 10, type: 'BOGUS' }] };
    expect(() => ConversionArcConfigSchema.parse(bad)).toThrow();
  });

  it('rejects OTA_PAUSE >= OTA_DISCONNECT', () => {
    const bad = {
      touchpoints: [
        { dayOffset: 124, type: 'OTA_PAUSE' },
        { dayOffset: 120, type: 'OTA_DISCONNECT' },
      ],
    };
    expect(() => ConversionArcConfigSchema.parse(bad)).toThrow(
      /OTA_PAUSE\.dayOffset must be less than OTA_DISCONNECT/,
    );
  });

  it('rejects OTA_PAUSE == OTA_DISCONNECT', () => {
    const bad = {
      touchpoints: [
        { dayOffset: 120, type: 'OTA_PAUSE' },
        { dayOffset: 120, type: 'OTA_DISCONNECT' },
      ],
    };
    expect(() => ConversionArcConfigSchema.parse(bad)).toThrow();
  });

  it('accepts schedule with only OTA_PAUSE (no DISCONNECT)', () => {
    const ok = { touchpoints: [{ dayOffset: 100, type: 'OTA_PAUSE' }] };
    expect(() => ConversionArcConfigSchema.parse(ok)).not.toThrow();
  });

  it('requires at least one touchpoint', () => {
    expect(() => ConversionArcConfigSchema.parse({ touchpoints: [] })).toThrow();
  });
});
