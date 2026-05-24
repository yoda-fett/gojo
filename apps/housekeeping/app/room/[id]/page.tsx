import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, Plus, RotateCcw, Sparkles } from 'lucide-react';

import { deriveRoomStatus, prisma, todayInIST, type RoomDisplayState } from '@gojo/db';

import { PwaShell } from '@/components/pwa-shell';
import { readHousekeepingActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) redirect('/sign-in');
  const { id } = await params;

  const room = await prisma.room.findFirst({
    where: { id, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!room) redirect('/');

  // Prisma row types degrade to index signatures across the package boundary
  // (every field reads as `string | number | boolean | Date | null | undefined`),
  // so coerce the room id once for the follow-up queries.
  const roomId = String(room.id);
  const now = new Date();
  const assignedDate = todayInIST();
  const [reservations, blocks, assignment] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        propertyId: actor.propertyId,
        roomId,
        deletedAt: null,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      },
    }),
    prisma.roomBlock.findMany({
      where: {
        propertyId: actor.propertyId,
        roomId,
        deletedAt: null,
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
    }),
    // Today's assignment for this room+staff — used to render only the tasks
    // actually in the bundle (wireframe 03's hidden-chip rule). Read-only, no
    // schema or API change; same query shape `load-my-day` already runs.
    prisma.roomAssignment.findFirst({
      where: {
        propertyId: actor.propertyId,
        roomId,
        staffUserId: actor.userId,
        assignedDate,
        deletedAt: null,
      },
    }),
  ]);

  const assignedTasks = (() => {
    const raw = (assignment?.taskTypes as unknown) ?? null;
    return Array.isArray(raw) ? raw.map(String) : null;
  })();

  const status = deriveRoomStatus(
    {
      housekeepingStatus: String(room.housekeepingStatus),
      holdExpiresAt: (room.holdExpiresAt as Date | null) ?? null,
    },
    reservations.map((r) => ({
      status: String(r.status),
      checkIn: r.checkIn as Date,
      checkOut: r.checkOut as Date,
    })),
    blocks.map((b) => ({
      blockType: String(b.blockType),
      startDate: b.startDate as Date,
      endDate: (b.endDate as Date | null) ?? null,
      reason: String(b.reason),
      deletedAt: (b.deletedAt as Date | null) ?? null,
    })),
    now,
  );

  const tasks = taskRowsFor(roomId, assignedTasks);
  const doneCount = 0; // Per-task completion data isn't loaded (Option 3 hybrid).
  const totalCount = tasks.length;

  return (
    <PwaShell title={String(room.number)} eyebrow="Room" back="/">
      <div style={{ padding: '12px 16px 100px' }}>
        <RoomStatusHeader status={status} />

        <div className="hk-section-label">
          <span>Tasks for this room</span>
          {totalCount > 0 ? (
            <span className="hk-filter" style={{ color: 'var(--mid-gray)', fontWeight: 600 }}>
              {doneCount} of {totalCount} done
            </span>
          ) : null}
        </div>

        <div className="hk-task-list">
          {tasks.map((task) => (
            <Link key={task.label} href={task.href} className={`hk-task-row${task.periodic ? ' periodic' : ''}`}>
              <span className={`hk-task-ico ${task.iconKind}`} aria-hidden>
                <task.Icon size={20} strokeWidth={2.2} />
              </span>
              <div className="hk-task-body">
                <div className="hk-task-head">
                  <span className="hk-task-label">{task.label}</span>
                  {task.periodic ? <span className="hk-rare-badge">Rare task</span> : null}
                </div>
                <div className="hk-task-sub">{task.sub}</div>
              </div>
              <span className="hk-status-badge pending">Pending</span>
              <span className="hk-chevron" aria-hidden>›</span>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <Link href={`/room/${roomId}/issue`} className="hk-report-btn">
            <span className="ico">!</span> Report an Issue with this Room
          </Link>
        </div>
      </div>
    </PwaShell>
  );
}

type TaskIconKind = 'clean' | 'refill' | 'linen' | 'periodic';
type TaskRow = {
  label: string;
  sub: string;
  href: string;
  iconKind: TaskIconKind;
  Icon: typeof Check;
  periodic?: boolean;
};

// All four possible tasks for a room. When the staff has an assignment for
// today, we filter to that bundle (wireframe 03's hidden-chip rule). When no
// assignment exists (direct URL hit or unassigned room), we show all four.
function taskRowsFor(roomId: string, assigned: string[] | null): TaskRow[] {
  const all: Array<TaskRow & { taskTypes: string[] }> = [
    {
      taskTypes: ['CLEAN'],
      label: 'CLEAN',
      sub: 'Bedroom · bathroom · final check',
      href: `/room/${roomId}/clean`,
      iconKind: 'clean',
      Icon: Check,
    },
    {
      taskTypes: ['REFILL'],
      label: 'REFILL',
      sub: 'Top up consumables to par',
      href: `/room/${roomId}/refill`,
      iconKind: 'refill',
      Icon: Plus,
    },
    {
      taskTypes: ['STANDARD_LAUNDRY'],
      label: 'LINEN SWAP',
      sub: 'Swap dirty linen for clean',
      href: `/room/${roomId}/linen-swap`,
      iconKind: 'linen',
      Icon: RotateCcw,
    },
    {
      taskTypes: ['PERIODIC_LAUNDRY'],
      label: 'PERIODIC',
      sub: 'Cadence task · curtains, mattress protectors',
      href: `/room/${roomId}/periodic-linen`,
      iconKind: 'periodic',
      Icon: Sparkles,
      periodic: true,
    },
  ];

  if (!assigned || assigned.length === 0) {
    return all.map(({ taskTypes: _t, ...rest }) => rest);
  }
  return all.filter((t) => t.taskTypes.some((tt) => assigned.includes(tt))).map(({ taskTypes: _t, ...rest }) => rest);
}

function RoomStatusHeader({ status }: { status: ReturnType<typeof deriveRoomStatus> }) {
  const primary = primaryChip(status.display);
  // Out-of-service rooms hide the housekeeping badge — §3 override (Epic 15).
  const showHkBadge = !status.outOfService;
  const meta = timelineMeta(status);

  return (
    <div className="hk-rsh">
      <span className={`hk-rsh-chip ${primary.kind}`}>{primary.label}</span>
      {showHkBadge ? (
        <span className={`hk-hk-badge ${status.housekeeping === 'DIRTY' ? 'dirty' : 'clean'}`}>
          {status.housekeeping === 'DIRTY' ? 'Dirty' : 'Clean'}
        </span>
      ) : null}
      {meta ? <span className="hk-rsh-meta">{meta}</span> : null}
    </div>
  );
}

type PrimaryChipKind = 'vacant' | 'inhouse' | 'departing' | 'arriving' | 'held' | 'ooo';

function primaryChip(display: RoomDisplayState): { label: string; kind: PrimaryChipKind } {
  switch (display) {
    case 'OUT_OF_ORDER':
      return { label: 'Out of Order', kind: 'ooo' };
    case 'MAINTENANCE':
      return { label: 'Maintenance', kind: 'ooo' };
    case 'IN_HOUSE':
      return { label: 'In-House', kind: 'inhouse' };
    case 'DEPARTING':
      return { label: 'Departing', kind: 'departing' };
    case 'ARRIVING':
      return { label: 'Arriving', kind: 'arriving' };
    case 'HELD':
      return { label: 'On Hold', kind: 'held' };
    case 'DIRTY':
    case 'AVAILABLE':
    default:
      return { label: 'Vacant', kind: 'vacant' };
  }
}

function timelineMeta(status: ReturnType<typeof deriveRoomStatus>): string | null {
  if (status.outOfService) return status.outOfService.reason || null;
  const { display, timeline } = status;
  if (display === 'IN_HOUSE' && timeline.nightNumber && timeline.totalNights) {
    return `Night ${timeline.nightNumber} of ${timeline.totalNights} · knock first`;
  }
  if (display === 'DEPARTING') return 'Departing today · turnover';
  if (display === 'ARRIVING') return 'Arriving today';
  if (display === 'DIRTY') return 'Awaiting clean';
  if (display === 'AVAILABLE') return 'Ready';
  return null;
}
