'use client';

import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export type PropertySwitcherOption = {
  propertyId: string;
  name: string;
  location: string | null;
  role: string;
};

interface Props {
  current: { name: string; location: string | null };
  currentPropertyId: string;
  options: PropertySwitcherOption[];
}

export function PropertySwitcher({ current, currentPropertyId, options }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasMultiple = options.length > 1;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function selectProperty(propertyId: string) {
    if (propertyId === currentPropertyId || switching) return;
    setSwitching(propertyId);
    const res = await fetch('/api/auth/select-property', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ propertyId }),
    });
    if (!res.ok) {
      setSwitching(null);
      return;
    }
    setOpen(false);
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative mx-3 mb-1 mt-3">
      <button
        type="button"
        onClick={() => hasMultiple && setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup={hasMultiple ? 'menu' : undefined}
        disabled={!hasMultiple}
        className="flex w-full items-center justify-between rounded-[8px] border border-white/[0.04] bg-white/[0.06] px-3 py-[10px] text-left transition-colors hover:bg-white/[0.08] disabled:cursor-default disabled:hover:bg-white/[0.06]"
      >
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-white">{current.name}</div>
          {current.location ? (
            <div className="mt-[1px] truncate text-[11px] text-[var(--color-mid-gray)]">
              {current.location}
            </div>
          ) : null}
        </div>
        {hasMultiple ? (
          <ChevronDown
            className="size-[10px] shrink-0 text-[var(--color-mid-gray)]"
            strokeWidth={2.5}
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            aria-hidden="true"
          />
        ) : null}
      </button>

      {open && hasMultiple ? (
        <div
          role="menu"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[60vh] overflow-y-auto rounded-[8px] border border-white/[0.06] bg-[#1F3033] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        >
          {options.map((opt) => {
            const active = opt.propertyId === currentPropertyId;
            const isSwitching = switching === opt.propertyId;
            return (
              <button
                key={opt.propertyId}
                type="button"
                role="menuitem"
                onClick={() => selectProperty(opt.propertyId)}
                disabled={active || Boolean(switching)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.05] disabled:hover:bg-transparent"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-white">{opt.name}</span>
                    {active ? (
                      <span className="rounded-[4px] bg-[var(--color-teal)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-[1px] truncate text-[11px] text-[var(--color-mid-gray)]">
                    {opt.location ? `${opt.location} · ` : ''}
                    <span className="capitalize">{opt.role.toLowerCase()}</span>
                  </div>
                </div>
                {isSwitching ? (
                  <span className="text-[10px] text-[var(--color-mid-gray)]">Switching…</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
