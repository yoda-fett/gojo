import { customAlphabet } from 'nanoid';

import { formatISTDateKey } from '@/lib/tz';

const randomSuffix = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);

export function generateBookingReference(now = new Date()) {
  const datePart = formatISTDateKey(now).replaceAll('-', '');
  return `GJ-${datePart}-${randomSuffix()}`;
}

export function fallbackBookingReference(id: string, createdAt?: Date | string | null) {
  if (createdAt) {
    const datePart = formatISTDateKey(createdAt).replaceAll('-', '');
    return `GJ-${datePart}-${id.slice(-4).toUpperCase()}`;
  }

  return id.slice(-8).toUpperCase();
}
