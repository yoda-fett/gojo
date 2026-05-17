// @ts-nocheck
'use client';

const categories = [
  ['DAMAGE_IN_ROOM', 'Damage in Room'],
  ['MISSING_ITEM', 'Missing Item'],
  ['DAMAGED_RETURN', 'Damaged Return'],
  ['OTHER', 'Other'],
];

export function CategoryPicker({ value, locked, onChange }: { value: string; locked?: boolean; onChange: (value: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {categories.map(([key, label]) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            disabled={locked && !selected}
            onClick={() => onChange(key)}
            style={{
              minHeight: 50,
              borderRadius: 8,
              border: `1px solid ${selected ? '#1DA888' : '#DBE7E4'}`,
              background: selected ? '#E7F4F1' : 'white',
              color: selected ? '#127C69' : '#172321',
              fontWeight: 900,
              opacity: locked && !selected ? 0.45 : 1,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
