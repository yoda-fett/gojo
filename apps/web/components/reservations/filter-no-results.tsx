import { Filter } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

export function FilterNoResults({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      icon={<Filter className="size-6" />}
      heading="No reservations match your filters"
      body="Try adjusting or removing a few filters to see more bookings."
      ctaLabel="Clear filters"
      onCtaClick={onClear}
    />
  );
}
