import { AppError, type Actor } from '@gojo/types';

import type { Prisma } from './generated/client/index.js';
import { scopedClient } from './scoped-client.js';
import type { DbClient } from './types.js';
import { writeAuditLog } from './audit-log.js';

export type CatalogItemType = 'AMENITY' | 'LINEN';
export type LinenCategory = 'ROUTINE' | 'PERIODIC';

export type CreateCatalogItemInput =
  | {
      itemType: 'AMENITY';
      roomTypeId: string;
      name: string;
      unit: string;
      expectedQtyPerStay: number;
      restockThreshold?: number | null;
    }
  | {
      itemType: 'LINEN';
      name: string;
      unit: string;
      linenCategory: LinenCategory;
      totalOwned: number;
      minPoolSize?: number | null;
    };

export type UpdateCatalogItemInput = {
  stateVersion: number;
  name?: string;
  unit?: string;
  roomTypeId?: string;
  expectedQtyPerStay?: number | null;
  restockThreshold?: number | null;
  linenCategory?: LinenCategory | null;
  totalOwned?: number | null;
  minPoolSize?: number | null;
};

export function assertCatalogItemPatchAllowed(itemType: CatalogItemType, patch: Record<string, unknown>) {
  if ('itemType' in patch) {
    throw new AppError('VALIDATION_ERROR', 'itemType cannot be changed', 422, {
      details: { field: 'itemType', reason: 'ITEM_TYPE_IMMUTABLE' },
    });
  }

  const amenityOnly = ['roomTypeId', 'expectedQtyPerStay', 'restockThreshold'];
  const linenOnly = ['linenCategory', 'totalOwned', 'minPoolSize'];
  const wrong = (itemType === 'AMENITY' ? linenOnly : amenityOnly).find((field) => field in patch);
  if (wrong) {
    throw new AppError('VALIDATION_ERROR', 'Field not allowed for item type', 422, {
      details: { field: wrong, reason: 'FIELD_NOT_ALLOWED_FOR_ITEM_TYPE' },
    });
  }
}

export function listCatalogItems(
  actor: Actor,
  db: DbClient,
  filters: { itemType: CatalogItemType; roomTypeId?: string | null },
) {
  const scoped = scopedClient(actor, db);
  return scoped.catalogItem.findMany({
    where: {
      itemType: filters.itemType,
      ...(filters.itemType === 'AMENITY' && filters.roomTypeId ? { roomTypeId: filters.roomTypeId } : {}),
    },
    orderBy: [{ roomTypeId: 'asc' }, { name: 'asc' }],
  });
}

async function assertUniqueCatalogName(
  actor: Actor,
  tx: Prisma.TransactionClient,
  data: { itemType: CatalogItemType; name: string; roomTypeId?: string | null; excludeId?: string },
) {
  const existing = await tx.catalogItem.findFirst({
    where: {
      propertyId: actor.propertyId,
      itemType: data.itemType,
      roomTypeId: data.roomTypeId ?? null,
      name: { equals: data.name, mode: 'insensitive' },
      deletedAt: null,
      ...(data.excludeId ? { id: { not: data.excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new AppError('CONFLICT', 'Catalog item already exists', 409, {
      details: { code: 'CATALOG_ITEM_ALREADY_EXISTS' },
    });
  }
}

export async function createCatalogItem(actor: Actor, tx: Prisma.TransactionClient, input: CreateCatalogItemInput) {
  await assertUniqueCatalogName(actor, tx, {
    itemType: input.itemType,
    name: input.name,
    roomTypeId: input.itemType === 'AMENITY' ? input.roomTypeId : null,
  });

  const data =
    input.itemType === 'AMENITY'
      ? {
          propertyId: actor.propertyId,
          itemType: input.itemType,
          roomTypeId: input.roomTypeId,
          name: input.name,
          unit: input.unit,
          expectedQtyPerStay: input.expectedQtyPerStay,
          restockThreshold: input.restockThreshold ?? null,
          linenCategory: null,
          totalOwned: null,
          minPoolSize: null,
        }
      : {
          propertyId: actor.propertyId,
          itemType: input.itemType,
          roomTypeId: null,
          name: input.name,
          unit: input.unit,
          expectedQtyPerStay: null,
          restockThreshold: null,
          linenCategory: input.linenCategory,
          totalOwned: input.totalOwned,
          minPoolSize: input.minPoolSize ?? null,
        };

  const item = await tx.catalogItem.create({ data });
  await writeAuditLog(tx, actor, {
    action: 'CATALOG_ITEM_CREATED',
    entityType: 'CATALOG_ITEM',
    entityId: item.id,
    after: data,
  });
  return item;
}

export async function updateCatalogItem(actor: Actor, tx: Prisma.TransactionClient, id: string, input: UpdateCatalogItemInput) {
  const before = await tx.catalogItem.findFirst({
    where: { id, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!before) throw new AppError('NOT_FOUND', 'Catalog item not found', 404);
  if (before.stateVersion !== input.stateVersion) {
    throw new AppError('CONFLICT', 'Catalog item state version mismatch', 409, {
      details: { currentStateVersion: before.stateVersion },
    });
  }

  assertCatalogItemPatchAllowed(before.itemType as CatalogItemType, input);
  if (input.name) {
    await assertUniqueCatalogName(actor, tx, {
      itemType: before.itemType as CatalogItemType,
      name: input.name,
      roomTypeId: before.itemType === 'AMENITY' ? (input.roomTypeId ?? before.roomTypeId) : null,
      excludeId: id,
    });
  }

  const patch: Omit<UpdateCatalogItemInput, 'stateVersion'> = { ...input };
  delete (patch as Partial<UpdateCatalogItemInput>).stateVersion;
  const updated = await tx.catalogItem.update({
    where: { id },
    data: { ...patch, stateVersion: { increment: 1 } },
  });
  await writeAuditLog(tx, actor, {
    action: 'CATALOG_ITEM_UPDATED',
    entityType: 'CATALOG_ITEM',
    entityId: id,
    before: before as unknown as Prisma.JsonObject,
    after: updated as unknown as Prisma.JsonObject,
  });
  return updated;
}

export async function deleteCatalogItem(actor: Actor, tx: Prisma.TransactionClient, id: string, stateVersion?: number) {
  const before = await tx.catalogItem.findFirst({
    where: { id, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!before) throw new AppError('NOT_FOUND', 'Catalog item not found', 404);
  if (stateVersion !== undefined && before.stateVersion !== stateVersion) {
    throw new AppError('CONFLICT', 'Catalog item state version mismatch', 409, {
      details: { currentStateVersion: before.stateVersion },
    });
  }

  const updated = await tx.catalogItem.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: actor.userId, stateVersion: { increment: 1 } },
  });
  await writeAuditLog(tx, actor, {
    action: 'CATALOG_ITEM_DELETED',
    entityType: 'CATALOG_ITEM',
    entityId: id,
    before: before as unknown as Prisma.JsonObject,
    after: updated as unknown as Prisma.JsonObject,
  });
  return updated;
}
