import { z } from 'zod';

export const ratePlanSchema = z
  .object({
    roomTypeId: z.string().min(1),
    name: z.string().min(1).max(100),
    modifierType: z.enum(['FLAT', 'PERCENTAGE']),
    modifierValue: z.number().positive(),
  })
  .superRefine((data, ctx) => {
    if (data.modifierType === 'PERCENTAGE' && data.modifierValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'modifierValue must be between 0 and 100 for percentage modifiers',
        path: ['modifierValue'],
      });
    }
  });
