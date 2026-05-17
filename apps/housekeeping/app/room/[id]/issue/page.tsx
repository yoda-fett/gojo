// @ts-nocheck
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { IssueReportClient } from '@/components/issue/IssueReportClient';
import { readHousekeepingActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function RoomIssuePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) redirect('/sign-in');
  const { id } = await params;
  const room = await prisma.room.findFirst({ where: { id, propertyId: actor.propertyId, deletedAt: null }, select: { id: true } });
  if (!room) redirect('/');
  return <IssueReportClient returnHref={`/room/${id}`} context={{ entryContext: 'COLD', roomId: id }} />;
}
