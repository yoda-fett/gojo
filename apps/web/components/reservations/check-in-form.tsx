'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BaseCard } from '@/components/ui/base-card';
import { Button } from '@/components/ui/button';

export function CheckInForm({ reservation }: { reservation: any }) {
  const router = useRouter();
  const [idType, setIdType] = useState<'AADHAAR' | 'PASSPORT' | 'DRIVING_LICENCE' | 'VOTER_ID'>('AADHAAR');
  const [idNumber, setIdNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const response = await fetch(`/api/reservations/${reservation.id}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stateVersion: reservation.stateVersion,
        idType,
        idNumber,
      }),
    });
    const data = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setError(data.message ?? 'Unable to complete check-in');
      return;
    }

    router.push(`/reservations/${reservation.id}`);
    router.refresh();
  }

  return (
    <BaseCard title="Check In Guest" subtitle="Confirm the stay and capture the guest ID before arrival is marked complete." className="max-w-3xl">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <div className="rounded-[10px] border border-[#edf3f1] bg-[#f7faf9] px-4 py-3 md:col-span-2">
          <p className="text-[13px] font-semibold">{reservation.guest.fullName}</p>
          <p className="mt-1 text-[12px] text-[var(--color-mid-gray)]">{reservation.guest.phone} • Room {reservation.room.number} • {reservation.room.roomType}</p>
        </div>
        <label className="space-y-2 text-[13px] font-medium">
          <span>ID Type</span>
          <select className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={idType} onChange={(event) => setIdType(event.target.value as never)}>
            <option value="AADHAAR">Aadhaar</option>
            <option value="PASSPORT">Passport</option>
            <option value="DRIVING_LICENCE">Driving Licence</option>
            <option value="VOTER_ID">Voter ID</option>
          </select>
        </label>
        <label className="space-y-2 text-[13px] font-medium">
          <span>ID Number</span>
          <input required className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={idNumber} onChange={(event) => setIdNumber(event.target.value)} />
        </label>
        {idNumber ? <p className="text-[12px] text-[var(--color-mid-gray)] md:col-span-2">Masked preview after save: •••• {idNumber.replace(/\s+/g, '').slice(-4)}</p> : null}
        {error ? <p className="md:col-span-2 rounded-[10px] bg-[rgba(232,118,63,0.12)] px-4 py-3 text-[13px] text-[var(--color-coral)]">{error}</p> : null}
        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="submit" disabled={submitting}>{submitting ? 'Checking In...' : 'Complete Check In'}</Button>
          <Button variant="secondary" href={`/reservations/${reservation.id}`}>Back to Reservation</Button>
        </div>
      </form>
    </BaseCard>
  );
}
