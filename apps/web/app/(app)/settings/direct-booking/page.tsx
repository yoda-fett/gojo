// @ts-nocheck
import { prisma } from '@gojo/db';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';
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
    <PageShell
      container="narrow"
      header={
        <PageHeader
          variant="minimal"
          eyebrow={[{ label: 'Settings', href: '/settings' }, { label: 'Direct Booking' }]}
          title="Direct Booking"
          subtitle="Enable a public booking widget so guests can book directly with no OTA commission."
        />
      }
    >
      <DirectBookingSettingsForm
        propertyId={property.id}
        initialEnabled={property.directBookingEnabled}
        initialRate={property.averageOtaCommissionRate}
        publicUrl={publicUrl}
      />
    </PageShell>
  );
}
