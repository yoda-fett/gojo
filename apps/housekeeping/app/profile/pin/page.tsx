import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { PinSetClient } from '@/components/pin-set-client';
import { readHousekeepingActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProfilePinPage() {
  const cookieStore = await cookies();
  const actor = await readHousekeepingActor(cookieStore);
  if (!actor) redirect('/sign-in');

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { pinHash: true },
  });

  return <PinSetClient hasPin={Boolean(user?.pinHash)} />;
}
