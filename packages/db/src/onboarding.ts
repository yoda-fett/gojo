import { AppError, type Actor } from '@gojo/types';

import { writeAuditLog } from './audit-log.js';
import { Prisma } from './generated/client/index.js';
import type { DbClient } from './types.js';

/**
 * Cold-start onboarding wizard — server-side state helpers (Story 12.2).
 *
 * Wizard state lives on `Property.coldStartProgress` (JSON) + `Property.coldStartCompletedAt`.
 * Persisted server-side so resume works across devices (resumability NFR).
 */

export const COLD_START_STEPS = [
  'property-profile',
  'room-types',
  'rooms',
  'users-roles',
  'rate-management',
  'housekeeping-catalog',
  'direct-booking',
] as const;

export type ColdStartStep = (typeof COLD_START_STEPS)[number];

/** Total wizard steps shown in the progress indicator. */
export const COLD_START_TOTAL_STEPS = COLD_START_STEPS.length;

/**
 * Shape of `Property.coldStartProgress`.
 * - `lastCompletedStep` — highest step index (1-based) fully completed; 0 = none.
 * - `drafts` — per-step draft payloads, keyed by step name. `drafts.cursor`
 *   (number) holds the Save-&-exit resume position (AC6).
 * - `skipped` — true once the Owner has dismissed the first-login redirect (AC1).
 */
export interface ColdStartProgress {
  lastCompletedStep: number;
  drafts?: Record<string, unknown>;
  skipped?: boolean;
}

export interface OnboardingState {
  completed: boolean;
  completedAt: Date | null;
  progress: ColdStartProgress;
}

export interface OnboardingStatePatch {
  /** Advance the completed-step marker (monotonic — never moves backward). */
  lastCompletedStep?: number;
  /** Persist a per-step draft payload (Save & exit / Save & Continue draft semantics). */
  draft?: { step: string; data: unknown };
  /** Mark the first-login redirect as dismissed ("skip for now"). */
  skipped?: boolean;
}

const EMPTY_PROGRESS: ColdStartProgress = { lastCompletedStep: 0 };

function normalizeProgress(raw: unknown): ColdStartProgress {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PROGRESS };
  const value = raw as Partial<ColdStartProgress>;
  const progress: ColdStartProgress = {
    lastCompletedStep:
      typeof value.lastCompletedStep === 'number' ? value.lastCompletedStep : 0,
  };
  if (value.drafts && typeof value.drafts === 'object') progress.drafts = value.drafts;
  if (value.skipped === true) progress.skipped = true;
  return progress;
}

/** Read the current onboarding state for the actor's property. */
export async function getOnboardingState(
  actor: Actor,
  db: DbClient,
): Promise<OnboardingState> {
  const property = await db.property.findUnique({
    where: { id: actor.propertyId },
    select: { coldStartCompletedAt: true, coldStartProgress: true },
  });
  if (!property) throw new AppError('NOT_FOUND', 'Property not found', 404);

  return {
    completed: property.coldStartCompletedAt != null,
    completedAt: property.coldStartCompletedAt,
    progress: normalizeProgress(property.coldStartProgress),
  };
}

/**
 * Merge a patch into `coldStartProgress`. `lastCompletedStep` is monotonic.
 * Emits a `COLD_START_SKIPPED` audit entry the first time `skipped` flips true.
 * Throws CONFLICT if cold-start is already complete.
 */
export async function updateOnboardingState(
  actor: Actor,
  db: DbClient,
  patch: OnboardingStatePatch,
): Promise<OnboardingState> {
  const property = await db.property.findUnique({
    where: { id: actor.propertyId },
    select: { coldStartCompletedAt: true, coldStartProgress: true },
  });
  if (!property) throw new AppError('NOT_FOUND', 'Property not found', 404);
  if (property.coldStartCompletedAt) {
    throw new AppError('CONFLICT', 'Cold-start onboarding is already complete', 409);
  }

  const current = normalizeProgress(property.coldStartProgress);
  const next: ColdStartProgress = { ...current };

  if (patch.lastCompletedStep !== undefined) {
    // Monotonic — Save & Continue can only move forward.
    next.lastCompletedStep = Math.max(current.lastCompletedStep, patch.lastCompletedStep);
  }
  if (patch.draft) {
    next.drafts = { ...(current.drafts ?? {}), [patch.draft.step]: patch.draft.data };
  }
  if (patch.skipped !== undefined) {
    next.skipped = patch.skipped;
  }

  await db.property.update({
    where: { id: actor.propertyId },
    data: { coldStartProgress: next as unknown as Prisma.InputJsonValue },
  });

  if (patch.skipped === true && current.skipped !== true) {
    await writeAuditLog(db, actor, {
      action: 'COLD_START_SKIPPED',
      entityType: 'PROPERTY',
      entityId: actor.propertyId,
    });
  }

  return { completed: false, completedAt: null, progress: next };
}

/**
 * Finalize cold-start: stamp `coldStartCompletedAt`, clear `coldStartProgress`,
 * emit `COLD_START_COMPLETED`, and arm the First-Shift Reconciliation watcher.
 * Idempotent — a second call on an already-complete property is a no-op.
 */
export async function completeColdStart(
  actor: Actor,
  db: DbClient,
): Promise<OnboardingState> {
  const property = await db.property.findUnique({
    where: { id: actor.propertyId },
    select: { coldStartCompletedAt: true },
  });
  if (!property) throw new AppError('NOT_FOUND', 'Property not found', 404);

  if (property.coldStartCompletedAt) {
    return {
      completed: true,
      completedAt: property.coldStartCompletedAt,
      progress: { ...EMPTY_PROGRESS },
    };
  }

  const completedAt = new Date();
  await db.property.update({
    where: { id: actor.propertyId },
    data: { coldStartCompletedAt: completedAt, coldStartProgress: Prisma.DbNull },
  });
  await writeAuditLog(db, actor, {
    action: 'COLD_START_COMPLETED',
    entityType: 'PROPERTY',
    entityId: actor.propertyId,
  });
  await armFirstShiftReconciliation(actor, db);

  return { completed: true, completedAt, progress: { ...EMPTY_PROGRESS } };
}

/**
 * Story 12.6 seam — arm the one-time First-Shift Reconciliation watcher once
 * cold-start completes. Intentionally a no-op until Story 12.6 lands; the call
 * site in `completeColdStart` is already wired, so 12.6 only needs to fill this
 * body (e.g. stamp a `firstShiftReconciliationArmedAt` marker / enqueue a job).
 */
export async function armFirstShiftReconciliation(
  _actor: Actor,
  _db: DbClient,
): Promise<void> {
  // no-op — see Story 12.6
}
