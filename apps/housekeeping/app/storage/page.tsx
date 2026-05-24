import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { PwaShell } from '@/components/pwa-shell';
import { StorageList, type StockItem } from '@/components/storage-list';
import { readHousekeepingActor } from '@/lib/auth';
import { bandForInStorage } from '@/lib/inventory-band';
import { HK_SHIFT_COOKIE } from '@/lib/shift-session';

export const dynamic = 'force-dynamic';

export default async function StoragePage() {
  const cookieStore = await cookies();
  const actor = await readHousekeepingActor(cookieStore);
  if (!actor) redirect('/sign-in');
  if (cookieStore.get(HK_SHIFT_COOKIE)?.value !== '1') redirect('/shift-start');

  const [items, user] = await Promise.all([
    prisma.catalogItem.findMany({
      where: { propertyId: actor.propertyId, itemType: 'LINEN', deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } }),
  ]);

  const userInitial = user?.name?.trim()[0]?.toUpperCase() ?? 'S';
  const stockItems: StockItem[] = items.map((item) => {
    const totalOwned = Number(item.totalOwned ?? 0);
    const inStorage = totalOwned;
    return {
      id: String(item.id),
      name: String(item.name),
      unit: String(item.unit),
      inStorage,
      linenCategory: (item.linenCategory ?? null) as 'ROUTINE' | 'PERIODIC' | null,
      band: bandForInStorage(inStorage, totalOwned),
    };
  });

  const snapshotLabel = `Updated ${new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(new Date())}`;

  return (
    <PwaShell title="Storage at a Glance" eyebrow="Storage" dateLabel={snapshotLabel} userInitial={userInitial}>
      <StorageList items={stockItems} snapshotLabel={snapshotLabel} />
    </PwaShell>
  );
}
