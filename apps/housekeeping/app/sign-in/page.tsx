import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { SignInClient } from '@/components/sign-in-client';
import { readHousekeepingActor } from '@/lib/auth';
import { HK_SHIFT_COOKIE } from '@/lib/shift-session';

export default async function SignInPage() {
  const cookieStore = await cookies();
  const actor = await readHousekeepingActor(cookieStore);
  if (actor) {
    redirect(cookieStore.get(HK_SHIFT_COOKIE)?.value === '1' ? '/' : '/shift-start');
  }
  return <SignInClient />;
}
