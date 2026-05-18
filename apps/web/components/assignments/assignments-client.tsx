'use client';

import { RefreshCw, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';

type Assignment = {
  assignmentId: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  housekeepingState: string;
  staffUserId: string;
  staffName: string;
  taskTypes: string[];
  stateVersion: number;
};
type Unassigned = Pick<Assignment, 'roomId' | 'roomNumber' | 'roomType' | 'housekeepingState'>;
type Staff = { id: string; name: string; phone: string };

export function AssignmentsClient({
  initialAssignments,
  initialUnassigned,
  staff,
}: {
  initialAssignments: Assignment[];
  initialUnassigned: Unassigned[];
  staff: Staff[];
}) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [selectedStaff, setSelectedStaff] = useState(staff[0]?.id ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const coverage = `${unassigned.length} of ${unassigned.length + assignments.length} rooms unassigned`;

  async function refresh() {
    const res = await fetch('/api/room-assignments');
    const data = await res.json();
    setAssignments(data.assignments ?? []);
    setUnassigned(data.unassigned ?? []);
  }

  async function assign(roomId: string) {
    setBusy(roomId);
    try {
      const res = await fetch('/api/room-assignments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId, staffUserId: selectedStaff }),
      });
      if (!res.ok) alert((await res.json()).message ?? 'Assignment failed');
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function reassign(assignment: Assignment, staffUserId: string) {
    setBusy(assignment.roomId);
    try {
      const res = await fetch(`/api/room-assignments/${assignment.assignmentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ staffUserId, stateVersion: assignment.stateVersion }),
      });
      if (!res.ok) alert((await res.json()).message ?? 'Reassignment failed');
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageShell
      header={
        <PageHeader
          variant="list"
          title="Daily Room Assignments"
          subtitle={coverage}
          controls={
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--color-line-soft)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--color-charcoal)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          }
        />
      }
    >
      <section className="grid grid-cols-[minmax(280px,360px)_1fr] gap-5">
        <aside className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-900">Unassigned</p>
            <select value={selectedStaff} onChange={(event) => setSelectedStaff(event.target.value)} className="mt-3 min-h-11 w-full rounded-md border border-slate-200 px-3 text-sm">
              {staff.map((person) => (
                <option key={person.id} value={person.id}>{person.name || person.phone}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 p-3">
            {unassigned.map((room) => (
              <article key={room.roomId} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-slate-900">{room.roomNumber}</p>
                    <p className="text-xs text-slate-500">{room.roomType} · {room.housekeepingState}</p>
                  </div>
                  <button type="button" disabled={busy === room.roomId || !selectedStaff} onClick={() => assign(room.roomId)} className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-teal-600 text-white disabled:bg-slate-300">
                    <UserPlus size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {assignments.map((assignment) => (
            <article key={assignment.assignmentId} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-bold text-slate-900">{assignment.roomNumber}</p>
                  <p className="text-xs text-slate-500">{assignment.roomType} · {assignment.housekeepingState}</p>
                </div>
                <span className="rounded bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">{assignment.staffName}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {assignment.taskTypes.map((task) => (
                  <span key={task} className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{task.replace('_', ' ')}</span>
                ))}
              </div>
              <label className="mt-4 grid gap-1 text-xs font-semibold text-slate-500">
                Reassign
                <select value={assignment.staffUserId} onChange={(event) => reassign(assignment, event.target.value)} className="min-h-11 rounded-md border border-slate-200 px-3 text-sm text-slate-900">
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>{person.name || person.phone}</option>
                  ))}
                </select>
              </label>
            </article>
          ))}
        </section>
      </section>
    </PageShell>
  );
}
