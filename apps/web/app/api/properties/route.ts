// @ts-nocheck
// Hotfix 2 Phase C: self-serve property creation.
// Auth: signup_token cookie (with userId). Creates Property + PropertyAccess
// (OWNER) + Subscription (TRIAL, 120 days) in one transaction, schedules the
// conversion-arc jobs, swaps signup_token for real session cookies, and
// returns the new propertyId.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  prisma,
  scheduleConversionArcJobs,
} from '@gojo/db';
import { AppError, DEFAULT_CONVERSION_ARC_CONFIG } from '@gojo/types';

import { setSessionCookies } from '@/lib/auth/cookies';
import { REFRESH_TOKEN_MAX_AGE, signAccessToken } from '@/lib/auth/jwt';
import { createRefreshToken } from '@/lib/auth/refresh-token';
import { clearSignupTokenCookie, readSignupToken } from '@/lib/auth/signup-token';

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(80),
});

const TRIAL_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'property';
}

async function uniqueSlug(base: string): Promise<string> {
  // Try base, base-2, base-3, … until unique. Bounded loop.
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await prisma.property.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  // Fallback to a random suffix.
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: Request) {
  try {
    const token = await readSignupToken();
    if (!token?.userId) {
      throw new AppError('UNAUTHORIZED', 'Signup session missing or incomplete', 401);
    }

    const body = Body.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id: token.userId } });
    if (!user) {
      throw new AppError('UNAUTHORIZED', 'User not found for signup token', 401);
    }
    if (user.phone !== token.phone) {
      throw new AppError('UNAUTHORIZED', 'Signup token does not match user', 401);
    }

    const slug = await uniqueSlug(slugify(body.name));
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * DAY_MS);

    const property = await prisma.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: {
          name: body.name,
          slug,
          // Required-by-schema fields with sensible empty defaults; owner
          // completes them in cold-start.
          address: '',
          city: body.city,
          state: '',
          pincode: '',
          active: true,
          conversionArcConfig: DEFAULT_CONVERSION_ARC_CONFIG,
        },
      });
      await tx.propertyAccess.create({
        data: {
          propertyId: created.id,
          userId: token.userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });
      await tx.subscription.create({
        data: {
          propertyId: created.id,
          planKey: 'TRIAL',
          tier: 'TRIAL',
          status: 'TRIAL',
          billingCadence: 'MONTHLY',
          trialStartedAt: now,
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
        },
      });
      return created;
    });

    // Best-effort: schedule conversion-arc nudges. Queue may be unavailable in
    // local dev; the scheduler returns a reason and does not throw.
    try {
      await scheduleConversionArcJobs(prisma, property.id);
    } catch (err) {
      console.warn('[api/properties] scheduleConversionArcJobs failed:', err);
    }

    // Swap signup_token → real session cookies, now carrying propertyId + OWNER.
    const accessToken = await signAccessToken({
      userId: token.userId,
      propertyId: property.id,
      role: 'OWNER',
      lastActiveAt: Date.now(),
    });
    const refresh = createRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: token.userId,
        propertyId: property.id,
        tokenHash: refresh.tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
      },
    });
    await setSessionCookies(accessToken, refresh.rawToken);
    await clearSignupTokenCookie();

    return NextResponse.json({ propertyId: property.id });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { code: error.code, message: error.message, ...(error.details ?? {}) },
        { status: error.statusCode },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Invalid input' },
        { status: 422 },
      );
    }
    console.error('[api/properties POST] Unhandled:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
      { status: 500 },
    );
  }
}
