import { describe, expect, it, vi } from 'vitest';

import { checkSubscriptionGate } from '../subscription-gate.js';

describe('checkSubscriptionGate', () => {
  it('returns without touching the db', async () => {
    const db = { subscription: { findFirst: vi.fn() } };

    await expect(
      checkSubscriptionGate(
        { propertyId: 'property-1', role: 'OWNER', userId: 'user-1' },
        'reservation.checkout',
        db as never,
      ),
    ).resolves.toBeUndefined();

    expect(db.subscription.findFirst).not.toHaveBeenCalled();
  });
});
