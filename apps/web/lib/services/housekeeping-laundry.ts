// @ts-nocheck
import { checkSubscriptionGate, istDateKey, prisma, scopedClient, withIdempotency, writeAuditLog } from '@gojo/db';
import { AppError, type Actor } from '@gojo/types';
import { z } from 'zod';
import { checkPoolBelowMin } from './housekeeping-alerts';
import { runFirstShiftReconciliationIfReady } from './first-shift-reconciliation';

type OutItem = {
  catalogItemId: string;
  dirtyPulled: number;
  cleanPlaced: number;
};

type ReceiveItem = {
  catalogItemId: string;
  receivedQty: number;
};

const ownerRoles = ['OWNER', 'MANAGER'] as const;
const OwnerTriggerBody = z
  .object({
    roomId: z.string().min(1),
    appendToOpenCycle: z.boolean().optional(),
    items: z
      .array(
        z.object({
          catalogItemId: z.string().min(1),
          qty: z.coerce.number().int().min(0).max(1000),
        }),
      )
      .min(1),
  })
  .strict();

export function isLaundryOverdue(loggedAt: Date, now = new Date()) {
  return now.getTime() - loggedAt.getTime() > 24 * 60 * 60 * 1000;
}

export function summarizeLaundryState(input?: { state: string; remainingQty: number; loggedAt: Date } | null, now = new Date()) {
  if (!input) {
    return { label: 'No activity', state: 'NO_ACTIVITY', overdue: false };
  }
  if (input.state === 'ITEMS_OUT' && input.remainingQty > 0) {
    return { label: 'Items out', state: 'ITEMS_OUT', overdue: isLaundryOverdue(input.loggedAt, now) };
  }
  return { label: 'Items returned', state: 'ITEMS_RETURNED', overdue: false };
}

function assertOwnerOrManager(actor: Actor) {
  if (!ownerRoles.includes(actor.role as (typeof ownerRoles)[number])) {
    throw new AppError('FORBIDDEN', 'Owner or manager role required', 403);
  }
}

function validation(message: string, field = 'body', reason = 'INVALID_PAYLOAD') {
  return new AppError('VALIDATION_ERROR', message, 422, { details: { field, reason } });
}

function parseOwnerTrigger(raw: unknown) {
  const result = OwnerTriggerBody.safeParse(raw);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw validation('Invalid owner laundry trigger payload', issue?.path.join('.') || 'body', issue?.code ?? 'INVALID_PAYLOAD');
}

async function validateLinenItem(actor: Actor, catalogItemId: string, category?: 'ROUTINE' | 'PERIODIC') {
  const item = await prisma.catalogItem.findFirst({
    where: {
      id: catalogItemId,
      propertyId: actor.propertyId,
      itemType: 'LINEN',
      ...(category ? { linenCategory: category } : {}),
      deletedAt: null,
    },
  });
  if (!item) {
    throw new AppError('VALIDATION_ERROR', 'Invalid linen catalog item', 422, {
      details: { field: 'catalogItemId', reason: 'INVALID_LINEN_ITEM' },
    });
  }
  return item;
}

export async function getLaundryStatus(actor: Actor) {
  const [property, rooms, logs, items, pendingFlags, routineItems] = await Promise.all([
    prisma.property.findUnique({
      where: { id: actor.propertyId },
      select: { laundryVendorName: true, laundryVendorContact: true },
    }),
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, roomTypeId: true },
    }),
    prisma.laundryLog.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.laundryLogItem.findMany({
      where: { propertyId: actor.propertyId },
    }),
    prisma.issueReport.findMany({
      where: {
        propertyId: actor.propertyId,
        deletedAt: null,
        status: 'PENDING_REVIEW',
        attributionStream: 'LAUNDRY_SHORTAGE',
      },
    }),
    prisma.catalogItem.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null, itemType: 'LINEN', linenCategory: 'ROUTINE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, unit: true, linenCategory: true },
    }),
  ]);

  const itemTotals = new Map<string, { qty: number; remainingQty: number }>();
  for (const item of items) {
    const current = itemTotals.get(item.laundryLogId) ?? { qty: 0, remainingQty: 0 };
    current.qty += item.qty;
    current.remainingQty += item.remainingQty;
    itemTotals.set(item.laundryLogId, current);
  }

  const flagsByRoom = new Map<string, number>();
  for (const report of pendingFlags) {
    if (!report.roomId) continue;
    flagsByRoom.set(report.roomId, (flagsByRoom.get(report.roomId) ?? 0) + 1);
  }

  const logsByRoom = new Map<string, typeof logs>();
  for (const log of logs) {
    if (!log.roomId) continue;
    const group = logsByRoom.get(log.roomId) ?? [];
    group.push(log);
    logsByRoom.set(log.roomId, group);
  }

  return {
    vendor: {
      name: property?.laundryVendorName ?? 'Laundry vendor',
      contact: property?.laundryVendorContact ?? null,
    },
    canMutate: ownerRoles.includes(actor.role as (typeof ownerRoles)[number]),
    routineItems: routineItems.map((item) => ({
      catalogItemId: item.id,
      name: item.name,
      unit: item.unit,
      defaultQty: 1,
    })),
    rows: rooms.map((room) => {
      const roomLogs = logsByRoom.get(room.id) ?? [];
      const openLog =
        roomLogs.find((log) => {
          const totals = itemTotals.get(log.id);
          return log.state === 'ITEMS_OUT' && (totals?.remainingQty ?? 0) > 0;
        }) ?? null;
      const latestLog = openLog ?? roomLogs[0] ?? null;
      const totals = latestLog ? itemTotals.get(latestLog.id) ?? { qty: 0, remainingQty: 0 } : null;
      const summary = summarizeLaundryState(
        latestLog
          ? {
              state: latestLog.state,
              remainingQty: totals?.remainingQty ?? 0,
              loggedAt: latestLog.createdAt,
            }
          : null,
      );
      return {
        roomId: room.id,
        roomNumber: room.number,
        cycleId: latestLog?.id ?? null,
        state: summary.state,
        stateLabel: summary.label,
        overdue: summary.overdue,
        itemCount: summary.state === 'ITEMS_OUT' ? totals?.remainingQty ?? 0 : totals?.qty ?? 0,
        loggedAt: latestLog?.createdAt ?? null,
        createdBy: latestLog?.createdByRole ?? null,
        createdByUserId: latestLog?.createdByUserId ?? null,
        flagCount: flagsByRoom.get(room.id) ?? 0,
        flagHref: latestLog
          ? `/housekeeping/inventory?tab=pending&filter=laundry-cycle:${latestLog.id}`
          : '/housekeeping/inventory?tab=pending&filter=laundry',
      };
    }),
  };
}

export async function ownerTriggerLaundry(
  actor: Actor,
  raw: unknown,
  options: { now?: Date } = {},
) {
  await checkSubscriptionGate(actor, 'laundry.ownerTrigger', prisma);
  assertOwnerOrManager(actor);
  const body = parseOwnerTrigger(raw);
  const items = body.items.filter((item) => item.qty > 0);
  if (items.length === 0) throw validation('At least one linen quantity must be greater than zero', 'items', 'EMPTY_ITEMS');

  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT id FROM rooms WHERE id = $1 AND property_id = $2 FOR UPDATE', body.roomId, actor.propertyId);
    const db = scopedClient(actor, tx);
    const room = await db.room.findFirst({ where: { id: body.roomId }, select: { id: true } });
    if (!room) throw new AppError('NOT_FOUND', 'Room not found', 404);

    for (const item of items) {
      const catalog = await db.catalogItem.findFirst({
        where: { id: item.catalogItemId, itemType: 'LINEN', linenCategory: 'ROUTINE' },
      });
      if (!catalog) {
        throw validation('Invalid routine linen item', 'catalogItemId', 'INVALID_ROUTINE_LINEN');
      }
    }

    const openLog = await db.laundryLog.findFirst({
      where: { roomId: body.roomId, state: 'ITEMS_OUT' },
      orderBy: { createdAt: 'asc' },
    });

    if (openLog && !body.appendToOpenCycle) {
      throw new AppError('CONFLICT', 'Open laundry cycle already exists for this room', 409, {
        details: { laundryLogId: openLog.id, createdBy: openLog.createdByRole },
      });
    }

    const cycleDate = options.now ?? new Date(`${istDateKey()}T00:00:00+05:30`);
    const log =
      openLog ??
      (await db.laundryLog.create({
        data: {
          roomId: body.roomId,
          state: 'ITEMS_OUT',
          createdByRole: 'OWNER',
          createdByUserId: actor.userId,
          linenCategory: 'ROUTINE',
          cycleDate,
        },
      }));

    const createdItems = [];
    for (const row of items) {
      const created = await db.laundryLogItem.create({
        data: {
          laundryLogId: log.id,
          catalogItemId: row.catalogItemId,
          state: 'ITEMS_OUT',
          qty: row.qty,
          remainingQty: row.qty,
        },
      });
      createdItems.push(created);
    }

    await writeAuditLog(tx, actor, {
      action: 'LAUNDRY_OUT_OWNER_TRIGGERED',
      entityType: 'LAUNDRY_LOG',
      entityId: log.id,
      metadata: {
        roomId: body.roomId,
        appendedToOpenCycle: Boolean(openLog),
        createdBy: 'OWNER',
        items,
      },
    });

    for (const row of items) {
      await checkPoolBelowMin(actor.propertyId, row.catalogItemId);
    }

    return {
      ok: true,
      laundryLogId: log.id,
      roomId: body.roomId,
      state: 'ITEMS_OUT',
      createdBy: log.createdByRole,
      appendedToOpenCycle: Boolean(openLog),
      itemIds: createdItems.map((item) => item.id),
      staffAppendContract: {
        openOwnerStartedLogId: log.createdByRole === 'OWNER' ? log.id : null,
        roomId: body.roomId,
        linenCategory: 'ROUTINE',
      },
    };
  });
}

export async function logLaundryOut(
  actor: Actor,
  input: {
    idempotencyKey: string;
    roomId: string;
    assignmentId?: string | null;
    linenCategory: 'ROUTINE' | 'PERIODIC';
    items: OutItem[];
    evidence?: unknown;
  },
) {
  await checkSubscriptionGate(actor, 'laundry.log', prisma);

  return withIdempotency(`laundry-out:v1:${actor.propertyId}:${input.idempotencyKey}`, prisma, async () => {
    return prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({
        where: { id: input.roomId, propertyId: actor.propertyId, deletedAt: null },
        select: { id: true },
      });
      if (!room) throw new AppError('NOT_FOUND', 'Room not found', 404);

      for (const row of input.items) {
        await validateLinenItem(actor, row.catalogItemId, input.linenCategory);
        if (row.dirtyPulled < 0 || row.cleanPlaced < 0 || row.dirtyPulled > 1000 || row.cleanPlaced > 1000) {
          throw new AppError('VALIDATION_ERROR', 'Invalid linen quantities', 422);
        }
      }

      const cycleDate = new Date(`${istDateKey()}T00:00:00+05:30`);
      const appendTarget =
        input.linenCategory === 'ROUTINE'
          ? await tx.laundryLog.findFirst({
              where: {
                propertyId: actor.propertyId,
                roomId: input.roomId,
                state: 'ITEMS_OUT',
                createdByRole: 'OWNER',
                deletedAt: null,
              },
              orderBy: { createdAt: 'asc' },
            })
          : null;

      const log =
        appendTarget ??
        (await tx.laundryLog.create({
          data: {
            propertyId: actor.propertyId,
            roomId: input.roomId,
            assignmentId: input.assignmentId ?? null,
            state: 'ITEMS_OUT',
            createdByRole: actor.role,
            createdByUserId: actor.userId,
            linenCategory: input.linenCategory,
            cycleDate,
            evidence: input.evidence ?? undefined,
          },
        }));

      const createdItems = [];
      for (const row of input.items) {
        const created = await tx.laundryLogItem.create({
          data: {
            propertyId: actor.propertyId,
            laundryLogId: log.id,
            catalogItemId: row.catalogItemId,
            state: 'ITEMS_OUT',
            qty: row.dirtyPulled,
            remainingQty: row.dirtyPulled,
          },
        });
        createdItems.push(created);

        await tx.roomLinenState.upsert({
          where: {
            propertyId_roomId_catalogItemId: {
              propertyId: actor.propertyId,
              roomId: input.roomId,
              catalogItemId: row.catalogItemId,
            },
          },
          create: {
            propertyId: actor.propertyId,
            roomId: input.roomId,
            catalogItemId: row.catalogItemId,
            qty: row.cleanPlaced,
            lastObservedAt: new Date(),
            seedSource: 'HOUSEKEEPING_SWEEP',
          },
          update: {
            qty: row.cleanPlaced,
            lastObservedAt: new Date(),
            seedSource: 'HOUSEKEEPING_SWEEP',
            stateVersion: { increment: 1 },
          },
        });
      }

      await writeAuditLog(tx, actor, {
        action: 'LAUNDRY_ITEMS_OUT',
        entityType: 'LAUNDRY_LOG',
        entityId: log.id,
        after: {
          roomId: input.roomId,
          linenCategory: input.linenCategory,
          appendedToOwnerLog: Boolean(appendTarget),
          items: input.items,
        },
      });

      for (const row of input.items) {
        await checkPoolBelowMin(actor.propertyId, row.catalogItemId);
      }

      // Story 12.6 — post-write hook for the First-Shift Reconciliation
      // watcher. Idempotent and inexpensive when not armed/ready.
      await runFirstShiftReconciliationIfReady(actor, tx);

      return { ok: true, laundryLogId: log.id, appendedToOwnerLog: Boolean(appendTarget), itemIds: createdItems.map((item) => item.id) };
    });
  });
}

export async function receiveLaundry(
  actor: Actor,
  input: { idempotencyKey: string; items: ReceiveItem[]; evidence?: unknown },
) {
  await checkSubscriptionGate(actor, 'laundry.receive', prisma);

  return withIdempotency(`laundry-receive:v1:${actor.propertyId}:${input.idempotencyKey}`, prisma, async () => {
    return prisma.$transaction(async (tx) => {
      const receivedRows = [];
      const shortages = [];

      for (const row of input.items) {
        await validateLinenItem(actor, row.catalogItemId);
        if (row.receivedQty < 0 || row.receivedQty > 100000) {
          throw new AppError('VALIDATION_ERROR', 'Invalid received quantity', 422);
        }

        let remainingToReceive = row.receivedQty;
        const outgoing = await tx.laundryLogItem.findMany({
          where: {
            propertyId: actor.propertyId,
            catalogItemId: row.catalogItemId,
            state: 'ITEMS_OUT',
            remainingQty: { gt: 0 },
          },
          orderBy: { createdAt: 'asc' },
        });
        const expected = outgoing.reduce((sum, item) => sum + item.remainingQty, 0);

        for (const outItem of outgoing) {
          if (remainingToReceive <= 0) break;
          const applied = Math.min(outItem.remainingQty, remainingToReceive);
          remainingToReceive -= applied;
          await tx.laundryLogItem.update({
            where: { id: outItem.id },
            data: { remainingQty: outItem.remainingQty - applied },
          });
          const inItem = await tx.laundryLogItem.create({
            data: {
              propertyId: actor.propertyId,
              laundryLogId: outItem.laundryLogId,
              sourceLaundryLogItemId: outItem.id,
              catalogItemId: row.catalogItemId,
              state: 'ITEMS_IN',
              qty: applied,
              remainingQty: 0,
            },
          });
          receivedRows.push(inItem);
        }

        if (row.receivedQty < expected) {
          const shortageQty = expected - row.receivedQty;
          const review = await tx.pendingReview.create({
            data: {
              propertyId: actor.propertyId,
              reviewType: 'LAUNDRY_SHORTAGE',
              catalogItemId: row.catalogItemId,
              qty: shortageQty,
              reason: 'Received fewer items than expected from laundry vendor',
              metadata: { expected, received: row.receivedQty },
              createdBy: actor.userId,
            },
          });
          shortages.push(review);
        }
      }

      await writeAuditLog(tx, actor, {
        action: 'LAUNDRY_ITEMS_RECEIVED',
        entityType: 'LAUNDRY_LOG',
        entityId: 'aggregate-receive',
        after: { items: input.items, receivedCount: receivedRows.length, shortageCount: shortages.length },
      });

      for (const row of input.items) {
        await checkPoolBelowMin(actor.propertyId, row.catalogItemId);
      }

      return {
        ok: true,
        receivedItemIds: receivedRows.map((row) => row.id),
        shortageReviewIds: shortages.map((row) => row.id),
      };
    });
  });
}

export async function getLaundryReceiveSnapshot(actor: Actor) {
  const [property, outgoing] = await Promise.all([
    prisma.property.findUnique({
      where: { id: actor.propertyId },
      select: { laundryVendorName: true, laundryVendorContact: true },
    }),
    prisma.laundryLogItem.findMany({
      where: { propertyId: actor.propertyId, state: 'ITEMS_OUT', remainingQty: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const itemIds = Array.from(new Set(outgoing.map((item) => item.catalogItemId)));
  const catalog = await prisma.catalogItem.findMany({
    where: { id: { in: itemIds }, propertyId: actor.propertyId, deletedAt: null },
  });
  const catalogMap = new Map(catalog.map((item) => [item.id, item]));
  const totals = new Map<string, number>();
  for (const item of outgoing) totals.set(item.catalogItemId, (totals.get(item.catalogItemId) ?? 0) + item.remainingQty);

  return {
    vendorName: property?.laundryVendorName ?? 'Laundry vendor',
    vendorContact: property?.laundryVendorContact ?? null,
    openCycleCount: new Set(outgoing.map((item) => item.laundryLogId)).size,
    items: Array.from(totals.entries()).map(([catalogItemId, expectedBack]) => {
      const item = catalogMap.get(catalogItemId);
      return {
        catalogItemId,
        name: item?.name ?? catalogItemId,
        unit: item?.unit ?? 'piece',
        linenCategory: item?.linenCategory ?? null,
        expectedBack,
      };
    }),
  };
}
