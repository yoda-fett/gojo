import { EmptyState } from '@/components/ui/empty-state';

export function NoChannelsEmptyState() {
  return (
    <EmptyState
      icon={<span>🔌</span>}
      heading="No channels connected"
      body="Connect an OTA channel to sync reservations automatically."
      ctaLabel="Connect your first channel"
      ctaHref="/channels/connect"
    />
  );
}
