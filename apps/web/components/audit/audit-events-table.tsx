'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';

export type AuditEventRow = {
  id: string;
  timestampIso: string;
  timestampShort: string;
  actorName: string;
  actorRole: string;
  moduleKey: string;
  moduleLabel: string;
  action: string;
  actionLabel: string;
  entityLabel: string;
  summary: string;
  flagged: boolean;
};

type SortKey = 'timestamp' | 'module' | 'actor';
type SortDir = 'asc' | 'desc';

export function AuditEventsTable({ rows }: { rows: AuditEventRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'timestamp' ? 'desc' : 'asc');
  }

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'timestamp') cmp = a.timestampIso.localeCompare(b.timestampIso);
      else if (sortKey === 'module') cmp = a.moduleLabel.localeCompare(b.moduleLabel);
      else if (sortKey === 'actor') cmp = a.actorName.localeCompare(b.actorName);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [rows, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-[13px]">
        <thead>
          <tr style={{ background: '#FAFCFC' }}>
            <SortableTh label="Timestamp" sortKey="timestamp" active={sortKey} dir={sortDir} onToggle={toggleSort} />
            <SortableTh label="Module" sortKey="module" active={sortKey} dir={sortDir} onToggle={toggleSort} />
            <SortableTh label="User" sortKey="actor" active={sortKey} dir={sortDir} onToggle={toggleSort} />
            <Th label="Role" />
            <Th label="Action" />
            {/*
            <Th label="Entity" />
            <Th label="Summary" />
            */}
            <Th label="Flag" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} className="border-t border-[#F0F5F4]">
              <td className="px-4 py-3 font-mono text-[12px] text-[var(--color-mid-gray)]">{row.timestampShort?.trim()}</td>
              <td className="px-2 py-3 text-center">
                <span className="inline-flex rounded-[6px] bg-[var(--color-off-white)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-charcoal)]">
                  {row.moduleLabel}
                </span>
              </td>
              <td className="px-2 py-3 text-[11px] text-[var(--color-charcoal)]">{row.actorName}</td>
              <td className="px-2 py-3 text-[10px] text-[var(--color-mid-gray)]">{row.actorRole}</td>
              <td className="px-2 py-3 text-[11px] font-medium text-[var(--color-charcoal)]">{row.actionLabel}</td>
              {/*
              <td className="px-3 py-3 text-[var(--color-mid-gray)]">{row.entityLabel}</td>
              <td className="px-3 py-3 text-[var(--color-mid-gray)]">{row.summary}</td>
              */}
              <td className="px-6 py-3 text-center" aria-label={row.flagged ? 'Flagged event' : ''}>
                {row.flagged ? (
                  <span className="text-[var(--color-coral)]" title="Flagged">⚠</span>
                ) : null}
              </td>
            </tr>
          ))}
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-6 py-10 text-center text-[13px] text-[var(--color-mid-gray)]">
                No audit entries match the current filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

const TH_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#9EAEAC',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  padding: '10px 24px',
  borderBottom: '1px solid #F0F5F4',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

function Th({ label }: { label: string }) {
  return <th style={TH_STYLE}>{label}</th>;
}

function SortableTh({
  label,
  sortKey,
  active,
  dir,
  onToggle,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onToggle: (key: SortKey) => void;
}) {
  const isActive = active === sortKey;
  const Icon = isActive ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th style={TH_STYLE}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={`inline-flex cursor-pointer items-center gap-1 uppercase tracking-[0.06em] ${
          isActive ? 'text-[var(--color-charcoal)]' : 'text-[#9EAEAC]'
        } hover:text-[var(--color-charcoal)]`}
      >
        {label}
        <Icon className="size-3" />
      </button>
    </th>
  );
}
