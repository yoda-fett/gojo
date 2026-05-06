'use client';

import { BaseCard } from '@/components/ui/base-card';
import { ExceptionAlertList } from '@/components/dashboard/exception-alert-list';

export function AlertPanel({ propertyId }: { propertyId: string }) {
  return (
    <BaseCard title="Alerts" subtitle="Conflicts, staleness, and issues to resolve first">
      <ExceptionAlertList propertyId={propertyId} />
    </BaseCard>
  );
}
