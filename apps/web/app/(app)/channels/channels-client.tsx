'use client';
// @ts-nocheck
import { useState } from 'react';

interface Channel {
  id: string;
  channelType: string;
  channelName: string;
  webhookEndpoint: string;
  status: 'CONNECTED' | 'ROTATING' | 'DISCONNECTED';
  connectedAt: string | Date;
}

const CHANNEL_TYPES = [
  { value: 'MMT', label: 'MakeMyTrip' },
  { value: 'BOOKING_COM', label: 'Booking.com' },
  { value: 'AGODA', label: 'Agoda' },
  { value: 'GOIBIBO', label: 'Goibibo' },
  { value: 'OTHER', label: 'Other' },
] as const;

export function ChannelsClient({
  initialChannels,
  canMutate,
}: {
  initialChannels: Channel[];
  canMutate: boolean;
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/channels');
    if (res.ok) setChannels((await res.json()).channels);
  }

  async function connect(channelType: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/channels/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Could not connect');
      }
      const data = await res.json();
      setRevealed((prev) => ({ ...prev, [data.id]: data.secret }));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rotate(channelId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/channels/${channelId}/rotate-secret`, { method: 'POST' });
      if (!res.ok) throw new Error('Rotation failed');
      const data = await res.json();
      setRevealed((prev) => ({ ...prev, [channelId]: data.secret }));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(channelId: string) {
    if (!confirm('Disconnect this channel? OTA webhooks will be rejected.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/channels/${channelId}/disconnect`, { method: 'POST' });
      if (!res.ok) throw new Error('Disconnect failed');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const connectedTypes = new Set(channels.filter((c) => c.status !== 'DISCONNECTED').map((c) => c.channelType));
  const available = CHANNEL_TYPES.filter((t) => !connectedTypes.has(t.value));

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {channels.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm">
          No channels connected yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {channels.map((c) => (
            <li key={c.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">{c.channelName}</p>
                  <p className="text-xs text-slate-500">
                    {c.status === 'ROTATING' ? 'Rotating secret' : 'Connected'}
                  </p>
                </div>
                {canMutate ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => rotate(c.id)}
                      className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Rotate secret
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => disconnect(c.id)}
                      className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Webhook URL</p>
                <code className="mt-1 block break-all text-xs text-slate-700">{c.webhookEndpoint}</code>
              </div>
              {revealed[c.id] ? (
                <div className="mt-3 rounded-lg bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-900">
                    Save this secret now — it will not be shown again.
                  </p>
                  <code className="mt-1 block break-all text-xs text-amber-900">{revealed[c.id]}</code>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canMutate && available.length > 0 ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Connect a channel</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {available.map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={busy}
                onClick={() => connect(t.value)}
                className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white disabled:bg-slate-300"
              >
                + {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
