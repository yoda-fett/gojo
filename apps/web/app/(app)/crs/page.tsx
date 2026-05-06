// @ts-nocheck
import { addDays } from 'date-fns';

import { Topbar } from '@/components/layout/topbar';
import { CalendarGrid } from '@/app/(app)/crs/_components/calendar-grid';
import { DateNav } from '@/app/(app)/crs/_components/date-nav';
import { getServerActor } from '@/lib/auth/server-actor';
import { getCalendarWindow } from '@/lib/services/crs-service';
import { formatISTDateKey, todayIST } from '@/lib/tz';

function formatRangeLabel(from: string, to: string) {
  const parse = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  const fmtDayMonth = (date: Date) => date.toLocaleString('en-US', { day: '2-digit', month: 'short' });
  const fmtFull = (date: Date) => date.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const fromDate = parse(from);
  const toDate = parse(to);
  return `${fmtDayMonth(fromDate)} to ${fmtFull(toDate)}`;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CrsPage({ searchParams }: { searchParams?: SearchParams }) {
  const actor = await getServerActor();
  if (!actor || !['OWNER', 'MANAGER'].includes(actor.role)) {
    return null;
  }

  const params = (await searchParams) ?? {};
  const from = typeof params.from === 'string' ? params.from : todayIST();
  const to = typeof params.to === 'string' ? params.to : formatISTDateKey(addDays(new Date(`${from}T00:00:00+05:30`), 13));
  const data = await getCalendarWindow(actor.propertyId, from, to);

  return (
    <div>
      <Topbar
        title="CRS Calendar"
        subtitle={formatRangeLabel(from, to)}
        role={actor.role}
        controls={<DateNav from={from} to={to} />}
      />
      <div className="space-y-4 px-4 py-[28px] sm:px-8">
        <CalendarGrid rooms={data.rooms ?? []} from={from} to={to} />
      </div>
    </div>
  );
}
