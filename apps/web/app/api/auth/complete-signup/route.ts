// @ts-nocheck
// Hotfix 2 Phase B: NEW_USER branch — accepts the name captured on the right
// pane after OTP verify, creates the User row, refreshes the signup_token
// with userId, returns NO_PROPERTY (frontend then routes to
// /onboarding/create-property).

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import {
  readSignupToken,
  setSignupTokenCookie,
  signSignupToken,
} from '@/lib/auth/signup-token';

const Body = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function POST(req: Request) {
  try {
    const token = await readSignupToken();
    if (!token) {
      throw new AppError('UNAUTHORIZED', 'Signup session missing or expired', 401);
    }
    if (token.userId) {
      throw new AppError('VALIDATION_ERROR', 'Signup is already complete for this session', 409);
    }

    const body = Body.parse(await req.json());

    // Upsert to be safe under racy double-submit. Phone is unique.
    const user = await prisma.user.upsert({
      where: { phone: token.phone },
      update: { name: body.name },
      create: { phone: token.phone, name: body.name },
    });
    const userId = String(user.id);

    // Re-issue signup_token carrying userId so /api/properties can act.
    const next = await signSignupToken({ phone: token.phone, userId });
    await setSignupTokenCookie(next);

    return NextResponse.json({ status: 'NO_PROPERTY', userId });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { code: error.code, message: error.message, ...(error.details ?? {}) },
        { status: error.statusCode },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Invalid name' },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
      { status: 500 },
    );
  }
}
