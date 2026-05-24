'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Box,
  Check,
  ChevronRight,
  DoorOpen,
  PackageX,
  Search,
  Settings,
  UploadCloud,
} from 'lucide-react';

import { PwaShell } from './pwa-shell';
import type { RoomCardData } from './room-card-mobile';
import { useSyncState } from './sync-provider';

export function ProfileClient({
  dateLabel,
  userInitial,
  userName,
  allRooms,
  incomplete,
  filedMissing,
  filedDamaged,
  hasPin,
}: {
  dateLabel: string;
  userInitial: string;
  userName: string;
  allRooms: RoomCardData[];
  incomplete: RoomCardData[];
  filedMissing: number;
  filedDamaged: number;
  hasPin: boolean;
}) {
  const router = useRouter();
  const sync = useSyncState();
  const [loggingOut, setLoggingOut] = useState(false);

  async function endShift() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/sign-in');
    router.refresh();
  }

  const done = allRooms.filter((r) => r.housekeepingState === 'CLEAN').length;
  const inProgress = allRooms.filter((r) => r.housekeepingState === 'DIRTY').length;
  const notStarted = Math.max(0, allRooms.length - done - inProgress);
  const total = allRooms.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const C = 2 * Math.PI * 24;
  const offset = C - (pct / 100) * C;

  const firstIncomplete = incomplete[0];
  const hasIncomplete = incomplete.length > 0;
  const reportsFiled = filedMissing + filedDamaged;

  const ctaWarn = hasIncomplete || sync.pendingCount > 0;
  const ctaWarnText = useMemo(() => {
    const parts: string[] = [];
    if (hasIncomplete) parts.push(`${incomplete.length} room${incomplete.length === 1 ? '' : 's'} still in progress`);
    if (sync.pendingCount > 0) parts.push(`${sync.pendingCount} item${sync.pendingCount === 1 ? '' : 's'} pending sync`);
    return parts.join(' · ');
  }, [hasIncomplete, incomplete.length, sync.pendingCount]);

  return (
    <PwaShell
      title={`${userName.split(' ')[0] || 'Your'} — Today's Shift`}
      eyebrow={`Your Shift · ${dateLabel}`}
      userInitial={userInitial}
    >
      <div style={{ padding: '14px 16px 200px' }}>
        {/* Identity */}
        <section className="hk-identity">
          <span className="hk-id-avatar">{userInitial}</span>
          <div className="hk-id-body">
            <div className="hk-id-name">{userName}</div>
            <div className="hk-id-meta">
              <span className="hk-role-chip">Housekeeping</span>
              <span className="hk-id-shift">On duty today</span>
            </div>
          </div>
        </section>

        {/* Safety net OR all-clear */}
        {hasIncomplete && firstIncomplete ? (
          <section className="hk-safety-net">
            <div className="hk-safety-eyebrow">⚠ Before you end shift</div>
            <div className="hk-safety-title">
              {incomplete.length === 1
                ? `You still have ${firstIncomplete.roomNumber} in progress`
                : `${incomplete.length} rooms still in progress`}
            </div>
            <div className="hk-safety-sub">
              Pick them up where you left off, or end shift anyway — owner will see the open state.
            </div>
            <Link href={`/room/${firstIncomplete.roomId}`} className="hk-safety-item">
              <span className="si-ico" aria-hidden>
                <DoorOpen size={16} />
              </span>
              <div className="hk-safety-item-body">
                <div className="hk-safety-item-name">
                  Room {firstIncomplete.roomNumber} — {firstIncomplete.roomType}
                </div>
                <div className="hk-safety-item-detail">Tap to resume · not yet marked done</div>
              </div>
              <ChevronRight size={14} className="hk-rr-caret" />
            </Link>
            <div className="hk-safety-actions">
              <Link href={`/room/${firstIncomplete.roomId}`} className="hk-safety-btn primary">Resume</Link>
              <button type="button" className="hk-safety-btn" onClick={endShift} disabled={loggingOut}>End anyway</button>
            </div>
          </section>
        ) : (
          <section className="hk-all-clear">
            <span className="hk-all-clear-ico" aria-hidden>
              <Check size={18} strokeWidth={2.6} />
            </span>
            <div className="hk-all-clear-body">
              <div className="hk-all-clear-title">All your rooms wrapped</div>
              <div className="hk-all-clear-sub">{done} of {total} done · safe to end shift.</div>
            </div>
          </section>
        )}

        {/* Today's coverage */}
        <div className="hk-section-head">
          <span>Today's coverage</span>
        </div>
        <section className="hk-shift-coverage">
          <div className="hk-shift-coverage-top">
            <div className="hk-coverage-ring" style={{ width: 56, height: 56 }}>
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="#E1ECEA" strokeWidth="5" />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="#1DA888"
                  strokeWidth="5"
                  strokeDasharray={C}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="hk-ring-text" style={{ fontSize: 12 }}>{done}/{total}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2B2E', letterSpacing: '-0.2px' }}>
                {total === 0 ? 'No rooms assigned today' : `${done} of ${total} rooms complete`}
              </div>
              <div style={{ fontSize: 11.5, color: '#5C7170', marginTop: 2, fontWeight: 500 }}>
                {inProgress} in progress · {notStarted} not started
              </div>
            </div>
          </div>
          {allRooms.length > 0 ? (
            <div className="hk-shift-room-list">
              {allRooms.map((room) => {
                const isDone = room.housekeepingState === 'CLEAN';
                const isWarn = room.housekeepingState === 'DIRTY';
                const statusClass = isDone ? 'done' : isWarn ? 'warn' : 'pending';
                const statusIcon = isDone ? '✓' : isWarn ? '!' : '●';
                const detail = isDone
                  ? 'Done'
                  : isWarn
                    ? 'In progress · not marked done'
                    : 'Not started';
                const detailClass = isWarn ? 'hk-rr-detail warn' : 'hk-rr-detail';
                return (
                  <Link key={room.roomId} href={`/room/${room.roomId}`} className={isWarn ? 'hk-shift-room-row warning' : 'hk-shift-room-row'}>
                    <span className={`hk-rr-status ${statusClass}`} aria-hidden>{statusIcon}</span>
                    <div className="hk-rr-body">
                      <div className="hk-rr-name">Room {room.roomNumber} · {room.roomType}</div>
                      <div className={detailClass}>{detail}</div>
                    </div>
                    <ChevronRight size={14} className="hk-rr-caret" />
                  </Link>
                );
              })}
            </div>
          ) : null}
        </section>

        {/* Today's reports */}
        <div className="hk-section-head">
          <span>Today's reports</span>
        </div>
        <section className="hk-reports">
          {reportsFiled === 0 ? (
            <div className="hk-reports-zero">No reports filed today.</div>
          ) : (
            <>
              <div className="hk-reports-lead">
                <strong>Today you filed:</strong> {filedMissing} missing item{filedMissing === 1 ? '' : 's'}, {filedDamaged} damaged return{filedDamaged === 1 ? '' : 's'}.
              </div>
              {filedMissing > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <span className="hk-item-ico" aria-hidden><Search size={14} /></span>
                  <div style={{ flex: 1, fontSize: 12.5, color: '#1A2B2E', fontWeight: 600 }}>
                    {filedMissing} Missing item{filedMissing === 1 ? '' : 's'}
                  </div>
                </div>
              ) : null}
              {filedDamaged > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <span className="hk-item-ico" aria-hidden><PackageX size={14} /></span>
                  <div style={{ flex: 1, fontSize: 12.5, color: '#1A2B2E', fontWeight: 600 }}>
                    {filedDamaged} Damaged return{filedDamaged === 1 ? '' : 's'}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        {/* Sync queue */}
        <div className="hk-section-head">
          <span>Sync queue</span>
        </div>
        <section className={sync.pendingCount > 0 ? 'hk-sync-card pending' : 'hk-sync-card clear'}>
          <div className="hk-sync-head">
            <span className="hk-sync-title">
              {sync.pendingCount > 0 ? `${sync.pendingCount} action${sync.pendingCount === 1 ? '' : 's'} pending` : 'All caught up'}
            </span>
            {sync.pendingCount > 0 ? <span className="hk-sync-count-chip">{sync.pendingCount}</span> : null}
          </div>
          <div className="hk-sync-sub">
            {sync.pendingCount > 0
              ? "Will send when you're online. Safe to end shift — owner gets them when they arrive."
              : 'Every action submitted today is on the owner side.'}
          </div>
          {sync.pendingCount > 0 && sync.queued.length > 0 ? (
            <div className="hk-sync-items">
              {sync.queued.slice(0, 5).map((label, i) => (
                <div key={`${label}-${i}`} className="hk-sync-item">
                  <span className="sync-i-ico" aria-hidden><UploadCloud size={13} /></span>
                  <div className="hk-sync-i-body">
                    <div className="hk-sync-i-name">{label}</div>
                    <div className="hk-sync-i-meta">Queued · will retry on reconnect</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* Account / settings */}
        <Link href="/profile/pin" className="hk-settings-link">
          <span className="hk-sl-ico" aria-hidden><Settings size={15} /></span>
          <div className="hk-sl-body">
            <div className="hk-sl-name">{hasPin ? 'Change PIN' : 'Set PIN'}</div>
            <div className="hk-sl-sub">
              {hasPin ? 'Update your 4-digit PIN for faster sign-in' : 'Set a 4-digit PIN to sign in faster'}
            </div>
          </div>
          <ChevronRight size={14} className="hk-sl-caret" />
        </Link>
      </div>

      {/* Sticky end-shift footer */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 70,
          maxWidth: 430,
          margin: '0 auto',
          padding: 12,
          background: 'rgba(255,255,255,0.96)',
          borderTop: '1px solid #DBE7E4',
        }}
      >
        {ctaWarn ? (
          <div className="hk-cta-warn">
            <strong>Heads up:</strong> {ctaWarnText}. Ending shift anyway is OK — owner will see what's open.
          </div>
        ) : (
          <div className="hk-cta-clean">Everything's wrapped — safe to end shift.</div>
        )}
        <button className="hk-cta" type="button" disabled={loggingOut} onClick={endShift}>
          {loggingOut ? 'Ending shift…' : 'End Shift'}
        </button>
        <button type="button" className="hk-secondary-logout" disabled={loggingOut} onClick={endShift}>
          Log out &amp; keep shift open
        </button>
      </div>
    </PwaShell>
  );
}
