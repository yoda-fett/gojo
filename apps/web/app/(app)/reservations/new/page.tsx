// @ts-nocheck
import { prisma } from '@gojo/db';

import { Topbar } from '@/components/layout/topbar';
import { WalkInForm } from '@/components/reservations/walk-in-form';
import { getServerActor } from '@/lib/auth/server-actor';

export default async function NewWalkInPage() {
  const actor = await getServerActor();
  if (!actor || !['OWNER', 'MANAGER', 'FRONT_DESK'].includes(actor.role)) {
    return null;
  }

  const [roomTypes, cancellationPolicies] = await Promise.all([
    prisma.roomType.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.cancellationPolicy.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div>
      <Topbar title="Create Walk-in" subtitle="Add a front-desk booking and check the guest in immediately." />
      <div className="px-4 py-[28px] sm:px-8">
        <WalkInForm roomTypes={roomTypes.map((roomType) => ({ id: roomType.id, name: roomType.name, floorRate: Number(roomType.floorRate) }))} cancellationPolicies={cancellationPolicies.map((policy) => ({ id: policy.id, name: policy.name }))} />
      </div>
    </div>
  );
}
