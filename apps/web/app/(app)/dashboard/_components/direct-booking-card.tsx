'use client';
// @ts-nocheck
import { useQuery } from '@tanstack/react-query';

import { DirectBookingStatusCard } from '@/components/dashboard/direct-booking-status-card';

interface SummaryResponse {
  directBookingEnabled: boolean;
  bookingSlug: string | null;
  averageOtaCommissionRate: number;
  directBookingCount: number;
  estimatedCommissionSaved: number;
  recent: Array<{ id: string; bookingReference: string | null; checkIn: string; guestName: string }>;
}

export function DirectBookingCard({
  propertyId,
  from,
  to,
}: {
  propertyId: string;
  from: string;
  to: string;
}) {
  const { data } = useQuery({
    queryKey: ['direct-booking-summary', propertyId, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/direct-booking-summary?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Could not load direct booking summary');
      return (await res.json()) as SummaryResponse;
    },
  });

  if (!data) return null;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = data.bookingSlug ? `${baseUrl}/book/${data.bookingSlug}` : null;

  return (
    <DirectBookingStatusCard
      enabled={data.directBookingEnabled}
      bookingSlug={data.bookingSlug}
      publicUrl={publicUrl}
      recent={data.recent.map((r) => ({ ...r, checkIn: r.checkIn }))}
      directBookingCount={data.directBookingCount}
      estimatedCommissionSaved={data.estimatedCommissionSaved}
      averageOtaCommissionRate={data.averageOtaCommissionRate}
    />
  );
}
