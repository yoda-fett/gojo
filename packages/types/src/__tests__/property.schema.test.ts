import { describe, expect, it } from 'vitest';

import { propertyProfileUpdateSchema } from '../schemas/requests/property.schema.js';

describe('propertyProfileUpdateSchema (Story 12.7b)', () => {
  it('accepts a single-field partial payload (per-card save)', () => {
    expect(propertyProfileUpdateSchema.safeParse({ name: 'Lotus Haveli' }).success).toBe(true);
  });

  it('accepts the new Property Profile columns', () => {
    const result = propertyProfileUpdateSchema.safeParse({
      contactPhone: '+919845012345',
      contactEmail: 'front.desk@lotushaveli.in',
      pan: 'ABCDE1234F',
      stateCode: '08',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null to clear nullable fields', () => {
    const result = propertyProfileUpdateSchema.safeParse({
      gstin: null,
      pan: null,
      contactPhone: null,
      numberOfFloors: null,
      defaultCheckInTime: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(propertyProfileUpdateSchema.safeParse({ contactEmail: 'not-an-email' }).success).toBe(false);
  });

  it('rejects a non-HH:MM check-in time', () => {
    expect(propertyProfileUpdateSchema.safeParse({ defaultCheckInTime: '2pm' }).success).toBe(false);
    expect(propertyProfileUpdateSchema.safeParse({ defaultCheckInTime: '25:00' }).success).toBe(false);
    expect(propertyProfileUpdateSchema.safeParse({ defaultCheckInTime: '14:00' }).success).toBe(true);
  });

  it('rejects an empty name when the field is provided', () => {
    expect(propertyProfileUpdateSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('does not allow null for non-nullable columns', () => {
    expect(propertyProfileUpdateSchema.safeParse({ currency: null }).success).toBe(false);
    expect(propertyProfileUpdateSchema.safeParse({ name: null }).success).toBe(false);
  });

  it('rejects numberOfFloors outside 1–50', () => {
    expect(propertyProfileUpdateSchema.safeParse({ numberOfFloors: 0 }).success).toBe(false);
    expect(propertyProfileUpdateSchema.safeParse({ numberOfFloors: 3 }).success).toBe(true);
  });

  it('rejects routineCleaningIntervalDays outside 1–90 (Story 15.6)', () => {
    expect(propertyProfileUpdateSchema.safeParse({ routineCleaningIntervalDays: 0 }).success).toBe(false);
    expect(propertyProfileUpdateSchema.safeParse({ routineCleaningIntervalDays: -1 }).success).toBe(false);
    expect(propertyProfileUpdateSchema.safeParse({ routineCleaningIntervalDays: 91 }).success).toBe(false);
    expect(propertyProfileUpdateSchema.safeParse({ routineCleaningIntervalDays: 2.5 }).success).toBe(false);
    expect(propertyProfileUpdateSchema.safeParse({ routineCleaningIntervalDays: 3 }).success).toBe(true);
    expect(propertyProfileUpdateSchema.safeParse({ routineCleaningIntervalDays: 90 }).success).toBe(true);
  });

  it('does not allow null for routineCleaningIntervalDays (non-nullable)', () => {
    expect(propertyProfileUpdateSchema.safeParse({ routineCleaningIntervalDays: null }).success).toBe(false);
  });
});
