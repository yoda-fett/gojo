import { z } from 'zod';

export const cancellationPolicySchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    windowHours: z.number().int().min(0).max(24 * 30),
    penaltyType: z.enum(['NONE', 'FIRST_NIGHT', 'PERCENTAGE', 'FULL']),
    penaltyValue: z.number().positive().max(100).optional(),
    isDefault: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.penaltyType === 'PERCENTAGE' && data.penaltyValue === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'penaltyValue is required when penaltyType is PERCENTAGE',
        path: ['penaltyValue'],
      });
    }
  });
