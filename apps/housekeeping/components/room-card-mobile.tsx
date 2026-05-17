import Link from 'next/link';

import {
  roomCardStatus,
  statusChipLabel,
  taskChipKind,
  taskChipLabel,
  type RoomCardStatus,
} from '@/lib/room-display';

export type RoomCardData = {
  roomId: string;
  roomNumber: string;
  roomType: string;
  housekeepingState: string;
  taskTypes: string[];
  meta?: string;
  reassigned?: boolean;
};

export function RoomCardMobile({ room }: { room: RoomCardData }) {
  const status: RoomCardStatus = roomCardStatus(room.housekeepingState);
  const cardClass = status === 'done' ? 'hk-room-card done' : status === 'in-progress' ? 'hk-room-card in-progress' : 'hk-room-card';

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
