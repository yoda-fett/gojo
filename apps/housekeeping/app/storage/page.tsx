import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma, todayInIST } from '@gojo/db';

import { PwaShell } from '@/components/pwa-shell';
import { readHousekeepingActor } from '@/lib/auth';
import { bandForInStorage, bandLabel } from '@/lib/inventory-band';
import { formatIstDateLabel } from '@/lib/room-display';
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

  return (
    <PwaShell title="Storage" dateLabel={formatIstDateLabel(todayInIST())} userInitial={userInitial}>
      {items.map((item) => {
        const totalOwned = Number(item.totalOwned ?? 0);
        const inStorage = totalOwned;
        const band = bandForInStorage(inStorage, totalOwned);
        return (
          <article
            key={String(item.id)}
            style={{
              background: '#fff',
              border: '1px solid #E8EFEE',
              borderRadius: 14,
              padding: 14,
              margin: '0 16px 8px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{String(item.name)}</div>
              <div style={{ color: '#5C7170', fontSize: 12 }}>
                {inStorage} {String(item.unit)} in clean pool
              </div>
            </div>
            <span
              style={{
                alignSelf: 'center',
                borderRadius: 14,
                padding: '7px 10px',
                fontSize: 11,
                fontWeight: 700,
                background: band === 'EMPTY' ? '#F0F4F4' : band === 'LOW' ? '#FFF4EE' : '#EAF6F2',
                color: band === 'EMPTY' ? '#5C7170' : band === 'LOW' ? '#B65628' : '#16876C',
              }}
            >
              {bandLabel(band)}
            </span>
          </article>
        );
      })}
    </PwaShell>
  );
}
