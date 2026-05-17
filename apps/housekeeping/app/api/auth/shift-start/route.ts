import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { readHousekeepingActor } from '@/lib/auth';
import { HK_SHIFT_COOKIE, shiftCookieOptions } from '@/lib/shift-session';

export async function POST() {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(HK_SHIFT_COOKIE, '1', shiftCookieOptions);
  return res;
}
