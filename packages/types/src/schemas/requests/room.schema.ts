import { z } from 'zod';

// Story 12.7d — Room configuration CRUD.
// Room here is the *physical unit* (number/roomTypeId/floor + optional flags+notes),
// not the operational state machine (AVAILABLE/DIRTY/OOO) that lives in Epic 9.

const roomBaseSchema = z.object({
  number: z.string().min(1).max(20),
  roomTypeId: z.string().min(1),
  floor: z.number().int().min(-5).max(200).optional(),
  notes: z.string().max(500).optional(),
  accessible: z.boolean().default(false),
  connectingRoomId: z.string().nullable().optional(),
});

export const roomCreateSchema = roomBaseSchema;

export const roomUpdateSchema = roomBaseSchema.extend({
  stateVersion: z.number().int().min(0),
});

// Range-add (AC3): one room type + one floor + numeric range [start..end].
// `prefix`/`suffix` lets ground-floor blocks like G-01..G-04 work.
export const roomRangeCreateSchema = z.object({
  start: z.number().int().min(0).max(9999),
  end: z.number().int().min(0).max(9999),
  prefix: z.string().max(8).optional(),
  suffix: z.string().max(8).optional(),
  pad: z.number().int().min(0).max(6).optional(),
  roomTypeId: z.string().min(1),
  floor: z.number().int().min(-5).max(200).optional(),
  accessible: z.boolean().default(false),
}).refine((d) => d.end >= d.start, {
  message: 'end must be >= start',
  path: ['end'],
}).refine((d) => d.end - d.start <= 99, {
  message: 'range cannot exceed 100 rooms',
  path: ['end'],
});

export type RoomCreateInput = z.infer<typeof roomCreateSchema>;
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>;
export type RoomRangeCreateInput = z.infer<typeof roomRangeCreateSchema>;
