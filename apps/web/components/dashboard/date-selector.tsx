'use client';

import { CalendarRange, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { DateRange, RangePreset } from '@/lib/dashboard/date-range';
import { buildRange } from '@/lib/dashboard/date-range';
import { cn } from '@/lib/utils';

const presets: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
];

const DEFAULT_STORAGE_KEY = 'gojo:dashboard:dateRange';

export function DateSelector({
  value,
  onChange,
  includeAdvanced = false,
  triggerClassName,
  valueClassName,
  defaultPreset = 'today',
  storageKey = DEFAULT_STORAGE_KEY,
}: {
  value?: DateRange;
  onChange: (next: DateRange) => void;
  includeAdvanced?: boolean;
  triggerClassName?: string;
  valueClassName?: string;
  defaultPreset?: RangePreset;
  storageKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    if (!value || typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(value));
  }, [value]);

  useEffect(() => {
    if (typeof window === 'undefined' || value) {
      return;
    }

    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      onChange(buildRange(defaultPreset));
      return;
    }

    try {
      onChange(JSON.parse(raw) as DateRange);
    } catch {
      onChange(buildRange(defaultPreset));
    }
  }, [onChange, value, defaultPreset, storageKey]);

  const current = value ?? buildRange(defaultPreset);
  const advanced = useMemo(() => (includeAdvanced ? [{ key: 'mtd' as const, label: 'MTD' }, { key: 'ytd' as const, label: 'YTD' }] : []), [includeAdvanced]);

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-[6px] border border-[#e8efee] bg-white px-2.5 py-[7px] text-[13px] font-medium text-[var(--color-charcoal)] hover:border-[#9eaeac]',
          triggerClassName,
        )}
        onClick={() => setOpen((value) => !value)}
        aria-label="Select date range"
      >
        <CalendarRange className="size-[13px]" strokeWidth={2} />
        <span className={valueClassName}>{current.label}</span>
        <ChevronDown className="size-[11px]" strokeWidth={2.5} />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[280px] rounded-[12px] border border-[#e8efee] bg-white p-3 shadow-[0_16px_32px_rgba(26,43,46,0.08)]">
          <div className="grid gap-2">
            {[...presets, ...advanced].map((preset) => {
              const next = buildRange(preset.key);
              return (
                <button
                  key={preset.key}
                  type="button"
                  className={cn(
                    'rounded-[8px] px-3 py-2 text-left text-[var(--color-charcoal)] hover:bg-[var(--color-off-white)]',
                    current.label === next.label && 'bg-[rgba(29,168,136,0.12)] font-semibold text-[var(--color-teal-dark)]',
                  )}
                  style={{ fontSize: 12 }}
                  onClick={() => {
                    onChange(next);
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
            <div className="mt-2 rounded-[10px] bg-[var(--color-off-white)] p-3" style={{ fontSize: 12 }}>
              <p className="mb-2 font-semibold uppercase tracking-[0.12em] text-[var(--color-mid-gray)]" style={{ fontSize: 12 }}>Custom range</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  type="date"
                  className="min-h-11 rounded-[6px] border border-[#d8e5e1] bg-white px-2 text-[12px] [&::-webkit-datetime-edit]:text-[12px] [&::-webkit-date-and-time-value]:text-[12px]"
                  style={{ fontSize: 12 }}
                />
                <input
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  type="date"
                  className="min-h-11 rounded-[6px] border border-[#d8e5e1] bg-white px-2 text-[12px] [&::-webkit-datetime-edit]:text-[12px] [&::-webkit-date-and-time-value]:text-[12px]"
                  style={{ fontSize: 12 }}
                />
              </div>
              <Button
                className="mt-3 w-full"
                style={{ fontSize: 12 }}
                onClick={() => {
                  if (!customFrom || !customTo || customFrom > customTo) {
                    return;
                  }
                  onChange({ from: customFrom, to: customTo, label: 'Custom range' });
                  setOpen(false);
                }}
              >
                Apply range
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
