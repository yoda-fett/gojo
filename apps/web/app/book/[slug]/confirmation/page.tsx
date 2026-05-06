// @ts-nocheck
import { prisma } from '@gojo/db';

import { formatIST } from '@/lib/tz';

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ orderId?: string }> };

export const dynamic = 'force-dynamic';

export default async function ConfirmationPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!sp.orderId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-600">Missing order id.</p>
      </main>
    );
  }

  const pp = await prisma.pendingPayment.findUnique({ where: { gatewayOrderId: sp.orderId } });
  if (!pp || !pp.reservationId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Payment processing</h1>
          <p className="mt-2 text-sm text-slate-600">Please wait a moment for confirmation.</p>
        </div>
      </main>
    );
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: pp.reservationId },
    include: { },
  });
  const roomType = reservation
    ? await prisma.roomType.findUnique({ where: { id: reservation.roomTypeId } })
    : null;
  const property = await prisma.property.findUnique({ where: { id: pp.propertyId } });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl bg-white shadow-sm">
          <div className="rounded-t-2xl bg-teal-600 px-6 py-4 text-white">
            <h1 className="text-lg font-semibold">Booking confirmed</h1>
          </div>
          <div className="space-y-3 px-6 py-5 text-sm text-slate-700">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Reference</p>
              <p className="text-xl font-semibold text-slate-900">{reservation?.bookingReference}</p>
            </div>
            <p>{property?.name} · {property?.city}</p>
            <p>Guest: {pp.guestName}</p>
            <p>Room type: {roomType?.name}</p>
            <p>Check-in: {formatIST(pp.checkIn)}</p>
            <p>Check-out: {formatIST(pp.checkOut)}</p>
            <p className="border-t border-slate-100 pt-3 text-base font-semibold text-slate-900">
              Paid: ₹{Number(pp.amount).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
        <a href={`/book/${slug}`} className="mt-4 block text-center text-sm text-slate-500">
          Make another booking
        </a>
      </div>
    </main>
  );
}
