// @ts-nocheck
// Story 12.5 — cold-start linen distribution endpoints.
//
// GET  → returns each linen CatalogItem with its `totalOwned` plus the current
//        per-room sum already recorded in RoomLinenState (so the Owner sees
//        any prior in-progress seeding when they resume).
// POST → accepts per-item { inRooms, inLaundry, inStorage } (+ optional
//        manual per-room overrides), validates sum, runs floor-divide,
//        upserts RoomLinenState rows with `seedSource: 'COLD_START'`, audits,
//        and arms the First-Shift Reconciliation watcher (AC6).
import { armFirstShiftReconciliation, checkSubscriptionGate, prisma } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { distributeFloorDivide, validateLinenSplit } from '@/lib/services/cold-start-linen';

export const GET = withAuth(async (_req, actor) => {
  const [linens, states, property] = await Promise.all([
    prisma.catalogItem.findMany({
      where: { propertyId: actor.propertyId, itemType: 'LINEN', deletedAt: null },
      orderBy: [{ linenCategory: 'asc' }, { name: 'asc' }],
    }),
    prisma.roomLinenState.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
    }),
    prisma.property.findUnique({
      where: { id: actor.propertyId },
      select: { coldStartLinenDeferred: true },
    }),
  ]);

  const sumByItem = new Map<string, number>();
  for (const s of states) {
    sumByItem.set(s.catalogItemId, (sumByItem.get(s.catalogItemId) ?? 0) + s.qty);
  }

  return NextResponse.json({
    deferred: property?.coldStartLinenDeferred ?? false,
    items: linens.map((l) => ({
      id: l.id,
      name: l.name,
      unit: l.unit,
      linenCategory: l.linenCategory,
      roomTypeId: l.roomTypeId,
      totalOwned: l.totalOwned ?? 0,
      inRoomsSoFar: sumByItem.get(l.id) ?? 0,
    })),
  });
}, ['OWNER']);

const perRoomSchema = z.object({ roomId: z.string().min(1), qty: z.number().int().min(0) });
const itemSchema = z.object({
  catalogItemId: z.string().min(1),
  inRooms: z.number().int().min(0),
  inLaundry: z.number().int().min(0),
  inStorage: z.number().int().min(0),
  // Optional manual override — when present, the sum of qty must equal inRooms.
  perRoom: z.array(perRoomSchema).optional(),
});
const bodySchema = z.object({ items: z.array(itemSchema).min(1) });

export const POST = withAuth(async (req, actor) => {
  // AC1 spec reuses catalog_item.create as the gate (per user decision 2026-05-15
  // — cold-start linen seed is conceptually a catalog seeding step).
  await checkSubscriptionGate(actor, 'catalog_item.create', prisma);

  const body = bodySchema.parse(await req.json());

  // Load the linen catalog + the property's rooms once. Rooms are scoped to
  // each item by its (optional) roomTypeId: a linen with `roomTypeId` set
  // distributes across only that room type's rooms; a linen with `roomTypeId`
  // null distributes across all rooms.
  const [linens, allRooms] = await Promise.all([
    prisma.catalogItem.findMany({
      where: { propertyId: actor.propertyId, itemType: 'LINEN', deletedAt: null },
    }),
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { id: true, number: true, roomTypeId: true },
    }),
  ]);
  const linenById = new Map(linens.map((l) => [l.id, l]));

  // Validate every item up front before any writes (atomic-ish).
  for (const item of body.items) {
    const linen = linenById.get(item.catalogItemId);
    if (!linen) {
      throw new AppError('NOT_FOUND', `Linen item ${item.catalogItemId} not found`, 404);
    }
    const totalOwned = linen.totalOwned ?? 0;
    const splitError = validateLinenSplit({ totalOwned, inRooms: item.inRooms, inLaundry: item.inLaundry, inStorage: item.inStorage });
    if (splitError) {
      throw new AppError('VALIDATION_ERROR', `${linen.name}: ${splitError}`, 422);
    }
    if (item.perRoom) {
      const perRoomSum = item.perRoom.reduce((acc, r) => acc + r.qty, 0);
      if (perRoomSum !== item.inRooms) {
        throw new AppError('VALIDATION_ERROR', `${linen.name}: per-room sum (${perRoomSum}) must equal inRooms (${item.inRooms})`, 422);
      }
    }
  }

  // Apply each item: build a per-room allocation (floor-divide or manual),
  // upsert RoomLinenState rows, audit. All inside a single transaction so a
  // mid-flight failure leaves no partial state.
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const item of body.items) {
      const linen = linenById.get(item.catalogItemId)!;
      const eligibleRooms = linen.roomTypeId
        ? allRooms.filter((r) => r.roomTypeId === linen.roomTypeId)
        : allRooms;

      const allocation = item.perRoom
        ? new Map(item.perRoom.map((r) => [r.roomId, r.qty]))
        : distributeFloorDivide(eligibleRooms, item.inRooms);

      for (const room of eligibleRooms) {
        const qty = allocation.get(room.id) ?? 0;
        await tx.roomLinenState.upsert({
          where: { propertyId_roomId_catalogItemId: { propertyId: actor.propertyId, roomId: room.id, catalogItemId: item.catalogItemId } },
          create: {
            propertyId: actor.propertyId,
            roomId: room.id,
            catalogItemId: item.catalogItemId,
            qty,
            lastObservedAt: now,
            seedSource: 'COLD_START',
          },
          update: {
            qty,
            lastObservedAt: now,
            seedSource: 'COLD_START',
            stateVersion: { increment: 1 },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          propertyId: actor.propertyId,
          entityType: 'CATALOG_ITEM',
          entityId: item.catalogItemId,
          action: 'COLD_START_LINEN_SEEDED',
          actorId: actor.userId,
          actorRole: actor.role,
          metadata: {
            totalOwned: linen.totalOwned ?? 0,
            inRooms: item.inRooms,
            inLaundry: item.inLaundry,
            inStorage: item.inStorage,
            manual: Boolean(item.perRoom),
            eligibleRoomCount: eligibleRooms.length,
          },
        },
      });
    }

    // AC6/AC7 — clear the deferred flag (a successful seed un-defers the
    // property) and arm the First-Shift Reconciliation watcher. The watcher
    // arm is currently a no-op seam — Story 12.6 uses a post-laundry hook
    // for the actual trigger, but we keep the call for symmetry.
    await tx.property.update({
      where: { id: actor.propertyId },
      data: { coldStartLinenDeferred: false },
    });
    await armFirstShiftReconciliation(actor, tx);
  });

  return NextResponse.json({ ok: true });
}, ['OWNER']);
