import { checkSubscriptionGate, prisma, scopedClient, writeAuditLog } from '@gojo/db';
import { AppError, type Actor } from '@gojo/types';
import { z } from 'zod';
import { checkPoolBelowMin, checkRestockRequired, syncWriteOffReviewPendingAlert } from './housekeeping-alerts';

type CatalogKind = 'AMENITY' | 'LINEN';
type AttributionStream = 'ROOM_SHORTAGE' | 'LAUNDRY_SHORTAGE' | 'OTHER';
type CatalogItemRow = {
  id: string;
  itemType: string;
  name: string;
  unit: string;
  restockThreshold: number | null;
  linenCategory: string | null;
  totalOwned: number | null;
  minPoolSize: number | null;
  roomTypeId: string | null;
  expectedQtyPerStay: number | null;
};
type IssueReportRow = {
  id: string;
  entryContext: string;
  category: string;
  attributionStream: string;
  roomId: string | null;
  catalogItemId: string | null;
  qty: number | null;
  vendorName: string | null;
  voiceFileUrl: string | null;
  photoFileUrl: string | null;
  textNote: string | null;
  reportedAt: Date;
  reportedBy: string;
  status: string;
  stateVersion: number;
};
type LedgerQtyRow = { catalogItemId: string; qty: number };
type LedgerAddedRow = { catalogItemId: string; qtyAdded: number };
type ConsumptionQtyRow = { catalogItemId: string; qtyUsed: number };
type LaundryOutQtyRow = { catalogItemId: string; remainingQty: number };
type RoomNumberRow = { id: string; number: string };
type CatalogLookup = { catalogItem: { findFirst: (args: unknown) => Promise<unknown> } };
type InventoryScoped = {
  inventoryRestock: { create: (args: unknown) => Promise<{ id: string }> };
  consumableWriteOff: { create: (args: unknown) => Promise<{ id: string }> };
  linenArrival: { create: (args: unknown) => Promise<{ id: string }> };
  linenWriteOff: { create: (args: unknown) => Promise<{ id: string }> };
  catalogItem: { update: (args: unknown) => Promise<unknown> };
};

const ownerRoles = ['OWNER', 'MANAGER'] as const;

const QtySchema = z.coerce.number().int().min(1).max(100000);

const ArrivalSchema = z
  .object({
    catalogItemId: z.string().min(1),
    qty: QtySchema,
    reference: z.string().trim().max(120).optional().nullable(),
  })
  .strict();

const WriteOffSchema = z
  .object({
    catalogItemId: z.string().min(1),
    qty: QtySchema,
    reason: z.string().trim().min(1).max(280),
    sourceLocation: z.enum(['STORAGE', 'LAUNDRY_CYCLE']).optional(),
    laundryLogId: z.string().min(1).optional().nullable(),
  })
  .strict();

const RejectSchema = z
  .object({
    rejectReason: z.string().trim().max(280).optional().nullable(),
  })
  .strict();

function parsePayload<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new AppError('VALIDATION_ERROR', 'Invalid inventory payload', 422, {
    details: {
      field: issue?.path.join('.') || 'body',
      reason: issue?.code ?? 'INVALID_PAYLOAD',
    },
  });
}

function assertOwnerOrManager(actor: Actor) {
  if (!ownerRoles.includes(actor.role as (typeof ownerRoles)[number])) {
    throw new AppError('FORBIDDEN', 'Owner or manager role required', 403);
  }
}

function idsFrom(id: string, idsParam?: string | null) {
  const ids = (idsParam ?? id)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
}

export function calculateAmenityCurrentLevel(input: { stocked: number; consumed: number; writeOffs: number }) {
  return input.stocked - input.consumed - input.writeOffs;
}

export function calculateLinenDistribution(input: {
  totalOwned: number;
  inRooms: number;
  inLaundry: number;
  cumulativeWriteOffs: number;
}) {
  return {
    ...input,
    inStorage: input.totalOwned - input.inRooms - input.inLaundry - input.cumulativeWriteOffs,
  };
}

async function maybeResolveWriteOffReviewAlert(propertyId: string) {
  const pendingCount = await prisma.issueReport.count({
    where: { propertyId, status: 'PENDING_REVIEW', deletedAt: null },
  });

  if (pendingCount <= 0) {
    await prisma.alert.updateMany({
      where: { propertyId, alertType: 'WRITE_OFF_REVIEW_PENDING', status: 'ACTIVE' },
      data: { status: 'AUTO_RESOLVED', resolvedAt: new Date() },
    });
    return;
  }

  await prisma.alert.updateMany({
    where: { propertyId, alertType: 'WRITE_OFF_REVIEW_PENDING', status: 'ACTIVE' },
    data: {
      message: pendingCount === 1 ? '1 issue report needs owner review' : `${pendingCount} issue reports need owner review`,
      updatedAt: new Date(),
    },
  });
}

async function getItem(db: CatalogLookup, propertyId: string, catalogItemId: string, itemType?: CatalogKind) {
  const item = (await db.catalogItem.findFirst({
    where: {
      id: catalogItemId,
      propertyId,
      ...(itemType ? { itemType } : {}),
      deletedAt: null,
    },
  })) as CatalogItemRow | null;
  if (!item) throw new AppError('NOT_FOUND', 'Catalog item not found', 404);
  return item;
}

export async function getInventoryLevels(actor: Actor) {
  // Hotfix-9: extended payload powers the new Amenities + Linens tabs.
  //  - Adds last-consumption per amenity, "approaching threshold" bucket,
  //    most-recent restock metadata, and room-type list for filters.
  //  - Adds stalled (>24h) laundry pieces per linen, distribution segments,
  //    and per-row status (Below min / At min / OK).
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    catalogItemsRaw,
    restocksRaw,
    consumptionsRaw,
    amenityWriteOffsRaw,
    linenRoomStatesRaw,
    openLaundryItemsRaw,
    stalledLaundryItemsRaw,
    linenWriteOffsRaw,
    roomTypesRaw,
    latestRestockRaw,
  ] = await Promise.all([
    prisma.catalogItem.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null, itemType: { in: ['AMENITY', 'LINEN'] } },
      orderBy: [{ itemType: 'asc' }, { name: 'asc' }],
    }),
    prisma.inventoryRestock.findMany({ where: { propertyId: actor.propertyId } }),
    prisma.consumptionLog.findMany({ where: { propertyId: actor.propertyId }, select: { catalogItemId: true, qtyUsed: true, createdAt: true } }),
    prisma.consumableWriteOff.findMany({ where: { propertyId: actor.propertyId } }),
    prisma.roomLinenState.findMany({ where: { propertyId: actor.propertyId, deletedAt: null } }),
    prisma.laundryLogItem.findMany({
      where: { propertyId: actor.propertyId, state: 'ITEMS_OUT', remainingQty: { gt: 0 } },
      select: { catalogItemId: true, remainingQty: true, laundryLogId: true },
    }),
    // Stalled laundry items: filtered post-fetch by joining to LaundryLog
    // (the schema declares no relation, only a fk). Reused below.
    prisma.laundryLog.findMany({
      where: { propertyId: actor.propertyId, state: 'ITEMS_OUT', createdAt: { lt: cutoff24h } },
      select: { id: true },
    }),
    prisma.linenWriteOff.findMany({ where: { propertyId: actor.propertyId } }),
    prisma.roomType.findMany({ where: { propertyId: actor.propertyId, deletedAt: null }, select: { id: true, name: true } }),
    prisma.inventoryRestock.findFirst({
      where: { propertyId: actor.propertyId },
      orderBy: { recordedAt: 'desc' },
      select: { catalogItemId: true, qtyAdded: true, recordedAt: true },
    }),
  ]);

  const catalogItems = catalogItemsRaw as CatalogItemRow[];
  const restocks = restocksRaw as LedgerAddedRow[];
  const consumptions = consumptionsRaw as Array<ConsumptionQtyRow & { createdAt: Date }>;
  const amenityWriteOffs = amenityWriteOffsRaw as LedgerQtyRow[];
  const linenRoomStates = linenRoomStatesRaw as LedgerQtyRow[];
  const openLaundryItems = openLaundryItemsRaw as Array<LaundryOutQtyRow & { laundryLogId: string }>;
  const stalledLogIds = new Set((stalledLaundryItemsRaw as Array<{ id: string }>).map((row) => row.id));
  const stalledLaundryItems = openLaundryItems.filter((item) => stalledLogIds.has(item.laundryLogId));
  const linenWriteOffs = linenWriteOffsRaw as LedgerQtyRow[];
  const roomTypes = roomTypesRaw as Array<{ id: string; name: string }>;

  const sumByItem = <T extends { catalogItemId: string }>(rows: T[], read: (row: T) => number) => {
    const totals = new Map<string, number>();
    for (const row of rows) totals.set(row.catalogItemId, (totals.get(row.catalogItemId) ?? 0) + read(row));
    return totals;
  };

  const lastByItem = <T extends { catalogItemId: string }>(rows: T[], read: (row: T) => Date) => {
    const map = new Map<string, Date>();
    for (const row of rows) {
      const cur = map.get(row.catalogItemId);
      const d = read(row);
      if (!cur || d > cur) map.set(row.catalogItemId, d);
    }
    return map;
  };

  const stocked = sumByItem(restocks, (row) => row.qtyAdded);
  const consumed = sumByItem(consumptions, (row) => row.qtyUsed);
  const lastConsumed = lastByItem(consumptions, (row) => row.createdAt);
  const amenityLoss = sumByItem(amenityWriteOffs, (row) => row.qty);
  const inRooms = sumByItem(linenRoomStates, (row) => row.qty);
  const inLaundry = sumByItem(openLaundryItems, (row) => row.remainingQty);
  const stalledByItem = sumByItem(stalledLaundryItems, (row) => row.remainingQty);
  const linenLoss = sumByItem(linenWriteOffs, (row) => row.qty);
  const roomTypeMap = new Map(roomTypes.map((rt) => [rt.id, rt.name]));

  const amenities = catalogItems
    .filter((item) => item.itemType === 'AMENITY')
    .map((item) => {
      const currentLevel = calculateAmenityCurrentLevel({
        stocked: stocked.get(item.id) ?? 0,
        consumed: consumed.get(item.id) ?? 0,
        writeOffs: amenityLoss.get(item.id) ?? 0,
      });
      const threshold = item.restockThreshold;
      // §3.1 status bucket: Below (< threshold) / Approaching (within 20%) / OK.
      let statusBucket: 'Below' | 'Approaching' | 'OK' = 'OK';
      if (threshold !== null && currentLevel < threshold) statusBucket = 'Below';
      else if (threshold !== null && currentLevel <= threshold * 1.2) statusBucket = 'Approaching';
      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        currentLevel,
        restockThreshold: threshold,
        roomTypeId: item.roomTypeId,
        roomTypeName: item.roomTypeId ? roomTypeMap.get(item.roomTypeId) ?? null : null,
        expectedQtyPerStay: item.expectedQtyPerStay,
        lastConsumedAt: lastConsumed.get(item.id)?.toISOString() ?? null,
        statusBucket,
        // Legacy field kept for any consumer relying on it.
        status: statusBucket === 'Below' ? 'Below Threshold' : 'Healthy',
      };
    });

  const linens = catalogItems
    .filter((item) => item.itemType === 'LINEN')
    .map((item) => {
      const dist = calculateLinenDistribution({
        totalOwned: item.totalOwned ?? 0,
        inRooms: inRooms.get(item.id) ?? 0,
        inLaundry: inLaundry.get(item.id) ?? 0,
        cumulativeWriteOffs: linenLoss.get(item.id) ?? 0,
      });
      const stalled = stalledByItem.get(item.id) ?? 0;
      const minPool = item.minPoolSize;
      // §3.2 status bucket against min pool.
      let statusBucket: 'BelowMin' | 'AtMin' | 'OK' = 'OK';
      if (minPool !== null && dist.inStorage < minPool) statusBucket = 'BelowMin';
      else if (minPool !== null && dist.inStorage <= minPool * 1.1) statusBucket = 'AtMin';
      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        linenCategory: item.linenCategory,
        minPoolSize: minPool,
        ...dist,
        stalled,
        statusBucket,
      };
    });

  const amenityCounts = {
    totalTracked: amenities.length,
    belowThreshold: amenities.filter((a) => a.statusBucket === 'Below').length,
    approachingThreshold: amenities.filter((a) => a.statusBucket === 'Approaching').length,
  };

  const linenCounts = {
    inStorageTotal: linens.reduce((sum, l) => sum + Math.max(0, l.inStorage), 0),
    inActiveRotation: linens.reduce((sum, l) => sum + Math.max(0, l.inRooms), 0),
    stalledGt24h: linens.reduce((sum, l) => sum + l.stalled, 0),
    belowMinPool: linens.filter((l) => l.statusBucket === 'BelowMin' || l.statusBucket === 'AtMin').length,
  };

  const latestRestock = latestRestockRaw as { catalogItemId: string; qtyAdded: number; recordedAt: Date } | null;
  const restockItemName = latestRestock
    ? catalogItems.find((i) => i.id === latestRestock.catalogItemId)?.name ?? null
    : null;

  return {
    amenities,
    linens,
    canMutate: ownerRoles.includes(actor.role as (typeof ownerRoles)[number]),
    roomTypes,
    counts: {
      amenities: amenityCounts,
      linens: linenCounts,
      lastRestock: latestRestock
        ? { at: latestRestock.recordedAt.toISOString(), itemName: restockItemName, qty: latestRestock.qtyAdded }
        : null,
    },
  };
}

export async function getPendingReview(
  actor: Actor,
  filters: { attributionStream?: AttributionStream | null; cycleId?: string | null } = {},
) {
  // Hotfix-9 §3.3 — pending review extended with reporter names, room type,
  // KPI counts (oldest pending), and optional cycle filter (deep-link from
  // Laundry status flag chip).
  const reports = (await prisma.issueReport.findMany({
    where: {
      propertyId: actor.propertyId,
      status: 'PENDING_REVIEW',
      deletedAt: null,
      ...(filters.attributionStream ? { attributionStream: filters.attributionStream } : {}),
    },
    orderBy: { reportedAt: 'desc' },
  })) as IssueReportRow[];

  const [catalogItemsRaw, roomsRaw, reporterUsersRaw] = await Promise.all([
    prisma.catalogItem.findMany({
      where: { propertyId: actor.propertyId, id: { in: reports.map((report) => report.catalogItemId).filter(Boolean) as string[] } },
    }),
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, id: { in: reports.map((report) => report.roomId).filter(Boolean) as string[] } },
      select: { id: true, number: true, roomTypeId: true },
    }),
    prisma.user.findMany({
      where: { id: { in: Array.from(new Set(reports.map((report) => report.reportedBy))) } },
      select: { id: true, name: true, phone: true },
    }),
  ]);

  const catalogItems = catalogItemsRaw as CatalogItemRow[];
  const rooms = roomsRaw as Array<RoomNumberRow & { roomTypeId: string }>;
  const reporterUsers = reporterUsersRaw as Array<{ id: string; name: string | null; phone: string }>;
  const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const reporterById = new Map(reporterUsers.map((u) => [u.id, u.name?.trim() || u.phone]));

  const cards = reports.map((report) => {
    const item = report.catalogItemId ? catalogById.get(report.catalogItemId) : null;
    const room = report.roomId ? roomById.get(report.roomId) : null;
    // Source description for the triage card — maps PWA entry contexts.
    const sourceLabel =
      report.entryContext === 'LINEN_SWAP'
        ? 'linen-swap shortage (PWA screen 6)'
        : report.entryContext === 'LAUNDRY_RECEIVE'
          ? 'laundry receive shortage (PWA screen 8)'
          : 'issue report (PWA screen 9)';
    return {
      id: report.id,
      attributionStream: report.attributionStream,
      entryContext: report.entryContext,
      category: report.category,
      itemName: item?.name ?? 'Uncatalogued item',
      itemType: item?.itemType ?? null,
      unit: item?.unit ?? 'item',
      qty: report.qty ?? 1,
      roomNumber: room?.number ?? null,
      vendorName: report.vendorName,
      voiceFileUrl: report.voiceFileUrl,
      photoFileUrl: report.photoFileUrl,
      textNote: report.textNote,
      reportedAt: report.reportedAt.toISOString(),
      reporterName: reporterById.get(report.reportedBy) ?? 'Unknown',
      sourceLabel,
      stateVersion: report.stateVersion,
    };
  });

  const oldestPendingAt = cards.length > 0 ? cards[cards.length - 1]!.reportedAt : null;
  const counts = {
    totalPending: cards.length,
    roomShortage: cards.filter((c) => c.attributionStream === 'ROOM_SHORTAGE').length,
    laundryShortage: cards.filter((c) => c.attributionStream === 'LAUNDRY_SHORTAGE').length,
    oldestPendingAt,
  };

  return {
    pendingCount: cards.length,
    counts,
    roomShortage: cards.filter((card) => card.attributionStream === 'ROOM_SHORTAGE'),
    laundryShortage: cards.filter((card) => card.attributionStream === 'LAUNDRY_SHORTAGE'),
  };
}

export async function recordInventoryArrival(actor: Actor, raw: unknown) {
  await checkSubscriptionGate(actor, 'inventory.recordArrival', prisma);
  assertOwnerOrManager(actor);
  const body = parsePayload(ArrivalSchema, raw);

  return prisma.$transaction(async (tx) => {
    const db = scopedClient(actor, tx) as unknown as InventoryScoped;
    const item = await getItem(tx as CatalogLookup, actor.propertyId, body.catalogItemId);
    if (item.itemType === 'AMENITY') {
      const restock = await db.inventoryRestock.create({
        data: {
          propertyId: actor.propertyId,
          catalogItemId: item.id,
          qtyAdded: body.qty,
          reference: body.reference ?? null,
          recordedBy: actor.userId,
        },
      });
      await writeAuditLog(tx, actor, {
        action: 'INVENTORY_ARRIVAL_RECORDED',
        entityType: 'CATALOG_ITEM',
        entityId: item.id,
        metadata: { qty: body.qty, reference: body.reference ?? null, ledgerId: restock.id },
      });
      await checkRestockRequired(actor.propertyId, item.id);
      return { ok: true, type: 'AMENITY', id: restock.id };
    }

    const arrival = await db.linenArrival.create({
      data: {
        propertyId: actor.propertyId,
        catalogItemId: item.id,
        qtyAdded: body.qty,
        reference: body.reference ?? null,
        recordedBy: actor.userId,
      },
    });
    await db.catalogItem.update({
      where: { id: item.id },
      data: { totalOwned: { increment: body.qty }, stateVersion: { increment: 1 } },
    });
    await writeAuditLog(tx, actor, {
      action: 'INVENTORY_ARRIVAL_RECORDED',
      entityType: 'CATALOG_ITEM',
      entityId: item.id,
      metadata: { qty: body.qty, reference: body.reference ?? null, ledgerId: arrival.id, itemType: 'LINEN' },
    });
    await checkPoolBelowMin(actor.propertyId, item.id);
    return { ok: true, type: 'LINEN', id: arrival.id };
  });
}

export async function recordInventoryWriteOff(actor: Actor, raw: unknown) {
  await checkSubscriptionGate(actor, 'inventory.recordWriteOff', prisma);
  assertOwnerOrManager(actor);
  const body = parsePayload(WriteOffSchema, raw);

  return prisma.$transaction(async (tx) => {
    const db = scopedClient(actor, tx) as unknown as InventoryScoped;
    const item = await getItem(tx as CatalogLookup, actor.propertyId, body.catalogItemId);
    if (item.itemType === 'AMENITY') {
      const writeOff = await db.consumableWriteOff.create({
        data: {
          propertyId: actor.propertyId,
          catalogItemId: item.id,
          qty: body.qty,
          reason: body.reason,
          recordedBy: actor.userId,
        },
      });
      await writeAuditLog(tx, actor, {
        action: 'INVENTORY_WRITE_OFF_RECORDED',
        entityType: 'CATALOG_ITEM',
        entityId: item.id,
        metadata: { qty: body.qty, reason: body.reason, ledgerId: writeOff.id, itemType: 'AMENITY' },
      });
      await checkRestockRequired(actor.propertyId, item.id);
      return { ok: true, type: 'AMENITY', id: writeOff.id };
    }

    const sourceLocation = body.sourceLocation ?? 'STORAGE';
    if (sourceLocation === 'LAUNDRY_CYCLE' && !body.laundryLogId) {
      throw new AppError('VALIDATION_ERROR', 'laundryLogId is required for laundry-cycle linen write-off', 422, {
        details: { field: 'laundryLogId', reason: 'REQUIRED_FOR_LAUNDRY_CYCLE' },
      });
    }
    const writeOff = await db.linenWriteOff.create({
      data: {
        propertyId: actor.propertyId,
        catalogItemId: item.id,
        qty: body.qty,
        reason: body.reason,
        sourceLocation,
        laundryLogId: body.laundryLogId ?? null,
        recordedBy: actor.userId,
      },
    });
    await db.catalogItem.update({
      where: { id: item.id },
      data: { totalOwned: { decrement: body.qty }, stateVersion: { increment: 1 } },
    });
    await writeAuditLog(tx, actor, {
      action: 'INVENTORY_WRITE_OFF_RECORDED',
      entityType: 'CATALOG_ITEM',
      entityId: item.id,
      metadata: { qty: body.qty, reason: body.reason, sourceLocation, ledgerId: writeOff.id, itemType: 'LINEN' },
    });
    await checkPoolBelowMin(actor.propertyId, item.id);
    return { ok: true, type: 'LINEN', id: writeOff.id };
  });
}

export async function approveIssueReports(actor: Actor, id: string, idsParam?: string | null) {
  await checkSubscriptionGate(actor, 'inventory.approveWriteOff', prisma);
  assertOwnerOrManager(actor);
  const ids = idsFrom(id, idsParam);
  if (ids.length === 0) throw new AppError('VALIDATION_ERROR', 'At least one issue report id is required', 422);

  return prisma.$transaction(async (tx) => {
    const db = scopedClient(actor, tx) as unknown as InventoryScoped;
    const reports = (await tx.issueReport.findMany({
      where: { id: { in: ids }, propertyId: actor.propertyId, deletedAt: null },
    })) as IssueReportRow[];
    if (reports.length !== ids.length) throw new AppError('NOT_FOUND', 'Issue report not found', 404);

    for (const report of reports) {
      if (report.status !== 'PENDING_REVIEW') {
        throw new AppError('CONFLICT', 'Issue report already reviewed', 409, {
          details: { id: report.id, currentStatus: report.status },
        });
      }
      if (!report.catalogItemId) {
        throw new AppError('VALIDATION_ERROR', 'Issue report is not linked to a catalog item', 422, {
          details: { id: report.id, field: 'catalogItemId' },
        });
      }

      const item = (await tx.catalogItem.findFirst({
        where: { id: report.catalogItemId, propertyId: actor.propertyId, deletedAt: null },
      })) as CatalogItemRow | null;
      if (!item) throw new AppError('NOT_FOUND', 'Catalog item not found', 404);
      const qty = report.qty ?? 1;

      if (item.itemType === 'LINEN') {
        await db.linenWriteOff.create({
          data: {
            propertyId: actor.propertyId,
            catalogItemId: item.id,
            qty,
            reason: `Approved from IssueReport ${report.id}`,
            sourceLocation: report.attributionStream === 'LAUNDRY_SHORTAGE' ? 'LAUNDRY_CYCLE' : 'STORAGE',
            issueReportId: report.id,
            recordedBy: actor.userId,
          },
        });
        await db.catalogItem.update({
          where: { id: item.id },
          data: { totalOwned: { decrement: qty }, stateVersion: { increment: 1 } },
        });
        await checkPoolBelowMin(actor.propertyId, item.id);
      } else {
        await db.consumableWriteOff.create({
          data: {
            propertyId: actor.propertyId,
            catalogItemId: item.id,
            qty,
            reason: `Approved from IssueReport ${report.id}`,
            source: 'ISSUE_REPORT_APPROVAL',
            issueReportId: report.id,
            recordedBy: actor.userId,
          },
        });
        await checkRestockRequired(actor.propertyId, item.id);
      }

      const updated = await tx.issueReport.updateMany({
        where: {
          id: report.id,
          propertyId: actor.propertyId,
          status: 'PENDING_REVIEW',
          stateVersion: report.stateVersion,
        },
        data: {
          status: 'APPROVED',
          reviewedBy: actor.userId,
          reviewedAt: new Date(),
          stateVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new AppError('CONFLICT', 'Issue report changed while reviewing', 409, {
          details: { id: report.id, currentStatus: report.status },
        });
      }

      await writeAuditLog(tx, actor, {
        action: 'WRITE_OFF_APPROVED',
        entityType: 'ISSUE_REPORT',
        entityId: report.id,
        fromState: 'PENDING_REVIEW',
        toState: 'APPROVED',
        metadata: { attributionStream: report.attributionStream, qty, catalogItemId: item.id, itemType: item.itemType },
      });
    }
  }).then(async () => {
    await maybeResolveWriteOffReviewAlert(actor.propertyId);
    await syncWriteOffReviewPendingAlert(actor.propertyId);
    return { ok: true, approved: ids.length };
  });
}

export async function rejectIssueReports(actor: Actor, id: string, idsParam: string | null | undefined, raw: unknown) {
  await checkSubscriptionGate(actor, 'inventory.rejectWriteOff', prisma);
  assertOwnerOrManager(actor);
  const ids = idsFrom(id, idsParam);
  const body = parsePayload(RejectSchema, raw ?? {});
  if (ids.length === 0) throw new AppError('VALIDATION_ERROR', 'At least one issue report id is required', 422);

  return prisma.$transaction(async (tx) => {
    const reports = (await tx.issueReport.findMany({
      where: { id: { in: ids }, propertyId: actor.propertyId, deletedAt: null },
    })) as IssueReportRow[];
    if (reports.length !== ids.length) throw new AppError('NOT_FOUND', 'Issue report not found', 404);

    for (const report of reports) {
      if (report.status !== 'PENDING_REVIEW') {
        throw new AppError('CONFLICT', 'Issue report already reviewed', 409, {
          details: { id: report.id, currentStatus: report.status },
        });
      }
      const updated = await tx.issueReport.updateMany({
        where: {
          id: report.id,
          propertyId: actor.propertyId,
          status: 'PENDING_REVIEW',
          stateVersion: report.stateVersion,
        },
        data: {
          status: 'REJECTED',
          reviewedBy: actor.userId,
          reviewedAt: new Date(),
          rejectReason: body.rejectReason ?? null,
          stateVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new AppError('CONFLICT', 'Issue report changed while reviewing', 409, {
          details: { id: report.id, currentStatus: report.status },
        });
      }
      await writeAuditLog(tx, actor, {
        action: 'WRITE_OFF_REJECTED',
        entityType: 'ISSUE_REPORT',
        entityId: report.id,
        fromState: 'PENDING_REVIEW',
        toState: 'REJECTED',
        metadata: { attributionStream: report.attributionStream, rejectReason: body.rejectReason ?? null },
      });
    }
  }).then(async () => {
    await maybeResolveWriteOffReviewAlert(actor.propertyId);
    await syncWriteOffReviewPendingAlert(actor.propertyId);
    return { ok: true, rejected: ids.length };
  });
}
