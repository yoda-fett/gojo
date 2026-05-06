'use client';
// @ts-nocheck
import { useState } from 'react';

export function DirectBookingSettingsForm({
  propertyId,
  initialEnabled,
  initialRate,
  publicUrl,
}: {
  propertyId: string;
  initialEnabled: boolean;
  initialRate: number;
  publicUrl: string | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [rate, setRate] = useState((initialRate * 100).toFixed(2));
  const [url, setUrl] = useState(publicUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextEnabled: boolean, nextRatePct: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}/direct-booking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: nextEnabled,
          averageOtaCommissionRate: nextRatePct / 100,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Could not save');
      }
      const data = await res.json();
      setEnabled(data.directBookingEnabled);
      if (data.bookingSlug) {
        setUrl(`${window.location.origin}/book/${data.bookingSlug}`);
      } else {
        setUrl(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Enable direct booking</p>
            <p className="text-xs text-slate-500">Generates a public booking URL + QR for your property.</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => save(!enabled, Number(rate))}
            className={`rounded-full px-3 py-1 text-xs font-medium ${enabled ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'}`}
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {url ? (
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Public booking URL</p>
            <code className="mt-1 block truncate text-sm text-slate-700">{url}</code>
            <a
              href={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`}
              className="mt-2 inline-block text-xs font-medium text-teal-700"
              target="_blank"
              rel="noreferrer"
            >
              Download QR code
            </a>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-900">Average OTA commission rate</p>
        <p className="text-xs text-slate-500">Used to estimate commission savings from direct bookings.</p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => save(enabled, Number(rate))}
            className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <span className="text-sm text-slate-600">%</span>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
