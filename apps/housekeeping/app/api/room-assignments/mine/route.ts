import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { istDateFromKey, todayInIST } from '@gojo/db';
import { AppError } from '@gojo/types';

import { readHousekeepingActor } from '@/lib/auth';
import { loadMyDay } from '@/lib/load-my-day';

function dateFromParam(value: string | null) {
  if (!value) return todayInIST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError('VALIDATION_ERROR', 'date must use yyyy-MM-dd', 422);
  return istDateFromKey(value);
}

export async function GET(req: Request) {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  const dateParam = new URL(req.url).searchParams.get('date');
  dateFromParam(dateParam);

  const day = await loadMyDay(actor);
  return NextResponse.json({
    items: day.items,
    done: day.done,
    inProgress: day.inProgress,
    total: day.total,
  });
}
