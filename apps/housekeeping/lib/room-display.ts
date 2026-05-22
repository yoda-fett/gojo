export type RoomCardStatus = 'pending' | 'in-progress' | 'done';

export type TaskChipKind = 'clean' | 'refill' | 'linen' | 'periodic';

// Epic 15: the room's stored cleanliness axis is `housekeepingStatus`
// (CLEAN | DIRTY). CLEAN is the serviced/done state — the legacy `AVAILABLE`
// value no longer exists.
export function roomCardStatus(housekeepingState: string): RoomCardStatus {
  if (housekeepingState === 'CLEAN') return 'done';
  if (housekeepingState === 'DIRTY') return 'in-progress';
  return 'pending';
}

export type RoomContextKind =
  | 'turnover'
  | 'stayover'
  | 'full-clean'
  | 'clean'
  | 'ooo'
  | 'arriving'
  | 'held';

// Epic 15: maps the composed `display` token (+ housekeeping axis) to the
// occupancy-context chip on the My Day card — tells the housekeeper what kind
// of service the room needs, distinct from the work-progress chip.
export function roomContext(
  display: string,
  housekeeping: string,
): { label: string; kind: RoomContextKind } {
  switch (display) {
    case 'OUT_OF_ORDER':
      return { label: 'Out of Order', kind: 'ooo' };
    case 'MAINTENANCE':
      return { label: 'Maintenance', kind: 'ooo' };
    case 'DEPARTING':
      return { label: 'Departing · turnover', kind: 'turnover' };
    case 'IN_HOUSE':
      return housekeeping === 'DIRTY'
        ? { label: 'Stayover · knock first', kind: 'stayover' }
        : { label: 'Occupied', kind: 'stayover' };
    case 'ARRIVING':
      return { label: 'Arriving today', kind: 'arriving' };
    case 'HELD':
      return { label: 'On hold', kind: 'held' };
    case 'DIRTY':
      return { label: 'Vacant · Dirty', kind: 'full-clean' };
    case 'AVAILABLE':
    default:
      return { label: 'Vacant · Clean', kind: 'clean' };
  }
}

export function statusChipLabel(status: RoomCardStatus): string {
  if (status === 'done') return 'Done';
  if (status === 'in-progress') return 'In progress';
  return 'Pending';
}

export function taskChipKind(taskType: string): TaskChipKind {
  if (taskType === 'PERIODIC_LAUNDRY') return 'periodic';
  if (taskType === 'STANDARD_LAUNDRY') return 'linen';
  if (taskType === 'REFILL') return 'refill';
  return 'clean';
}

export function taskChipLabel(taskType: string): string {
  if (taskType === 'STANDARD_LAUNDRY') return 'LINEN';
  if (taskType === 'PERIODIC_LAUNDRY') return 'PERIODIC';
  return taskType.replace('_', ' ');
}

export function formatIstDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}
