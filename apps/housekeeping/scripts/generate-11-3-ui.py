#!/usr/bin/env python3
"""Generate story 11.3 UI and API files."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
T = "div"


def write(rel: str, content: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print("wrote", rel)


write(
    "components/coverage-chip.tsx",
    f"""export function CoverageChip({{
  done,
  total,
  inProgress,
}}: {{
  done: number;
  total: number;
  inProgress: number;
}}) {{
  const remaining = Math.max(total - done, 0);
  const pct = total > 0 ? (done / total) * 100 : 0;
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <{T} className="hk-coverage">
      <{T} className="hk-coverage-ring">
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#E1ECEA" strokeWidth="5" />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="#1DA888"
            strokeWidth="5"
            strokeDasharray={{circumference}}
            strokeDashoffset={{offset}}
            strokeLinecap="round"
          />
        </svg>
        <{T} className="hk-ring-text" style={{ total === 0 ? {{ color: '#9EAEAC' }} : undefined }}>
          {{done}}/{{total}}
        </{T}>
      </{T}>
      <{T} style={{{{ flex: 1 }}}}>
        <{T} style={{{{ fontSize: 15, fontWeight: 700 }}}}>
          {{total === 0 ? 'No rooms yet' : `${{done}} of ${{total}} rooms done`}}
        </{T}>
        <{T} style={{{{ fontSize: 11.5, color: '#5C7170', marginTop: 2 }}}}>
          {{total === 0
            ? "Your manager hasn't published today's list"
            : `${{remaining}} remaining · ${{inProgress}} in progress`}}
        </{T}>
        <{T} className="hk-coverage-bar">
          <span style={{{{ width: `${{pct}}%` }}}} />
        </{T}>
      </{T}>
    </{T}>
  );
}}
""",
)

write(
    "components/reassignment-banner.tsx",
    f"""'use client';

export function ReassignmentBanner({{
  title,
  message,
  onDismiss,
}}: {{
  title: string;
  message: string;
  onDismiss: () => void;
}}) {{
  return (
    <{T} className="hk-banner">
      <{T} className="hk-banner-icon">!</{T}>
      <{T} style={{{{ flex: 1, paddingRight: 16 }}}}>
        <{T} style={{{{ fontSize: 13, fontWeight: 700 }}}}>{{title}}</{T}>
        <{T} style={{{{ fontSize: 12, color: '#5C7170', marginTop: 2, lineHeight: 1.4 }}}}>{{message}}</{T}>
      </{T}>
      <button type="button" onClick={{onDismiss}} aria-label="Dismiss" style={{{{ position: 'absolute', top: 8, right: 10, border: 0, background: 'transparent', color: '#9EAEAC', fontSize: 18 }}}}>
        ×
      </button>
    </{T}>
  );
}}
""",
)

write(
    "components/empty-state.tsx",
    f"""'use client';

export function EmptyState({{
  offline,
  onRetry,
}}: {{
  offline?: boolean;
  onRetry?: () => void;
}}) {{
  return (
    <{T} className="hk-empty">
      <{T} className="hk-empty-illus">{{offline ? '☁' : '☀'}}</{T}>
      <{T} style={{{{ fontSize: 17, fontWeight: 700, marginTop: 8 }}}}>{{offline ? 'Connecting…' : 'All clear for now'}}</{T}>
      <{T} style={{{{ fontSize: 13, color: '#5C7170', lineHeight: 1.5, maxWidth: 260 }}}}>
        {{offline
          ? "Your rooms will appear here once you're back online — or as soon as your manager assigns them."
          : 'No rooms are assigned to you for today yet.'}}
      </{T}>
      {{offline && onRetry ? (
        <button type="button" className="hk-empty-cta" onClick={{onRetry}}>
          Retry connection
        </button>
      ) : null}}
    </{T}>
  );
}}
""",
)

write(
    "lib/load-my-day.ts",
    """import { prisma, todayInIST } from '@gojo/db';

import type { Actor } from '@gojo/types';

import type { RoomCardData } from '@/components/room-card-mobile';

export async function loadMyDay(actor: Actor) {
  const assignedDate = todayInIST();
  const assignments = await prisma.roomAssignment.findMany({
    where: { propertyId: actor.propertyId, staffUserId: actor.userId, assignedDate, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  const roomIds = assignments.map((a) => a.roomId);
  const [rooms, roomTypes, user, property] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, id: { in: roomIds }, deletedAt: null },
      orderBy: { number: 'asc' },
    }),
    prisma.roomType.findMany({ where: { propertyId: actor.propertyId, deletedAt: null }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } }),
    prisma.property.findUnique({ where: { id: actor.propertyId }, select: { name: true } }),
  ]);
  const assignmentMap = new Map(assignments.map((a) => [a.roomId, a]));
  const roomTypeMap = new Map(roomTypes.map((rt) => [rt.id, rt.name]));

  const items: RoomCardData[] = rooms.map((room) => ({
    roomId: room.id,
    roomNumber: room.number,
    roomType: roomTypeMap.get(room.roomTypeId) ?? 'Room',
    housekeepingState: room.state,
    taskTypes: assignmentMap.get(room.id)?.taskTypes ?? [],
  }));

  const done = items.filter((r) => r.housekeepingState === 'AVAILABLE').length;
  const inProgress = items.filter((r) => r.housekeepingState === 'DIRTY').length;

  return {
    items,
    done,
    inProgress,
    total: items.length,
    userName: user?.name ?? 'Staff',
    propertyName: property?.name ?? 'Property',
    dateLabel: new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(assignedDate),
  };
}
""",
)

print("batch 1 done")
