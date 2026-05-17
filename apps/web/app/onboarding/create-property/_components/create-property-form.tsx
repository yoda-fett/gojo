'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CreatePropertyForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim().length > 0 && city.trim().length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), city: city.trim() }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSubmitting(false);
      setError(payload.message ?? 'Could not create property');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-bold text-[#1A2B2E]">Set up your property</h1>
      <p className="mt-2 text-sm text-[#5C7170]">
        Just two fields to get started — you can complete the rest from Settings later.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[#5C7170]">
            Property name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={120}
            placeholder="e.g. Mountain Echo Resort"
            className="mt-1 w-full rounded-md border border-[#D9E5E3] px-3 py-2 text-sm text-[#1A2B2E] focus:border-[#1DA888] focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[#5C7170]">
            City
          </span>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={80}
            placeholder="e.g. Manali"
            className="mt-1 w-full rounded-md border border-[#D9E5E3] px-3 py-2 text-sm text-[#1A2B2E] focus:border-[#1DA888] focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={!ready || submitting}
          className="w-full rounded-md bg-[#1DA888] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0E7C7B] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? 'Creating…' : 'Create property & start trial'}
        </button>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <p className="text-xs text-[#9EAEAC]">
          Your 4-month free trial starts now. You can add rooms, rate plans, and team members from
          Settings.
        </p>
      </form>
    </main>
  );
}
