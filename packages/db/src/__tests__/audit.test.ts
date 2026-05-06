import { describe, expect, it, vi } from 'vitest';

import { writeAuditedTransition } from '../audit.js';

describe('writeAuditedTransition', () => {
  it('writes an audit row through the provided transaction', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const tx = {
      auditLog: { create },
    } as never;

    await writeAuditedTransition(tx, {
      actor: { propertyId: 'property-1', role: 'OWNER', userId: 'user-1' },
      entityId: 'reservation-1',
      entityType: 'reservation',
      fromState: 'CONFIRMED',
      toState: 'CHECKED_IN',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        propertyId: 'property-1',
        actorId: 'user-1',
        action: 'CHECKED_IN',
      }),
    });
  });
});
