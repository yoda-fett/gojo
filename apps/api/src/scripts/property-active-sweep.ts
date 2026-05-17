// Hotfix 2 Phase E3 — weekly sweep.
// Flips `Property.active = false` when:
//   - No RefreshToken.createdAt newer than (now - 60 days) for any user with
//     active PropertyAccess on this property, AND
//   - Subscription is not SUSPENDED (SUSPENDED has its own full-screen gate).
//
// Idempotent. Re-running with the same state is a no-op. Owner login flips
// `active` back to true at the next OTP/PIN verify (see otp/verify route
// re-issue path) — wire that on next pass if not done.
//
// Run with: `pnpm --filter @gojo/api exec tsx src/scripts/property-active-sweep.ts`
// (or via cron in production).

import { prisma } from '@gojo/db';

const DORMANT_WINDOW_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

interface SweepResult {
  candidates: number;
  flipped: number;
  skippedSuspended: number;
  skippedActiveLogin: number;
}

export async function propertyActiveSweep(now: Date = new Date()): Promise<SweepResult> {
  const threshold = new Date(now.getTime() - DORMANT_WINDOW_DAYS * DAY_MS);

  const properties = await prisma.property.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true },
  });

  const result: SweepResult = {
    candidates: properties.length,
    flipped: 0,
    skippedSuspended: 0,
    skippedActiveLogin: 0,
  };

  for (const property of properties) {
    const sub = await prisma.subscription.findUnique({
      where: { propertyId: property.id },
      select: { status: true },
    });
    if (sub?.status === 'SUSPENDED') {
      result.skippedSuspended += 1;
      continue;
    }

    // Any active access user with a refresh token newer than threshold?
    const accesses = await prisma.propertyAccess.findMany({
      where: { propertyId: property.id, deletedAt: null, revokedAt: null, status: 'ACTIVE' },
      select: { userId: true },
    });
    const userIds = accesses.map((a) => String(a.userId));

    if (userIds.length === 0) {
      // No users at all — definitely dormant.
      await prisma.property.update({
        where: { id: property.id },
        data: { active: false, dormantAt: now },
      });
      result.flipped += 1;
      continue;
    }

    const recent = await prisma.refreshToken.findFirst({
      where: { userId: { in: userIds }, createdAt: { gt: threshold } },
      select: { id: true },
    });
    if (recent) {
      result.skippedActiveLogin += 1;
      continue;
    }

    await prisma.property.update({
      where: { id: property.id },
      data: { active: false, dormantAt: now },
    });
    result.flipped += 1;
  }

  return result;
}

// Allow direct invocation: `tsx src/scripts/property-active-sweep.ts`.
if (import.meta.url === `file://${process.argv[1]}`) {
  propertyActiveSweep()
    .then((r) => {
      console.log('[property-active-sweep]', r);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[property-active-sweep] failed', err);
      process.exit(1);
    });
}
