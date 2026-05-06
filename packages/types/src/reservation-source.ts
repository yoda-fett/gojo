/**
 * Canonical reservation source values matching the
 * `reservation_source_check` Postgres CHECK constraint.
 *
 * Anything not in this list will fail to insert and will silently miss
 * groupings in reports.
 */
export const RESERVATION_SOURCES = ['DIRECT_BOOKING', 'OTA', 'WALK_IN'] as const;

export type ReservationSource = (typeof RESERVATION_SOURCES)[number];

export const RESERVATION_SOURCE_LABELS: Record<ReservationSource, string> = {
  DIRECT_BOOKING: 'Direct',
  OTA: 'OTA',
  WALK_IN: 'Walk-in',
};

export const RESERVATION_SOURCE_COLORS: Record<ReservationSource, string> = {
  DIRECT_BOOKING: '#1DA888',
  OTA: '#E8763F',
  WALK_IN: '#E9C46A',
};

export function isReservationSource(value: string): value is ReservationSource {
  return (RESERVATION_SOURCES as readonly string[]).includes(value);
}
