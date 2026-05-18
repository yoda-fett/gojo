'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { BaseCard } from '@/components/ui/base-card';
import { Chip } from '@/components/ui/chip';
import { formatISTTime } from '@/lib/tz';

type RoomStatusCounts = {
  total: number;
  inHouse: number;
  vacantClean: number;
  dirty: number;
  outOfOrder: number;
};

type ArrivalItem = {
  reservationId: string;
  bookingReference: string | null;
  guestName: string;
  checkIn: string;
  status: string;
};

type DepartureItem = {
  reservationId: string;
  bookingReference: string | null;
  guestName: string;
  checkOut: string;
  status: string;
};

type HousekeepingResponse = {
  rooms: Array<{ roomId: string; state: string }>;
  counts: {
    total: number;
    needsCleaning: number;
    inProgress: number;
    cleanReady: number;
    outOfOrder: number;
  };
};

const SEGMENT_COLORS = {
  inHouse: 'var(--color-teal)',
  vacantClean: '#9EAEAC',
  dirty: 'var(--color-amber)',
  outOfOrder: 'var(--color-coral)',
} as const;

function todayEyebrow(): string {
  return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function StackedSegment({ value, total, color }: { value: number; total: number; color: string }) {
  if (total === 0 || value === 0) return null;
  const pct = (value / total) * 100;
  return <div style={{ width: `${pct}%`, background: color }} aria-hidden="true" />;
}

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

  const counts: RoomStatusCounts = (() => {
    const rooms = data?.rooms ?? [];
    const c = data?.counts;
    const inHouse = rooms.filter((r) => r.state === 'OCCUPIED').length;
    return {
      total: c?.total ?? 0,
      inHouse,
      vacantClean: c?.cleanReady ?? 0,
      dirty: c?.needsCleaning ?? 0,
      outOfOrder: c?.outOfOrder ?? 0,
    };
  })();

  return (
    <BaseCard title="Room Status" subtitle={`Today, ${todayEyebrow()}`}>
      {isLoading ? (
        <div className="h-[120px] animate-pulse rounded-md bg-black/[0.04]" />
      ) : counts.total === 0 ? (
        <p className="text-[13px] text-[var(--color-mid-gray)]">No rooms configured.</p>
      ) : (
        <div>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-[28px] font-bold leading-none text-[var(--color-charcoal)]">{counts.inHouse}</span>
            <span className="text-[13px] text-[var(--color-mid-gray)]">/ {counts.total} in-house</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-[var(--color-off-white)]">
            <StackedSegment value={counts.inHouse} total={counts.total} color={SEGMENT_COLORS.inHouse} />
            <StackedSegment value={counts.vacantClean} total={counts.total} color={SEGMENT_COLORS.vacantClean} />
            <StackedSegment value={counts.dirty} total={counts.total} color={SEGMENT_COLORS.dirty} />
            <StackedSegment value={counts.outOfOrder} total={counts.total} color={SEGMENT_COLORS.outOfOrder} />
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-y-2 text-[12.5px]">
            <LegendRow color={SEGMENT_COLORS.inHouse} label="In-house" value={counts.inHouse} />
            <LegendRow color={SEGMENT_COLORS.vacantClean} label="Vacant clean" value={counts.vacantClean} />
            <LegendRow color={SEGMENT_COLORS.dirty} label="Dirty" value={counts.dirty} />
            <LegendRow color={SEGMENT_COLORS.outOfOrder} label="Out of order" value={counts.outOfOrder} />
          </ul>
          <Link
            href="/front-desk"
            className="mt-4 inline-flex text-[12.5px] font-semibold text-[var(--color-teal-dark)]"
          >
            Open Front Desk →
          </Link>
        </div>
      )}
    </BaseCard>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
      <span className="text-[var(--color-charcoal)]">{label}</span>
      <span className="ml-auto font-medium text-[var(--color-charcoal)]">{value}</span>
    </li>
  );
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
  return (
    <BaseCard title="Today's Arrivals" subtitle={`Today, ${todayEyebrow()}`}>
      {isLoading ? (
        <div className="h-[120px] animate-pulse rounded-md bg-black/[0.04]" />
      ) : items.length === 0 ? (
        <p className="text-[13px] text-[var(--color-mid-gray)]">No arrivals today.</p>
      ) : (
        <div className="space-y-2.5">
          {items.slice(0, 5).map((item) => (
            <Link
              key={item.reservationId}
              href={`/reservations/${item.reservationId}`}
              className="-mx-2 grid grid-cols-[60px_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-[var(--color-off-white)]"
            >
              <span className="font-mono text-[12px] text-[var(--color-mid-gray)]">
                {formatISTTime(item.checkIn)}
              </span>
              <span className="truncate text-[13px] font-medium text-[var(--color-charcoal)]">{item.guestName}</span>
              <Chip variant={item.status === 'CHECKED_IN' ? 'positive' : 'neutral'}>
                {item.status === 'CHECKED_IN' ? 'In' : 'Due'}
              </Chip>
            </Link>
          ))}
          {items.length > 5 ? (
            <Link href="/reservations" className="inline-flex text-[12.5px] font-semibold text-[var(--color-teal-dark)]">
              View all {items.length} →
            </Link>
          ) : null}
        </div>
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
  return (
    <BaseCard title="Today's Departures" subtitle={`Today, ${todayEyebrow()}`}>
      {isLoading ? (
        <div className="h-[120px] animate-pulse rounded-md bg-black/[0.04]" />
      ) : items.length === 0 ? (
        <p className="text-[13px] text-[var(--color-mid-gray)]">No departures today.</p>
      ) : (
        <div className="space-y-2.5">
          {items.slice(0, 5).map((item) => (
            <Link
              key={item.reservationId}
              href={`/reservations/${item.reservationId}`}
              className="-mx-2 grid grid-cols-[60px_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-[var(--color-off-white)]"
            >
              <span className="font-mono text-[12px] text-[var(--color-mid-gray)]">
                {formatISTTime(item.checkOut)}
              </span>
              <span className="truncate text-[13px] font-medium text-[var(--color-charcoal)]">{item.guestName}</span>
              <Chip variant={item.status === 'CHECKED_OUT' ? 'positive' : 'neutral'}>
                {item.status === 'CHECKED_OUT' ? 'Out' : 'Due'}
              </Chip>
            </Link>
          ))}
          {items.length > 5 ? (
            <Link href="/reservations" className="inline-flex text-[12.5px] font-semibold text-[var(--color-teal-dark)]">
              View all {items.length} →
            </Link>
          ) : null}
        </div>
      )}
    </BaseCard>
  );
}

export function OperationsToday({ propertyId }: { propertyId: string }) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <RoomStatusCard propertyId={propertyId} />
      <ArrivalsCard propertyId={propertyId} />
      <DeparturesCard propertyId={propertyId} />
    </section>
  );
}
