// Shared composed-status primitives for the dashboard.
//
// Single source of truth for hotfix-5 §3 visual contract on apps/web side.
// The HK companion app (apps/housekeeping) consumes the same labels and
// palette via its own globals.css — keep this file in sync if §3 changes.
//
// Usage:
//   <RoomStatusBadge display="IN_HOUSE" />          → "In-House" (mint)
//   <HousekeepingBadge state="DIRTY" />             → "Dirty" (amber)
//   <ComposedStatus display="..." housekeeping=".." outOfService={null} />

import type { ReactNode } from 'react';

// ── §3.1 — Occupancy primary chip ──────────────────────────────────
// Labels + classes match hotfix-5 §3.1 (occupancy chip table) and the HK
// app's .hk-rsh-chip rules in apps/housekeeping/app/globals.css.

export type RoomDisplay =
  | 'OUT_OF_ORDER'
  | 'MAINTENANCE'
  | 'IN_HOUSE'
  | 'DEPARTING'
  | 'ARRIVING'
  | 'HELD'
  | 'AVAILABLE'
  | 'DIRTY';

type ChipMeta = { label: string; classes: string };

const ROOM_STATUS_CHIPS: Record<RoomDisplay, ChipMeta> = {
  IN_HOUSE: {
    label: 'In‑House',
    classes: 'bg-[#e8f9f5] text-[#0a6b58] border border-[#c6e6d9]',
  },
  DEPARTING: {
    label: 'Departing',
    classes: 'bg-[#feede2] text-[#b65628] border border-[#f2c3a7]',
  },
  ARRIVING: {
    label: 'Arriving',
    classes: 'bg-[#fbf6dc] text-[#8a6610] border border-[#efd79b]',
  },
  HELD: {
    label: 'On Hold',
    classes: 'bg-[#f0f4f4] text-[#5c7170] border border-[#d9e5e3]',
  },
  AVAILABLE: {
    label: 'Vacant',
    classes: 'bg-[#eef4f3] text-[#5c7170] border border-[#d9e5e3]',
  },
  DIRTY: {
    label: 'Vacant',
    classes: 'bg-[#eef4f3] text-[#5c7170] border border-[#d9e5e3]',
  },
  OUT_OF_ORDER: {
    label: 'Out of Order',
    classes: 'bg-[#fdecec] text-[#a82828] border border-[#f4c5c5]',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    classes: 'bg-[#fdecec] text-[#a82828] border border-[#f4c5c5]',
  },
};

export function RoomStatusBadge({ display, className }: { display: string; className?: string }) {
  const meta = ROOM_STATUS_CHIPS[(display as RoomDisplay)] ?? {
    label: display,
    classes: 'bg-slate-100 text-slate-700 border border-slate-200',
  };
  return (
    <span
      className={[
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold leading-none',
        meta.classes,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {meta.label}
    </span>
  );
}

// ── §3.2 — Housekeeping badge ──────────────────────────────────────
// Always-on alongside the primary chip *unless* an active block exists
// (out-of-service override — §3.5). Caller decides when to hide.

export type HousekeepingState = 'CLEAN' | 'DIRTY';

const HOUSEKEEPING_CHIPS: Record<HousekeepingState, ChipMeta> = {
  CLEAN: {
    label: 'Clean',
    classes: 'bg-[#eaf6f2] text-[#16876c] border border-[#b8e5d6]',
  },
  DIRTY: {
    label: 'Dirty',
    classes: 'bg-[#fff3d6] text-[#8b6914] border border-[#f0dca0]',
  },
};

export function HousekeepingBadge({
  state,
  className,
}: {
  state: HousekeepingState;
  className?: string;
}) {
  const meta = HOUSEKEEPING_CHIPS[state];
  return (
    <span
      className={[
        'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide leading-none',
        meta.classes,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {meta.label}
    </span>
  );
}

// ── §3.5 — Composed bundle ─────────────────────────────────────────
// Renders the primary chip + housekeeping badge per the §3 contract:
// when an active block exists, only the OOR/MAINTENANCE chip shows
// (no housekeeping badge). Otherwise both render side-by-side.

export function ComposedStatus({
  display,
  housekeeping,
  outOfService,
  meta,
  className,
}: {
  display: string;
  housekeeping: HousekeepingState;
  outOfService: boolean;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={['flex flex-wrap items-center gap-1.5', className ?? ''].filter(Boolean).join(' ')}>
      <RoomStatusBadge display={display} />
      {!outOfService ? <HousekeepingBadge state={housekeeping} /> : null}
      {meta ? <span className="text-[11.5px] font-medium text-[#5c7170]">{meta}</span> : null}
    </div>
  );
}
