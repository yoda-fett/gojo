'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PlaneLanding, PlaneTakeoff } from 'lucide-react';

import { BaseCard } from '@/components/ui/base-card';
import { formatInr } from '@/lib/format';

type HousekeepingRoom = {
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  state: string;
};

type HousekeepingResponse = {
  rooms: HousekeepingRoom[];
  counts: {
    total: number;
    needsCleaning: number;
    inProgress: number;
    cleanReady: number;
    outOfOrder: number;
  };
};

type ArrivalItem = {
  reservationId: string;
  bookingReference: string | null;
  guestName: string;
  roomNumber: string;
  roomTypeName: string;
  source: string;
  checkIn: string;
  status: string;
};

type DepartureItem = {
  reservationId: string;
  bookingReference: string | null;
  guestName: string;
  roomNumber: string;
  roomTypeName: string;
  folioTotal: number;
  checkOut: string;
  status: string;
};

// State buckets for the room grid. Anything not maintenance-flavoured and not
// occupied is treated as "vacant" — that's all the front-desk view needs.
type Bucket = 'occupied' | 'vacant' | 'maint';
function bucketFor(state: string): Bucket {
  if (state === 'OCCUPIED') return 'occupied';
  if (state === 'OUT_OF_ORDER' || state === 'MAINTENANCE') return 'maint';
  return 'vacant';
}

const BUCKET_STYLES: Record<Bucket, { tile: string; number: string; type: string }> = {
  occupied: {
    tile: 'bg-[#E8F4F1] border border-[#D5EAE5]',
    number: 'text-[#0A6B58]',
    type: 'text-[#0A6B58]/70',
  },
  vacant: {
    tile: 'bg-[#F4F9F8] border border-[#E8EFEE]',
    number: 'text-[var(--color-charcoal)]',
    type: 'text-[var(--color-mid-gray)]',
  },
  maint: {
    tile: 'bg-[#FEF8E2] border border-dashed border-[#E9C46A]',
    number: 'text-[var(--color-charcoal)]',
    type: 'text-[#8a6610]',
  },
};

function RoomStatusCard({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['operations-today-housekeeping', propertyId],
    queryFn: async () => {
      const res = await fetch('/api/housekeeping');
      if (!res.ok) throw new Error('Failed to load room status');
      return (await res.json()) as HousekeepingResponse;
    },
    refetchInterval: 30_000,
  });

  const rooms = data?.rooms ?? [];
  const total = rooms.length;
  const occupied = rooms.filter((r) => bucketFor(r.state) === 'occupied').length;
  const vacant = rooms.filter((r) => bucketFor(r.state) === 'vacant').length;
  const maint = rooms.filter((r) => bucketFor(r.state) === 'maint').length;
  const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <BaseCard className="h-full" title="Room Status" subtitle={total > 0 ? `${total} rooms · ${occupancyPct}% occupied` : 'No rooms configured'}>
      {isLoading ? (
        <div className="h-[260px] animate-pulse rounded-md bg-black/[0.04]" />
      ) : total === 0 ? null : (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
            <LegendDot color="#1DA888" label={`${occupied} Occupied`} />
            <LegendDot color="#D8E0DF" label={`${vacant} Vacant`} />
            <LegendDot color="#E9C46A" label={`${maint} Maint.`} />
          </div>
          <ul className="mt-4 grid grid-cols-4 gap-2.5">
            {rooms.map((room) => {
              const bucket = bucketFor(room.state);
              const styles = BUCKET_STYLES[bucket];
              return (
                <li
                  key={room.roomId}
                  className={`flex flex-col items-center justify-center rounded-[10px] py-3 ${styles.tile}`}
                >
                  <span className={`text-[15px] font-bold leading-tight ${styles.number}`}>{room.roomNumber}</span>
                  <span className={`mt-1 text-[9px] text-center font-medium uppercase tracking-[0.06em] ${styles.type}`}>
                    {bucket === 'maint' ? 'Maint.' : room.roomTypeName}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </BaseCard>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--color-charcoal)]">
      <span className="inline-block size-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '·'
  );
}

// ─── Arrivals / Departures shared bits ────────────────────────────────────

const SOURCE_LABEL: Record<string, string> = {
  WALK_IN: 'Walk-in',
  DIRECT_BOOKING: 'Direct',
  OTA: 'OTA',
};

function StatusPill({ tone, children }: { tone: 'green' | 'amber' | 'coral' | 'grey'; children: React.ReactNode }) {
  const styles: Record<typeof tone, string> = {
    green: 'bg-[rgba(29,168,136,0.12)] text-[#0A6B58]',
    amber: 'bg-[rgba(233,196,106,0.22)] text-[#8a6610]',
    coral: 'bg-[rgba(232,118,63,0.12)] text-[#C45A20]',
    grey: 'bg-[#EEF2F1] text-[var(--color-mid-gray)]',
  };
  return <span className={`inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11.5px] font-semibold ${styles[tone]}`}>{children}</span>;
}

function ListEmpty({ icon, heading, body }: { icon: React.ReactNode; heading: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-[#EAF4FA] text-[#3B7DB8]">{icon}</span>
      <p className="text-[14px] font-semibold text-[var(--color-charcoal)]">{heading}</p>
      <p className="mt-1 text-[12.5px] text-[var(--color-mid-gray)]">{body}</p>
    </div>
  );
}

function arrivalStatusPill(item: ArrivalItem) {
  if (item.status === 'CHECKED_IN') return <StatusPill tone="green">Checked In</StatusPill>;
  // For future ETA logic we could compare checkIn vs now; for now show Confirmed.
  const checkInDate = new Date(item.checkIn);
  const now = new Date();
  if (checkInDate.getTime() > now.getTime() + 60 * 60 * 1000) {
    const hh = checkInDate.toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true, timeZone: 'Asia/Kolkata' });
    return <StatusPill tone="amber">ETA {hh.replace(' ', '').toLowerCase()}</StatusPill>;
  }
  return <StatusPill tone="green">Confirmed</StatusPill>;
}

function ArrivalsCard({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['operations-today-arrivals', propertyId],
    queryFn: async () => {
      const res = await fetch('/api/front-desk/arrivals');
      if (!res.ok) throw new Error('Failed to load arrivals');
      return (await res.json()) as { items: ArrivalItem[] };
    },
    refetchInterval: 30_000,
  });

  const items = data?.items ?? [];
  const checkedIn = items.filter((i) => i.status === 'CHECKED_IN').length;
  
  return (
    <BaseCard
      className="h-full"
      title="Today's Arrivals"
      {...(items.length > 0 ? { subtitle: `${items.length} guests · ${checkedIn} checked in` } : {})}
      {...(items.length > 0 ? {
        controls: (
          <span className="inline-flex min-w-[28px] justify-center rounded-[6px] bg-[#E8F4F1] px-2 py-0.5 text-[12px] font-semibold text-[#0A6B58]">
            {items.length}
          </span>
        ),
      } : {})}
    >
      {isLoading ? (
        <div className="h-[200px] animate-pulse rounded-md bg-black/[0.04]" />
      ) : items.length === 0 ? (
        <ListEmpty
          icon={<PlaneLanding className="size-5" />}
          heading="No arrivals today"
          body="Walk-in reservations will appear here"
        />
      ) : (
        <ul className="divide-y divide-[#F4F9F8]">
          {items.slice(0, 6).map((item) => (
            <li key={item.reservationId}>
              <Link
                href={`/reservations/${item.reservationId}`}
                className="-mx-2 flex items-center justify-between gap-3 rounded-md px-1 py-2.5 hover:bg-[var(--color-off-white)]"
              >
                <div className="min-w-0">
                  <p className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EAF6F2] text-[12px] font-bold tracking-[0.04em] text-[#0A6B58]">
                  {initials(item.guestName)}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-[var(--color-charcoal)]">{item.guestName}</p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--color-mid-gray)]">
                    {item.roomNumber} · {item.roomTypeName} · {SOURCE_LABEL[item.source] ?? item.source} 
                  </p>
                </div>
                {arrivalStatusPill(item)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BaseCard>
  );
}

function DeparturesCard({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['operations-today-departures', propertyId],
    queryFn: async () => {
      const res = await fetch('/api/front-desk/departures');
      if (!res.ok) throw new Error('Failed to load departures');
      return (await res.json()) as { items: DepartureItem[] };
    },
    refetchInterval: 30_000,
  });

  const items = data?.items ?? [];
  const dueOut = items.filter((i) => i.status !== 'CHECKED_OUT').length;
  
  return (
    <BaseCard
      className="h-full"
      title="Today's Departures"
      {...(items.length > 0 ? { subtitle: `${items.length} guests · ${dueOut} pending checkout` } : {})}
      {...(items.length > 0 ? {
        controls: (
          <span className="inline-flex min-w-[28px] justify-center rounded-[6px] bg-[#EEF2F1] px-2 py-0.5 text-[12px] font-semibold text-[var(--color-mid-gray)]">
            {items.length}
          </span>
        ),
      } : {})}
    >
      {isLoading ? (
        <div className="h-[200px] animate-pulse rounded-md bg-black/[0.04]" />
      ) : items.length === 0 ? (
        <ListEmpty
          icon={<PlaneTakeoff className="size-5" />}
          heading="No departures today"
          body="All checked out — well done"
        />
      ) : (
        <ul className="divide-y divide-[#F4F9F8]">
          {items.slice(0, 6).map((item) => (
            <li key={item.reservationId}>
              <Link
                href={`/reservations/${item.reservationId}`}
                className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-[var(--color-off-white)]"
              >
                <div className="min-w-0">
                  <p className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EAF6F2] text-[12px] font-bold tracking-[0.04em] text-[#0A6B58]">
                  {initials(item.guestName)}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-[var(--color-charcoal)]">{item.guestName}</p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--color-mid-gray)]">
                    {item.roomNumber} · {item.roomTypeName} · {formatInr(item.folioTotal)}
                  </p>
                </div>
                {item.status === 'CHECKED_OUT' ? (
                  <StatusPill tone="grey">Checked Out</StatusPill>
                ) : (
                  <StatusPill tone="coral">Due Out</StatusPill>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BaseCard>
  );
}

export function OperationsToday({ propertyId }: { propertyId: string }) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch">
      <RoomStatusCard propertyId={propertyId} />
      <ArrivalsCard propertyId={propertyId} />
      <DeparturesCard propertyId={propertyId} />
    </section>
  );
}
