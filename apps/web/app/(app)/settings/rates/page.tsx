// @ts-nocheck
import { prisma } from '@gojo/db';

import { Topbar } from '@/components/layout/topbar';
import { getServerActor } from '@/lib/auth/server-actor';

import { RateConfigCard } from './_components/rate-config-card';

export default async function RateManagementPage() {
  const actor = await getServerActor();
  if (!actor || actor.role !== 'OWNER') {
    return null;
  }

  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: actor.propertyId, deletedAt: null },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <Topbar
        title="Rate Management"
        subtitle="Set guardrails for each room type and compare them against your live break-even guidance."
        role={actor.role}
      />
      <div className="space-y-4 px-4 py-[16px] sm:px-8">
        {roomTypes.map((roomType) => (
          <RateConfigCard key={roomType.id} roomType={roomType} />
        ))}
      </div>
    </div>
  );
}
