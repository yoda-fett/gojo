'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { ErrorMessage } from '@/components/ui/error-message';
import { formatIST } from '@/lib/tz';

const severityStyles = {
  HIGH: 'bg-[var(--color-coral)]',
  MEDIUM: 'bg-[var(--color-amber)]',
  LOW: 'bg-[var(--color-mid-gray)]',
} as const;

export function ExceptionAlertList({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['dashboard-alerts', propertyId];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch('/api/dashboard/alerts');
      if (!response.ok) throw new Error('Unable to load alerts');
      return (await response.json()) as { alerts: { id: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; message: string; entityId?: string; createdAt: string }[]; total: number };
    },
    refetchInterval: 30_000,
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/alerts/${id}/dismiss`, { method: 'POST' });
      if (!response.ok) throw new Error('Unable to dismiss alert');
      return (await response.json()) as { ok: boolean };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current: { alerts: { id: string }[]; total: number } | undefined) => {
        if (!current) return current;
        return {
          alerts: current.alerts.filter((alert) => alert.id !== id),
          total: Math.max(0, current.total - 1),
        };
      });
      return { previous };
    },
    onError: (_error, _id, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
    },
  });

  if (query.isError) {
    return <ErrorMessage line1="Alerts are unavailable" line2="Gojo is retrying in the background" line3="Try refreshing in a moment" />;
  }

  const alerts = query.data?.alerts ?? [];

  if (alerts.length === 0) {
    return <p className="text-[13px] font-medium text-[var(--color-teal)]">All clear — no active alerts</p>;
  }

  return (
    <div className="space-y-3">
      {alerts.slice(0, 5).map((alert) => (
        <div key={alert.id} className="border-b border-[#edf3f1] pb-3 last:border-b-0 last:pb-0">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex items-center gap-2 text-[12px] font-medium text-[var(--color-mid-gray)]">
              <span className={`inline-flex size-2 rounded-full ${severityStyles[alert.severity]}`} aria-hidden="true" />
              <span>{alert.severity === 'HIGH' ? 'High' : alert.severity === 'MEDIUM' ? 'Medium' : 'Low'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-[var(--color-charcoal)]">{alert.message}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-mid-gray)]">
                <span>{formatIST(alert.createdAt, 'dd MMM, hh:mm a')}</span>
                {alert.entityId ? <Link href={`/reservations/${alert.entityId}`} className="font-semibold text-[var(--color-teal-dark)]">View →</Link> : null}
              </div>
            </div>
            <button type="button" aria-label="Dismiss alert" onClick={() => dismiss.mutate(alert.id)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] text-[var(--color-mid-gray)] hover:bg-[var(--color-off-white)]">
              <X className="size-4" />
            </button>
          </div>
        </div>
      ))}
      {(query.data?.total ?? 0) > 5 ? <Link href="/alerts" className="inline-flex text-[13px] font-semibold text-[var(--color-teal-dark)]">View all alerts →</Link> : null}
    </div>
  );
}
