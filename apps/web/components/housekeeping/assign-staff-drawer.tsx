'use client';

import { useEffect, useState } from 'react';

import type { HousekeepingRow, StaffOption } from '@/app/(app)/housekeeping/housekeeping-client';

// Phase C in-page drawer for assign / reassign / unassign.
// Wires to existing endpoints:
//   POST   /api/room-assignments              (assign)
//   PATCH  /api/room-assignments/{id}         (reassign — staff change)
//   DELETE /api/room-assignments/{id}         (unassign)
// Optimistic invalidation is owned by the caller via onSaved.

export function AssignStaffDrawer({
  row,
  staff,
  onClose,
  onSaved,
}: {
  row: HousekeepingRow | null;
  staff: StaffOption[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (row) {
      setPicked(row.assignment?.staffUserId ?? null);
      setError(null);
    }
  }, [row?.roomId, row?.assignment?.id]);

  if (!row) return null;

  const currentId = row.assignment?.staffUserId ?? null;
  const isChange = picked !== null && picked !== currentId;
  const cta = !currentId ? 'Assign' : isChange ? 'Reassign' : 'Save';

  async function submit() {
    if (!row || !picked) return;
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      if (!row.assignment) {
        res = await fetch('/api/room-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: row.roomId, staffUserId: picked }),
        });
      } else {
        res = await fetch(`/api/room-assignments/${row.assignment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffUserId: picked, stateVersion: row.assignment.stateVersion }),
        });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Could not save assignment');
        return;
      }
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function unassign() {
    if (!row?.assignment) return;
    if (!confirm(`Unassign ${row.assignment.name} from room ${row.roomNumber}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/room-assignments/${row.assignment.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stateVersion: row.assignment.stateVersion }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Could not unassign');
        return;
      }
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close drawer"
        className="flex-1 bg-black/30"
        onClick={onClose}
      />
      <aside className="flex h-full w-[380px] flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assign staff</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Room {row.roomNumber}
              <span className="ml-2 text-sm font-normal text-slate-500">{row.roomTypeName}</span>
            </h2>
            {row.assignment ? (
              <p className="mt-1 text-xs text-slate-500">
                Currently assigned to <span className="font-medium text-slate-700">{row.assignment.name}</span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Currently unassigned</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {staff.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              No housekeeping staff configured for this property. Add them under Settings → Users & Roles.
            </p>
          ) : (
            <ul className="space-y-2">
              {staff.map((person) => {
                const selected = picked === person.id;
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(person.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                        selected
                          ? 'border-[#1DA888] bg-[#F0FBF8]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A2B2E] text-xs font-bold text-[#1DA888]">
                        {person.initials}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-slate-900">{person.name}</span>
                        {currentId === person.id ? (
                          <span className="block text-[11px] font-medium text-[#1DA888]">Current assignee</span>
                        ) : null}
                      </span>
                      {selected ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1DA888" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 p-4">
          {row.assignment ? (
            <button
              type="button"
              onClick={unassign}
              disabled={busy}
              className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:text-slate-400"
            >
              Unassign
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !picked || (!isChange && !!currentId)}
              className="rounded-lg bg-[#1DA888] px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:bg-slate-300"
            >
              {busy ? 'Saving…' : cta}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
