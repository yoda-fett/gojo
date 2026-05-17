import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { prisma, todayInIST } from '@gojo/db';

import { PwaShell } from '@/components/pwa-shell';
import { readHousekeepingActor } from '@/lib/auth';
import { formatIstDateLabel } from '@/lib/room-display';
import { HK_SHIFT_COOKIE } from '@/lib/shift-session';

export const dynamic = 'force-dynamic';

export default async function LaundryInPage() {
  const cookieStore = await cookies();
  const actor = await readHousekeepingActor(cookieStore);
  if (!actor) redirect('/sign-in');
  if (cookieStore.get(HK_SHIFT_COOKIE)?.value !== '1') redirect('/shift-start');

  const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } });
  const userInitial = user?.name?.trim()[0]?.toUpperCase() ?? 'S';

  return (
    <PwaShell title="Laundry In" dateLabel={formatIstDateLabel(todayInIST())} userInitial={userInitial}>
      <section style={{ margin: '0 16px', background: '#fff', border: '1px solid #E8EFEE', borderRadius: 14, padding: 18 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Vendor returns</p>
        <p style={{ color: '#5C7170', fontSize: 14, lineHeight: 1.5 }}>
          Receive clean linen back into the property pool by item type.
        </p>
        <Link className="hk-cta" href="/laundry/receive" style={{ marginTop: 14, display: 'grid', placeItems: 'center' }}>
          Open receive
        </Link>
      </section>
    </PwaShell>
  );
}
