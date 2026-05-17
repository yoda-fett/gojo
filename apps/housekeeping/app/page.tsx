import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { MyDayClient } from '@/components/my-day-client';
import { readHousekeepingActor } from '@/lib/auth';
import { loadMyDay } from '@/lib/load-my-day';
import { HK_SHIFT_COOKIE } from '@/lib/shift-session';

export const dynamic = 'force-dynamic';

export default async function MyDayPage() {
  const cookieStore = await cookies();
  const actor = await readHousekeepingActor(cookieStore);
  if (!actor) redirect('/sign-in');
  if (cookieStore.get(HK_SHIFT_COOKIE)?.value !== '1') redirect('/shift-start');

  const day = await loadMyDay(actor);
  const userInitial = day.userName.trim()[0]?.toUpperCase() ?? 'S';

  return (
    <MyDayClient
      dateLabel={day.dateLabel}
      userInitial={userInitial}
      items={day.items}
      done={day.done}
      inProgress={day.inProgress}
      total={day.total}
      propertyId={actor.propertyId}
    />
  );
}
