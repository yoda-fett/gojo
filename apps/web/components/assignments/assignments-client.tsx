'use client';

import { RefreshCw, UserPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';

// Hotfix-8 Phase D — wireframe 18-assignments fidelity:
//  - 4-KPI strip (Rooms needing service / Assigned / Unassigned / Task mix)
//  - Filter pills (All staff + per-staff)
//  - Two-pane board: Unassigned column on the left + per-staff buckets grid right
//  - Mini-room rows in each bucket with task-type dots and × Unassign button
//  - Click-to-move drawer (pick staff for an Unassigned room) — preferred over
//    drag/drop for desktop clarity; matches the hotfix-7 AssignStaffDrawer flow
//  - Shift window displayed for non-owner roles only (page.tsx already nulls
//    shift for OWNER / CO_OWNER per Owner direction)

type Assignment = {
  roomId: string;
  roomNumber: string;
  roomType: string;
  housekeepingState: string;
  derivedTasks: string[];
  assignmentId: string;
  staffUserId: string;
  staffName: string;
  taskTypes: string[];
  stateVersion: number;
};
type Unassigned = {
  roomId: string;
  roomNumber: string;
  roomType: string;
  housekeepingState: string;
  derivedTasks: string[];
};
type Staff = {
  id: string;
  name: string;
  phone: string;
  initials: string;
  shiftStart: string | null;
  shiftEnd: string | null;
};
type Counts = {
  needingService: number;
  assigned: number;
  unassigned: number;
  taskMix: { CLEAN: number; REFILL: number; STANDARD_LAUNDRY: number; PERIODIC_LAUNDRY: number };
};

const TASK_META: Record<string, { label: string; dot: string; chip: string }> = {
  CLEAN: { label: 'Clean', dot: 'bg-[#2E86AB]', chip: 'bg-[#E4F0F7] text-[#1F5A78]' },
  REFILL: { label: 'Refill', dot: 'bg-[#1DA888]', chip: 'bg-[#EAF6F2] text-[#0F7A5E]' },
  STANDARD_LAUNDRY: { label: 'Laundry', dot: 'bg-[#B5853A]', chip: 'bg-[#FFF3D6] text-[#8B6914]' },
  PERIODIC_LAUNDRY: { label: 'Periodic', dot: 'bg-[#9C4DCC]', chip: 'bg-[#F1E4F8] text-[#6B2A8F]' },
};

const TASK_ORDER = ['CLEAN', 'REFILL', 'STANDARD_LAUNDRY', 'PERIODIC_LAUNDRY'] as const;

export function AssignmentsClient({
  initialAssignments,
  initialUnassigned,
  staff,
  counts,
}: {
  initialAssignments: Assignment[];
  initialUnassigned: Unassigned[];
  staff: Staff[];
  counts: Counts;
}) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [pickerRoom, setPickerRoom] = useState<Unassigned | null>(null);
  const [reassignTarget, setReassignTarget] = useState<Assignment | null>(null);

  // /api/room-assignments doesn't return the `derivedTasks` / counts shape that
  // the server page renders — re-derive client-side after a refresh so the row
  // cards keep their task chips. KPI counts re-derive from the current state.
  function deriveTasksFor(hk: string): string[] {
    return hk === 'DIRTY' ? ['CLEAN', 'REFILL', 'STANDARD_LAUNDRY'] : ['REFILL'];
  }

  async function refresh() {
    const res = await fetch('/api/room-assignments');
    const data = await res.json();
    const nextAssignments: Assignment[] = (data.assignments ?? []).map((row: Assignment) => ({
      ...row,
      derivedTasks: row.derivedTasks ?? deriveTasksFor(row.housekeepingState),
    }));
    const nextUnassigned: Unassigned[] = (data.unassigned ?? []).map((row: Unassigned) => ({
      ...row,
      derivedTasks: row.derivedTasks ?? deriveTasksFor(row.housekeepingState),
    }));
    setAssignments(nextAssignments);
    setUnassigned(nextUnassigned);
  }

  async function assign(roomId: string, staffUserId: string) {
    setBusy(roomId);
    try {
      const res = await fetch('/api/room-assignments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId, staffUserId }),
      });
      if (!res.ok) {
        alert((await res.json()).message ?? 'Assignment failed');
        return;
      }
      setPickerRoom(null);
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
      if (!res.ok) {
        alert((await res.json()).message ?? 'Reassignment failed');
        return;
      }
      setReassignTarget(null);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function unassign(assignment: Assignment) {
    if (!confirm(`Unassign ${assignment.staffName} from room ${assignment.roomNumber}?`)) return;
    setBusy(assignment.roomId);
    try {
      const res = await fetch(`/api/room-assignments/${assignment.assignmentId}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stateVersion: assignment.stateVersion }),
      });
      if (!res.ok) {
        alert((await res.json()).message ?? 'Unassign failed');
        return;
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  const buckets = useMemo(() => {
    return staff.map((person) => ({
      person,
      rooms: assignments.filter((a) => a.staffUserId === person.id),
    }));
  }, [assignments, staff]);

  const visibleBuckets = staffFilter === 'all' ? buckets : buckets.filter((b) => b.person.id === staffFilter);

  return (
    <PageShell
      header={
        <PageHeader
          variant="list"
          title="Daily Room Assignments"
          subtitle={`${counts.assigned} assigned · ${counts.unassigned} unassigned · ${staff.length} staff on shift`}
          controls={
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:border-[#1DA888] hover:text-[#1DA888]"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          }
        />
      }
    >
      {/* KPI strip */}
      <section className="grid grid-cols-4 gap-3">
        <KpiCard label="Rooms needing service" value={counts.needingService} sub="Dirty — housekeeping axis" />
        <KpiCard label="Assigned" value={counts.assigned} sub={`Across ${staff.length} staff`} tone="teal" />
        <KpiCard label="Unassigned" value={counts.unassigned} sub="Pick a staff to dispatch" tone="amber" />
        <TaskMixKpi taskMix={counts.taskMix} />
      </section>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStaffFilter('all')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            staffFilter === 'all'
              ? 'border-[#1DA888] bg-[#1DA888] text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          All staff
        </button>
        {staff.map((person) => {
          const isActive = staffFilter === person.id;
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => setStaffFilter(person.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? 'border-[#1DA888] bg-[#1DA888] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {person.name}
            </button>
          );
        })}
        <span className="ml-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500">
          Tasks: <TaskDot type="CLEAN" /> Clean · <TaskDot type="REFILL" /> Refill · <TaskDot type="STANDARD_LAUNDRY" /> Laundry · <TaskDot type="PERIODIC_LAUNDRY" /> Periodic
        </span>
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
        {/* Unassigned column */}
        <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Unassigned</p>
              <p className="text-[11px] text-slate-500">{unassigned.length} rooms · click to pick staff</p>
            </div>
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              {unassigned.length}
            </span>
          </header>
          <div className="grid gap-2 p-3">
            {unassigned.length === 0 ? (
              <p className="rounded-md bg-slate-50 p-4 text-center text-xs text-slate-500">
                Everything dispatched. Nice work.
              </p>
            ) : (
              unassigned.map((room) => (
                <button
                  key={room.roomId}
                  type="button"
                  onClick={() => setPickerRoom(room)}
                  disabled={busy === room.roomId}
                  className="group flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-[#1DA888] disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-slate-900">{room.roomNumber}</p>
                      <p className="text-[11px] text-slate-500">{room.roomType}</p>
                    </div>
                    <StatusPill state={room.housekeepingState} />
                  </div>
                  <TaskChips tasks={room.derivedTasks} />
                  <span className="text-[11px] font-semibold text-[#1DA888] group-hover:underline">Assign staff →</span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Staff buckets */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleBuckets.map(({ person, rooms }) => (
            <article key={person.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#EAF6F2] text-[12px] font-bold text-[#0A6B58]">
                  {person.initials}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{person.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {person.shiftStart && person.shiftEnd
                      ? `On shift · ${person.shiftStart} – ${person.shiftEnd}`
                      : 'Shift not set'}
                  </p>
                </div>
                <span
                  className={`min-w-7 rounded-full px-2 py-0.5 text-center text-[11px] font-bold ${
                    rooms.length >= 6 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {rooms.length}
                </span>
              </header>
              <div className="grid gap-1 p-2">
                {rooms.length === 0 ? (
                  <p className="rounded-md border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">
                    No rooms yet
                  </p>
                ) : (
                  rooms.map((assignment) => (
                    <MiniRoomRow
                      key={assignment.assignmentId}
                      assignment={assignment}
                      busy={busy === assignment.roomId}
                      onReassign={() => setReassignTarget(assignment)}
                      onUnassign={() => unassign(assignment)}
                    />
                  ))
                )}
              </div>
            </article>
          ))}
          {visibleBuckets.length === 0 ? (
            <p className="col-span-full rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              No housekeeping staff configured for this property.
            </p>
          ) : null}
        </div>
      </section>

      {/* Pickers */}
      {pickerRoom ? (
        <StaffPicker
          title={`Assign room ${pickerRoom.roomNumber}`}
          subtitle={`${pickerRoom.roomType} · ${pickerRoom.derivedTasks.length} tasks`}
          currentStaffId={null}
          staff={staff}
          busy={!!busy}
          onClose={() => setPickerRoom(null)}
          onPick={(staffUserId) => assign(pickerRoom.roomId, staffUserId)}
        />
      ) : null}

      {reassignTarget ? (
        <StaffPicker
          title={`Reassign room ${reassignTarget.roomNumber}`}
          subtitle={`Currently with ${reassignTarget.staffName}`}
          currentStaffId={reassignTarget.staffUserId}
          staff={staff}
          busy={!!busy}
          onClose={() => setReassignTarget(null)}
          onPick={(staffUserId) => reassign(reassignTarget, staffUserId)}
        />
      ) : null}
    </PageShell>
  );
}

function MiniRoomRow({
  assignment,
  busy,
  onReassign,
  onUnassign,
}: {
  assignment: Assignment;
  busy: boolean;
  onReassign: () => void;
  onUnassign: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-transparent px-3 py-2 hover:border-slate-200 hover:bg-slate-50/60">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900">{assignment.roomNumber}</span>
          <span className="text-[11px] text-slate-500">{assignment.roomType}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {assignment.taskTypes.map((t) => (
            <TaskDot key={t} type={t} />
          ))}
          <span className="text-[10px] text-slate-400">{labelHk(assignment.housekeepingState)}</span>
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onReassign}
        title="Reassign"
        aria-label="Reassign"
        className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-[#1DA888] disabled:opacity-50"
      >
        ↔
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onUnassign}
        title="Unassign"
        aria-label="Unassign"
        className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-red-600 disabled:opacity-50"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function TaskChips({ tasks }: { tasks: string[] | undefined }) {
  const list = tasks ?? [];
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {TASK_ORDER.filter((t) => list.includes(t)).map((t) => {
        const meta = TASK_META[t]!;
        return (
          <span key={t} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${meta.chip}`}>
            <span className={`size-1.5 rounded-full ${meta.dot}`} /> {meta.label}
          </span>
        );
      })}
    </div>
  );
}

function TaskDot({ type }: { type: string }) {
  const meta = TASK_META[type];
  if (!meta) return null;
  return <span title={meta.label} className={`inline-block size-1.5 rounded-full ${meta.dot}`} />;
}

function StatusPill({ state }: { state: string }) {
  if (state === 'DIRTY') {
    return <span className="inline-flex items-center rounded-md bg-[#FFF3D6] px-1.5 py-0.5 text-[10px] font-bold text-[#8B6914]">Dirty</span>;
  }
  return <span className="inline-flex items-center rounded-md bg-[#EAF6F2] px-1.5 py-0.5 text-[10px] font-bold text-[#16876c]">Clean</span>;
}

function labelHk(state: string) {
  if (state === 'DIRTY') return 'Dirty';
  if (state === 'CLEAN') return 'Clean';
  return state;
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: 'teal' | 'amber' | 'coral';
}) {
  const color =
    tone === 'teal' ? 'text-teal-700' : tone === 'amber' ? 'text-amber-600' : tone === 'coral' ? 'text-orange-600' : 'text-slate-900';
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function TaskMixKpi({ taskMix }: { taskMix: Counts['taskMix'] }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Task mix today</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-[#2E86AB]">{taskMix.CLEAN}</span>
          <span className="text-[11px] text-slate-500">clean</span>
        </span>
        <span className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-[#1DA888]">{taskMix.REFILL}</span>
          <span className="text-[11px] text-slate-500">refill</span>
        </span>
        <span className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-[#B5853A]">{taskMix.STANDARD_LAUNDRY}</span>
          <span className="text-[11px] text-slate-500">laundry</span>
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {taskMix.PERIODIC_LAUNDRY > 0 ? `${taskMix.PERIODIC_LAUNDRY} periodic scheduled` : 'No periodic items today'}
      </p>
    </div>
  );
}

function StaffPicker({
  title,
  subtitle,
  currentStaffId,
  staff,
  busy,
  onClose,
  onPick,
}: {
  title: string;
  subtitle: string;
  currentStaffId: string | null;
  staff: Staff[];
  busy: boolean;
  onClose: () => void;
  onPick: (staffUserId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="flex h-full w-[380px] flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pick staff</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-3">
          {staff.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              No housekeeping staff configured. Add them under Settings → Users & Roles.
            </p>
          ) : (
            <ul className="space-y-2">
              {staff.map((person) => {
                const isCurrent = person.id === currentStaffId;
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      disabled={busy || isCurrent}
                      onClick={() => onPick(person.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                        isCurrent
                          ? 'border-slate-200 bg-slate-50 text-slate-400'
                          : 'border-slate-200 bg-white hover:border-[#1DA888] hover:bg-[#F0FBF8]'
                      }`}
                    >
                      <span className="flex size-9 items-center justify-center rounded-full bg-[#1A2B2E] text-[11px] font-bold text-[#1DA888]">
                        {person.initials}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-slate-900">{person.name}</span>
                        {person.shiftStart && person.shiftEnd ? (
                          <span className="block text-[11px] text-slate-500">
                            Shift {person.shiftStart} – {person.shiftEnd}
                          </span>
                        ) : null}
                      </span>
                      {isCurrent ? <span className="text-[11px] font-semibold text-slate-400">Current</span> : <UserPlus size={14} className="text-[#1DA888]" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
