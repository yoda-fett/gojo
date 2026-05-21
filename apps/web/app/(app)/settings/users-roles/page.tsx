// @ts-nocheck
import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';
import { maskPhone } from '@/lib/utils/mask-phone';

import { UsersRolesClient } from './_components/users-roles-client';

// Settings → Users and Roles (Story 12.7e). RSC loads the team rows and the
// actor's other-property access list (for the co-owner card). Mutations go
// through /api/properties/[id]/team + /[userId]. RBAC layout guard applies.
export default async function UsersRolesPage() {
  const actor = await getServerActor();
  if (!actor) return null;

  const [accessList, currentProperty, ownAccess] = await Promise.all([
    prisma.propertyAccess.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.property.findUnique({ where: { id: actor.propertyId }, select: { name: true, city: true, state: true } }),
    prisma.propertyAccess.findMany({
      where: { userId: actor.userId, deletedAt: null, revokedAt: null },
    }),
  ]);

  const ownPropertyIds = ownAccess.map((a) => a.propertyId);
  const ownProperties = await prisma.property.findMany({
    where: { id: { in: ownPropertyIds } },
    select: { id: true, name: true, city: true, state: true },
  });
  const propById = new Map(ownProperties.map((p) => [p.id, p]));

  // OWNER count per property (soft-deleted / revoked access excluded) — drives
  // the Owner vs Co-owner chip per row in the multi-property card.
  const ownerCounts = await prisma.propertyAccess.groupBy({
    by: ['propertyId'],
    where: { propertyId: { in: ownPropertyIds }, role: 'OWNER', deletedAt: null, revokedAt: null },
    _count: true,
  });
  const ownerCountByProp = new Map(ownerCounts.map((g) => [g.propertyId, g._count]));

  const users = await prisma.user.findMany({
    where: { id: { in: accessList.map((a) => a.userId) } },
    select: { id: true, name: true, phone: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const rows = accessList.map((a) => {
    const u = userById.get(a.userId);
    return {
      userId: a.userId,
      displayName: u?.name ?? null,
      phoneMasked: maskPhone(u?.phone ?? ''),
      role: a.role,
      status: a.status,
      isSelf: a.userId === actor.userId,
    };
  });

  const properties = ownAccess
    .map((a) => {
      const p = propById.get(a.propertyId);
      if (!p) return null;
      return {
        id: p.id,
        name: p.name,
        location: [p.city, p.state].filter(Boolean).join(', '),
        role: a.role,
        isCurrent: p.id === actor.propertyId,
        ownerCount: ownerCountByProp.get(p.id) ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <UsersRolesClient
      propertyId={actor.propertyId}
      propertyName={currentProperty?.name ?? 'this property'}
      initialRows={rows}
      properties={properties}
    />
  );
}
