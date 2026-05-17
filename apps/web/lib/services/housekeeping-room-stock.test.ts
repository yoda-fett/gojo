import type { Actor } from '@gojo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkSubscriptionGate: vi.fn(),
  scopedClient: vi.fn(),
  withIdempotency: vi.fn((_key, _db, fn) => fn()),
  writeAuditLog: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock('@gojo/db', () => ({
  checkSubscriptionGate: mocks.checkSubscriptionGate,
  prisma: mocks.prisma,
  scopedClient: mocks.scopedClient,
  todayInIST: () => new Date('2026-05-14T00:00:00.000Z'),
  withIdempotency: mocks.withIdempotency,
  writeAuditLog: mocks.writeAuditLog,
}));

import { appendRefillTask, calculateStorageAvailability, generateRefillAssignments } from './housekeeping-room-stock';

const owner: Actor = { userId: 'owner-1', propertyId: 'property-1', role: 'OWNER' };
const frontDesk: Actor = { userId: 'front-1', propertyId: 'property-1', role: 'FRONT_DESK' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkSubscriptionGate.mockResolvedValue(undefined);
  mocks.scopedClient.mockImplementation((_actor, tx) => tx);
});

describe('room stock helpers', () => {
  it('derives storage availability without live room counts', () => {
    expect(calculateStorageAvailability({ catalogItemId: 'soap', stocked: 20, consumed: 14, writeOffs: 2 })).toEqual({
      level: 4,
      status: 'Low',
    });
  });

  it('appends REFILL exactly once', () => {
    expect(appendRefillTask(['CLEAN'])).toEqual(['CLEAN', 'REFILL']);
    expect(appendRefillTask(['CLEAN', 'REFILL'])).toEqual(['CLEAN', 'REFILL']);
  });
});

describe('generateRefillAssignments', () => {
  it('blocks Front Desk mutations before writes', async () => {
    await expect(generateRefillAssignments(frontDesk, { roomIds: ['room-1'], staffUserId: 'staff-1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('preserves existing assignees and avoids duplicate REFILL tasks', async () => {
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        room: { findMany: vi.fn().mockResolvedValue([{ id: 'room-1' }]) },
        roomAssignment: {
          findMany: vi.fn().mockResolvedValue([{ id: 'assignment-1', roomId: 'room-1', staffUserId: 'staff-old', taskTypes: ['CLEAN', 'REFILL'] }]),
          update: vi.fn(),
          create: vi.fn(),
        },
      }),
    );

    await expect(generateRefillAssignments(owner, { roomIds: ['room-1'] })).resolves.toMatchObject({
      ok: true,
      assignmentIds: ['assignment-1'],
    });
  });

  it('requires staff selection for unassigned rooms', async () => {
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        room: { findMany: vi.fn().mockResolvedValue([{ id: 'room-1' }]) },
        roomAssignment: { findMany: vi.fn().mockResolvedValue([]) },
      }),
    );

    await expect(generateRefillAssignments(owner, { roomIds: ['room-1'] })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 422,
    });
  });
});
