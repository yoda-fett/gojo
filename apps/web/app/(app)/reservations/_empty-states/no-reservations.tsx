import { EmptyState } from '@/components/ui/empty-state';

export function NoReservationsEmptyState() {
  return (
    <EmptyState
      icon={<span>📅</span>}
      heading="No reservations yet"
      body="Walk-in reservations and bookings will appear here."
      ctaLabel="Create a walk-in"
      ctaHref="/reservations/new"
    />
  );
}
