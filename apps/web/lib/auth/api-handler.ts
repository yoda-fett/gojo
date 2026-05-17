import { AppError, type Actor, type Role } from '@gojo/types';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getActor } from './get-actor';
import { requireRole } from './require-role';

export function withAuth(
  handler: (req: NextRequest, actor: Actor, context?: unknown) => Promise<Response>,
  roles?: Role | Role[],
) {
  return async (req: NextRequest, context?: unknown) => {
    try {
      const actor = roles ? await requireRole(roles)(req) : await getActor(req);
      return await handler(req, actor, context);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(
          {
            code: error.code,
            message: error.message,
            ...(error.details ?? {}),
          },
          { status: error.statusCode },
        );
      }

      console.error('[withAuth] Unhandled error:', error);
      return NextResponse.json(
        {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unexpected error',
        },
        { status: 500 },
      );
    }
  };
}
