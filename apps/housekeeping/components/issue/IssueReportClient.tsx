// @ts-nocheck
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { CategoryPicker } from './CategoryPicker';
import { MicHeroRecorder } from './MicHeroRecorder';
import { PrefillBanner } from './PrefillBanner';
import { SyncIndicator } from '../sync-indicator';

function lockedCategory(entryContext: string) {
  if (entryContext === 'MISSING_FROM_ROOM') return 'MISSING_ITEM';
  if (entryContext === 'DAMAGED_ON_RETURN') return 'DAMAGED_RETURN';
  return 'DAMAGE_IN_ROOM';
}

export function IssueReportClient({ context, returnHref }: { context: any; returnHref: string }) {
  const [category, setCategory] = useState(lockedCategory(context.entryContext));
  const [voice, setVoice] = useState(null);
  const [textNote, setTextNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [toast, setToast] = useState('');
  const [sync, setSync] = useState({ state: 'synced', pendingCount: 0, queued: [] });
  const locked = context.entryContext !== 'COLD';
  const enabled = Boolean(voice || textNote.trim());
  const remaining = 280 - textNote.length;

  const payload = useMemo(() => ({
    entryContext: context.entryContext,
    category,
    roomId: context.roomId || undefined,
    catalogItemId: context.catalogItemId || undefined,
    qty: context.qty || undefined,
    vendorName: context.vendorName || undefined,
    textNote: textNote.trim() || undefined,
  }), [category, context, textNote]);

  async function submit() {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null) form.append(key, String(value));
    }
    if (voice?.blob) {
      form.append('voiceFile', voice.blob, 'issue-voice.webm');
      form.append('voiceSeconds', String(voice.seconds));
    }
    if (photo) form.append('photoFile', photo, photo.name);
    const res = await fetch('/api/issue-reports', { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() }, body: form });
    if (res.status === 202) {
      setSync({ state: 'pending', pendingCount: 1, queued: ['Issue report'] });
      setToast('Report queued. It will send when online.');
      return;
    }
    if (res.ok) {
      setSync({ state: 'synced', pendingCount: 0, queued: [] });
      setToast('Report sent. Owner will review.');
      window.setTimeout(() => {
        window.location.href = `${returnHref}?toast=${encodeURIComponent('Report sent. Owner will review.')}`;
      }, 500);
    }
  }

  return (
    <main className="hk-screen" style={{ paddingBottom: 104 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Link href={returnHref} style={{ minHeight: 44, display: 'grid', placeItems: 'center', color: '#127C69', fontWeight: 900 }}>Back</Link>
        <h1 style={{ margin: 0, fontSize: 20 }}>Issue Report</h1>
        <SyncIndicator {...sync} />
      </header>
      {toast ? <div style={{ marginBottom: 10, borderRadius: 8, padding: 10, background: '#E7F4F1', color: '#127C69', fontWeight: 900 }}>{toast}</div> : null}
      <PrefillBanner context={context} />
      <section className="hk-card" style={{ padding: 14, marginBottom: 12 }}>
        <MicHeroRecorder value={voice} onChange={setVoice} />
      </section>
      <section className="hk-card" style={{ padding: 14, marginBottom: 12 }}>
        <CategoryPicker value={category} locked={locked} onChange={setCategory} />
      </section>
      <section className="hk-card" style={{ padding: 14, display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 6, color: '#66736F', fontSize: 12, fontWeight: 900 }}>
          Note
          <textarea
            value={textNote}
            maxLength={280}
            onChange={(event) => setTextNote(event.target.value.slice(0, 280))}
            rows={4}
            style={{ resize: 'none', border: '1px solid #DBE7E4', borderRadius: 8, padding: 10, color: '#172321' }}
          />
          <span>{remaining} left</span>
        </label>
        <label style={{ display: 'grid', gap: 6, color: '#66736F', fontSize: 12, fontWeight: 900 }}>
          Photo
          <input type="file" accept="image/png,image/jpeg" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
        </label>
      </section>
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, maxWidth: 430, margin: '0 auto', padding: 12, background: 'rgba(255,255,255,0.96)', borderTop: '1px solid #DBE7E4' }}>
        <button className="hk-button" type="button" disabled={!enabled} onClick={submit} style={{ width: '100%', background: enabled ? '#1DA888' : '#CBD5D1' }}>
          {enabled ? 'Submit Report' : 'Add voice or text'}
        </button>
      </div>
    </main>
  );
}
