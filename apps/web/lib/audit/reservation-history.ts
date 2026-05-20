// @ts-nocheck
import { prisma } from '@gojo/db';
import { AUDIT_ACTION_LABELS } from '@gojo/types';

import { formatAuditSummary } from '@/lib/audit/format-summary';

const RESERVATION_HISTORY_LIMIT = 50;

export type ReservationHistoryEvent = {
  id: string;
  action: string;
  label: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
  summary: string;
};

export async function loadReservationHistory(
  propertyId: string,
  reservationId: string,
): Promise<ReservationHistoryEvent[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      propertyId,
      OR: [
        { entityType: 'RESERVATION', entityId: reservationId },
        { entityType: 'FOLIO_LINE', metadata: { path: ['reservationId'], equals: reservationId } as never },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: RESERVATION_HISTORY_LIMIT,
  });

  const actorIds = Array.from(new Set(rows.map((row) => row.actorId).filter(Boolean)));
  const users = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, phone: true },
      })
    : [];
  const userMap = new Map(users.map((user) => [user.id, user.name ?? user.phone]));

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    label: AUDIT_ACTION_LABELS[row.action] ?? row.action,
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
