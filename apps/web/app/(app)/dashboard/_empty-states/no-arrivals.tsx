import { CalendarX2 } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

export function NoArrivalsEmptyState() {
  return (
    <EmptyState
      icon={<CalendarX2 className="size-6 text-[var(--color-teal)]" />}
      heading="No arrivals today"
      body="Walk-in reservations and check-ins will appear here."
      ctaLabel="Create a walk-in"
      ctaHref="/reservations/new"
    />
  );
}
