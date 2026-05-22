import Link from 'next/link';

import {
  roomCardStatus,
  roomContext,
  statusChipLabel,
  taskChipKind,
  taskChipLabel,
  type RoomCardStatus,
  type RoomContextKind,
} from '@/lib/room-display';

export type RoomCardData = {
  roomId: string;
  roomNumber: string;
  roomType: string;
  housekeepingState: string;
  // Epic 15: the composed `display` token (IN_HOUSE | DEPARTING | DIRTY | …).
  roomContext?: string;
  taskTypes: string[];
  meta?: string;
  reassigned?: boolean;
};

// Occupancy-context chip palette — matches the 02-my-day wireframe tokens.
const CTX_STYLE: Record<RoomContextKind, { background: string; color: string }> = {
  turnover: { background: '#FEEDE2', color: '#B65628' },
  stayover: { background: '#EAF6F2', color: '#16876C' },
  'full-clean': { background: '#FFF3D6', color: '#8B6914' },
  clean: { background: '#EEF4F3', color: '#5C7170' },
  ooo: { background: '#FDECEC', color: '#A82828' },
  arriving: { background: '#FBF6DC', color: '#8A6610' },
  held: { background: '#F0F4F4', color: '#5C7170' },
};

export function RoomCardMobile({ room }: { room: RoomCardData }) {
  const status: RoomCardStatus = roomCardStatus(room.housekeepingState);
  const cardClass = status === 'done' ? 'hk-room-card done' : status === 'in-progress' ? 'hk-room-card in-progress' : 'hk-room-card';
  const ctx = room.roomContext ? roomContext(room.roomContext, room.housekeepingState) : null;

  return (
    <Link href={`/room/${room.roomId}`} className={cardClass}>
      <div className="hk-room-top">
        <div className="hk-room-id">
          {room.roomNumber}
          <span className="hk-room-type">— {room.roomType}</span>
        </div>
        <span className={`hk-status-chip ${status === 'done' ? 'done' : status === 'in-progress' ? 'progress' : 'pending'}`}>
          {statusChipLabel(status)}
        </span>
      </div>
      {ctx ? (
        <span
          style={{
            display: 'inline-flex',
            alignSelf: 'flex-start',
            alignItems: 'center',
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 8,
            ...CTX_STYLE[ctx.kind],
          }}
        >
          {ctx.label}
        </span>
      ) : null}
      <div className="hk-task-chips">
        {room.taskTypes.map((task) => (
          <span key={task} className={`hk-task-chip ${taskChipKind(task)}`}>
            {taskChipLabel(task)}
          </span>
        ))}
      </div>
      <div className="hk-room-meta" style={room.reassigned ? { color: '#B65628' } : undefined}>
        {room.meta ?? (room.reassigned ? 'Just reassigned' : 'Tap to open')}
        <span className="arrow">›</span>
      </div>
    </Link>
  );
}
