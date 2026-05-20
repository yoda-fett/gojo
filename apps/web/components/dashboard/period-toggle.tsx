'use client';

import { CalendarRange, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { buildRange, type DateRange, type RangePreset } from '@/lib/dashboard/date-range';

type Props = {
  value: DateRange;
  onChange: (next: DateRange) => void;
};

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'mtd', label: 'MTD' },
  { key: 'ytd', label: 'YTD' },
];

function matchPreset(from: string, to: string): RangePreset | 'custom' {
  for (const preset of PRESETS) {
    const range = buildRange(preset.key);
    if (range.from === from && range.to === to) return preset.key;
  }
  return 'custom';
}

function shortLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PeriodToggle({ value, onChange }: Props) {
  const active = matchPreset(value.from, value.to);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(active === 'custom' ? value.from : '');
  const [customTo, setCustomTo] = useState(active === 'custom' ? value.to : '');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDocClick(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [pickerOpen]);

  function applyPreset(key: RangePreset) {
    onChange(buildRange(key));
  }

  function applyCustom(fromStr: string, toStr: string) {
    if (!fromStr || !toStr || fromStr > toStr) return;
    onChange({ from: fromStr, to: toStr, label: 'Custom range' });
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div
        style={{
          display: 'flex',
          background: '#F0F5F4',
          borderRadius: 7,
          padding: 3,
          gap: 2,
        }}
      >
        {PRESETS.map((preset) => {
          const isActive = active === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.key)}
              style={{
                padding: '5px 12px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                background: isActive ? '#fff' : 'transparent',
                color: isActive ? '#1A2B2E' : '#9EAEAC',
                boxShadow: isActive ? '0 1px 2px rgba(26,43,46,0.08)' : 'none',
              }}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          style={{
            padding: '5px 12px',
            borderRadius: 5,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            border: 'none',
            background: active === 'custom' ? '#fff' : 'transparent',
            color: active === 'custom' ? '#1A2B2E' : '#9EAEAC',
            boxShadow: active === 'custom' ? '0 1px 2px rgba(26,43,46,0.08)' : 'none',
          }}
        >
          Custom
        </button>
      </div>

      <div ref={popoverRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            padding: '7px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            border: '1px solid #E8EFEE',
            background: '#fff',
            color: '#1A2B2E',
          }}
          className="hover:!border-[#1DA888] hover:!text-[#1DA888]"
        >
          <CalendarRange size={13} strokeWidth={2} aria-hidden="true" />
          {`${shortLabel(value.from)} – ${shortLabel(value.to)}`}
          <ChevronDown size={11} strokeWidth={2.5} aria-hidden="true" />
        </button>
        {pickerOpen ? (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              zIndex: 30,
              width: 280,
              background: '#fff',
              border: '1px solid #E8EFEE',
              borderRadius: 10,
              boxShadow: '0 16px 32px rgba(26,43,46,0.10)',
              padding: 14,
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9EAEAC', marginBottom: 8 }}>
              Custom range
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ borderRadius: 6, border: '1px solid #D8E5E1', padding: '8px 10px', fontSize: 12, background: '#fff' }} />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ borderRadius: 6, border: '1px solid #D8E5E1', padding: '8px 10px', fontSize: 12, background: '#fff' }} />
            </div>
            <button
              type="button"
              onClick={() => {
                applyCustom(customFrom, customTo);
                setPickerOpen(false);
              }}
              disabled={!customFrom || !customTo || customFrom > customTo}
              style={{
                marginTop: 10,
                width: '100%',
                padding: '9px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                background: '#1DA888',
                color: '#fff',
                border: 'none',
                cursor: !customFrom || !customTo || customFrom > customTo ? 'not-allowed' : 'pointer',
                opacity: !customFrom || !customTo || customFrom > customTo ? 0.5 : 1,
              }}
            >
              Apply range
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
