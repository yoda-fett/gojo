import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { prisma, todayInTz } from '@gojo/db';

import { readHousekeepingActor } from '@/lib/auth';
import { formatIstDateLabel } from '@/lib/room-display';

export async function GET() {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  // hotfix-6: load property timezone first so "today" is computed in the
  // property's local tz (not hardcoded IST). Then run the dependent count.
  const [user, property] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } }),
    prisma.property.findUnique({ where: { id: actor.propertyId }, select: { name: true, timezone: true } }),
  ]);
  const tz = String(property?.timezone ?? 'Asia/Kolkata');
  const assignedDate = todayInTz(tz);
  const count = await prisma.roomAssignment.count({
    where: { propertyId: actor.propertyId, staffUserId: actor.userId, assignedDate, deletedAt: null },
  });

  return NextResponse.json({
    userName: user?.name ?? 'Staff',
    propertyName: property?.name ?? 'Property',
    roomCount: count,
    dateLabel: formatIstDateLabel(assignedDate),
  });
}
