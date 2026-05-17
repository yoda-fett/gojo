import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkSubscriptionGate: vi.fn(),
  writeAuditLog: vi.fn(),
  scopedClient: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    issueReport: { count: vi.fn() },
    alert: { updateMany: vi.fn() },
  },
}));

vi.mock('@gojo/db', () => ({
  checkSubscriptionGate: mocks.checkSubscriptionGate,
  prisma: mocks.prisma,
  scopedClient: mocks.scopedClient,
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock('./housekeeping-alerts', () => ({
  checkPoolBelowMin: vi.fn(),
  checkRestockRequired: vi.fn(),
  syncWriteOffReviewPendingAlert: vi.fn(),
}));

import type { Actor } from '@gojo/types';

import {
  approveIssueReports,
  calculateAmenityCurrentLevel,
  calculateLinenDistribution,
  recordInventoryWriteOff,
} from './housekeeping-inventory';

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

describe('housekeeping inventory calculations', () => {
  it('computes amenity level from restocks, consumption, and write-offs', () => {
    expect(calculateAmenityCurrentLevel({ stocked: 120, consumed: 47, writeOffs: 3 })).toBe(70);
  });

  it('derives linen storage without storing room or laundry counters', () => {
    expect(
      calculateLinenDistribution({
        totalOwned: 50,
        inRooms: 24,
        inLaundry: 8,
        cumulativeWriteOffs: 5,
      }),
    ).toEqual({
      totalOwned: 50,
      inRooms: 24,
      inLaundry: 8,
      cumulativeWriteOffs: 5,
      inStorage: 13,
    });
  });

  it('rejects mutating roles outside Owner/Manager before inventory writes', async () => {
    await expect(
      recordInventoryWriteOff(frontDesk, {
        catalogItemId: 'amenity-1',
        qty: 1,
        reason: 'expired',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns validation errors for write-offs without required reasons', async () => {
    await expect(
      recordInventoryWriteOff(owner, {
        catalogItemId: 'amenity-1',
        qty: 1,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 422 });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps approve bulk actions conflict-safe', async () => {
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        issueReport: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'issue-1',
              status: 'APPROVED',
              catalogItemId: 'linen-1',
              qty: 1,
              stateVersion: 0,
              attributionStream: 'ROOM_SHORTAGE',
            },
          ]),
        },
      }),
    );

    await expect(approveIssueReports(owner, 'issue-1')).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
  });
});
