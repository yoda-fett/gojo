'use client';

import Link from 'next/link';

import type { RoomCardData } from './room-card-mobile';

export function EndShiftSheet({
  open,
  incomplete,
  onDismiss,
  onEndAnyway,
}: {
  open: boolean;
  incomplete: RoomCardData[];
  onDismiss: () => void;
  onEndAnyway: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <div className="hk-sheet-backdrop" onClick={onDismiss} role="presentation" />
      <div className="hk-sheet">
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Rooms still in progress</h2>
        <p style={{ margin: '0 0 16px', color: '#5C7170', fontSize: 14 }}>
          You can resume any room or mark done with current state. Ending shift never blocks you.
        </p>
        <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none' }}>
          {incomplete.map((room) => (
            <li key={room.roomId} style={{ padding: '8px 0', borderBottom: '1px solid #E8EFEE' }}>
              Room {room.roomNumber} · {room.roomType}
            </li>
          ))}
        </ul>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {incomplete.slice(0, 1).map((room) => (
            <Link key={room.roomId} href={`/room/${room.roomId}`} className="hk-cta" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              Resume
            </Link>
          ))}
          <button type="button" className="hk-cta" style={{ background: '#E7F4F1', color: '#127C69' }} onClick={onEndAnyway}>
            End shift anyway
          </button>
        </div>
        <button type="button" className="hk-cta hk-cta-secondary" onClick={onDismiss}>
          Keep working
        </button>
      </div>
    </>
  );
}
