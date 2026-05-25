// @ts-nocheck
'use client';

import { Camera, ChevronDown, DoorOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { CategoryPicker } from './CategoryPicker';
import { MicHeroRecorder } from './MicHeroRecorder';
import { PrefillBanner } from './PrefillBanner';
import { PwaShell } from '../pwa-shell';
import { compressImage } from '@/lib/compress-image';

function lockedCategory(entryContext: string) {
  if (entryContext === 'MISSING_FROM_ROOM') return 'MISSING_ITEM';
  if (entryContext === 'DAMAGED_ON_RETURN') return 'DAMAGED_RETURN';
  return 'DAMAGE_IN_ROOM';
}

function titleFor(entryContext: string) {
  if (entryContext === 'MISSING_FROM_ROOM') return 'Report Missing Item';
  if (entryContext === 'DAMAGED_ON_RETURN') return 'Report Damaged Return';
  return 'Report an Issue';
}

function eyebrowFor(entryContext: string) {
  if (entryContext === 'MISSING_FROM_ROOM') return 'Issue Report · from Linen Swap';
  if (entryContext === 'DAMAGED_ON_RETURN') return 'Issue Report · from Laundry';
  return 'Issue Report';
}

function subtitleFor(entryContext: string) {
  if (entryContext !== 'COLD') return 'Owner reviews · queued for approval';
  return 'Speak in any language · owner reviews';
}

export function IssueReportClient({ context, returnHref }: { context: any; returnHref: string }) {
  const [category, setCategory] = useState(lockedCategory(context.entryContext));
  const [voice, setVoice] = useState(null);
  const [textNote, setTextNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Discrete stage shown in the overlay so the user knows what's happening
  // (compression takes ~10s on phones; upload is fast).
  const [submitStage, setSubmitStage] = useState<'compressing' | 'uploading' | null>(null);
  const locked = context.entryContext !== 'COLD';
  const enabled = Boolean(voice || textNote.trim());
  const remaining = 280 - textNote.length;

  // Object URL preview cleanup.
  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  async function handlePhoto(file: File | null | undefined) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    if (!file) {
      setPhoto(null);
      setPhotoUrl(null);
      return;
    }
    // Compress before storing so the submit payload stays under Vercel's
    // 4.5 MB body cap. Originals from modern phone cameras are 5–10 MB.
    // This step can take ~10s on phones — overlay it so the user waits.
    setSubmitStage('compressing');
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      setPhotoUrl(URL.createObjectURL(compressed));
    } finally {
      setSubmitStage(null);
    }
  }

  // Server schemas (@gojo/db) are strict — unknown keys 422. Build the payload
  // shape per entryContext so stray context defaults don't leak through.
  const payload = useMemo(() => {
    const note = textNote.trim() || undefined;
    if (context.entryContext === 'MISSING_FROM_ROOM') {
      return {
        entryContext: context.entryContext,
        category: 'MISSING_ITEM',
        roomId: context.roomId,
        catalogItemId: context.catalogItemId,
        qty: context.qty,
        textNote: note,
      };
    }
    if (context.entryContext === 'DAMAGED_ON_RETURN') {
      return {
        entryContext: context.entryContext,
        category: 'DAMAGED_RETURN',
        catalogItemId: context.catalogItemId,
        qty: context.qty,
        vendorName: context.vendorName,
        textNote: note,
      };
    }
    // COLD — only the fields the schema allows.
    return {
      entryContext: context.entryContext,
      category,
      roomId: context.roomId || undefined,
      catalogItemId: context.catalogItemId || undefined,
      vendorName: context.vendorName || undefined,
      textNote: note,
    };
  }, [category, context, textNote]);

  async function submit() {
    setError('');
    setSubmitting(true);
    setSubmitStage('uploading');
    try {
      const form = new FormData();
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined && value !== null) form.append(key, String(value));
      }
      if (voice?.blob) {
        form.append('voiceFile', voice.blob, 'issue-voice.webm');
        form.append('voiceSeconds', String(voice.seconds));
      }
      if (photo) form.append('photoFile', photo, photo.name);
      const res = await fetch('/api/issue-reports', {
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
        body: form,
      });
      if (res.status === 202) {
        setToast('Report queued. It will send when online.');
        return;
      }
      if (res.ok) {
        setToast('Report sent. Owner will review.');
        window.setTimeout(() => {
          window.location.href = `${returnHref}?toast=${encodeURIComponent('Report sent. Owner will review.')}`;
        }, 500);
        return;
      }
      // Non-OK response — surface the server error so the owner sees why.
      let message = `Submit failed (HTTP ${res.status}).`;
      try {
        const body = await res.json();
        const parts: string[] = [];
        if (body?.message) parts.push(body.message);
        if (body?.field) parts.push(`field: ${body.field}`);
        if (body?.reason) parts.push(`reason: ${body.reason}`);
        if (parts.length > 0) message = `${parts.join(' · ')} (HTTP ${res.status})`;
      } catch {
        // body wasn't JSON; keep the generic message.
      }
      setError(message);
    } catch (err) {
      // Network / fetch threw before reaching the server.
      setError(err instanceof Error ? `Network error: ${err.message}` : 'Network error — please retry.');
    } finally {
      setSubmitting(false);
      setSubmitStage(null);
    }
  }

  // Sticky helper copy per wireframe states.
  const helperText = !enabled
    ? 'Add a voice note or text to continue'
    : voice && photo
      ? 'Voice + photo captured · ready to send.'
      : voice
        ? 'Voice captured · ready to send.'
        : photo
          ? 'Text + photo captured · ready to send.'
          : 'Text captured · ready to send.';
  const helperTone: 'ok' | 'warn' | undefined = enabled ? 'ok' : undefined;

  return (
    <PwaShell
      title={titleFor(context.entryContext)}
      eyebrow={eyebrowFor(context.entryContext)}
      subtitle={subtitleFor(context.entryContext)}
      back={returnHref}
      nav={false}
    >
      <div style={{ padding: '14px 16px 140px' }}>
        {toast ? (
          <div style={{ marginBottom: 10, borderRadius: 8, padding: 10, background: '#E7F4F1', color: '#127C69', fontWeight: 700, fontSize: 13 }}>
            {toast}
          </div>
        ) : null}
        {error ? (
          <div style={{ marginBottom: 10, borderRadius: 8, padding: 10, background: '#FEE6DD', color: '#A03A10', fontWeight: 600, fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        {locked ? (
          <PrefillBanner context={context} />
        ) : (
          <>
            <div className="hk-room-prompt">Where did you find the issue?</div>
            <div className="hk-room-picker">
              <span className="rp-ico" aria-hidden>
                <DoorOpen size={15} />
              </span>
              <div className="rp-text">
                <div className="rp-label">
                  {context.roomNumber ? `Room ${context.roomNumber}` : 'Property-wide'}
                  {context.roomType ? ` — ${context.roomType}` : ''}
                </div>
                <div className="rp-sub">
                  {context.roomId
                    ? 'Auto-set from where you came from · tap to change'
                    : "Not tied to a specific room — that's fine for general issues"}
                </div>
              </div>
              <span className="rp-caret" aria-hidden>
                <ChevronDown size={14} />
              </span>
            </div>
          </>
        )}

        <div className="hk-section-head" style={{ marginTop: 14 }}>
          <span>What kind of issue?</span>
          <span className="opt">{locked ? 'Locked by context' : 'Pick one'}</span>
        </div>
        <CategoryPicker value={category} locked={locked} onChange={setCategory} />

        <div className="hk-section-head">
          <span>Describe the issue</span>
          <span className="star">★ Voice first</span>
        </div>
        <MicHeroRecorder value={voice} onChange={setVoice} />

        <div className="hk-section-head">
          <span>Add a note</span>
          <span className="opt">Optional · if you prefer typing</span>
        </div>
        <div className="hk-notes-wrap">
          <textarea
            className="hk-notes-input"
            maxLength={280}
            value={textNote}
            onChange={(event) => setTextNote(event.target.value.slice(0, 280))}
            placeholder="Type anything extra (optional)"
            rows={3}
          />
          <div className="hk-notes-foot">
            <span>Backup to your voice note</span>
            <span>{280 - remaining} / 280</span>
          </div>
        </div>

        <div className="hk-section-head">
          <span>Add a photo</span>
          <span className="opt">Optional · helpful for damage</span>
        </div>
        <label className={photo ? 'hk-photo-card attached' : 'hk-photo-card'}>
          {photo && photoUrl ? (
            <img src={photoUrl} alt="" className="hk-photo-thumb" />
          ) : (
            <span className="hk-photo-ico" aria-hidden>
              <Camera size={22} />
            </span>
          )}
          <div className="hk-photo-text">
            <div className="hk-photo-label">{photo ? photo.name : 'Add a photo'}</div>
            <div className="hk-photo-sub">
              {photo
                ? 'Tap to replace'
                : 'Optional — helpful for damage / missing item evidence'}
            </div>
          </div>
          <span className="hk-photo-cta">{photo ? 'Replace' : 'Add'}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(event) => handlePhoto(event.target.files?.[0])}
          />
        </label>
      </div>

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: 430,
          margin: '0 auto',
          padding: 12,
          background: 'rgba(255,255,255,0.96)',
          borderTop: '1px solid #DBE7E4',
        }}
      >
        <div className={`hk-cta-hint${helperTone ? ` ${helperTone}` : ''}`}>{helperText}</div>
        <button className="hk-cta" type="button" disabled={!enabled || submitting} onClick={submit}>
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
      </div>
      {submitStage ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(26,43,46,0.55)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            padding: '0 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '4px solid rgba(255,255,255,0.25)',
              borderTopColor: '#fff',
              animation: 'hk-spin 0.9s linear infinite',
            }}
          />
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
            {submitStage === 'compressing' ? 'Optimising photo…' : 'Sending report…'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12.5, maxWidth: 240, lineHeight: 1.4 }}>
            {submitStage === 'compressing'
              ? 'Resizing for faster upload. This can take up to 10 seconds on phones.'
              : 'Uploading voice + photo to the owner. Hold on a moment.'}
          </div>
          <style>{`@keyframes hk-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : null}
    </PwaShell>
  );
}
