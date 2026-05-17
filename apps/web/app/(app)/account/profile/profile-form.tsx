'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = { initialName: string; phone: string };

export function ProfileForm({ initialName, phone }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    const res = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.message ?? 'Could not save.');
      return;
    }
    setStatus('Saved.');
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="max-w-md space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-dark-gray)]" htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          disabled={saving}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-dark-gray)]" htmlFor="phone">Phone</label>
        <input
          id="phone"
          type="text"
          value={phone}
          readOnly
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-off-white)] px-3 py-2 text-sm text-[var(--color-mid-gray)]"
        />
        <p className="mt-1 text-xs text-[var(--color-mid-gray)]">Contact support to change your phone number.</p>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {status ? <div className="text-sm text-[var(--color-teal)]">{status}</div> : null}

      <button
        type="submit"
        disabled={saving || name === initialName || !name.trim()}
        className="rounded-md bg-[var(--color-teal)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
