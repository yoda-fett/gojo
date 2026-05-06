// @ts-nocheck
'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BookOpenText, Search } from 'lucide-react';

import { FilterBar } from '@/components/reservations/filter-bar';
import { FilterNoResults } from '@/components/reservations/filter-no-results';
import { ReservationListRow } from '@/components/reservations/reservation-list-row';
import { BaseCard } from '@/components/ui/base-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

type ReservationListPayload = {
  reservations: Array<{
    id: string;
    bookingReference: string;
    guestName: string;
    guestPhone: string;
    roomNumber: string;
    roomType: string;
    checkIn: string;
    checkOut: string;
    status: string;
    sourceLabel: string;
  }>;
  nextCursor: string | null;
  total: number;
};

function buildListUrl(params: URLSearchParams) {
  const query = params.toString();
  return `/api/reservations${query ? `?${query}` : ''}`;
}

export function ReservationWorkspace({
  role,
  initialFilters,
  roomTypes,
  initialData,
}: {
  role: 'OWNER' | 'MANAGER' | 'FRONT_DESK';
  initialFilters: Record<string, string | undefined>;
  roomTypes: Array<{ id: string; name: string }>;
  initialData: ReservationListPayload;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialFilters.q ?? '');
  const deferredQuery = useDeferredValue(query);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pages, setPages] = useState<ReservationListPayload[]>([initialData]);
  const activeStatuses = searchParams.getAll('status');
  const activeSources = searchParams.getAll('source');
  const activeRoomTypes = searchParams.getAll('roomType');
  const activeFrom = searchParams.get('from') ?? '';
  const activeTo = searchParams.get('to') ?? '';
  const hasFilters = Boolean(deferredQuery.length >= 2 || activeStatuses.length || activeSources.length || activeRoomTypes.length || activeFrom || activeTo);

  useEffect(() => {
    setPages([initialData]);
    setCursor(null);
  }, [initialData]);

  const params = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (!deferredQuery) next.delete('q');
    else next.set('q', deferredQuery);
    return next;
  }, [deferredQuery, searchParams]);

  const queryResult = useQuery({
    queryKey: ['reservations', role, params.toString()],
    queryFn: async () => {
      if (deferredQuery.length >= 2) {
        const response = await fetch(`/api/reservations/search?q=${encodeURIComponent(deferredQuery)}`);
        if (!response.ok) throw new Error('Unable to search reservations');
        return (await response.json()) as ReservationListPayload;
      }

      const response = await fetch(buildListUrl(params));
      if (!response.ok) throw new Error('Unable to load reservations');
      return (await response.json()) as ReservationListPayload;
    },
    initialData,
  });

  const activeData = deferredQuery.length >= 2 ? queryResult.data ?? initialData : {
    reservations: pages.flatMap((page) => page.reservations),
    nextCursor: pages[pages.length - 1]?.nextCursor ?? null,
    total: pages[0]?.total ?? 0,
  };

  async function loadMore() {
    const nextCursor = activeData.nextCursor ?? cursor;
    if (!nextCursor || deferredQuery.length >= 2) return;

    const nextParams = new URLSearchParams(params.toString());
    nextParams.set('cursor', nextCursor);
    const response = await fetch(buildListUrl(nextParams));
    if (!response.ok) return;
    const data = (await response.json()) as ReservationListPayload;
    setPages((current) => [...current, data]);
    setCursor(data.nextCursor);
  }

  function clearAllFilters() {
    setQuery('');
    router.replace('/reservations', { scroll: false });
  }

  return (
    <div className="space-y-4 px-4 py-[28px] sm:px-8">
      <BaseCard>
        <div className="flex items-start gap-3">
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#F4F9F8',
                border: '1px solid #E8EFEE',
                borderRadius: 8,
                padding: '8px 12px',
                width: 280,
                flexShrink: 0,
              }}
            >
              <Search size={14} strokeWidth={2} color="#9EAEAC" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by booking ref or guest name"
                style={{
                  border: 'none',
                  background: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: 13,
                  color: '#1A2B2E',
                }}
                className="placeholder:text-[#9EAEAC]"
              />
            </label>
            <FilterBar roomTypes={roomTypes} />
        </div>
      </BaseCard>

      <BaseCard title="Unified Reservation List" subtitle={`${activeData.total} reservations across all current sources`}>
        {activeData.reservations.length === 0 ? (
          hasFilters ? (
            <FilterNoResults onClear={clearAllFilters} />
          ) : (
            <EmptyState
              icon={<BookOpenText className="size-6" />}
              heading="No reservations yet"
              body="Create a walk-in to get your front-desk register moving."
              ctaLabel="Create walk-in"
              ctaHref="/reservations/new"
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">
                  <tr>
                    <th className="pb-3 pr-3">Booking</th>
                    <th className="pb-3 pr-3">Guest</th>
                    <th className="pb-3 pr-3">Room</th>
                    <th className="pb-3 pr-3">Stay</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeData.reservations.map((reservation) => (
                    <ReservationListRow key={reservation.id} reservation={reservation} role={role} />
                  ))}
                </tbody>
              </table>
            </div>
            {activeData.nextCursor && deferredQuery.length < 2 ? (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={loadMore}>Load more</Button>
              </div>
            ) : null}
          </>
        )}
      </BaseCard>
    </div>
  );
}
