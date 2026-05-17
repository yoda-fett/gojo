import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';

import { SetPinInterstitial } from './set-pin-interstitial';

export default async function SetPinPage() {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');

  const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { pinHash: true } });
  if (user?.pinHash) redirect('/dashboard');

  return <SetPinInterstitial />;
}
