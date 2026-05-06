import type { Actor } from '@gojo/types';

import { prisma } from './client.js';
import type { DbClient } from './types.js';

type ScopedArgs = { where?: Record<string, unknown> };
type UniqueScopedArgs = { where: Record<string, unknown> };
interface Delegate {
  findMany: (args?: ScopedArgs) => unknown;
  findFirst: (args?: ScopedArgs) => unknown;
  findUnique?: (args: UniqueScopedArgs) => unknown;
  update: (args: ScopedArgs) => unknown;
  updateMany: (args?: ScopedArgs) => unknown;
  delete: (args: ScopedArgs) => unknown;
  deleteMany: (args?: ScopedArgs) => unknown;
}

function withScope(args: ScopedArgs | undefined, propertyId: string) {
  return {
    ...args,
    where: {
      ...(args?.where ?? {}),
      propertyId,
      deletedAt: null,
    },
  };
}

function wrapDelegate(delegate: Delegate, propertyId: string) {
  return {
    findMany(args?: ScopedArgs) {
      return delegate.findMany(withScope(args, propertyId));
    },
    findFirst(args?: ScopedArgs) {
      return delegate.findFirst(withScope(args, propertyId));
    },
    async update(args: UniqueScopedArgs & { data?: unknown }) {
      const record = delegate.findUnique
        ? await delegate.findUnique({ where: args.where })
        : await delegate.findFirst(withScope({ where: args.where }, propertyId));

      if (!record || typeof record !== 'object') {
        throw new Error('Scoped update target not found');
      }

      const candidate = record as Record<string, unknown>;
      if (candidate['propertyId'] !== propertyId || candidate['deletedAt'] !== null) {
        throw new Error('Scoped update target is outside actor scope');
      }

      return delegate.update(args);
    },
    updateMany(args?: ScopedArgs) {
      return delegate.updateMany(withScope(args, propertyId));
    },
    async delete(args: UniqueScopedArgs) {
      const record = delegate.findUnique
        ? await delegate.findUnique({ where: args.where })
        : await delegate.findFirst(withScope({ where: args.where }, propertyId));

      if (!record || typeof record !== 'object') {
        throw new Error('Scoped delete target not found');
      }

      const candidate = record as Record<string, unknown>;
      if (candidate['propertyId'] !== propertyId || candidate['deletedAt'] !== null) {
        throw new Error('Scoped delete target is outside actor scope');
      }

      return delegate.delete(args);
    },
    deleteMany(args?: ScopedArgs) {
      return delegate.deleteMany(withScope(args, propertyId));
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
    auditLog: base.auditLog,
    idempotencyKey: base.idempotencyKey,
  };
}
