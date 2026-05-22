import { describe, expect, it, vi } from 'vitest';

import { transitionReservation } from '../transitions/reservation.js';

// Epic 15: `transitionRoom` was retired with the conflated `rooms.state`
// column — occupancy is derived and housekeeping has its own transition path.

const actor = { propertyId: 'property-1', role: 'OWNER', userId: 'user-1' } as const;

describe('transitions', () => {
  it('updates a reservation when the version matches', async () => {
    const tx = {
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
      reservation: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'reservation-1', propertyId: actor.propertyId, status: 'CONFIRMED', stateVersion: 2 }),
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
});
