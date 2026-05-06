// @ts-nocheck
import { prisma } from '@gojo/db';
import { addDays } from 'date-fns';

import { listAvailability, nightsBetween } from '@/lib/services/direct-booking';

import { BookingWidget } from './widget';

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export const dynamic = 'force-dynamic';

export default async function BookPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const property = await prisma.property.findFirst({ where: { bookingSlug: slug, deletedAt: null } });
  if (!property || !property.directBookingEnabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Direct booking is not available</h1>
          <p className="mt-2 text-sm text-slate-600">
            This property has not enabled direct booking. Please reach out to the property directly.
          </p>
        </div>
      </main>
    );
  }

  const today = new Date();
  const defaultCheckIn = sp.checkIn ?? today.toISOString().slice(0, 10);
  const defaultCheckOut = sp.checkOut ?? addDays(today, 1).toISOString().slice(0, 10);

  const availability = await listAvailability(
    slug,
    new Date(`${defaultCheckIn}T00:00:00+05:30`),
    new Date(`${defaultCheckOut}T00:00:00+05:30`),
  );

  const nights = nightsBetween(new Date(defaultCheckIn), new Date(defaultCheckOut));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">{property.name}</h1>
          <p className="text-sm text-slate-600">
            {property.address}, {property.city}
          </p>
        </header>
        <BookingWidget
          slug={slug}
          initialCheckIn={defaultCheckIn}
          initialCheckOut={defaultCheckOut}
          initialAvailability={availability}
          initialNights={nights}
        />
      </div>
    </main>
  );
}
