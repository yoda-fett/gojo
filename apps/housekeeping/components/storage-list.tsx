'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronRight, FileSearch, Snowflake } from 'lucide-react';

import { bandLabel, type InventoryBand } from '@/lib/inventory-band';

export type StockItem = {
  id: string;
  name: string;
  unit: string;
  inStorage: number;
  linenCategory: 'ROUTINE' | 'PERIODIC' | string | null;
  band: InventoryBand;
};

type Filter = 'all' | 'low' | 'empty';

export function StorageList({ items, snapshotLabel }: { items: StockItem[]; snapshotLabel: string }) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const c = { all: items.length, low: 0, empty: 0 };
    for (const item of items) {
      if (item.band === 'LOW') c.low += 1;
      if (item.band === 'EMPTY') c.empty += 1;
    }
    return c;
  }, [items]);

  const visible = useMemo(() => {
    if (filter === 'low') return items.filter((i) => i.band === 'LOW');
    if (filter === 'empty') return items.filter((i) => i.band === 'EMPTY');
    return items;
  }, [filter, items]);

  return (
    <div style={{ padding: '14px 16px 32px' }}>
      <section className="hk-snapshot">
        <span className="hk-snap-ico" aria-hidden>
          <Snowflake size={18} />
        </span>
        <div className="hk-snap-text">
          <div className="hk-snap-title">A read-only snapshot</div>
          <div className="hk-snap-sub">
            {snapshotLabel} · plan your trolley before walking to storage. Counts update when staff log refills, swaps &amp; receives.
          </div>
        </div>
      </section>

      <div className="hk-filter-bar" role="tablist">
        <FilterChip current={filter} value="all" label="All" count={counts.all} onSelect={setFilter} />
        <FilterChip current={filter} value="low" label="Low only" count={counts.low} onSelect={setFilter} />
        <FilterChip current={filter} value="empty" label="Empty only" count={counts.empty} onSelect={setFilter} />
      </div>

      <div className="hk-section-head">
        <span>Linens</span>
        <span className="count-hint">
          {items.length} item{items.length === 1 ? '' : 's'} · property pool
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="hk-filter-empty">
          <span className="em-ico" aria-hidden>✓</span>
          Nothing in this bucket
          <div className="em-sub">
            No {filter === 'low' ? 'low-stock' : 'empty'} items right now — clean pool looks healthy.
          </div>
        </div>
      ) : (
        <div className="hk-stock-list">
          {visible.map((item) => {
            const bandClass = item.band === 'LOW' ? 'low' : item.band === 'EMPTY' ? 'empty' : '';
            const pillClass = item.band === 'LOW' ? 'low' : item.band === 'EMPTY' ? 'empty' : 'healthy';
            const categoryKind = item.linenCategory === 'PERIODIC' ? 'periodic' : 'routine';
            const categoryLabel = item.linenCategory === 'PERIODIC' ? 'Periodic' : 'Routine';
            return (
              <article key={item.id} className={`hk-stock-row${bandClass ? ' ' + bandClass : ''}`}>
                <div className="hk-stock-body">
                  <div className="hk-stock-name-row">
                    <span className="hk-stock-name">{item.name}</span>
                    <span className={`hk-cat-chip ${categoryKind}`}>{categoryLabel}</span>
                  </div>
                  <div className="hk-stock-count">
                    {item.inStorage}
                    <span className="unit">{item.unit} in storage</span>
                  </div>
                </div>
                <span className={`hk-status-pill ${pillClass}`}>{bandLabel(item.band)}</span>
              </article>
            );
          })}
        </div>
      )}

      <Link href="/issue?entryContext=COLD" className="hk-discrepancy">
        <span className="d-ico" aria-hidden>
          <FileSearch size={16} />
        </span>
        <div className="d-text">
          <div className="d-title">Storage discrepancy?</div>
          <div className="d-sub">Counts don't match what you see — report it.</div>
        </div>
        <span className="d-caret" aria-hidden>
          <ChevronRight size={16} />
        </span>
      </Link>
    </div>
  );
}

function FilterChip({
  current,
  value,
  label,
  count,
  onSelect,
}: {
  current: Filter;
  value: Filter;
  label: string;
  count: number;
  onSelect: (next: Filter) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={current === value}
      className={current === value ? 'hk-filter-chip selected' : 'hk-filter-chip'}
      onClick={() => onSelect(value)}
    >
      {label} <span className="count">{count}</span>
    </button>
  );
}
