'use client';

import { useQuery } from '@tanstack/react-query';

import { SetupChecklist } from './setup-checklist';

type SetupStatus = {
  roomTypesConfigured: boolean;
  cancellationPoliciesConfigured: boolean;
  teamInvited: boolean;
  minimumSetupComplete: boolean;
};

export function SetupChecklistLoader({ propertyId }: { propertyId: string }) {
  const query = useQuery<SetupStatus>({
    queryKey: ['setup-status', propertyId],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${propertyId}/setup-status`);
      return response.json() as Promise<SetupStatus>;
    },
    refetchInterval: (query) => (query.state.data?.minimumSetupComplete ? false : 5000),
  });

  if (!query.data) {
    return null;
  }

  return <SetupChecklist setupStatus={query.data} />;
}
