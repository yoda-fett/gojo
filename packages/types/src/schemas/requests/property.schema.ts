import { z } from 'zod';

/** "HH:MM" 24-hour time-of-day (e.g. "14:00"). Not a timestamp. */
export const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Property Profile update payload (Story 12.7b — `PATCH /api/properties/:id`).
 *
 * Every field is optional: the Property Profile screen saves each card
 * independently, so a request carries only the subset of fields the edited
 * card owns. Non-nullable columns (name/address/city/state/pincode/currency/
 * timezone) are optional-but-not-nullable; the rest accept `null` to clear.
 */
export const propertyProfileUpdateSchema = z.object({
  // Identity
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().min(1).max(200).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  state: z.string().trim().min(1).max(80).optional(),
  pincode: z.string().trim().min(1).max(12).optional(),
  contactPhone: z.string().trim().max(20).optional().nullable(),
  contactEmail: z.string().trim().email().max(120).optional().nullable(),
  // Legal & tax
  gstin: z.string().trim().max(20).optional().nullable(),
  pan: z.string().trim().max(10).optional().nullable(),
  stateCode: z.string().trim().max(2).optional().nullable(),
  // Operations
  currency: z.string().trim().min(1).max(3).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  numberOfFloors: z.number().int().min(1).max(50).optional().nullable(),
  defaultCheckInTime: z.string().regex(TIME_OF_DAY_RE, 'Expected HH:MM (24-hour)').optional().nullable(),
  defaultCheckOutTime: z.string().regex(TIME_OF_DAY_RE, 'Expected HH:MM (24-hour)').optional().nullable(),
  // Laundry vendor (existing — Epic 11)
  laundryVendorName: z.string().trim().min(1).max(80).optional(),
  laundryVendorContact: z.string().trim().max(120).optional().nullable(),
});

export type PropertyProfileUpdate = z.infer<typeof propertyProfileUpdateSchema>;
