'use client';

import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';

import { useWizardNav } from './wizard-nav-context';

export type FinalReviewData = {
  property: {
    name: string;
    city: string | null;
    state: string | null;
    pincode: string | null;
    gstin: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    defaultCheckInTime: string | null;
    defaultCheckOutTime: string | null;
    numberOfFloors: number | null;
  };
  roomTypes: Array<{ name: string; baseRate: number; roomCount: number }>;
  rooms: { total: number; byFloor: Array<{ floor: number | null; count: number }> };
  team: { total: number; byRole: Record<string, number> };
  rates: { ratePlanCount: number; multiplierCount: number; multiplierNames: string[] };
  catalog: {
    amenityCount: number;
    linenCount: number;
    laundryVendor: string | null;
    linenDistributionDeclared: boolean;
  };
  directBooking: { enabled: boolean; skipped: boolean };
};

function Section({
  step,
  title,
  pill,
  children,
  onEdit,
}: {
  step: number;
  title: string;
  pill?: ReactNode;
  children: ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="relative flex gap-4 rounded-[12px] border border-[var(--color-line-soft)] bg-white px-5 py-4">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[rgba(29,168,136,0.12)] text-[12px] font-semibold text-[var(--color-teal-dark)]">
        {step}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-[var(--color-charcoal)]">{title}</span>
          {pill}
        </div>
        <div className="mt-1 text-[13px] leading-[1.55] text-[var(--color-muted)]">{children}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${title}`}
        className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-md text-[var(--color-mid-gray)] hover:bg-[var(--color-off-white)] hover:text-[var(--color-teal)]"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}

function MetaPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'amber' }) {
  const styles =
    tone === 'amber'
      ? 'bg-[rgba(233,196,106,0.18)] text-[#8a6610]'
      : 'bg-[var(--color-off-white)] text-[var(--color-charcoal)]';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles}`}>
      {children}
    </span>
  );
}

function KvRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="min-w-[80px] text-[11px] uppercase tracking-[0.06em] text-[var(--color-mid-gray)]">{k}</span>
      <span className="text-[13px] text-[var(--color-charcoal)]">{v}</span>
    </div>
  );
}

export function FinalReview({ data }: { data: FinalReviewData }) {
  const { goToStep } = useWizardNav();

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[12px] bg-[rgba(29,168,136,0.08)] px-5 py-4 text-[13px] leading-[1.55] text-[var(--color-charcoal)]">
        <p>
          <strong>All 7 steps complete.</strong> One last look before you finish setup — tapping{' '}
          <strong>Finish setup</strong> arms the First-Shift Reconciliation watcher and routes you to your dashboard.
        </p>
      </div>

      {/* 1. Property profile */}
      <Section step={1} title="Property profile" onEdit={() => goToStep(1)}>
        <p>
          <strong className="text-[var(--color-charcoal)]">{data.property.name}</strong>
          {data.property.city ? (
            <>
              {' · '}
              {[data.property.city, data.property.state, data.property.pincode].filter(Boolean).join(', ')}
            </>
          ) : null}
        </p>
        <div className="mt-2 grid gap-1.5">
          <KvRow k="GST" v={data.property.gstin ?? <span className="text-[#C45A20]">Not registered</span>} />
          <KvRow
            k="Contact"
            v={[data.property.contactPhone, data.property.contactEmail].filter(Boolean).join(' · ') || '—'}
          />
          <KvRow
            k="Hours"
            v={
              data.property.defaultCheckInTime || data.property.defaultCheckOutTime
                ? `Check-in ${data.property.defaultCheckInTime ?? '—'} · Check-out ${data.property.defaultCheckOutTime ?? '—'}`
                : '—'
            }
          />
          <KvRow k="Floors" v={data.property.numberOfFloors ?? '—'} />
        </div>
      </Section>

      {/* 2. Room types */}
      <Section
        step={2}
        title="Room types"
        pill={<MetaPill>{data.roomTypes.length} type{data.roomTypes.length === 1 ? '' : 's'}</MetaPill>}
        onEdit={() => goToStep(2)}
      >
        {data.roomTypes.length === 0 ? (
          <span className="text-[#C45A20]">No room types configured.</span>
        ) : (
          <p>
            {data.roomTypes.map((rt, i) => (
              <span key={rt.name}>
                <strong className="text-[var(--color-charcoal)]">{rt.name}</strong> · {rt.roomCount} room
                {rt.roomCount === 1 ? '' : 's'} · ₹{rt.baseRate.toLocaleString('en-IN')} base
                {i < data.roomTypes.length - 1 ? <span className="mx-2 text-[var(--color-mid-gray)]">·</span> : null}
              </span>
            ))}
          </p>
        )}
      </Section>

      {/* 3. Rooms */}
      <Section
        step={3}
        title="Rooms"
        pill={
          <MetaPill>
            {data.rooms.total} room{data.rooms.total === 1 ? '' : 's'}
            {data.rooms.byFloor.length > 0 ? ` · ${data.rooms.byFloor.length} floor${data.rooms.byFloor.length === 1 ? '' : 's'}` : ''}
          </MetaPill>
        }
        onEdit={() => goToStep(3)}
      >
        {data.rooms.byFloor.length === 0 ? (
          <span className="text-[#C45A20]">No rooms configured.</span>
        ) : (
          <p>
            {data.rooms.byFloor.map((f, i) => (
              <span key={`f-${f.floor ?? 'none'}`}>
                Floor {f.floor ?? '—'}: {f.count} room{f.count === 1 ? '' : 's'}
                {i < data.rooms.byFloor.length - 1 ? <span className="mx-2 text-[var(--color-mid-gray)]">·</span> : null}
              </span>
            ))}
          </p>
        )}
      </Section>

      {/* 4. Users and Roles */}
      <Section
        step={4}
        title="Users and Roles"
        pill={<MetaPill>{data.team.total} user{data.team.total === 1 ? '' : 's'}</MetaPill>}
        onEdit={() => goToStep(4)}
      >
        <p>
          {(['OWNER', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING'] as const).map((role, i, arr) => {
            const count = data.team.byRole[role] ?? 0;
            const label = role === 'FRONT_DESK' ? 'Front Desk' : role.charAt(0) + role.slice(1).toLowerCase();
            return (
              <span key={role}>
                <strong className="text-[var(--color-charcoal)]">{label}:</strong> {count}
                {i < arr.length - 1 ? <span className="mx-2 text-[var(--color-mid-gray)]">·</span> : null}
              </span>
            );
          })}
        </p>
      </Section>

      {/* 5. Rate management */}
      <Section
        step={5}
        title="Rate management"
        pill={<MetaPill>{data.rates.ratePlanCount} rate plan{data.rates.ratePlanCount === 1 ? '' : 's'}</MetaPill>}
        onEdit={() => goToStep(5)}
      >
        {data.rates.ratePlanCount === 0 ? (
          <span className="text-[#C45A20]">No rate plans configured.</span>
        ) : (
          <p>
            {data.rates.ratePlanCount} rate plan{data.rates.ratePlanCount === 1 ? '' : 's'} configured
            {data.rates.multiplierCount > 0 ? (
              <>
                {' · '}
                {data.rates.multiplierCount} multiplier{data.rates.multiplierCount === 1 ? '' : 's'} active
                {data.rates.multiplierNames.length > 0
                  ? ` (${data.rates.multiplierNames.slice(0, 3).join(', ')}${
                      data.rates.multiplierNames.length > 3 ? '…' : ''
                    })`
                  : ''}
              </>
            ) : null}
            .
          </p>
        )}
      </Section>

      {/* 6. Housekeeping Catalog */}
      <Section
        step={6}
        title="Housekeeping Catalog"
        pill={
          data.catalog.linenDistributionDeclared ? (
            <MetaPill>Linen distribution declared</MetaPill>
          ) : data.catalog.linenCount > 0 ? (
            <MetaPill tone="amber">Linen distribution pending</MetaPill>
          ) : null
        }
        onEdit={() => goToStep(6)}
      >
        <p>
          <strong className="text-[var(--color-charcoal)]">{data.catalog.amenityCount} amenities</strong>
          {' · '}
          <strong className="text-[var(--color-charcoal)]">{data.catalog.linenCount} linens</strong>
          {data.catalog.laundryVendor ? (
            <>
              {' · '}Laundry vendor: <strong className="text-[var(--color-charcoal)]">{data.catalog.laundryVendor}</strong>
            </>
          ) : null}
        </p>
      </Section>

      {/* 7. Direct booking */}
      <Section
        step={7}
        title="Direct booking"
        pill={
          data.directBooking.skipped ? (
            <MetaPill tone="amber">Skipped — set up later</MetaPill>
          ) : data.directBooking.enabled ? (
            <MetaPill>Enabled</MetaPill>
          ) : (
            <MetaPill>Disabled</MetaPill>
          )
        }
        onEdit={() => goToStep(7)}
      >
        {data.directBooking.skipped ? (
          <p>
            You skipped this optional step. Direct booking can be configured anytime from{' '}
            <strong className="text-[var(--color-charcoal)]">Settings → Direct booking</strong>. Cold-start does not
            require it.
          </p>
        ) : data.directBooking.enabled ? (
          <p>Direct booking is live — guests can book on your widget without OTA commission.</p>
        ) : (
          <p>Direct booking is configured but not yet enabled.</p>
        )}
      </Section>
    </div>
  );
}
