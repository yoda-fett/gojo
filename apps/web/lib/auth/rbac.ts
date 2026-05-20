import type { Role } from '@gojo/types';

export const PERMISSION_MATRIX: Record<Role, string[]> = {
  OWNER: ['*'],
  MANAGER: ['reservation.*', 'room.*', 'guest.*', 'folio.*', 'rate_plan.*', 'room_type.*', 'team.*', 'report.*', 'cancellation_policy.*'],
  FRONT_DESK: ['reservation.checkIn', 'reservation.checkOut', 'reservation.walkIn', 'reservation.noShow', 'housekeeping.update', 'folio.payment'],
  HOUSEKEEPING: ['housekeeping.update'],
};

export function canPerform(role: Role, action: string) {
  const permissions = PERMISSION_MATRIX[role];
  return permissions.some((permission) => permission === '*' || permission === action || (permission.endsWith('.*') && action.startsWith(permission.slice(0, -1))));
}
