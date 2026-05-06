'use client';
// @ts-nocheck
import { differenceInCalendarDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

interface Availability {
  propertyId: string;
  propertyName: string;
  roomTypes: Array<{
    roomTypeId: string;
    name: string;
    description: string | null;
    maxOccupancy: number;
    ratePerNight: number;
    availableRooms: number;
    photos: string[];
  }>;
}

export function BookingWidget({
  slug,
  initialCheckIn,
  initialCheckOut,
  initialAvailability,
  initialNights,
}: {
  slug: string;
  initialCheckIn: string;
  initialCheckOut: string;
  initialAvailability: Availability;
  initialNights: number;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [availability, setAvailability] = useState(initialAvailability);
  const [nights, setNights] = useState(initialNights);
  const [loading, setLoading] = useState(false);
  const [holding, setHolding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guestSession = useMemo(() => {
    if (typeof window === 'undefined') return 'ssr';
    const key = 'gojo_guest_session';
    let value = window.sessionStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      window.sessionStorage.setItem(key, value);
    }
    return value;
  }, []);

  async function refresh(nextCheckIn: string, nextCheckOut: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/widget/${slug}/availability?checkIn=${encodeURIComponent(nextCheckIn)}&checkOut=${encodeURIComponent(nextCheckOut)}`,
      );
      if (!res.ok) throw new Error('Could not load availability');
      const data = (await res.json()) as Availability;
      setAvailability(data);
      setNights(Math.max(1, differenceInCalendarDays(new Date(nextCheckOut), new Date(nextCheckIn))));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function book(roomTypeId: string) {
    setHolding(roomTypeId);
    setError(null);
    try {
      const res = await fetch(`/api/widget/${slug}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomTypeId,
          checkIn: new Date(`${checkIn}T00:00:00+05:30`).toISOString(),
          checkOut: new Date(`${checkOut}T00:00:00+05:30`).toISOString(),
          guestSession,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Could not hold room');
      }
      const data = await res.json();
      router.push(
        `/book/${slug}/payment?holdId=${encodeURIComponent(data.holdId)}&roomTypeId=${encodeURIComponent(roomTypeId)}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setHolding(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="text-sm">
          <span className="block text-slate-600">Check-in</span>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => {
              setCheckIn(e.target.value);
              refresh(e.target.value, checkOut);
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Check-out</span>
          <input
            type="date"
            value={checkOut}
            onChange={(e) => {
              setCheckOut(e.target.value);
              refresh(checkIn, e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <div className="text-sm text-slate-600">
          <span className="block">Nights</span>
          <span className="mt-2 block text-lg font-semibold text-slate-900">{nights}</span>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <ul className="space-y-3">
        {availability.roomTypes.map((rt) => {
          const unavailable = rt.availableRooms === 0;
          const total = rt.ratePerNight * nights;
          return (
            <li
              key={rt.roomTypeId}
              className={`rounded-2xl bg-white p-5 shadow-sm ${unavailable ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{rt.name}</h2>
                  {rt.description ? <p className="mt-1 text-sm text-slate-600">{rt.description}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">
                    Sleeps {rt.maxOccupancy} · {rt.availableRooms} room{rt.availableRooms === 1 ? '' : 's'} available
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">₹{rt.ratePerNight.toLocaleString('en-IN')} / night</p>
                  <p className="text-lg font-semibold text-slate-900">₹{total.toLocaleString('en-IN')}</p>
                  <button
                    type="button"
                    disabled={unavailable || loading || holding === rt.roomTypeId}
                    onClick={() => book(rt.roomTypeId)}
                    className="mt-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
                  >
                    {holding === rt.roomTypeId ? 'Holding…' : unavailable ? 'Unavailable' : 'Book'}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
