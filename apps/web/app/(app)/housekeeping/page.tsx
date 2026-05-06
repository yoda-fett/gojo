// @ts-nocheck
import { redirect } from 'next/navigation';

import { getServerActor } from '@/lib/auth/server-actor';

import { HousekeepingClient } from './housekeeping-client';

export const dynamic = 'force-dynamic';

export default async function HousekeepingPage() {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');
  return <HousekeepingClient />;
}
