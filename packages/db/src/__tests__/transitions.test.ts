import { AppError } from '@gojo/types';
import { describe, expect, it, vi } from 'vitest';

import { transitionReservation } from '../transitions/reservation.js';
import { transitionRoom } from '../transitions/room.js';

const actor = { propertyId: 'property-1', role: 'OWNER', userId: 'user-1' } as const;

describe('transitions', () => {
  it('updates a reservation when the version matches', async () => {
    const tx = {
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
      reservation: {
        findFirst: vi.fn().mockResolvedValue({ id: 'reservation-1', propertyId: actor.propertyId, status: 'CONFIRMED', stateVersion: 2 }),
        update: vi.fn().mockResolvedValue({ id: 'reservation-1', status: 'CHECKED_IN' }),
      },
    } as never;

    const result = await transitionReservation(tx, {
      actor,
      reservationId: 'reservation-1',
      stateVersion: 2,
      toStatus: 'CHECKED_IN',
    });

    expect(result).toEqual({ id: 'reservation-1', status: 'CHECKED_IN' });
  });

  it('throws on room version mismatch', async () => {
    const tx = {
      room: {
        findFirst: vi.fn().mockResolvedValue({ id: 'room-1', propertyId: actor.propertyId, state: 'AVAILABLE', stateVersion: 2 }),
      },
    } as never;

    await expect(
      transitionRoom(tx, {
        actor,
        roomId: 'room-1',
        stateVersion: 1,
        toState: 'OCCUPIED',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('allows maintenance rooms to transition back to available', async () => {
    const tx = {
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'room-1',
          propertyId: actor.propertyId,
          state: 'MAINTENANCE',
          stateVersion: 2,
        }),
        update: vi.fn().mockResolvedValue({ id: 'room-1', state: 'AVAILABLE' }),
      },
    } as never;

    const result = await transitionRoom(tx, {
      actor,
      roomId: 'room-1',
      stateVersion: 2,
      toState: 'AVAILABLE',
    });

    expect(result).toEqual({ id: 'room-1', state: 'AVAILABLE' });
  });
});
