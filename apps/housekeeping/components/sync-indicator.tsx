'use client';

import { useState } from 'react';

import { useSyncState } from './sync-provider';

export type SyncState = { state: 'synced' | 'pending' | 'offline'; pendingCount?: number; queued?: string[] };

export function SyncIndicator(props?: Partial<SyncState>) {
  const live = useSyncState();
  const state = props?.state ?? live.state;
  const pendingCount = props?.pendingCount ?? live.pendingCount;
  const queued = props?.queued ?? live.queued;
  const [open, setOpen] = useState(false);

  const label = state === 'synced' ? 'Synced' : state === 'offline' ? 'Offline' : `Pending · ${pendingCount}`;
  const chipClass =
    state === 'synced' ? 'hk-sync-chip' : state === 'offline' ? 'hk-sync-chip offline' : 'hk-sync-chip pending';

  return (
    <div>
      <button
        type="button"
        className={chipClass}
        onClick={() => state === 'pending' && setOpen((value) => !value)}
        style={{ border: 0, cursor: state === 'pending' ? 'pointer' : 'default' }}
      >
        <span className="dot" />
        {label}
        {state === 'pending' && pendingCount > 0 ? (
          <span style={{ background: '#E8763F', color: '#fff', padding: '1px 6px', borderRadius: 100, fontSize: 9.5 }}>
            {pendingCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="hk-card" style={{ marginTop: 8, padding: 10, fontSize: 12, color: '#47534f' }}>
          {(queued.length ? queued : ['Queued task completion']).map((item) => (
            <div key={item}>{item}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
