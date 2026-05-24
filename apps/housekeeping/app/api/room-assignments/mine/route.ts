import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { dateFromKey } from '@gojo/db';
import { AppError } from '@gojo/types';

import { readHousekeepingActor } from '@/lib/auth';
import { loadMyDay } from '@/lib/load-my-day';

// Validates the optional ?date=YYYY-MM-DD query param. The downstream
// `loadMyDay` always computes "today" in the property's timezone (hotfix-6),
// so the parsed result is currently used only for validation.
function validateDateParam(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError('VALIDATION_ERROR', 'date must use yyyy-MM-dd', 422);
  return dateFromKey(value);
}

export async function GET(req: Request) {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  const dateParam = new URL(req.url).searchParams.get('date');
  validateDateParam(dateParam);

  const day = await loadMyDay(actor);
  return NextResponse.json({
    items: day.items,
    done: day.done,
    inProgress: day.inProgress,
    total: day.total,
  });
}
