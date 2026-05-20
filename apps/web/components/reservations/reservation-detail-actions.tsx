'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Pencil, LogIn, LogOut, UserX, XCircle, Eye } from 'lucide-react';

const BTN =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-[12.5px] font-medium no-underline transition';
const SECONDARY = `${BTN} border-[#e8efee] bg-white text-[var(--color-charcoal)] hover:border-[var(--color-mid-gray)]`;
const PRIMARY = `${BTN} border-[var(--color-teal)] bg-[var(--color-teal)] text-white hover:border-[var(--color-teal-dark)] hover:bg-[var(--color-teal-dark)]`;

type ActionsReservation = {
  id: string;
  rawStatus: string;
  stateVersion: number;
  guest: { fullName: string; idMasked?: string | null };
};

export function ReservationDetailActions({
  reservation,
  role,
  onAmend,
}: {
  reservation: ActionsReservation;
  role: 'OWNER' | 'MANAGER' | 'FRONT_DESK';
  onAmend: () => void;
}) {
  const router = useRouter();
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revealId() {
    const response = await fetch(`/api/reservations/${reservation.id}/reveal-id`, { method: 'POST' });
    const data = (await response.json()) as { message?: string; value?: string };
    if (!response.ok) {
      setError(data.message ?? 'Unable to reveal guest ID');
      return;
    }
    setRevealedId(data.value ?? null);
    window.setTimeout(() => setRevealedId(null), 30_000);
  }

  async function markNoShow() {
    if (!window.confirm(`Mark ${reservation.guest.fullName} as no-show? The room will be released.`)) {
      return;
    }
    const response = await fetch(`/api/reservations/${reservation.id}/no-show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stateVersion: reservation.stateVersion }),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(data.message ?? 'Unable to mark reservation as no-show');
      return;
    }
    router.refresh();
  }

  async function cancelReservation() {
    const reason = window.prompt('Cancellation reason');
    if (!reason) return;
    const response = await fetch(`/api/reservations/${reservation.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stateVersion: reservation.stateVersion, reason }),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(data.message ?? 'Unable to cancel reservation');
      return;
    }
    router.refresh();
  }

  return (
    <>
      {role !== 'FRONT_DESK' ? (
        <button type="button" className={SECONDARY} onClick={onAmend}>
          <Pencil className="size-3" />
          Amend
        </button>
      ) : null}
      {reservation.rawStatus === 'CONFIRMED' ? (
        <button type="button" className={SECONDARY} onClick={() => void markNoShow()}>
          <UserX className="size-3" />
          Mark No-Show
        </button>
      ) : null}
      {role !== 'FRONT_DESK' && reservation.rawStatus === 'CONFIRMED' ? (
        <button type="button" className={SECONDARY} onClick={() => void cancelReservation()}>
          <XCircle className="size-3" />
          Cancel
        </button>
      ) : null}
      {role !== 'FRONT_DESK' && reservation.guest.idMasked ? (
        <button type="button" className={SECONDARY} onClick={() => void revealId()}>
          <Eye className="size-3" />
          Reveal ID
        </button>
      ) : null}
      {reservation.rawStatus === 'CONFIRMED' ? (
        <Link href={`/reservations/${reservation.id}/check-in`} className={PRIMARY}>
          <LogIn className="size-3" />
          Check In
        </Link>
      ) : null}
      {reservation.rawStatus === 'CHECKED_IN' ? (
        <Link href={`/reservations/${reservation.id}/check-out`} className={PRIMARY}>
          <LogOut className="size-3" />
          Check Out
        </Link>
      ) : null}
      {revealedId ? (
        <span className="text-[11px] text-[var(--color-mid-gray)]">ID (30s): {revealedId}</span>
      ) : null}
      {error ? <span className="text-[12px] text-[var(--color-coral)]">{error}</span> : null}
    </>
  );
}
