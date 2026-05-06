// @ts-nocheck
import { prisma } from '@gojo/db';
import { redirect } from 'next/navigation';

import { PaymentForm } from './payment-form';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ holdId?: string; roomTypeId?: string }>;
};

export const dynamic = 'force-dynamic';

export default async function PaymentPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!sp.holdId || !sp.roomTypeId) redirect(`/book/${slug}`);

  const room = await prisma.room.findFirst({
    where: { holdRef: sp.holdId, state: 'HELD' },
  });
  if (!room || !room.holdExpiresAt || room.holdExpiresAt < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Hold expired</h1>
          <p className="mt-2 text-sm text-slate-600">Please start your booking again.</p>
          <a
            href={`/book/${slug}`}
            className="mt-4 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white"
          >
            Start again
          </a>
        </div>
      </main>
    );
  }

  const roomType = await prisma.roomType.findFirst({ where: { id: sp.roomTypeId, deletedAt: null } });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold text-slate-900">Confirm your booking</h1>
        <PaymentForm
          slug={slug}
          holdId={sp.holdId}
          roomTypeId={sp.roomTypeId}
          roomTypeName={roomType?.name ?? 'Room'}
          ratePerNight={Number(roomType?.baseRate ?? 0)}
          holdExpiresAt={room.holdExpiresAt.toISOString()}
        />
      </div>
    </main>
  );
}
