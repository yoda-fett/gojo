import { z } from 'zod';

const roomTypeBaseSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  maxOccupancy: z.number().int().min(1).max(50),
  baseRate: z.number().positive(),
  floorRate: z.number().positive(),
  gstSlab: z.enum(['0%', '12%', '18%']),
  amenities: z.array(z.string()).default([]),
});

export const roomTypeCreateSchema = roomTypeBaseSchema;

export const roomTypeUpdateSchema = roomTypeBaseSchema.extend({
  stateVersion: z.number().int().min(0),
});
