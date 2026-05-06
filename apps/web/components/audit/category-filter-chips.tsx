'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const CHIPS: { key: string | null; label: string }[] = [
  { key: null, label: 'All Events' },
  { key: 'BOOKINGS', label: 'Bookings' },
  { key: 'BILLING', label: 'Billing' },
  { key: 'SETTINGS', label: 'Settings' },
];

export function CategoryFilterChips({ basePath }: { basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get('category');

  function apply(key: string | null) {
    const next = new URLSearchParams(params.toString());
    if (key) next.set('category', key);
    else next.delete('category');
    router.replace(`${basePath}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-mid-gray)]">
        Filter by
      </span>
      {CHIPS.map((chip) => {
        const isActive = (chip.key ?? null) === (active ?? null);
        return (
          <button
            key={chip.label}
            type="button"
            onClick={() => apply(chip.key)}
            className="rounded-full border px-3 py-1 text-[12px] font-medium transition-colors"
            style={
              isActive
                ? { borderColor: '#1DA888', background: 'rgba(29,168,136,0.12)', color: '#0A6B58' }
                : { borderColor: '#E8EFEE', background: '#fff', color: '#1A2B2E' }
            }
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
