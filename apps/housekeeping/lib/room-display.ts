export type RoomCardStatus = 'pending' | 'in-progress' | 'done';

export type TaskChipKind = 'clean' | 'refill' | 'linen' | 'periodic';

export function roomCardStatus(housekeepingState: string): RoomCardStatus {
  if (housekeepingState === 'AVAILABLE') return 'done';
  if (housekeepingState === 'DIRTY') return 'in-progress';
  return 'pending';
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
