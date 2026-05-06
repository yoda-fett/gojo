'use client';
// @ts-nocheck
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export function PaymentForm({
  slug,
  holdId,
  roomTypeId,
  roomTypeName,
  ratePerNight,
  holdExpiresAt,
}: {
  slug: string;
  holdId: string;
  roomTypeId: string;
  roomTypeName: string;
  ratePerNight: number;
  holdExpiresAt: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkIn = searchParams.get('checkIn') ?? new Date().toISOString().slice(0, 10);
  const checkOut = searchParams.get('checkOut') ?? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const nights = Math.max(
    1,
    Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000),
  );
  const total = ratePerNight * nights;

  const expiry = useMemo(() => new Date(holdExpiresAt).getTime(), [holdExpiresAt]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remainingMs = expiry - now;
  const expired = remainingMs <= 0;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      const sessionRes = await fetch(`/api/widget/${slug}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdId,
          roomTypeId,
          checkIn: new Date(`${checkIn}T00:00:00+05:30`).toISOString(),
          checkOut: new Date(`${checkOut}T00:00:00+05:30`).toISOString(),
          guestName: name,
          guestPhone: phone,
          guestEmail: email || undefined,
        }),
      });
      if (!sessionRes.ok) {
        const data = await sessionRes.json().catch(() => ({}));
        throw new Error(data.message || 'Could not start payment');
      }
      const session = await sessionRes.json();

      // Simulate gateway-hosted UPI flow + webhook callback.
      const confirm = await fetch('/api/widget/mock-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatewayOrderId: session.gatewayOrderId }),
      });
      if (!confirm.ok) {
        const data = await confirm.json().catch(() => ({}));
        throw new Error(data.message || 'Payment failed');
      }
      router.push(`/book/${slug}/confirmation?orderId=${encodeURIComponent(session.gatewayOrderId)}`);
    } catch (e) {
      setError((e as Error).message);
      setPaying(false);
    }
  }

  if (expired) {
    return (
      <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-base font-semibold text-slate-900">Your hold has expired</p>
        <p className="mt-1 text-sm text-slate-600">Please start again to find another room.</p>
        <a href={`/book/${slug}`} className="mt-4 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white">
          Start again
        </a>
      </div>
    );
  }

  const mins = Math.floor(remainingMs / 60_000);
  const secs = Math.floor((remainingMs % 60_000) / 1000);

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Hold expires in</p>
        <p className="mt-1 text-2xl font-semibold text-teal-700">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Stay summary</h2>
        <dl className="mt-3 space-y-1 text-sm text-slate-700">
          <div className="flex justify-between"><dt>Room type</dt><dd>{roomTypeName}</dd></div>
          <div className="flex justify-between"><dt>Check-in</dt><dd>{checkIn}</dd></div>
          <div className="flex justify-between"><dt>Check-out</dt><dd>{checkOut}</dd></div>
          <div className="flex justify-between"><dt>Nights</dt><dd>{nights}</dd></div>
          <div className="flex justify-between"><dt>Rate / night</dt><dd>₹{ratePerNight.toLocaleString('en-IN')}</dd></div>
          <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
            <dt>Total</dt><dd>₹{total.toLocaleString('en-IN')}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Guest details</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <button
        type="button"
        disabled={paying || !name || !phone}
        onClick={pay}
        className="w-full rounded-lg bg-teal-600 px-4 py-3 text-base font-semibold text-white disabled:bg-slate-300"
      >
        {paying ? 'Processing…' : `Pay ₹${total.toLocaleString('en-IN')} via UPI`}
      </button>
      <p className="text-center text-xs text-slate-500">
        UPI gateway integration is mocked in Phase 2; payments are auto-confirmed for demo.
      </p>
    </div>
  );
}
