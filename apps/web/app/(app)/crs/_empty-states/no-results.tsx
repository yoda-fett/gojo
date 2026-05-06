'use client';

import { EmptyState } from '@/components/ui/empty-state';

export function NoCrsResultsEmptyState() {
  return (
    <EmptyState
      icon={<span>🔎</span>}
      heading="No results"
      body="Try adjusting your date range or filters."
      ctaLabel="Clear filters"
      onCtaClick={() => window.location.reload()}
    />
  );
}
