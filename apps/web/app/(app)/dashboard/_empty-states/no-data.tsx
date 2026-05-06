import { Building2 } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

export function NewPropertyEmptyState() {
  return (
    <EmptyState
      icon={<Building2 className="size-6 text-[var(--color-teal)]" />}
      heading="Welcome to Gojo"
      body="Complete your property setup to unlock your live dashboard."
      ctaLabel="Complete setup"
      ctaHref="/settings/room-types"
    />
  );
}
