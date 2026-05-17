import type { Actor } from '@gojo/types';

import { prisma } from './client.js';
import type { DbClient } from './types.js';

type ScopedArgs = { where?: Record<string, unknown>; [key: string]: unknown };
type UniqueScopedArgs = { where: Record<string, unknown> };
interface Delegate {
  create: (args: ScopedArgs) => unknown;
  findMany: (args?: ScopedArgs) => unknown;
  findFirst: (args?: ScopedArgs) => unknown;
  findUnique?: (args: UniqueScopedArgs) => unknown;
  count?: (args?: ScopedArgs) => unknown;
  update: (args: ScopedArgs) => unknown;
  updateMany: (args?: ScopedArgs) => unknown;
  delete: (args: ScopedArgs) => unknown;
  deleteMany: (args?: ScopedArgs) => unknown;
}

function withScope(args: ScopedArgs | undefined, propertyId: string, softDelete: boolean) {
  return {
    ...args,
    where: {
      ...(args?.where ?? {}),
      propertyId,
      ...(softDelete ? { deletedAt: null } : {}),
    },
  };
}

function wrapDelegate(delegate: Delegate, propertyId: string, options: { softDelete?: boolean } = {}) {
  const softDelete = options.softDelete ?? true;

  return {
    create(args: ScopedArgs & { data?: Record<string, unknown> }) {
      return delegate.create({
        ...args,
        data: {
          ...(args.data ?? {}),
          propertyId,
        },
      });
    },
    findMany(args?: ScopedArgs) {
      return delegate.findMany(withScope(args, propertyId, softDelete));
    },
    findFirst(args?: ScopedArgs) {
      return delegate.findFirst(withScope(args, propertyId, softDelete));
    },
    count(args?: ScopedArgs) {
      if (!delegate.count) {
        throw new Error('Scoped count is not supported by this delegate');
      }
      return delegate.count(withScope(args, propertyId, softDelete));
    },
    async update(args: UniqueScopedArgs & { data?: unknown }) {
      const record = delegate.findUnique
        ? await delegate.findUnique({ where: args.where })
        : await delegate.findFirst(withScope({ where: args.where }, propertyId, softDelete));

      if (!record || typeof record !== 'object') {
        throw new Error('Scoped update target not found');
      }

      const candidate = record as Record<string, unknown>;
      if (candidate['propertyId'] !== propertyId || (softDelete && candidate['deletedAt'] !== null)) {
        throw new Error('Scoped update target is outside actor scope');
      }

      return delegate.update(args);
    },
    updateMany(args?: ScopedArgs) {
      return delegate.updateMany(withScope(args, propertyId, softDelete));
    },
    async delete(args: UniqueScopedArgs) {
      const record = delegate.findUnique
        ? await delegate.findUnique({ where: args.where })
        : await delegate.findFirst(withScope({ where: args.where }, propertyId, softDelete));

      if (!record || typeof record !== 'object') {
        throw new Error('Scoped delete target not found');
      }

      const candidate = record as Record<string, unknown>;
      if (candidate['propertyId'] !== propertyId || (softDelete && candidate['deletedAt'] !== null)) {
        throw new Error('Scoped delete target is outside actor scope');
      }

      return delegate.delete(args);
    },
    deleteMany(args?: ScopedArgs) {
      return delegate.deleteMany(withScope(args, propertyId, softDelete));
    },
  };
}

export function scopedClient(actor: Actor, tx?: DbClient) {
  const base = tx ?? prisma;

  return {
    room: wrapDelegate(base.room as unknown as Delegate, actor.propertyId),
    roomType: wrapDelegate(base.roomType as unknown as Delegate, actor.propertyId),
    reservation: wrapDelegate(base.reservation as unknown as Delegate, actor.propertyId),
    folio: wrapDelegate(base.folio as unknown as Delegate, actor.propertyId),
    folioLine: wrapDelegate(base.folioLine as unknown as Delegate, actor.propertyId),
    guest: wrapDelegate(base.guest as unknown as Delegate, actor.propertyId),
    subscription: wrapDelegate(base.subscription as unknown as Delegate, actor.propertyId),
    propertyAccess: wrapDelegate(base.propertyAccess as unknown as Delegate, actor.propertyId),
    catalogItem: wrapDelegate(base.catalogItem as unknown as Delegate, actor.propertyId),
    roomAssignment: wrapDelegate(base.roomAssignment as unknown as Delegate, actor.propertyId),
    roomConsumableState: wrapDelegate(base.roomConsumableState as unknown as Delegate, actor.propertyId),
    consumptionLog: wrapDelegate(base.consumptionLog as unknown as Delegate, actor.propertyId, { softDelete: false }),
    inventoryRestock: wrapDelegate((base as unknown as { inventoryRestock: Delegate }).inventoryRestock, actor.propertyId, { softDelete: false }),
    consumableWriteOff: wrapDelegate((base as unknown as { consumableWriteOff: Delegate }).consumableWriteOff, actor.propertyId, { softDelete: false }),
    roomLinenState: wrapDelegate(base.roomLinenState as unknown as Delegate, actor.propertyId),
    linenArrival: wrapDelegate((base as unknown as { linenArrival: Delegate }).linenArrival, actor.propertyId, { softDelete: false }),
    linenWriteOff: wrapDelegate((base as unknown as { linenWriteOff: Delegate }).linenWriteOff, actor.propertyId, { softDelete: false }),
    laundryLog: wrapDelegate(base.laundryLog as unknown as Delegate, actor.propertyId),
    laundryLogItem: wrapDelegate(base.laundryLogItem as unknown as Delegate, actor.propertyId, { softDelete: false }),
    pendingReview: wrapDelegate(base.pendingReview as unknown as Delegate, actor.propertyId, { softDelete: false }),
    issueReport: wrapDelegate((base as unknown as { issueReport: Delegate }).issueReport, actor.propertyId),
    auditLog: base.auditLog,
    idempotencyKey: base.idempotencyKey,
  };
}
