// @ts-nocheck
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma, todayInIST } from '@gojo/db';

import { ProfileClient } from '@/components/profile-client';
import { readHousekeepingActor } from '@/lib/auth';
import { signEvidenceUrl } from '@/lib/issue-evidence-storage';
import { loadMyDay } from '@/lib/load-my-day';
import { roomCardStatus } from '@/lib/room-display';
import { HK_SHIFT_COOKIE } from '@/lib/shift-session';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const cookieStore = await cookies();
  const actor = await readHousekeepingActor(cookieStore);
  if (!actor) redirect('/sign-in');
  if (cookieStore.get(HK_SHIFT_COOKIE)?.value !== '1') redirect('/shift-start');

  const params = await searchParams;
  const toastParam = Array.isArray(params.toast) ? params.toast[0] : params.toast;

  const todayStart = todayInIST();
  const [day, user, todayReports, rooms] = await Promise.all([
    loadMyDay(actor),
    prisma.user.findUnique({ where: { id: actor.userId }, select: { pinHash: true, name: true } }),
    // Today's issue reports by this staff member — now full payload so the
    // "Today's reports" section can show actual cards with playback + thumb.
    prisma.issueReport.findMany({
      where: {
        propertyId: actor.propertyId,
        reportedBy: actor.userId,
        reportedAt: { gte: todayStart },
        deletedAt: null,
      },
      orderBy: { reportedAt: 'desc' },
      select: {
        id: true,
        category: true,
        textNote: true,
        voiceFileUrl: true,
        voiceSeconds: true,
        photoFileUrl: true,
        reportedAt: true,
        roomId: true,
        status: true,
      },
    }),
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { id: true, number: true },
    }),
  ]);

  const incomplete = day.items.filter((room) => roomCardStatus(room.housekeepingState) !== 'done');
  const userName = String(user?.name ?? day.userName ?? 'Staff');
  const userInitial = userName.trim()[0]?.toUpperCase() ?? 'S';

  const roomNumberById = new Map(rooms.map((r) => [r.id, r.number]));

  // Sign URLs server-side so the client gets ready-to-play / display URLs.
  const reports = await Promise.all(
    todayReports.map(async (r) => {
      const [voiceUrl, photoUrl] = await Promise.all([
        signEvidenceUrl(r.voiceFileUrl).catch(() => null),
        signEvidenceUrl(r.photoFileUrl).catch(() => null),
      ]);
      return {
        id: r.id,
        category: r.category,
        textNote: r.textNote,
        voiceUrl,
        voiceSeconds: r.voiceSeconds,
        photoUrl,
        reportedAt: r.reportedAt.toISOString(),
        roomNumber: r.roomId ? roomNumberById.get(r.roomId) ?? null : null,
        status: r.status,
      };
    }),
  );

  let filedMissing = 0;
  let filedDamaged = 0;
  for (const r of todayReports) {
    if (r.category === 'MISSING_ITEM') filedMissing += 1;
    else if (r.category === 'DAMAGED_RETURN') filedDamaged += 1;
  }

  return (
    <ProfileClient
      dateLabel={day.dateLabel}
      userInitial={userInitial}
      userName={userName}
      allRooms={day.items}
      incomplete={incomplete}
      filedMissing={filedMissing}
      filedDamaged={filedDamaged}
      hasPin={Boolean(user?.pinHash)}
      reports={reports}
      toast={toastParam ?? null}
    />
  );
}
