'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { BelowFloorModal } from '@/components/reservations/below-floor-modal';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Drawer } from '@/components/ui/drawer';
import { todayIST } from '@/lib/tz';
import { formatInr } from '@/lib/utils/currency';

type RoomTypeOption = { id: string; name: string; floorRate: number };

type AmendDetail = {
  bookingReference: string;
  checkIn: string;
  checkOut: string;
  nightlyRate: number;
  stateVersion: number;
  room: { id: string; number: string; roomTypeId: string };
};

const FIELD_CLASS = 'min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3 text-[13px]';

export function AmendReservationDrawer({
  open,
  reservationId,
  onClose,
  onAmended,
  roomTypes,
}: {
  open: boolean;
  reservationId: string;
  onClose: () => void;
  onAmended: () => void;
  roomTypes: RoomTypeOption[];
}) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery<AmendDetail>({
    queryKey: ['reservation-detail', reservationId],
    queryFn: async () => {
      const response = await fetch(`/api/reservations/${reservationId}`);
      if (!response.ok) throw new Error('Unable to load reservation');
      return (await response.json()) as AmendDetail;
    },
    enabled: open && Boolean(reservationId),
  });
  const detail = detailQuery.data;

  const [form, setForm] = useState({ checkIn: '', checkOut: '', roomTypeId: '', roomId: '', rate: '' });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [belowFloorConfirmed, setBelowFloorConfirmed] = useState(false);
  const [pendingOverride, setPendingOverride] = useState<{ enteredRate: number; floorRate: number; delta: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill the form once the reservation detail arrives for this row.
  useEffect(() => {
    if (open && detail && loadedFor !== reservationId) {
      setForm({
        checkIn: detail.checkIn.slice(0, 10),
        checkOut: detail.checkOut.slice(0, 10),
        roomTypeId: detail.room.roomTypeId,
        roomId: detail.room.id,
        rate: String(detail.nightlyRate),
      });
      setLoadedFor(reservationId);
      setDirty(false);
      setBelowFloorConfirmed(false);
      setError(null);
    }
  }, [open, detail, reservationId, loadedFor]);

  useEffect(() => {
    if (!open) setLoadedFor(null);
  }, [open]);

  const selectedRoomType = useMemo(
    () => roomTypes.find((roomType) => roomType.id === form.roomTypeId),
    [form.roomTypeId, roomTypes],
  );

  const nights = form.checkIn && form.checkOut
    ? Math.max(1, Math.round((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86_400_000))
    : 0;
  const rateBelowFloor =
    Boolean(selectedRoomType) && Number(form.rate) > 0 && Number(form.rate) < Number(selectedRoomType?.floorRate ?? 0);

  const roomsQuery = useQuery({
    queryKey: ['available-rooms-amend', reservationId, form.roomTypeId, form.checkIn, form.checkOut],
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

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setDirty(true);
    setForm((current) => ({ ...current, [key]: value }));
  }

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
    if (!detail || !selectedRoomType) {
      setError('Select a room type to continue.');
      return;
    }

    const rateValue = Number(form.rate);
    if (rateValue < Number(selectedRoomType.floorRate) && !belowFloorConfirmed) {
      setPendingOverride({
        enteredRate: rateValue,
        floorRate: Number(selectedRoomType.floorRate),
        delta: Number(selectedRoomType.floorRate) - rateValue,
      });
      return;
    }

    setSubmitting(true);
    const response = await fetch(`/api/reservations/${reservationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stateVersion: detail.stateVersion,
        checkIn: new Date(`${form.checkIn}T14:00:00+05:30`).toISOString(),
        checkOut: new Date(`${form.checkOut}T11:00:00+05:30`).toISOString(),
        roomTypeId: form.roomTypeId,
        roomId: form.roomId,
        rate: rateValue,
        belowFloorOverride: belowFloorConfirmed,
      }),
    });
    const data = (await response.json()) as { message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(data.message ?? 'Unable to amend reservation');
      return;
    }

    setDirty(false);
    void queryClient.invalidateQueries({ queryKey: ['reservation-detail', reservationId] });
    void queryClient.invalidateQueries({ queryKey: ['reservation-history', reservationId] });
    onAmended();
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="Amend Reservation"
      subtitle={detail?.bookingReference ?? 'Adjust dates, room, or rate'}
      width={540}
      footer={
        <div className="flex flex-wrap gap-3">
          <Button type="submit" form="amend-reservation-form" disabled={submitting || !detail}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </Button>
          <Button variant="secondary" onClick={handleClose} type="button">
            Cancel
          </Button>
        </div>
      }
    >
      {detailQuery.isLoading || !detail ? (
        <p className="text-[13px] text-[var(--color-mid-gray)]">Loading reservation…</p>
      ) : (
        <form
          id="amend-reservation-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            void onSubmit(event);
          }}
        >
          <label className="space-y-1.5 text-[13px] font-medium">
            <span>Check-in Date</span>
            <input
              required
              type="date"
              className={FIELD_CLASS}
              value={form.checkIn}
              onChange={(event) => {
                setDirty(true);
                setForm((current) => ({ ...current, checkIn: event.target.value, roomId: '' }));
              }}
            />
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
              <option value={detail.room.id}>Keep Room {detail.room.number}</option>
              {(roomsQuery.data?.rooms ?? [])
                .filter((room) => room.roomId !== detail.room.id)
                .map((room) => (
                  <option key={room.roomId} value={room.roomId}>Room {room.roomNumber}</option>
                ))}
            </select>
          </label>
          <label className="space-y-1.5 text-[13px] font-medium sm:col-span-2">
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
                  Below floor ({formatInr(Number(selectedRoomType.floorRate))})
                </p>
              ) : (
                <p className="text-[12px] font-normal text-[var(--color-mid-gray)]">
                  Floor rate: {formatInr(Number(selectedRoomType.floorRate))}
                </p>
              )
            ) : null}
          </label>

          {error ? (
            <p className="rounded-[10px] bg-[rgba(232,118,63,0.12)] px-4 py-3 text-[13px] text-[var(--color-coral)] sm:col-span-2">
              {error}
            </p>
          ) : null}
        </form>
      )}

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
        title="Discard changes?"
        body="Your edits to this reservation will be lost."
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
