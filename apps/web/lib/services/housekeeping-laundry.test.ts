import type { Actor } from '@gojo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkSubscriptionGate: vi.fn(),
  scopedClient: vi.fn(),
  writeAuditLog: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock('@gojo/db', () => ({
  checkSubscriptionGate: mocks.checkSubscriptionGate,
  istDateKey: () => '2026-05-14',
  prisma: mocks.prisma,
  scopedClient: mocks.scopedClient,
  withIdempotency: vi.fn((_key, _db, fn) => fn()),
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock('./housekeeping-alerts', () => ({
  checkPoolBelowMin: vi.fn(),
}));

import { ownerTriggerLaundry, summarizeLaundryState } from './housekeeping-laundry';

const owner: Actor = {
  userId: 'owner-1',
  propertyId: 'property-1',
  role: 'OWNER',
};

const frontDesk: Actor = {
  userId: 'front-1',
  propertyId: 'property-1',
  role: 'FRONT_DESK',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkSubscriptionGate.mockResolvedValue(undefined);
  mocks.scopedClient.mockImplementation((_actor, tx) => tx);
});

describe('housekeeping laundry owner status helpers', () => {
  it('labels overdue open cycles after 24 hours', () => {
    expect(
      summarizeLaundryState(
        { state: 'ITEMS_OUT', remainingQty: 3, loggedAt: new Date('2026-05-13T00:00:00.000Z') },
        new Date('2026-05-14T01:00:00.000Z'),
      ),
    ).toEqual({ label: 'Items out', state: 'ITEMS_OUT', overdue: true });
  });

  it('preserves returned and no-activity states distinctly', () => {
    expect(summarizeLaundryState(null)).toMatchObject({ label: 'No activity', state: 'NO_ACTIVITY' });
    expect(
      summarizeLaundryState({ state: 'ITEMS_OUT', remainingQty: 0, loggedAt: new Date('2026-05-14T00:00:00.000Z') }),
    ).toMatchObject({ label: 'Items returned', state: 'ITEMS_RETURNED' });
  });
});

describe('ownerTriggerLaundry', () => {
  it('rejects Front Desk mutation attempts before writing', async () => {
    await expect(
      ownerTriggerLaundry(frontDesk, {
        roomId: 'room-1',
        items: [{ catalogItemId: 'linen-1', qty: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns conflict instead of silently creating a duplicate open cycle', async () => {
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRawUnsafe: vi.fn(),
        room: { findFirst: vi.fn().mockResolvedValue({ id: 'room-1' }) },
        catalogItem: { findFirst: vi.fn().mockResolvedValue({ id: 'linen-1' }) },
        laundryLog: {
          findFirst: vi.fn().mockResolvedValue({ id: 'open-1', createdByRole: 'STAFF' }),
        },
      }),
    );

    await expect(
      ownerTriggerLaundry(owner, {
        roomId: 'room-1',
        items: [{ catalogItemId: 'linen-1', qty: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });
  });

  it('creates an owner-started log payload that staff can append to', async () => {
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRawUnsafe: vi.fn(),
        room: { findFirst: vi.fn().mockResolvedValue({ id: 'room-1' }) },
        catalogItem: { findFirst: vi.fn().mockResolvedValue({ id: 'linen-1' }) },
        laundryLog: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'log-1', createdByRole: 'OWNER' }),
        },
        laundryLogItem: {
          create: vi.fn().mockResolvedValue({ id: 'item-1' }),
        },
      }),
    );

    await expect(
      ownerTriggerLaundry(
        owner,
        {
          roomId: 'room-1',
          items: [{ catalogItemId: 'linen-1', qty: 2 }],
        },
        { now: new Date('2026-05-14T00:00:00.000Z') },
      ),
    ).resolves.toMatchObject({
      ok: true,
      laundryLogId: 'log-1',
      createdBy: 'OWNER',
      staffAppendContract: {
        openOwnerStartedLogId: 'log-1',
        roomId: 'room-1',
        linenCategory: 'ROUTINE',
      },
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      owner,
      expect.objectContaining({ action: 'LAUNDRY_OUT_OWNER_TRIGGERED', entityId: 'log-1' }),
    );
  });
});
