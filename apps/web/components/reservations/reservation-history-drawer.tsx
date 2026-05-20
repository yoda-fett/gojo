'use client';

import { useQuery } from '@tanstack/react-query';

import { Drawer } from '@/components/ui/drawer';
import { formatIST } from '@/lib/tz';
import type { ReservationHistoryEvent } from '@/lib/audit/reservation-history';

export function ReservationHistoryDrawer({
  reservationId,
  open,
  onClose,
}: {
  reservationId: string;
  open: boolean;
  onClose: () => void;
}) {
  const historyQuery = useQuery<ReservationHistoryEvent[]>({
    queryKey: ['reservation-history', reservationId],
    queryFn: async () => {
      const response = await fetch(`/api/reservations/${reservationId}/history`);
      if (!response.ok) throw new Error('Unable to load history');
      return ((await response.json()) as { events: ReservationHistoryEvent[] }).events;
    },
    enabled: open,
  });

  const events = historyQuery.data ?? [];

  let lastDay: string | null = null;

  return (
    <Drawer open={open} onClose={onClose} title="History" subtitle="Full event timeline · newest first" width={460}>
      {historyQuery.isLoading ? (
        <p className="text-[13px] text-[var(--color-mid-gray)]">Loading history…</p>
      ) : events.length === 0 ? (
        <p className="text-[13px] text-[var(--color-mid-gray)]">No events recorded yet.</p>
      ) : (
        <ol className="space-y-3">
          {events.map((event) => {
            const day = formatIST(event.createdAt, 'dd MMM yyyy');
            const showDivider = day !== lastDay;
            lastDay = day;
            return (
              <li key={event.id}>
                {showDivider ? (
                  <p className="mb-2 mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">
                    {day}
                  </p>
                ) : null}
                <div className="rounded-[10px] border border-[#e3ece9] bg-white px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[var(--color-charcoal)]">{event.label}</span>
                    <span className="font-mono text-[11px] text-[var(--color-mid-gray)]">
                      {formatIST(event.createdAt, 'HH:mm')}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--color-mid-gray)]">
                    {event.actorName} · {event.actorRole}
                  </p>
                  {event.summary && event.summary !== '—' ? (
                    <p className="mt-1 text-[12px] text-[var(--color-charcoal)]">{event.summary}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Drawer>
  );
}
