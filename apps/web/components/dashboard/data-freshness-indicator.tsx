'use client';

import { cn } from '@/lib/utils';

function Dot({ className }: { className: string }) {
  return <span className={cn('inline-flex size-2 rounded-full', className)} aria-hidden="true" />;
}

export function DataFreshnessIndicator({ lastPollAt, isFailing }: { lastPollAt: Date | null; isFailing: boolean }) {
  const stale = isFailing || (!!lastPollAt && Date.now() - lastPollAt.getTime() > 2 * 60 * 1000);

  return (
    <div className="hidden shrink-0 items-center gap-4 rounded-[8px] border border-[#e8efee] bg-white px-3 py-2 text-[12px] text-[var(--color-mid-gray)] lg:flex">
      <span className="inline-flex items-center gap-2 whitespace-nowrap"><Dot className="bg-[var(--color-mid-gray)]" /> OTA: Pending SSE</span>
      <span className="inline-flex items-center gap-2 whitespace-nowrap"><Dot className={stale ? 'bg-[var(--color-coral)]' : 'bg-[var(--color-teal)]'} /> Ops: {stale ? 'Data may be stale' : lastPollAt ? 'Live' : 'Loading'}</span>
      <span className="inline-flex items-center gap-2 whitespace-nowrap"><Dot className="bg-[var(--color-teal)]" /> Config: Current</span>
    </div>
  );
}
