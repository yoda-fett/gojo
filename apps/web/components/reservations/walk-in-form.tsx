'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { BelowFloorModal } from '@/components/reservations/below-floor-modal';
import { BaseCard } from '@/components/ui/base-card';
import { Button } from '@/components/ui/button';
import { formatInr } from '@/lib/utils/currency';

export function WalkInForm({
  roomTypes,
  cancellationPolicies,
}: {
  roomTypes: Array<{ id: string; name: string; floorRate: number; ceilingRate: number | null }>;
  cancellationPolicies: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    checkIn: '',
    checkOut: '',
    roomTypeId: roomTypes[0]?.id ?? '',
    roomId: '',
    rate: '',
    selectedCancellationPolicyId: cancellationPolicies[0]?.id ?? '',
  });
  const [belowFloorConfirmed, setBelowFloorConfirmed] = useState(false);
  const [pendingOverride, setPendingOverride] = useState<{ enteredRate: number; floorRate: number; delta: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedRoomType = useMemo(
    () => roomTypes.find((roomType) => roomType.id === form.roomTypeId),
    [form.roomTypeId, roomTypes],
  );

  const roomsQuery = useQuery({
    queryKey: ['available-rooms', form.roomTypeId, form.checkIn, form.checkOut],
    queryFn: async () => {
      const response = await fetch(`/api/reservations/available-rooms?roomTypeId=${form.roomTypeId}&checkIn=${encodeURIComponent(new Date(`${form.checkIn}T14:00:00+05:30`).toISOString())}&checkOut=${encodeURIComponent(new Date(`${form.checkOut}T11:00:00+05:30`).toISOString())}`);
      if (!response.ok) {
        return { rooms: [] as Array<{ roomId: string; roomNumber: string }> };
      }
      return (await response.json()) as { rooms: Array<{ roomId: string; roomNumber: string }> };
    },
    enabled: Boolean(form.roomTypeId && form.checkIn && form.checkOut),
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const rateValue = Number(form.rate);
    if (!selectedRoomType) {
      setError('Select a room type to continue.');
      return;
    }
    if (rateValue < Number(selectedRoomType.floorRate) && !belowFloorConfirmed) {
      setPendingOverride({
        enteredRate: rateValue,
        floorRate: Number(selectedRoomType.floorRate),
        delta: Number(selectedRoomType.floorRate) - rateValue,
      });
      return;
    }

    setSubmitting(true);
    const response = await fetch('/api/reservations/walk-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        rate: rateValue,
        belowFloorOverride: belowFloorConfirmed,
        checkIn: new Date(`${form.checkIn}T14:00:00+05:30`).toISOString(),
        checkOut: new Date(`${form.checkOut}T11:00:00+05:30`).toISOString(),
      }),
    });
    const data = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      if (response.status === 423) {
        setError('Room is temporarily unavailable. Gojo is releasing the hold. Try again in a few seconds.');
        return;
      }

      setError(data.message ?? 'Unable to create walk-in reservation');
      return;
    }

    router.push(`/reservations/${data.data.reservation.id}`);
  }

  return (
    <BaseCard title="Create Walk-in" subtitle="Register a guest, assign a room, and check them in immediately." className="max-w-4xl">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <label className="space-y-2 text-[13px] font-medium">
          <span>Guest Name</span>
          <input required className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={form.guestName} onChange={(event) => setForm((current) => ({ ...current, guestName: event.target.value }))} />
        </label>
        <label className="space-y-2 text-[13px] font-medium">
          <span>Guest Mobile</span>
          <input required minLength={10} className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={form.guestPhone} onChange={(event) => setForm((current) => ({ ...current, guestPhone: event.target.value }))} />
        </label>
        <label className="space-y-2 text-[13px] font-medium">
          <span>Check-in Date</span>
          <input required type="date" className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={form.checkIn} onChange={(event) => setForm((current) => ({ ...current, checkIn: event.target.value, roomId: '' }))} />
        </label>
        <label className="space-y-2 text-[13px] font-medium">
          <span>Check-out Date</span>
          <input required type="date" className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={form.checkOut} onChange={(event) => setForm((current) => ({ ...current, checkOut: event.target.value, roomId: '' }))} />
        </label>
        <label className="space-y-2 text-[13px] font-medium">
          <span>Room Type</span>
          <select required className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={form.roomTypeId} onChange={(event) => setForm((current) => ({ ...current, roomTypeId: event.target.value, roomId: '' }))}>
            {roomTypes.map((roomType) => (
              <option key={roomType.id} value={roomType.id}>{roomType.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-[13px] font-medium">
          <span>Room Number</span>
          <select required className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={form.roomId} onChange={(event) => setForm((current) => ({ ...current, roomId: event.target.value }))}>
            <option value="">Select available room</option>
            {(roomsQuery.data?.rooms ?? []).map((room) => (
              <option key={room.roomId} value={room.roomId}>Room {room.roomNumber}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-[13px] font-medium">
          <span>Nightly Rate</span>
          <input required type="number" min="1" className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={form.rate} onChange={(event) => { setBelowFloorConfirmed(false); setPendingOverride(null); setForm((current) => ({ ...current, rate: event.target.value })); }} />
          {selectedRoomType ? (
            <p className="text-[12px] text-[var(--color-mid-gray)]">
              Suggested range: {formatInr(Number(selectedRoomType.floorRate))}{selectedRoomType.ceilingRate ? ` to ${formatInr(Number(selectedRoomType.ceilingRate))}` : ''}
            </p>
          ) : null}
        </label>
        <label className="space-y-2 text-[13px] font-medium">
          <span>Cancellation Policy</span>
          <select className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={form.selectedCancellationPolicyId} onChange={(event) => setForm((current) => ({ ...current, selectedCancellationPolicyId: event.target.value }))}>
            {cancellationPolicies.map((policy) => (
              <option key={policy.id} value={policy.id}>{policy.name}</option>
            ))}
          </select>
        </label>

        {error ? <p className="md:col-span-2 rounded-[10px] bg-[rgba(232,118,63,0.12)] px-4 py-3 text-[13px] text-[var(--color-coral)]">{error}</p> : null}

        <div className="md:col-span-2 flex flex-wrap gap-3">
          <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Walk-in'}</Button>
          <Button variant="secondary" href="/reservations">Back to Bookings</Button>
        </div>
      </form>
      {pendingOverride ? (
        <BelowFloorModal
          enteredRate={pendingOverride.enteredRate}
          floorRate={pendingOverride.floorRate}
          delta={pendingOverride.delta}
          onCancel={() => setPendingOverride(null)}
          onConfirm={() => {
            setPendingOverride(null);
            setBelowFloorConfirmed(true);
          }}
        />
      ) : null}
    </BaseCard>
  );
}
