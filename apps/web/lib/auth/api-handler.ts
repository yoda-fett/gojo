import { AppError, type Actor, type Role } from '@gojo/types';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getActor } from './get-actor';
import { requireRole } from './require-role';

export function withAuth(
  handler: (req: NextRequest, actor: Actor) => Promise<Response>,
  roles?: Role | Role[],
) {
  return async (req: NextRequest) => {
    try {
      const actor = roles ? await requireRole(roles)(req) : await getActor(req);
      return await handler(req, actor);
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

      return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
    }
  };
}
