import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';

import { SecurityClient } from './security-client';

export default async function SecurityPage() {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { phone: true, pinHash: true },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-[var(--color-dark-gray)]">Security</h1>
      <SecurityClient phone={user?.phone ?? ''} hasPin={Boolean(user?.pinHash)} />
    </div>
  );
}
