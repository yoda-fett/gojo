// @ts-nocheck
import { ArrowLeft } from 'lucide-react';

import { BaseCard } from '@/components/ui/base-card';
import { Button } from '@/components/ui/button';
import { Topbar } from '@/components/layout/topbar';
import { StatusChip } from '@/components/reservations/status-chip';
import { ReservationDetailActions } from '@/components/reservations/reservation-detail-actions';
import { getServerActor } from '@/lib/auth/server-actor';
import { getReservationDetail } from '@/lib/services/reservation-service';
import { formatIST } from '@/lib/tz';
import { formatInr } from '@/lib/utils/currency';

type Context = { params: Promise<{ id: string }> };

export default async function ReservationDetailPage({ params }: Context) {
  const actor = await getServerActor();
  if (!actor || !['OWNER', 'MANAGER', 'FRONT_DESK'].includes(actor.role)) {
    return null;
  }

  const { id } = await params;
  const reservation = await getReservationDetail(actor, id);

  return (
    <div>
      <Topbar
        title={reservation.bookingReference}
        subtitle={`${reservation.guest.fullName} • Room ${reservation.room.number} • ${reservation.sourceLabel}`}
        controls={<Button variant="secondary" href="/reservations"><ArrowLeft className="mr-2 size-4" />Back</Button>}
      />
      <div className="space-y-4 px-4 py-[28px] sm:px-8">
        <BaseCard
          title="Reservation Overview"
          subtitle={`${formatIST(reservation.checkIn, 'dd MMM yyyy')} to ${formatIST(reservation.checkOut, 'dd MMM yyyy')}`}
          controls={<StatusChip status={reservation.status} />}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[10px] border border-[#edf3f1] bg-[#f7faf9] px-4 py-3">
                <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Guest</p>
                <p className="mt-2 text-[15px] font-semibold">{reservation.guest.fullName}</p>
                <p className="mt-1 text-[13px] text-[var(--color-mid-gray)]">{reservation.guest.phone}</p>
                {reservation.guest.idMasked ? <p className="mt-1 text-[13px] text-[var(--color-mid-gray)]">{reservation.guest.idType}: {reservation.guest.idMasked}</p> : null}
              </div>
              <div className="rounded-[10px] border border-[#edf3f1] bg-[#f7faf9] px-4 py-3">
                <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Stay</p>
                <p className="mt-2 text-[15px] font-semibold">Room {reservation.room.number}</p>
                <p className="mt-1 text-[13px] text-[var(--color-mid-gray)]">{reservation.room.roomType}</p>
                <p className="mt-1 text-[13px] text-[var(--color-mid-gray)]">Nightly rate: {formatInr(reservation.nightlyRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-[10px] border border-[#edf3f1] bg-[#f7faf9] px-4 py-3">
                <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Source</p>
                <p className="mt-2 text-[15px] font-semibold">{reservation.sourceLabel}</p>
                <p className="mt-1 text-[13px] text-[var(--color-mid-gray)]">Stored state: {reservation.rawStatus}</p>
              </div>
              <div className="rounded-[10px] border border-[#edf3f1] bg-[#f7faf9] px-4 py-3">
                <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Folio</p>
                <p className="mt-2 text-[15px] font-semibold">{reservation.folio?.invoiceNumber ?? 'Will be created on demand'}</p>
                <p className="mt-1 text-[13px] text-[var(--color-mid-gray)]">Balance due: {formatInr(reservation.folio?.balanceDue ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
            <BaseCard title="Actions" subtitle="Role-scoped front-desk controls for this booking." className="p-4">
              <ReservationDetailActions reservation={reservation} role={actor.role} />
            </BaseCard>
          </div>
        </BaseCard>

        {reservation.folio ? (
          <BaseCard title="Folio Summary" subtitle={`Status: ${reservation.folio.status}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">
                  <tr>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Description</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {reservation.folio.lines.map((line) => (
                    <tr key={line.id} className="border-t border-[#edf3f1]">
                      <td className="py-3">{line.postedAt.slice(0, 10)}</td>
                      <td>{line.description}</td>
                      <td>{line.chargeType}</td>
                      <td className="text-right">{formatInr(line.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BaseCard>
        ) : null}
      </div>
    </div>
  );
}
