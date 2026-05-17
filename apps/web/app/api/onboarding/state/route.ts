// @ts-nocheck
import { getOnboardingState, prisma, updateOnboardingState } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';

// GET /api/onboarding/state — current cold-start progress + completion flag.
export const GET = withAuth(async (_req, actor) => {
  const state = await getOnboardingState(actor, prisma);
  return NextResponse.json(state);
}, 'OWNER');

const PatchBody = z
  .object({
    lastCompletedStep: z.number().int().min(0).max(7).optional(),
    draft: z.object({ step: z.string().min(1).max(64), data: z.unknown() }).optional(),
    skipped: z.boolean().optional(),
  })
  .refine(
    (b) => b.lastCompletedStep !== undefined || b.draft !== undefined || b.skipped !== undefined,
    { message: 'No onboarding-state fields provided' },
  );

// PATCH /api/onboarding/state — advance lastCompletedStep, persist a draft,
// or mark the first-login redirect skipped. Audited inside a transaction.
export const PATCH = withAuth(async (req, actor) => {
  const result = PatchBody.safeParse(await req.json());
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError('VALIDATION_ERROR', 'Invalid onboarding-state payload', 422, {
      details: { field: issue?.path.join('.') || 'body', reason: issue?.message },
    });
  }
  const state = await prisma.$transaction((tx) => updateOnboardingState(actor, tx, result.data));
  return NextResponse.json(state);
}, 'OWNER');
