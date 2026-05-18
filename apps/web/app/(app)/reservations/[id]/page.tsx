// @ts-nocheck
import { prisma } from '@gojo/db';
import { AUDIT_ACTION_LABELS } from '@gojo/types';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';
import { BaseCard } from '@/components/ui/base-card';
import { StatusChip } from '@/components/reservations/status-chip';
import { ReservationDetailActions } from '@/components/reservations/reservation-detail-actions';
import { getServerActor } from '@/lib/auth/server-actor';
import { getReservationDetail } from '@/lib/services/reservation-service';
import { formatAuditSummary } from '@/lib/audit/format-summary';
import { formatIST } from '@/lib/tz';
import { formatInr } from '@/lib/utils/currency';

type Context = { params: Promise<{ id: string }> };

const AUDIT_HISTORY_LIMIT = 20;

async function loadAuditHistory(propertyId: string, reservationId: string) {
  const rows = await prisma.auditLog.findMany({
    where: {
      propertyId,
      OR: [
        { entityType: 'RESERVATION', entityId: reservationId },
        { entityType: 'FOLIO_LINE', metadata: { path: ['reservationId'], equals: reservationId } as never },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: AUDIT_HISTORY_LIMIT,
  });

  const actorIds = Array.from(new Set(rows.map((r) => r.actorId).filter(Boolean)));
  const users = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, phone: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name ?? u.phone]));

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actorName: userMap.get(row.actorId) ?? 'System',
    actorRole: row.actorRole,
    createdAt: row.createdAt.toISOString(),
    summary: formatAuditSummary({
      action: row.action,
      metadata: row.metadata as Record<string, unknown> | null,
      fromState: row.fromState,
      toState: row.toState,
    }),
  }));
}

export default async function ReservationDetailPage({ params }: Context) {
  const actor = await getServerActor();
  if (!actor || !['OWNER', 'MANAGER', 'FRONT_DESK'].includes(actor.role)) {
    return null;
  }

  const { id } = await params;
  const reservation = await getReservationDetail(actor, id);
  const history = await loadAuditHistory(actor.propertyId, reservation.id);

  return (
    <PageShell
      header={
        <PageHeader
          variant="detail"
          eyebrow={[
            { label: 'Bookings', href: '/reservations' },
            { label: reservation.bookingReference },
          ]}
          back={{ href: '/reservations' }}
          title={reservation.bookingReference}
          subtitle={`${reservation.guest.fullName} · Room ${reservation.room.number} · ${reservation.sourceLabel}`}
          controls={<StatusChip status={reservation.status} />}
        />
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          <BaseCard
            title="Reservation Overview"
            subtitle={`${formatIST(reservation.checkIn, 'dd MMM yyyy')} to ${formatIST(reservation.checkOut, 'dd MMM yyyy')}`}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoTile label="Guest">
                <p className="text-[15px] font-semibold">{reservation.guest.fullName}</p>
                <p className="mt-1 text-[13px] text-[var(--color-mid-gray)]">{reservation.guest.phone}</p>
                {reservation.guest.idMasked ? (
                  <p className="mt-1 text-[13px] text-[var(--color-mid-gray)]">
                    {reservation.guest.idType}: {reservation.guest.idMasked}
                  </p>
                ) : null}
              </InfoTile>
              <InfoTile label="Stay">
                <p className="text-[15px] font-semibold">Room {reservation.room.number}</p>
                <p className="mt-1 text-[13px] text-[var(--color-mid-gray)]">{reservation.room.roomType}</p>
                <p className="mt-1 text-[13px] text-[var(--color-mid-gray)]">
                  Nightly rate: {formatInr(reservation.nightlyRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </InfoTile>
              <InfoTile label="Source">
                <p className="text-[15px] font-semibold">{reservation.sourceLabel}</p>
                <p className="mt-1 text-[13px] text-[var(--color-mid-gray)]">Stored state: {reservation.rawStatus}</p>
              </InfoTile>
              <InfoTile label="Folio">
                <p className="text-[15px] font-semibold">
                  {reservation.folio?.invoiceNumber ?? 'Will be created on demand'}
                </p>
                <p className="mt-1 text-[13px] text-[var(--color-mid-gray)]">
                  Balance due: {formatInr(reservation.folio?.balanceDue ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </InfoTile>
            </div>
          </BaseCard>

          {reservation.folio ? (
            <BaseCard title="Folio" subtitle={`Status: ${reservation.folio.status}`}>
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
                        <td className="text-right">
                          {formatInr(line.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </BaseCard>
          ) : null}
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          <BaseCard title="Actions" subtitle="Role-scoped front-desk controls">
            <ReservationDetailActions reservation={reservation} role={actor.role} />
          </BaseCard>

          <BaseCard title="History" subtitle={history.length ? `${history.length} events` : 'Nothing yet'}>
            {history.length === 0 ? (
              <p className="text-[13px] text-[var(--color-mid-gray)]">No audit events recorded for this booking.</p>
            ) : (
              <ol className="space-y-3">
                {history.map((event) => (
                  <li key={event.id} className="flex flex-col">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[var(--color-charcoal)]">
                        {AUDIT_ACTION_LABELS[event.action] ?? event.action}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--color-mid-gray)]">
                        {formatIST(event.createdAt, 'dd MMM HH:mm')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-[var(--color-mid-gray)]">
                      {event.actorName} · {event.actorRole}
                    </p>
                    {event.summary && event.summary !== '—' ? (
                      <p className="mt-1 text-[12.5px] text-[var(--color-charcoal)]">{event.summary}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </BaseCard>
        </div>
      </div>
    </PageShell>
  );
}

function InfoTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#edf3f1] bg-[#f7faf9] px-4 py-3">
      <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
