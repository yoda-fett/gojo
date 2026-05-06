// @ts-nocheck
import { prisma } from '@gojo/db';

import { Topbar } from '@/components/layout/topbar';
import { getServerActor } from '@/lib/auth/server-actor';

import { CostInputForm } from './_components/cost-input-form';

export default async function BreakEvenSetupPage() {
  const actor = await getServerActor();
  if (!actor || actor.role !== 'OWNER') {
    return null;
  }

  const property = await prisma.property.findFirst({
    where: { id: actor.propertyId, deletedAt: null },
    select: { costConfig: true },
  });

  return (
    <div>
      <Topbar
        title="Break-even Cost Setup"
        subtitle="Set your cost inputs to calculate how much you need to earn per room, per night to cover your costs."
        role={actor.role}
      />
      <div className="px-4 py-[28px] sm:px-8">
        <CostInputForm initialConfig={property?.costConfig ?? null} propertyId={actor.propertyId} />
      </div>
    </div>
  );
}
