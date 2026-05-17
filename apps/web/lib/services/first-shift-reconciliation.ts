// @ts-nocheck
// Story 12.6 — First-Shift Reconciliation watcher.
//
// Flow:
//   1. A laundry-out write fires the post-write hook (call site:
//      `housekeeping-laundry.ts:logLaundryOut`).
//   2. The hook calls `runFirstShiftReconciliationIfReady(actor, tx)`.
//   3. Helper checks property eligibility (completed cold-start + not deferred
//      + not already reconciled) and sweep completeness (every today's
//      RoomAssignment row has a same-day ITEMS_OUT LaundryLog for its room).
//   4. If both pass, compute per-CatalogItem variance vs. the COLD_START
//      audit-log baseline and upsert a FIRST_SHIFT_RECONCILED alert.
//
// One-time only (AC6): the helper exits cleanly once `firstShiftReconciledAt`
// is set; Mark-reviewed in the review endpoint stamps it, so no re-firing.

import { prisma } from '@gojo/db';
import { startOfIstDayUtc } from '@/lib/tz';

export type VarianceRow = {
  catalogItemId: string;
  name: string;
  unit: string;
  linenCategory: string | null;
  totalOwned: number;
  declaredInRooms: number;
  observedInRooms: number;
  variance: number;
  variancePct: number;
  severity: 'CLEAN' | 'STANDARD' | 'SIGNIFICANT';
  suggestedAction: 'WRITE_OFF' | 'COUNTING_ERROR' | 'REDEPLOYMENT' | 'NONE';
};

/**
 * Pure suggested-action heuristic (Story 12.6, user-confirmed mapping
 * 2026-05-15). Sign + magnitude:
 *
 *   variance < 0                      → 'WRITE_OFF'      (item missing in property)
 *   variance === 0                    → 'NONE'           (clean row)
 *   variance > 0 AND pct <= 5         → 'COUNTING_ERROR' (declaration off by a hair)
 *   variance > 0 AND pct  > 5         → 'REDEPLOYMENT'   (allocation drifted)
 *
 * Percentage is over `totalOwned`; severity tiers are 0 / 1–10% / >10% per
 * the wireframe legend.
 */
export function classifyVariance(
  declared: number,
  observed: number,
  totalOwned: number,
): Pick<VarianceRow, 'variance' | 'variancePct' | 'severity' | 'suggestedAction'> {
  const variance = observed - declared;
  const variancePct = totalOwned > 0 ? Math.abs(variance) / totalOwned * 100 : 0;
  const severity: VarianceRow['severity'] =
    variance === 0 ? 'CLEAN' : variancePct > 10 ? 'SIGNIFICANT' : 'STANDARD';
  let suggestedAction: VarianceRow['suggestedAction'];
  if (variance === 0) suggestedAction = 'NONE';
  else if (variance < 0) suggestedAction = 'WRITE_OFF';
  else if (variancePct <= 5) suggestedAction = 'COUNTING_ERROR';
  else suggestedAction = 'REDEPLOYMENT';
  return { variance, variancePct, severity, suggestedAction };
}

/**
 * A property is "armed" for first-shift reconciliation iff cold-start is
 * complete, linen seeding was performed (not deferred), and no reconciliation
 * has yet been recorded.
 */
export function isArmed(p: { coldStartCompletedAt: Date | null; coldStartLinenDeferred: boolean | null; firstShiftReconciledAt: Date | null }): boolean {
  return !!p.coldStartCompletedAt && p.coldStartLinenDeferred !== true && !p.firstShiftReconciledAt;
}

/**
 * Sweep-complete: every today's RoomAssignment row has at least one
 * same-day ITEMS_OUT LaundryLog for the same room. Returns true if there is
 * at least one assignment AND every assignment's room is covered.
 *
 * Same-day is IST-anchored. Conservative: zero assignments returns false
 * (we don't want to fire reconciliation on a no-activity day).
 */
export async function isSweepComplete(tx: any, propertyId: string, now = new Date()): Promise<boolean> {
  const todayIst = startOfIstDayUtc(now);
  const tomorrowIst = new Date(todayIst);
  tomorrowIst.setUTCDate(tomorrowIst.getUTCDate() + 1);

  const assignments = await tx.roomAssignment.findMany({
    where: {
      propertyId,
      deletedAt: null,
      assignedDate: { gte: todayIst, lt: tomorrowIst },
    },
    select: { roomId: true },
  });
  if (assignments.length === 0) return false;

  const logs = await tx.laundryLog.findMany({
    where: {
      propertyId,
      state: 'ITEMS_OUT',
      deletedAt: null,
      cycleDate: { gte: todayIst, lt: tomorrowIst },
    },
    select: { roomId: true },
  });
  const loggedRooms = new Set(logs.map((l: any) => l.roomId));
  return assignments.every((a: any) => loggedRooms.has(a.roomId));
}

/**
 * Compute per-item variance rows. Declared baseline comes from the most
 * recent `COLD_START_LINEN_SEEDED` AuditLog entry per CatalogItem; observed
 * from the current sum of `RoomLinenState.qty`.
 */
export async function computeReconciliationRows(propertyId: string, tx: any = prisma): Promise<VarianceRow[]> {
  const [linens, states, baselineLogs] = await Promise.all([
    tx.catalogItem.findMany({
      where: { propertyId, itemType: 'LINEN', deletedAt: null },
    }),
    tx.roomLinenState.findMany({
      where: { propertyId, deletedAt: null },
      select: { catalogItemId: true, qty: true },
    }),
    tx.auditLog.findMany({
      where: { propertyId, action: 'COLD_START_LINEN_SEEDED', entityType: 'CATALOG_ITEM' },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const observedByItem = new Map<string, number>();
  for (const s of states) observedByItem.set(s.catalogItemId, (observedByItem.get(s.catalogItemId) ?? 0) + s.qty);

  const declaredByItem = new Map<string, number>();
  for (const log of baselineLogs) {
    if (declaredByItem.has(log.entityId)) continue; // most-recent wins (orderBy desc above)
    const meta = log.metadata as { inRooms?: number } | null;
    declaredByItem.set(log.entityId, Number(meta?.inRooms ?? 0));
  }

  const rows: VarianceRow[] = linens.map((l: any) => {
    const declaredInRooms = declaredByItem.get(l.id) ?? 0;
    const observedInRooms = observedByItem.get(l.id) ?? 0;
    const totalOwned = l.totalOwned ?? 0;
    const cls = classifyVariance(declaredInRooms, observedInRooms, totalOwned);
    return {
      catalogItemId: l.id,
      name: l.name,
      unit: l.unit,
      linenCategory: l.linenCategory ?? null,
      totalOwned,
      declaredInRooms,
      observedInRooms,
      ...cls,
    };
  });

  // Sort: SIGNIFICANT first, then STANDARD, then CLEAN; within tier by name.
  const sevRank = { SIGNIFICANT: 0, STANDARD: 1, CLEAN: 2 } as const;
  rows.sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || a.name.localeCompare(b.name));
  return rows;
}

const ALERT_TYPE = 'FIRST_SHIFT_RECONCILED';

/**
 * Hook entrypoint: called from the laundry-out post-write hook. Idempotent
 * (safe to call on every laundry log); returns silently if the property is
 * not yet armed or the sweep isn't complete. Alert dedup is by upsert on
 * (propertyId, alertType) — at most one open alert of this type.
 *
 * @gateExempt Post-auth background watcher — runs without an Owner mutation intent.
 */
export async function runFirstShiftReconciliationIfReady(actor: { propertyId: string; userId: string; role: string }, tx: any): Promise<void> {
  const property = await tx.property.findUnique({
    where: { id: actor.propertyId },
    select: { coldStartCompletedAt: true, coldStartLinenDeferred: true, firstShiftReconciledAt: true },
  });
  if (!property || !isArmed(property as any)) return;
  if (!(await isSweepComplete(tx, actor.propertyId))) return;

  const rows = await computeReconciliationRows(actor.propertyId, tx);
  const varianceCount = rows.filter((r) => r.severity !== 'CLEAN').length;
  const message = varianceCount === 0
    ? 'First-shift reconciliation ready — no variance detected.'
    : `First-shift reconciliation ready — ${varianceCount} item${varianceCount === 1 ? '' : 's'} with variance.`;

  // Upsert by (propertyId, alertType). No unique constraint on the model, so
  // we findFirst-then-create-or-update.
  const existing = await tx.alert.findFirst({
    where: { propertyId: actor.propertyId, alertType: ALERT_TYPE },
  });
  if (existing) {
    await tx.alert.update({
      where: { id: existing.id },
      data: { message, severity: 'MEDIUM', status: 'ACTIVE', dismissedAt: null, dismissedBy: null, resolvedAt: null },
    });
  } else {
    await tx.alert.create({
      data: {
        propertyId: actor.propertyId,
        alertType: ALERT_TYPE,
        severity: 'MEDIUM',
        status: 'ACTIVE',
        message,
        entityType: 'PROPERTY',
        entityId: actor.propertyId,
      },
    });
  }

  await tx.auditLog.create({
    data: {
      propertyId: actor.propertyId,
      entityType: 'PROPERTY',
      entityId: actor.propertyId,
      action: 'FIRST_SHIFT_RECONCILIATION_COMPUTED',
      actorId: actor.userId,
      actorRole: actor.role,
      metadata: { varianceCount, totalItemsCompared: rows.length },
    },
  });
}
