import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ShiftStartClient } from '@/components/shift-start-client';
import { readHousekeepingActor } from '@/lib/auth';
import { loadMyDay } from '@/lib/load-my-day';
import { HK_SHIFT_COOKIE } from '@/lib/shift-session';

export const dynamic = 'force-dynamic';

export default async function ShiftStartPage() {
  const cookieStore = await cookies();
  const actor = await readHousekeepingActor(cookieStore);
  if (!actor) redirect('/sign-in');
  if (cookieStore.get(HK_SHIFT_COOKIE)?.value === '1') redirect('/');

  const day = await loadMyDay(actor);

  return (
    <ShiftStartClient
      userName={day.userName}
      propertyName={day.propertyName}
      dateLabel={day.dateLabel}
      roomsAssigned={day.total}
    />
  );
}
