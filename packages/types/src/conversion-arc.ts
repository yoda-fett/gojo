// Story 10.2d: Conversion-arc touchpoint schedule (data-driven, no hardcoded calendar dates).

import { z } from 'zod';

export const TOUCHPOINT_TYPES = [
  'SAVINGS_CARD_IN_APP',
  'EMAIL_NUDGE',
  'WHATSAPP_NUDGE',
  'GRACE_PERIOD_WARNING_EMAIL',
  'OTA_PAUSE',
  'OTA_DISCONNECT',
] as const;

export type TouchpointType = (typeof TOUCHPOINT_TYPES)[number];

export const TouchpointSchema = z.object({
  dayOffset: z.number().int().min(0).max(365),
  type: z.enum(TOUCHPOINT_TYPES),
});

export type Touchpoint = z.infer<typeof TouchpointSchema>;

export const ConversionArcConfigSchema = z
  .object({
    touchpoints: z.array(TouchpointSchema).min(1),
  })
  .refine(
    (cfg) => {
      const pause = cfg.touchpoints.find((t) => t.type === 'OTA_PAUSE');
      const disconnect = cfg.touchpoints.find((t) => t.type === 'OTA_DISCONNECT');
      if (pause && disconnect) {
        return pause.dayOffset < disconnect.dayOffset;
      }
      return true;
    },
    { message: 'OTA_PAUSE.dayOffset must be less than OTA_DISCONNECT.dayOffset' },
  );

export type ConversionArcConfig = z.infer<typeof ConversionArcConfigSchema>;

export const DEFAULT_CONVERSION_ARC_CONFIG: ConversionArcConfig = {
  touchpoints: [
    { dayOffset: 100, type: 'SAVINGS_CARD_IN_APP' },
    { dayOffset: 107, type: 'EMAIL_NUDGE' },
    { dayOffset: 112, type: 'WHATSAPP_NUDGE' },
    { dayOffset: 117, type: 'GRACE_PERIOD_WARNING_EMAIL' },
    { dayOffset: 118, type: 'EMAIL_NUDGE' },
    { dayOffset: 119, type: 'WHATSAPP_NUDGE' },
    { dayOffset: 120, type: 'OTA_PAUSE' },
    { dayOffset: 121, type: 'EMAIL_NUDGE' },
    { dayOffset: 124, type: 'OTA_DISCONNECT' },
  ],
};
