// @ts-nocheck
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { CleanTaskClient } from '@/components/task-client';
import { readHousekeepingActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function CleanPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) redirect('/sign-in');
  const { id } = await params;
  const room = await prisma.room.findFirst({ where: { id, propertyId: actor.propertyId, deletedAt: null } });
  if (!room) redirect('/');
  return <CleanTaskClient room={room} photoRequired={false} />;
}
