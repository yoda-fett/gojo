import { NextResponse } from 'next/server';

import { HK_SESSION_COOKIE } from '@/lib/auth';
import { HK_SHIFT_COOKIE, shiftCookieOptions } from '@/lib/shift-session';

const cleared = { ...shiftCookieOptions, maxAge: 0 };

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(HK_SESSION_COOKIE, '', cleared);
  res.cookies.set(HK_SHIFT_COOKIE, '', cleared);
  return res;
}
