import { prisma } from '@gojo/db';

export { alertHref } from '@/lib/dashboard/alert-links';

type AlertTarget = {
  propertyId: string;
  alertType: string;
  entityType: string;
  entityId: string | null;
  message: string;
};

type ExistingAlert = { id: string };
type RestockItem = { id: string; name: string; unit: string; restockThreshold: number | null };
type LinenItem = { id: string; name: string; totalOwned: number | null; minPoolSize: number | null };

async function upsertActiveAlert(target: AlertTarget) {
  const existing = (await prisma.alert.findFirst({
    where: {
      propertyId: target.propertyId,
      alertType: target.alertType,
      entityType: target.entityType,
      entityId: target.entityId,
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'desc' },
  })) as ExistingAlert | null;
  if (existing) {
    return prisma.alert.update({
      where: { id: existing.id },
      data: { message: target.message, severity: 'MEDIUM', updatedAt: new Date() },
    });
  }
  return prisma.alert.create({
    data: {
      propertyId: target.propertyId,
      alertType: target.alertType,
      severity: 'MEDIUM',
      status: 'ACTIVE',
      message: target.message,
      entityType: target.entityType,
      entityId: target.entityId,
    },
  });
}

async function resolveAlert(propertyId: string, alertType: string, entityType: string, entityId: string | null) {
  await prisma.alert.updateMany({
    where: { propertyId, alertType, entityType, entityId, status: 'ACTIVE' },
    data: { status: 'AUTO_RESOLVED', resolvedAt: new Date() },
  });
}

export async function calculateAmenityLevel(propertyId: string, catalogItemId: string) {
  const [stocked, consumed, writeOffs] = await Promise.all([
    prisma.inventoryRestock.aggregate({ where: { propertyId, catalogItemId }, _sum: { qtyAdded: true } }),
    prisma.consumptionLog.aggregate({ where: { propertyId, catalogItemId }, _sum: { qtyUsed: true } }),
    prisma.consumableWriteOff.aggregate({ where: { propertyId, catalogItemId }, _sum: { qty: true } }),
  ]);
  return (stocked._sum.qtyAdded ?? 0) - (consumed._sum.qtyUsed ?? 0) - (writeOffs._sum.qty ?? 0);
}

export async function checkRestockRequired(propertyId: string, catalogItemId: string) {
  const item = (await prisma.catalogItem.findFirst({
    where: { id: catalogItemId, propertyId, itemType: 'AMENITY', deletedAt: null },
    select: { id: true, name: true, unit: true, restockThreshold: true },
  })) as RestockItem | null;
  if (!item || item.restockThreshold === null) return null;
  const currentLevel = await calculateAmenityLevel(propertyId, catalogItemId);
  if (currentLevel < item.restockThreshold) {
    return upsertActiveAlert({
      propertyId,
      alertType: 'RESTOCK_REQUIRED',
      entityType: 'CATALOG_ITEM',
      entityId: item.id,
      message: `Restock needed: ${item.name} - ${currentLevel} ${item.unit} remaining, threshold ${item.restockThreshold}`,
    });
  }
  await resolveAlert(propertyId, 'RESTOCK_REQUIRED', 'CATALOG_ITEM', item.id);
  return null;
}

export async function calculateLinenStorage(propertyId: string, catalogItemId: string) {
  const [item, inRooms, inLaundry, writeOffs] = await Promise.all([
    prisma.catalogItem.findFirst({ where: { id: catalogItemId, propertyId, itemType: 'LINEN', deletedAt: null } }),
    prisma.roomLinenState.aggregate({ where: { propertyId, catalogItemId, deletedAt: null }, _sum: { qty: true } }),
    prisma.laundryLogItem.aggregate({ where: { propertyId, catalogItemId, state: 'ITEMS_OUT', remainingQty: { gt: 0 } }, _sum: { remainingQty: true } }),
    prisma.linenWriteOff.aggregate({ where: { propertyId, catalogItemId }, _sum: { qty: true } }),
  ]);
  const linenItem = item as LinenItem | null;
  if (!linenItem) return null;
  return {
    item: linenItem,
    inStorage:
      Number(linenItem.totalOwned ?? 0) -
      Number(inRooms._sum.qty ?? 0) -
      Number(inLaundry._sum.remainingQty ?? 0) -
      Number(writeOffs._sum.qty ?? 0),
  };
}

export async function checkPoolBelowMin(propertyId: string, catalogItemId: string) {
  const result = await calculateLinenStorage(propertyId, catalogItemId);
  if (!result || result.item.minPoolSize === null) return null;
  if (result.inStorage < result.item.minPoolSize) {
    return upsertActiveAlert({
      propertyId,
      alertType: 'POOL_BELOW_MIN',
      entityType: 'CATALOG_ITEM',
      entityId: result.item.id,
      message: `Linen pool low: ${result.item.name} - ${result.inStorage} available, minimum ${result.item.minPoolSize}`,
    });
  }
  await resolveAlert(propertyId, 'POOL_BELOW_MIN', 'CATALOG_ITEM', result.item.id);
  return null;
}

export async function syncWriteOffReviewPendingAlert(propertyId: string) {
  const pendingCount = await prisma.issueReport.count({ where: { propertyId, status: 'PENDING_REVIEW', deletedAt: null } });
  if (pendingCount <= 0) {
    await resolveAlert(propertyId, 'WRITE_OFF_REVIEW_PENDING', 'ISSUE_REPORT_QUEUE', null);
    return null;
  }
  return upsertActiveAlert({
    propertyId,
    alertType: 'WRITE_OFF_REVIEW_PENDING',
    entityType: 'ISSUE_REPORT_QUEUE',
    entityId: null,
    message: `${pendingCount} ${pendingCount === 1 ? 'item' : 'items'} awaiting review`,
  });
}
