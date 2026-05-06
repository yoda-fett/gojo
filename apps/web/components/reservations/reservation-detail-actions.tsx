'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function ReservationDetailActions({ reservation, role }: { reservation: any; role: 'OWNER' | 'MANAGER' | 'FRONT_DESK' }) {
  const router = useRouter();
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revealId() {
    const response = await fetch(`/api/reservations/${reservation.id}/reveal-id`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.message ?? 'Unable to reveal guest ID');
      return;
    }
    setRevealedId(data.value);
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
    const data = await response.json();
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
      body: JSON.stringify({
        stateVersion: reservation.stateVersion,
        reason,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.message ?? 'Unable to cancel reservation');
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-3">
      {reservation.rawStatus === 'CONFIRMED' ? <Button variant="secondary" href={`/reservations/${reservation.id}/check-in`}>Check In</Button> : null}
      {reservation.rawStatus === 'CHECKED_IN' ? <Button variant="secondary" href={`/reservations/${reservation.id}/check-out`}>Check Out</Button> : null}
      {reservation.rawStatus === 'CONFIRMED' ? <Button variant="ghost" onClick={markNoShow}>Mark No-Show</Button> : null}
      {role !== 'FRONT_DESK' ? <Button variant="ghost" href={`/reservations/${reservation.id}/amend`}>Amend</Button> : null}
      {role !== 'FRONT_DESK' && reservation.rawStatus === 'CONFIRMED' ? <Button variant="ghost" onClick={cancelReservation}>Cancel</Button> : null}
      {role !== 'FRONT_DESK' && reservation.guest.idMasked ? <Button variant="ghost" onClick={revealId}>Reveal ID</Button> : null}
      {revealedId ? <p className="w-full text-[13px] text-[var(--color-mid-gray)]">Sensitive ID visible for 30 seconds: {revealedId}</p> : null}
      {error ? <p className="w-full text-[13px] text-[var(--color-coral)]">{error}</p> : null}
    </div>
  );
}
