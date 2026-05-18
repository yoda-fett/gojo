'use client';

import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useTransition } from 'react';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'VOID', label: 'Void' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'B2C', label: 'B2C' },
  { value: 'B2B', label: 'B2B' },
  { value: 'CREDIT_NOTE', label: 'Credit Note' },
];

export function InvoiceFilterBar({ basePath }: { basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');

  useEffect(() => {
    setQ(params.get('q') ?? '');
  }, [params]);

  function patch(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => {
      router.replace(`${basePath}?${next.toString()}`, { scroll: false });
    });
  }

  const status = params.get('status') ?? '';
  const type = params.get('type') ?? '';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[var(--color-line-soft)] bg-white px-5 py-3 shadow-[0_1px_3px_rgba(26,43,46,0.05)]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-mid-gray)]">Filters</span>
      <label className="flex flex-1 min-w-[220px] max-w-[320px] items-center gap-2 rounded-[8px] border border-[var(--color-line-soft)] bg-[var(--color-off-white)] px-3 py-2">
        <Search className="size-3.5 text-[var(--color-mid-gray)]" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') patch({ q: q.trim() || null });
          }}
          onBlur={() => patch({ q: q.trim() || null })}
          placeholder="Search invoice / booking / guest"
          className="w-full bg-transparent text-[13px] text-[var(--color-charcoal)] outline-none placeholder:text-[var(--color-mid-gray)]"
        />
      </label>
      <div className="h-7 w-px bg-[var(--color-line-soft)]" aria-hidden="true" />
      <label className="inline-flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-mid-gray)]">Status</span>
        <select
          value={status}
          onChange={(e) => patch({ status: e.target.value || null })}
          className="rounded-[8px] border border-[var(--color-line-soft)] bg-white px-2.5 py-1 text-[13px] text-[var(--color-charcoal)] outline-none focus:border-[var(--color-teal)]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="inline-flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-mid-gray)]">Type</span>
        <select
          value={type}
          onChange={(e) => patch({ type: e.target.value || null })}
          className="rounded-[8px] border border-[var(--color-line-soft)] bg-white px-2.5 py-1 text-[13px] text-[var(--color-charcoal)] outline-none focus:border-[var(--color-teal)]"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
