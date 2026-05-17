import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { ProfileClient } from '@/components/profile-client';
import { readHousekeepingActor } from '@/lib/auth';
import { loadMyDay } from '@/lib/load-my-day';
import { roomCardStatus } from '@/lib/room-display';
import { HK_SHIFT_COOKIE } from '@/lib/shift-session';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const actor = await readHousekeepingActor(cookieStore);
  if (!actor) redirect('/sign-in');
  if (cookieStore.get(HK_SHIFT_COOKIE)?.value !== '1') redirect('/shift-start');

  const [day, user] = await Promise.all([
    loadMyDay(actor),
    prisma.user.findUnique({ where: { id: actor.userId }, select: { pinHash: true } }),
  ]);
  const incomplete = day.items.filter((room) => roomCardStatus(room.housekeepingState) !== 'done');
  const userInitial = day.userName.trim()[0]?.toUpperCase() ?? 'S';

  return (
    <ProfileClient
      dateLabel={day.dateLabel}
      userInitial={userInitial}
      incomplete={incomplete}
      filedMissing={0}
      filedDamaged={0}
      hasPin={Boolean(user?.pinHash)}
    />
  );
}
