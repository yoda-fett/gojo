/**
 * Housekeeping state machine + transition helper (Story 9.1, 9.2).
 *
 * Single `state` column on Room covers both lifecycle and housekeeping
 * states. Allowed transitions are explicit; anything else raises
 * INVALID_TRANSITION at the service boundary.
 */
import { AppError } from '@gojo/types';

export type RoomState =
  | 'AVAILABLE'
  | 'HELD'
  | 'OCCUPIED'
  | 'DIRTY'
  | 'CLEAN'
  | 'OUT_OF_ORDER'
  | 'MAINTENANCE';

export const ROOM_STATES: RoomState[] = [
  'AVAILABLE',
  'HELD',
  'OCCUPIED',
  'DIRTY',
  'CLEAN',
  'OUT_OF_ORDER',
  'MAINTENANCE',
];

const ALLOWED: Record<RoomState, RoomState[]> = {
  AVAILABLE: ['HELD', 'OCCUPIED', 'OUT_OF_ORDER', 'MAINTENANCE'],
  HELD: ['AVAILABLE', 'OCCUPIED'],
  OCCUPIED: ['DIRTY'],
  DIRTY: ['CLEAN', 'OUT_OF_ORDER', 'MAINTENANCE'],
  CLEAN: ['AVAILABLE', 'DIRTY'],
  OUT_OF_ORDER: ['AVAILABLE'],
  MAINTENANCE: ['AVAILABLE'],
};

export function isValidHousekeepingTransition(from: string, to: string): boolean {
  const fromList = ALLOWED[from as RoomState];
  return Array.isArray(fromList) && fromList.includes(to as RoomState);
}

export const HOUSEKEEPING_TRANSITION_ROLES: Record<string, string[]> = {
  'AVAILABLE→OCCUPIED': ['OWNER', 'MANAGER', 'FRONT_DESK'],
  'OCCUPIED→DIRTY': ['OWNER', 'MANAGER', 'FRONT_DESK'],
  'DIRTY→CLEAN': ['OWNER', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING'],
  'CLEAN→AVAILABLE': ['OWNER', 'MANAGER', 'FRONT_DESK'],
  'CLEAN→DIRTY': ['OWNER', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING'],
  'AVAILABLE→OUT_OF_ORDER': ['OWNER'],
  'AVAILABLE→MAINTENANCE': ['OWNER'],
  'DIRTY→OUT_OF_ORDER': ['OWNER'],
  'DIRTY→MAINTENANCE': ['OWNER'],
  'OUT_OF_ORDER→AVAILABLE': ['OWNER'],
  'MAINTENANCE→AVAILABLE': ['OWNER'],
};

export function isTransitionAllowedForRole(
  fromState: string,
  toState: string,
  role: string,
): boolean {
  const key = `${fromState}→${toState}`;
  const allowed = HOUSEKEEPING_TRANSITION_ROLES[key];
  return Array.isArray(allowed) && allowed.includes(role);
}

export function assertHousekeepingTransition(from: string, to: string, role: string) {
  if (!isValidHousekeepingTransition(from, to)) {
    throw new AppError('INVALID_TRANSITION', `Cannot transition ${from} → ${to}`, 409);
  }
  if (!isTransitionAllowedForRole(from, to, role)) {
    throw new AppError('FORBIDDEN', `Role ${role} cannot transition ${from} → ${to}`, 403);
  }
}
