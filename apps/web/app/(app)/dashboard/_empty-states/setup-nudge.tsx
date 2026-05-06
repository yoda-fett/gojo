import { EmptyState } from '@/components/ui/empty-state';

export function SetupNudge() {
  return (
    <EmptyState
      icon={<span>🏨</span>}
      heading="Welcome to Gojo"
      body="Set up your property to start accepting reservations."
      ctaLabel="Add a room type"
      ctaHref="/settings/room-types"
    />
  );
}
