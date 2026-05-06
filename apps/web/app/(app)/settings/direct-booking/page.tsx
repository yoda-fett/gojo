// @ts-nocheck
import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';

import { DirectBookingSettingsForm } from './form';

export const dynamic = 'force-dynamic';

export default async function DirectBookingSettingsPage() {
  const actor = await getServerActor();
  if (!actor) return null;

  const property = await prisma.property.findFirst({
    where: { id: actor.propertyId, deletedAt: null },
  });
  if (!property) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const publicUrl = property.bookingSlug ? `${baseUrl}/book/${property.bookingSlug}` : null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Direct booking</h1>
      <p className="mt-1 text-sm text-slate-600">
        Enable a public booking widget so guests can book directly with no OTA commission.
      </p>
      <DirectBookingSettingsForm
        propertyId={property.id}
        initialEnabled={property.directBookingEnabled}
        initialRate={property.averageOtaCommissionRate}
        publicUrl={publicUrl}
      />
    </main>
  );
}
