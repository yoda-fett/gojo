import { describe, expect, it, vi } from 'vitest';

import { scopedClient } from '../scoped-client.js';

describe('scopedClient', () => {
  it('injects property scope and soft delete filters', async () => {
    const findMany = vi.fn();
    const tx = {
      auditLog: {},
      folio: {},
      folioLine: {},
      guest: {},
      idempotencyKey: {},
      propertyAccess: {},
      reservation: {},
      room: { findMany },
      roomType: {},
      subscription: {},
    } as never;

    const client = scopedClient({ propertyId: 'property-1', role: 'OWNER', userId: 'user-1' }, tx);
    await client.room.findMany({ where: { state: 'AVAILABLE' } });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        state: 'AVAILABLE',
        propertyId: 'property-1',
        deletedAt: null,
      },
    });
  });

  it('preserves unique update args after scope precheck', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'room-1',
      propertyId: 'property-1',
      deletedAt: null,
    });
    const update = vi.fn();
    const tx = {
      auditLog: {},
      folio: {},
      folioLine: {},
      guest: {},
      idempotencyKey: {},
      propertyAccess: {},
      reservation: {},
      room: { findMany: vi.fn(), findFirst: vi.fn(), findUnique, update, updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
      roomType: {} ,
      subscription: {},
    } as never;

    const client = scopedClient({ propertyId: 'property-1', role: 'OWNER', userId: 'user-1' }, tx);
    await client.room.update({ where: { id: 'room-1' }, data: { state: 'OCCUPIED' } });

    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'room-1' } });
    expect(update).toHaveBeenCalledWith({ where: { id: 'room-1' }, data: { state: 'OCCUPIED' } });
  });
});
