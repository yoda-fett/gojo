'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { BelowFloorModal } from '@/components/reservations/below-floor-modal';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Drawer } from '@/components/ui/drawer';
import { todayIST } from '@/lib/tz';
import { formatInr } from '@/lib/utils/currency';

type RoomTypeOption = { id: string; name: string; floorRate: number };
type CancellationPolicyOption = { id: string; name: string };

const FIELD_CLASS = 'min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3 text-[13px]';

export function NewReservationDrawer({
  open,
  onClose,
  onCreated,
  roomTypes,
  cancellationPolicies,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (reservationId: string) => void;
  roomTypes: RoomTypeOption[];
  cancellationPolicies: CancellationPolicyOption[];
}) {
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
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [belowFloorConfirmed, setBelowFloorConfirmed] = useState(false);
  const [pendingOverride, setPendingOverride] = useState<{ enteredRate: number; floorRate: number; delta: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedRoomType = useMemo(
    () => roomTypes.find((roomType) => roomType.id === form.roomTypeId),
    [form.roomTypeId, roomTypes],
  );

  const nights = form.checkIn && form.checkOut
    ? Math.max(1, Math.round((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86_400_000))
    : 0;
  const rateBelowFloor =
    Boolean(selectedRoomType) && Number(form.rate) > 0 && Number(form.rate) < Number(selectedRoomType?.floorRate ?? 0);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setDirty(true);
    setForm((current) => ({ ...current, [key]: value }));
  }

  const roomsQuery = useQuery({
    queryKey: ['available-rooms-new', form.roomTypeId, form.checkIn, form.checkOut],
    queryFn: async () => {
      const response = await fetch(
        `/api/reservations/available-rooms?roomTypeId=${form.roomTypeId}&checkIn=${encodeURIComponent(new Date(`${form.checkIn}T14:00:00+05:30`).toISOString())}&checkOut=${encodeURIComponent(new Date(`${form.checkOut}T11:00:00+05:30`).toISOString())}`,
      );
      if (!response.ok) {
        return { rooms: [] as Array<{ roomId: string; roomNumber: string }> };
      }
      return (await response.json()) as { rooms: Array<{ roomId: string; roomNumber: string }> };
    },
    enabled: open && Boolean(form.roomTypeId && form.checkIn && form.checkOut),
  });

  function handleClose() {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

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
        guestPhone: `+91${form.guestPhone}`,
        rate: rateValue,
        belowFloorOverride: belowFloorConfirmed,
        checkIn: new Date(`${form.checkIn}T14:00:00+05:30`).toISOString(),
        checkOut: new Date(`${form.checkOut}T11:00:00+05:30`).toISOString(),
      }),
    });
    const data = (await response.json()) as {
      message?: string;
      data: { reservation: { id: string } };
    };
    setSubmitting(false);

    if (!response.ok) {
      if (response.status === 423) {
        setError('Room is temporarily unavailable. Gojo is releasing the hold. Try again in a few seconds.');
        return;
      }
      setError(data.message ?? 'Unable to create reservation');
      return;
    }

    setDirty(false);
    onCreated(data.data.reservation.id);
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="New Reservation"
      subtitle="Register a guest and assign a room"
      width={540}
      footer={
        <div className="flex flex-wrap gap-3">
          <Button type="submit" form="new-reservation-form" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Reservation'}
          </Button>
          <Button variant="secondary" onClick={handleClose} type="button">
            Cancel
          </Button>
        </div>
      }
    >
      <form
        id="new-reservation-form"
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          void onSubmit(event);
        }}
      >
        <label className="space-y-1.5 text-[13px] font-medium">
          <span>Guest Name</span>
          <input required className={FIELD_CLASS} value={form.guestName} onChange={(event) => update('guestName', event.target.value)} />
        </label>
        <label className="space-y-1.5 text-[13px] font-medium">
          <span>Guest Mobile</span>
          <div className="flex min-h-11 items-center rounded-[10px] border border-[#d7e3e0] focus-within:border-[var(--color-teal)]">
            <span className="select-none border-r border-[#d7e3e0] px-3 text-[13px] text-[var(--color-mid-gray)]">+91</span>
            <input
              required
              type="tel"
              inputMode="numeric"
              minLength={10}
              maxLength={10}
              placeholder="98765 43210"
              className="min-h-11 w-full rounded-r-[10px] bg-transparent px-3 text-[13px] font-normal outline-none"
              value={form.guestPhone}
              onChange={(event) => update('guestPhone', event.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>
        </label>
        <label className="space-y-1.5 text-[13px] font-medium">
          <span>Check-in Date</span>
          <input
            required
            type="date"
            min={todayIST()}
            className={FIELD_CLASS}
            value={form.checkIn}
            onChange={(event) => {
              setDirty(true);
              setForm((current) => ({ ...current, checkIn: event.target.value, roomId: '' }));
            }}
          />
          {form.checkIn ? (
            <p className="text-[12px] font-normal text-[var(--color-mid-gray)]">
              {form.checkIn === todayIST() ? 'Same-day · checks in immediately' : 'Future-dated · creates as Confirmed'}
            </p>
          ) : null}
        </label>
        <label className="space-y-1.5 text-[13px] font-medium">
          <span>Check-out Date</span>
          <input
            required
            type="date"
            min={form.checkIn || todayIST()}
            className={FIELD_CLASS}
            value={form.checkOut}
            onChange={(event) => {
              setDirty(true);
              setForm((current) => ({ ...current, checkOut: event.target.value, roomId: '' }));
            }}
          />
          {nights > 0 ? (
            <p className="text-[12px] font-normal text-[var(--color-mid-gray)]">
              {nights} {nights === 1 ? 'night' : 'nights'}
            </p>
          ) : null}
        </label>
        <label className="space-y-1.5 text-[13px] font-medium">
          <span>Room Type</span>
          <select
            required
            className={FIELD_CLASS}
            value={form.roomTypeId}
            onChange={(event) => {
              setDirty(true);
              setForm((current) => ({ ...current, roomTypeId: event.target.value, roomId: '' }));
            }}
          >
            {roomTypes.map((roomType) => (
              <option key={roomType.id} value={roomType.id}>{roomType.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-[13px] font-medium">
          <span>Room Number</span>
          <select required className={FIELD_CLASS} value={form.roomId} onChange={(event) => update('roomId', event.target.value)}>
            <option value="">Select available room</option>
            {(roomsQuery.data?.rooms ?? []).map((room) => (
              <option key={room.roomId} value={room.roomId}>Room {room.roomNumber}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-[13px] font-medium">
          <span>Nightly Rate</span>
          <input
            required
            type="number"
            min="1"
            className={FIELD_CLASS}
            value={form.rate}
            onChange={(event) => {
              setBelowFloorConfirmed(false);
              setPendingOverride(null);
              update('rate', event.target.value);
            }}
          />
          {selectedRoomType ? (
            rateBelowFloor ? (
              <p className="text-[12px] font-normal text-[var(--color-coral)]">
                Below floor price ({formatInr(Number(selectedRoomType.floorRate))})
              </p>
            ) : (
              <p className="text-[12px] font-normal text-[var(--color-mid-gray)]">
                Floor rate: {formatInr(Number(selectedRoomType.floorRate))}
              </p>
            )
          ) : null}
        </label>
        <label className="space-y-1.5 text-[13px] font-medium">
          <span>Cancellation Policy</span>
          <select
            className={FIELD_CLASS}
            value={form.selectedCancellationPolicyId}
            onChange={(event) => update('selectedCancellationPolicyId', event.target.value)}
          >
            {cancellationPolicies.map((policy) => (
              <option key={policy.id} value={policy.id}>{policy.name}</option>
            ))}
          </select>
        </label>

        {error ? (
          <p className="rounded-[10px] bg-[rgba(232,118,63,0.12)] px-4 py-3 text-[13px] text-[var(--color-coral)] sm:col-span-2">
            {error}
          </p>
        ) : null}
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

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard reservation?"
        body="Your entries will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </Drawer>
  );
}
