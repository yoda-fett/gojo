import type { ReactNode } from 'react';

import { prisma } from '@gojo/db';

import { Sidebar, type SidebarProperty, type SidebarUser } from '@/components/layout/sidebar';
import { SuspensionNotice } from '@/components/subscription/suspension-notice';
import { getServerActor } from '@/lib/auth/server-actor';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const actor = await getServerActor();

  let user: SidebarUser | undefined;
  let property: SidebarProperty | undefined;

  let suspended = false;
  let suspendedPropertyName: string | null = null;

  if (actor) {
    const [userRow, propertyRow, subscription] = await Promise.all([
      prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } }),
      prisma.property.findUnique({ where: { id: actor.propertyId }, select: { name: true, city: true, state: true } }),
      prisma.subscription.findUnique({ where: { propertyId: actor.propertyId }, select: { status: true } }),
    ]);

    if (userRow?.name) {
      user = { name: userRow.name, role: actor.role };
    }
    if (propertyRow) {
      const location = [propertyRow.city, propertyRow.state].filter(Boolean).join(', ') || null;
      property = { name: propertyRow.name, location };
      suspendedPropertyName = propertyRow.name;
    }
    if (subscription?.status === 'SUSPENDED') {
      suspended = true;
    }
  }

  // Story 10.3 AC5: SUSPENDED subscription replaces all app content with the
  // full-screen reactivation notice. Auth and sidebar load were still done
  // above so the page renders without flicker if the Owner reactivates.
  if (suspended && actor) {
    return <SuspensionNotice propertyId={actor.propertyId} propertyName={suspendedPropertyName} />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-off-white)] xl:flex">
      <Sidebar
        {...(actor?.role ? { role: actor.role } : {})}
        {...(user ? { user } : {})}
        {...(property ? { property } : {})}
      />
      <main className="min-h-screen flex-1 xl:ml-[240px]">{children}</main>
    </div>
  );
}
