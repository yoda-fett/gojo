// @ts-nocheck
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { getServerActor } from '@/lib/auth/server-actor';

// RBAC guard for the entire /settings route group (Story 12.7a AC5):
// Owner and Manager only — Front Desk / Housekeeping are redirected away.
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const actor = await getServerActor();
  if (!actor) {
    redirect('/sign-in');
  }
  if (actor.role !== 'OWNER' && actor.role !== 'MANAGER') {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
