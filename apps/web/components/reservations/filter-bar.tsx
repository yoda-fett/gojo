// @ts-nocheck
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown, X } from 'lucide-react';

import { DateSelector } from '@/components/dashboard/date-selector';

const STATUS_OPTIONS = [
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'ARRIVING_TODAY', label: 'Arriving Today' },
  { value: 'CHECKED_IN', label: 'Checked In' },
  { value: 'CHECKING_OUT_TODAY', label: 'Checking Out' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NO_SHOW', label: 'No Show' },
];

const SOURCE_OPTIONS = [
  { value: 'DIRECT_BOOKING', label: 'Direct' },
  { value: 'WALK_IN', label: 'Walk-in' },
  { value: 'OTA', label: 'OTA' },
];

const SELECT_BASE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 10px',
  borderRadius: 6,
  border: '1px solid #E8EFEE',
  background: '#fff',
  fontSize: 13,
  fontWeight: 500,
  color: '#1A2B2E',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'border-color 0.12s, background 0.12s, color 0.12s',
};

const SELECT_ACTIVE: React.CSSProperties = {
  borderColor: '#1DA888',
  background: '#E8F9F5',
  color: '#0A6B58',
};

const LABEL: React.CSSProperties = {
  fontSize: 12,
  color: '#9EAEAC',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const DIVIDER: React.CSSProperties = {
  width: 1,
  height: 28,
  background: '#E8EFEE',
};

function formatFilterDate(date: string) {
  const [, , day] = date.split('-');
  const monthLabel = new Date(`${date}T00:00:00`).toLocaleString('en-US', { month: 'short' });
  return `${day} ${monthLabel}`;
}

function formatFilterDateRange(from: string, to: string) {
  return `${formatFilterDate(from)} – ${formatFilterDate(to)}`;
}

function FilterButton({
  label,
  active,
  onClick,
  withChevron = true,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  withChevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...SELECT_BASE, ...(active ? SELECT_ACTIVE : {}) }}
    >
      {label}
      {withChevron ? <ChevronDown size={11} strokeWidth={2.5} aria-hidden="true" /> : null}
    </button>
  );
}

function MultiSelectDropdown({
  placeholder,
  options,
  selected,
  onToggle,
}: {
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const active = selected.length > 0;
  const triggerLabel = !active
    ? placeholder
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? placeholder
      : `${selected.length} selected`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ ...SELECT_BASE, ...(active ? SELECT_ACTIVE : {}) }}
      >
        {triggerLabel}
        <ChevronDown size={11} strokeWidth={2.5} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 30,
            minWidth: 200,
            background: '#fff',
            border: '1px solid #E8EFEE',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(26,43,46,0.12)',
            padding: 4,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onToggle(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: isSelected ? '#E8F9F5' : 'transparent',
                  color: isSelected ? '#0A6B58' : '#1A2B2E',
                  fontSize: 13,
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                className="hover:!bg-[#F4F9F8]"
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    border: `1.5px solid ${isSelected ? '#1DA888' : '#D7E3E0'}`,
                    background: isSelected ? '#1DA888' : '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isSelected ? <Check size={10} strokeWidth={3} color="#fff" aria-hidden="true" /> : null}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 20,
        background: '#E8F9F5',
        border: '1px solid #B8DDD5',
        fontSize: 12,
        fontWeight: 500,
        color: '#0A6B58',
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        style={{ display: 'inline-flex', color: '#9EAEAC', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <X size={11} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </span>
  );
}

export function FilterBar({ roomTypes }: { roomTypes: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedStatuses = searchParams.getAll('status');
  const selectedSources = searchParams.getAll('source');
  const selectedRoomTypes = searchParams.getAll('roomType');
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; remove: () => void }> = [];
    selectedStatuses.forEach((value) => {
      const opt = STATUS_OPTIONS.find((o) => o.value === value);
      chips.push({
        key: `status:${value}`,
        label: opt?.label ?? value,
        remove: () => toggleMultiValue('status', value),
      });
    });
    selectedSources.forEach((value) => {
      const opt = SOURCE_OPTIONS.find((o) => o.value === value);
      chips.push({
        key: `source:${value}`,
        label: opt?.label ?? value,
        remove: () => toggleMultiValue('source', value),
      });
    });
    selectedRoomTypes.forEach((value) => {
      const opt = roomTypes.find((roomType) => roomType.id === value);
      chips.push({
        key: `roomType:${value}`,
        label: opt?.name ?? value,
        remove: () => toggleMultiValue('roomType', value),
      });
    });
    if (from && to) {
      chips.push({
        key: 'date',
        label: formatFilterDateRange(from, to),
        remove: () =>
          updateParams((params) => {
            params.delete('from');
            params.delete('to');
          }),
      });
    }
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatuses.join(','), selectedSources.join(','), selectedRoomTypes.join(','), roomTypes, from, to]);

  function updateParams(mutator: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString());
    mutator(next);
    const query = next.toString();
    router.replace(query ? `/reservations?${query}` : '/reservations', { scroll: false });
  }

  function toggleMultiValue(key: string, value: string) {
    updateParams((params) => {
      const values = new Set(params.getAll(key));
      params.delete(key);
      if (values.has(value)) {
        values.delete(value);
      } else {
        values.add(value);
      }
      [...values].forEach((entry) => params.append(key, entry));
    });
  }

  const hasActive = activeChips.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: hasActive ? 10 : 0, position: 'relative', zIndex: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap', minWidth: 'max-content' }}>
        <div style={DIVIDER} />

        {/* Dates */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={LABEL}>Dates</span>
          <DateSelector
            value={from && to ? { from, to, label: formatFilterDateRange(from, to) } : undefined}
            defaultPreset="7d"
            storageKey="gojo:reservations:dateRange"
            triggerClassName="text-[13px]"
            valueClassName="text-[13px]"
            onChange={(next) =>
              updateParams((params) => {
                params.set('from', next.from);
                params.set('to', next.to);
              })
            }
          />
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={LABEL}>Status</span>
          <MultiSelectDropdown
            placeholder="All statuses"
            options={STATUS_OPTIONS}
            selected={selectedStatuses}
            onToggle={(value) => toggleMultiValue('status', value)}
          />
        </div>

        {/* Source */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={LABEL}>Source</span>
          <MultiSelectDropdown
            placeholder="All sources"
            options={SOURCE_OPTIONS}
            selected={selectedSources}
            onToggle={(value) => toggleMultiValue('source', value)}
          />
        </div>

        {/* Room type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={LABEL}>Room type</span>
          <MultiSelectDropdown
            placeholder="All types"
            options={roomTypes.map((roomType) => ({ value: roomType.id, label: roomType.name }))}
            selected={selectedRoomTypes}
            onToggle={(value) => toggleMultiValue('roomType', value)}
          />
        </div>
      </div>

      {hasActive ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
          {activeChips.map((chip) => (
            <ActiveChip key={chip.key} label={chip.label} onRemove={chip.remove} />
          ))}
          <button
            type="button"
            onClick={() => router.replace('/reservations', { scroll: false })}
            style={{
              fontSize: 12,
              color: '#9EAEAC',
              padding: '4px 6px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            className="hover:!text-[#E8763F]"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}
