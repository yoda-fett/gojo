'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';

import { ReservationDetailActions } from '@/components/reservations/reservation-detail-actions';
import { StatusChip } from '@/components/reservations/status-chip';
import { formatIST } from '@/lib/tz';
import { formatInr } from '@/lib/utils/currency';
import type { ReservationHistoryEvent } from '@/lib/audit/reservation-history';

type FolioLine = {
  id: string;
  postedAt: string;
  description: string;
  chargeType: string;
  amount: number;
};

type ReservationDetail = {
  id: string;
  bookingReference: string;
  status: string;
  rawStatus: string;
  source: string;
  sourceLabel: string;
  guest: { fullName: string; phone: string; email?: string | null; idMasked?: string | null; idType?: string | null };
  room: { number: string; floor?: number | null; roomType: string };
  nightlyRate: number;
  belowFloor: boolean;
  checkIn: string;
  checkOut: string;
  stateVersion: number;
  previousStayCount: number;
  cancellationPolicy: { name: string; description: string | null } | null;
  folio: {
    invoiceNumber: string;
    status: string;
    balanceDue: number;
    totalCharges: number;
    totalPayments: number;
    lines: FolioLine[];
  } | null;
};

const ACTION_BTN =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-[6px] border border-[#e8efee] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-charcoal)] transition hover:border-[var(--color-mid-gray)]';

const CARD_LINK =
  'cursor-pointer text-[12px] font-medium text-[var(--color-teal)] hover:text-[var(--color-teal-dark)]';

function dayCount(checkIn: string, checkOut: string) {
  return Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000));
}

function ordinalFloor(floor?: number | null) {
  if (floor === null || floor === undefined) return null;
  if (floor === 0) return 'Ground Floor';
  const suffix = floor % 10 === 1 && floor % 100 !== 11 ? 'st'
    : floor % 10 === 2 && floor % 100 !== 12 ? 'nd'
    : floor % 10 === 3 && floor % 100 !== 13 ? 'rd' : 'th';
  return `${floor}${suffix} Floor`;
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#f0f4f3] bg-white px-[18px] py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[var(--color-charcoal)]">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-r border-[#f4f9f8] pr-3.5 last:border-r-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--color-mid-gray)]">{label}</p>
      <p className="text-[14px] font-semibold text-[var(--color-charcoal)]">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-[var(--color-mid-gray)]">{sub}</p> : null}
    </div>
  );
}

function GuestField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <p className="mb-[3px] text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--color-mid-gray)]">{label}</p>
      {children}
    </div>
  );
}

export function ExpandedReservation({
  reservationId,
  role,
  onOpenHistory,
  onOpenFolio,
  onOpenAmend,
}: {
  reservationId: string;
  role: 'OWNER' | 'MANAGER' | 'FRONT_DESK';
  onOpenHistory: () => void;
  onOpenFolio: () => void;
  onOpenAmend: () => void;
}) {
  const detailQuery = useQuery<ReservationDetail>({
    queryKey: ['reservation-detail', reservationId],
    queryFn: async () => {
      const response = await fetch(`/api/reservations/${reservationId}`);
      if (!response.ok) throw new Error('Unable to load reservation');
      return (await response.json()) as ReservationDetail;
    },
  });

  const historyQuery = useQuery<ReservationHistoryEvent[]>({
    queryKey: ['reservation-history', reservationId],
    queryFn: async () => {
      const response = await fetch(`/api/reservations/${reservationId}/history`);
      if (!response.ok) throw new Error('Unable to load history');
      return ((await response.json()) as { events: ReservationHistoryEvent[] }).events;
    },
  });

  if (detailQuery.isLoading) {
    return <div className="bg-[#fafcfc] px-6 py-10 text-center text-[13px] text-[var(--color-mid-gray)]">Loading reservation…</div>;
  }
  if (detailQuery.isError || !detailQuery.data) {
    return <div className="bg-[#fafcfc] px-6 py-10 text-center text-[13px] text-[var(--color-coral)]">Could not load this reservation.</div>;
  }

  const r = detailQuery.data;
  const history = historyQuery.data ?? [];
  const folio = r.folio;
  const nights = dayCount(r.checkIn, r.checkOut);
  const total = r.nightlyRate * nights;

  let durationSub = '';
  if (r.rawStatus === 'CHECKED_IN') {
    const elapsed = Math.round((Date.now() - new Date(r.checkIn).getTime()) / 86_400_000) + 1;
    durationSub = `Night ${Math.min(Math.max(elapsed, 1), nights)} of ${nights}`;
  }

  const floorLabel = ordinalFloor(r.room.floor);

  return (
    <div className="bg-[#fafcfc] px-6 pb-6">
      {/* Sticky action toolbar */}
      <div className="sticky top-[var(--topbar-height)] z-[5] -mx-6 mb-4 flex items-center justify-between gap-4 border-b border-[#e8efee] bg-[#fafcfc] px-6 pb-3 pt-3.5">
        <div className="flex items-center gap-3">
          <span className="text-[18px] font-bold tracking-[-0.3px] text-[var(--color-charcoal)]">
            {r.guest.fullName} ·
            <span className="ml-2 text-xs font-medium text-[var(--color-mid-gray)]">
            {r.bookingReference}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <StatusChip status={r.status} />
            <span className="inline-flex items-center rounded-[4px] bg-[#e8f9f5] px-2 py-[3px] text-[12px] font-medium text-[var(--color-teal-dark)]">
              {r.sourceLabel}
            </span>
            {r.belowFloor ? (
              <span className="inline-flex items-center rounded-[4px] bg-[#fef0eb] px-2 py-[3px] text-[12px] font-medium text-[#a03a10]">
                Below floor price
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button type="button" className={ACTION_BTN} onClick={onOpenFolio}>
            <FileText className="size-3" />
            Open full folio
          </button>
          <ReservationDetailActions reservation={r} role={role} onAmend={onOpenAmend} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] items-start gap-5">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-4">
          <Card title="Stay Overview">
            <div className="grid grid-cols-4">
              <Tile label="Check-in" value={formatIST(r.checkIn, 'dd MMM yyyy')} sub={formatIST(r.checkIn, 'EEEE · h:mmaaa')} />
              <Tile label="Check-out" value={formatIST(r.checkOut, 'dd MMM yyyy')} sub={formatIST(r.checkOut, 'EEEE · h:mmaaa')} />
              <Tile label="Duration" value={`${nights} ${nights === 1 ? 'night' : 'nights'}`} sub={durationSub} />
              <Tile label="Guests" value="—" sub="Not recorded" />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-[8px] bg-[#f9fcfb] px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-[8px] bg-[#e8f9f5] text-[15px]">🛏</span>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--color-charcoal)]">{r.room.roomType}</p>
                  <p className="mt-px text-[11px] text-[var(--color-mid-gray)]">
                    Room {r.room.number}{floorLabel ? ` · ${floorLabel}` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-bold text-[var(--color-charcoal)]">{formatInr(r.nightlyRate)} / night</p>
                <p className="mt-px text-[11px] text-[var(--color-mid-gray)]">{r.sourceLabel} rate · {formatInr(total)} total</p>
              </div>
            </div>
          </Card>

          <Card
            title="Folio"
            action={
              folio ? (
                <button type="button" onClick={onOpenFolio} className={CARD_LINK}>
                  Open full folio →
                </button>
              ) : undefined
            }
          >
            {folio && folio.lines.length > 0 ? (
              <>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--color-mid-gray)]">
                      <th className="border-b border-[#f0f4f3] px-2.5 py-2 text-left" style={{ width: '46%' }}>Description</th>
                      <th className="border-b border-[#f0f4f3] px-2.5 py-2 text-left">Date</th>
                      <th className="border-b border-[#f0f4f3] px-2.5 py-2 text-left">Posted by</th>
                      <th className="border-b border-[#f0f4f3] px-2.5 py-2 text-right">Qty</th>
                      <th className="border-b border-[#f0f4f3] px-2.5 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {folio.lines.map((line) => {
                      const isPayment = line.amount < 0;
                      return (
                        <tr key={line.id} className={isPayment ? 'bg-[#f9fcfb]' : ''}>
                          <td className="border-b border-[#f4f9f8] px-2.5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`flex size-[22px] items-center justify-center rounded-[5px] text-[11px] ${isPayment ? 'bg-[#ebf4ff]' : 'bg-[#e8f9f5]'}`}>
                                {isPayment ? '💳' : '🛏'}
                              </span>
                              <span className="text-[12.5px] text-[var(--color-charcoal)]">{line.description}</span>
                            </div>
                          </td>
                          <td className="border-b border-[#f4f9f8] px-2.5 py-2.5 text-[12.5px] text-[var(--color-mid-gray)]">
                            {formatIST(line.postedAt, 'dd MMM')}
                          </td>
                          <td className="border-b border-[#f4f9f8] px-2.5 py-2.5 text-[12.5px] text-[var(--color-mid-gray)]">System</td>
                          <td className="border-b border-[#f4f9f8] px-2.5 py-2.5 text-right text-[12.5px] tabular-nums text-[var(--color-charcoal)]">
                            {isPayment ? '—' : '1'}
                          </td>
                          <td className={`border-b border-[#f4f9f8] px-2.5 py-2.5 text-right text-[12.5px] tabular-nums ${isPayment ? 'text-[var(--color-teal-dark)]' : 'text-[var(--color-charcoal)]'}`}>
                            {isPayment ? `−${formatInr(Math.abs(line.amount))}` : formatInr(line.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-2.5 flex items-center justify-between rounded-[8px] bg-[#f9fcfb] px-3.5 py-3">
                  <div>
                    <p className="text-[12px] font-semibold text-[var(--color-charcoal)]">Running balance</p>
                    <p className="mt-0.5 text-[10.5px] text-[var(--color-mid-gray)]">
                      Charges {formatInr(folio.totalCharges)} · Payments {formatInr(folio.totalPayments)}
                    </p>
                  </div>
                  <p className="text-[18px] font-bold tabular-nums text-[var(--color-teal)]">{formatInr(folio.balanceDue)}</p>
                </div>
              </>
            ) : (
              <p className="py-2 text-[12.5px] text-[var(--color-mid-gray)]">No folio charges yet — charges post at check-in.</p>
            )}
          </Card>

          <Card
            title="History"
            action={
              history.length > 0 ? (
                <button type="button" onClick={onOpenHistory} className={CARD_LINK}>
                  View full history →
                </button>
              ) : undefined
            }
          >
            {history.length === 0 ? (
              <p className="py-1 text-[12.5px] text-[var(--color-mid-gray)]">No events recorded yet.</p>
            ) : (
              <div>
                {history.slice(0, 3).map((event) => (
                  <div key={event.id} className="flex gap-2.5 border-b border-[#f4f9f8] py-2 last:border-b-0">
                    <span className="mt-[5px] size-[7px] flex-shrink-0 rounded-full bg-[var(--color-teal)]" />
                    <div>
                      <p className="text-[12.5px] leading-[1.4] text-[var(--color-charcoal)]">
                        {event.label}
                        {event.summary && event.summary !== '—' ? ` — ${event.summary}` : ''}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-[var(--color-mid-gray)]">
                        {event.actorName} · {formatIST(event.createdAt, 'dd MMM, h:mmaaa')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4">
          <Card title="Guest">
            <GuestField label="Name">
              <p className="text-[13px] font-medium text-[var(--color-charcoal)]">{r.guest.fullName}</p>
            </GuestField>
            <GuestField label="Mobile">
              <p className="text-[13px] font-medium text-[var(--color-charcoal)]">{r.guest.phone || '—'}</p>
            </GuestField>
            {r.guest.email ? (
              <GuestField label="Email">
                <p className="text-[13px] font-medium text-[var(--color-charcoal)]">{r.guest.email}</p>
              </GuestField>
            ) : null}
            {r.guest.idMasked ? (
              <GuestField label={r.guest.idType ?? 'Guest ID'}>
                <p className="text-[13px] font-medium text-[var(--color-charcoal)]">{r.guest.idMasked}</p>
              </GuestField>
            ) : null}
            <GuestField label="Stayed before">
              <p className={`text-[13px] ${r.previousStayCount > 0 ? 'font-medium text-[var(--color-charcoal)]' : 'italic text-[var(--color-mid-gray)]'}`}>
                {r.previousStayCount > 0
                  ? `${r.previousStayCount} previous ${r.previousStayCount === 1 ? 'stay' : 'stays'}`
                  : 'First visit'}
              </p>
            </GuestField>
          </Card>

          <Card title="Cancellation policy">
            {r.cancellationPolicy ? (
              <div className="text-[12.5px] leading-[1.5] text-[var(--color-charcoal)]">
                <span className="font-medium">{r.cancellationPolicy.name}</span>
                {r.cancellationPolicy.description ? <> — {r.cancellationPolicy.description}</> : null}
              </div>
            ) : (
              <p className="text-[12.5px] text-[var(--color-mid-gray)]">No cancellation policy set.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
