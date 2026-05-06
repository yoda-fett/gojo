import type { Role } from '@gojo/types';

export const PERMISSION_MATRIX: Record<Role, string[]> = {
  OWNER: ['*'],
  MANAGER: ['reservation.*', 'room.*', 'guest.*', 'folio.*', 'rate_plan.*', 'room_type.*', 'team.*', 'report.*', 'cancellation_policy.*'],
  FRONT_DESK: ['reservation.check_in', 'reservation.check_out', 'reservation.walk_in', 'reservation.no_show', 'housekeeping.update', 'folio.payment'],
  HOUSEKEEPING: ['housekeeping.update'],
};

export function canPerform(role: Role, action: string) {
  const permissions = PERMISSION_MATRIX[role];
  return permissions.some((permission) => permission === '*' || permission === action || (permission.endsWith('.*') && action.startsWith(permission.slice(0, -1))));
}
