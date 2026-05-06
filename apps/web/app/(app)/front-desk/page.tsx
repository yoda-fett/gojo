// @ts-nocheck
import { redirect } from 'next/navigation';

import { getServerActor } from '@/lib/auth/server-actor';

import { FrontDeskClient } from './front-desk-client';

export const dynamic = 'force-dynamic';

export default async function FrontDeskPage() {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');
  return <FrontDeskClient />;
}
