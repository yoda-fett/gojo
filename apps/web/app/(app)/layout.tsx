import type { ReactNode } from 'react';

import { prisma } from '@gojo/db';

import { Sidebar, type SidebarProperty, type SidebarUser } from '@/components/layout/sidebar';
import { getServerActor } from '@/lib/auth/server-actor';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const actor = await getServerActor();

  let user: SidebarUser | undefined;
  let property: SidebarProperty | undefined;

  if (actor) {
    const [userRow, propertyRow] = await Promise.all([
      prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } }),
      prisma.property.findUnique({ where: { id: actor.propertyId }, select: { name: true, city: true, state: true } }),
    ]);

    if (userRow?.name) {
      user = { name: userRow.name, role: actor.role };
    }
    if (propertyRow) {
      const location = [propertyRow.city, propertyRow.state].filter(Boolean).join(', ') || null;
      property = { name: propertyRow.name, location };
    }
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
