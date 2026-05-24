// @ts-nocheck
'use client';

import { AlertTriangle, MoreHorizontal, PackageX, Search } from 'lucide-react';

// 2×2 grid of issue category buttons, each with icon + label + helper sub.
// When `locked` is set (from a pre-fill context), only the selected button is
// interactable; the others fade per wireframe 09.
const categories: Array<{ key: string; label: string; sub: string; Icon: typeof AlertTriangle }> = [
  { key: 'DAMAGE_IN_ROOM', label: 'Damage in Room', sub: 'Leak, broken fixture, stain', Icon: AlertTriangle },
  { key: 'MISSING_ITEM', label: 'Missing Item', sub: 'Something not in the room', Icon: Search },
  { key: 'DAMAGED_RETURN', label: 'Damaged Return', sub: 'From the laundry dock', Icon: PackageX },
  { key: 'OTHER', label: 'Other', sub: 'Anything else', Icon: MoreHorizontal },
];

export function CategoryPicker({ value, locked, onChange }: { value: string; locked?: boolean; onChange: (value: string) => void }) {
  return (
    <div className="hk-cat-grid">
      {categories.map(({ key, label, sub, Icon }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            disabled={locked && !selected}
            onClick={() => onChange(key)}
            className={selected ? 'hk-cat-btn selected' : 'hk-cat-btn'}
          >
            <span className="cb-ico" aria-hidden>
              <Icon size={14} />
            </span>
            <span className="cb-label">{label}</span>
            <span className="cb-sub">{sub}</span>
          </button>
        );
      })}
    </div>
  );
}
