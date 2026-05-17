import { z } from 'zod';

// Story 12.7f. SEASONAL needs startDate <= endDate; CHANNEL needs channel.
// `multiplier` is a positive factor (e.g. 1.4 = +40%, 0.85 = -15%).
export const rateMultiplierSchema = z
  .object({
    name: z.string().min(1).max(100),
    type: z.enum(['SEASONAL', 'CHANNEL']),
    multiplier: z.number().positive().max(10),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    channel: z.string().min(1).max(50).optional(),
    roomTypeIds: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'SEASONAL') {
      if (!data.startDate || !data.endDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SEASONAL requires startDate and endDate', path: ['startDate'] });
        return;
      }
      if (new Date(data.startDate) > new Date(data.endDate)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'startDate must be <= endDate', path: ['endDate'] });
      }
    } else if (data.type === 'CHANNEL' && !data.channel) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CHANNEL requires channel name', path: ['channel'] });
    }
  });
