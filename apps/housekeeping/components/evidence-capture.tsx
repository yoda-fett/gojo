// @ts-nocheck
'use client';

import { Camera, Mic, Play, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type EvidenceDraft = {
  note: string;
  photoName?: string;
  // Object URL of the attached photo — display-only, stripped before submit.
  photoUrl?: string;
  voiceState: 'idle' | 'recording' | 'near-cap' | 'recorded';
  // Duration (sec) of the captured voice note — set when recording → recorded.
  voiceDurationSec?: number;
};

const VOICE_CAP_SEC = 60;
const NEAR_CAP_SEC = 48; // 80% — meter shifts amber.

// Static waveform pattern — repeats during the recording state. A real audio
// meter would compute these from RMS levels; we stub static heights and let
// CSS animation pulse them so the card reads as "live" during demos.
const WAVE_HEIGHTS = [6, 12, 8, 16, 10, 14, 6, 12, 9, 15, 7, 11, 13, 5, 10, 14];

export function EvidenceCapture({
  value,
  onChange,
  photoRequired = false,
}: {
  value: EvidenceDraft;
  onChange: (value: EvidenceDraft) => void;
  photoRequired?: boolean;
}) {
  const remaining = 280 - value.note.length;
  const photoAttached = Boolean(value.photoName);

  // ── Voice timer: ticks while in 'recording' state, captures the final
  //    duration on transition to 'recorded'.
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (value.voiceState !== 'recording') {
      startedAtRef.current = null;
      setElapsedSec(0);
      return undefined;
    }
    startedAtRef.current = Date.now();
    setElapsedSec(0);
    const id = window.setInterval(() => {
      if (startedAtRef.current == null) return;
      const next = Math.min(VOICE_CAP_SEC, (Date.now() - startedAtRef.current) / 1000);
      setElapsedSec(next);
    }, 100);
    return () => window.clearInterval(id);
  }, [value.voiceState]);

  function startRecording() {
    onChange({ ...value, voiceState: 'recording' });
  }

  function stopRecording() {
    onChange({
      ...value,
      voiceState: 'recorded',
      voiceDurationSec: Math.max(1, Math.round(elapsedSec)),
    });
  }

  function reRecord() {
    onChange({ ...value, voiceState: 'recording', voiceDurationSec: undefined });
  }

  function deleteVoice() {
    onChange({ ...value, voiceState: 'idle', voiceDurationSec: undefined });
  }

  // ── Photo: keep an object URL for the in-component preview thumbnail.
  //    Revoke when the file changes or the component unmounts.
  useEffect(() => {
    const url = value.photoUrl;
    if (!url) return undefined;
    return () => URL.revokeObjectURL(url);
  }, [value.photoUrl]);

  function handlePhotoChange(file: File | null | undefined) {
    if (value.photoUrl) URL.revokeObjectURL(value.photoUrl);
    if (!file) {
      onChange({ ...value, photoName: undefined, photoUrl: undefined });
      return;
    }
    onChange({ ...value, photoName: file.name, photoUrl: URL.createObjectURL(file) });
  }

  const isRecording = value.voiceState === 'recording';
  const isRecorded = value.voiceState === 'recorded';
  const meterPct = isRecording ? (elapsedSec / VOICE_CAP_SEC) * 100 : isRecorded ? 30 : 0;
  const nearCap = isRecording && elapsedSec >= NEAR_CAP_SEC;
  const voiceCardClass = isRecording
    ? 'hk-voice-card recording'
    : isRecorded
      ? 'hk-voice-card recorded'
      : 'hk-voice-card';

  return (
    <div className="hk-evidence-group" style={{ marginTop: 8 }}>
      {/* Voice */}
      <div className="hk-evidence-sublabel">
        <span>Voice note</span>
        <span>
          {isRecording ? 'Live' : isRecorded ? `${formatTime(value.voiceDurationSec ?? 0)} captured` : 'Optional · up to 60s'}
        </span>
      </div>
      <div className={voiceCardClass}>
        {isRecording ? (
          <button type="button" className="hk-voice-btn stop" onClick={stopRecording} aria-label="Stop recording">
            <Square size={20} fill="currentColor" />
          </button>
        ) : isRecorded ? (
          <button type="button" className="hk-voice-btn play" aria-label="Play voice note">
            <Play size={20} fill="currentColor" />
          </button>
        ) : (
          <button type="button" className="hk-voice-btn" onClick={startRecording} aria-label="Start recording">
            <Mic size={22} />
          </button>
        )}
        <div className="hk-voice-text">
          <div className="hk-voice-label">
            {isRecording ? (nearCap ? 'Recording… approaching cap' : 'Recording…') : isRecorded ? 'Voice note saved' : 'Record voice note'}
          </div>
          {isRecording ? (
            <>
              <div className="hk-voice-wave" aria-hidden>
                {WAVE_HEIGHTS.map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}px`, animationDelay: `${(i % 8) * 80}ms` }}
                  />
                ))}
              </div>
              <div className="hk-voice-meter">
                <div className={`hk-voice-meter-fill${nearCap ? ' amber' : ''}`} style={{ width: `${meterPct}%` }} />
              </div>
            </>
          ) : isRecorded ? (
            <>
              <div className="hk-voice-meter" style={{ marginTop: 6 }}>
                <div className="hk-voice-meter-fill" style={{ width: `${meterPct}%` }} />
              </div>
              <div className="hk-voice-actions">
                <button type="button" className="hk-voice-action" onClick={reRecord}>Re-record</button>
                <button type="button" className="hk-voice-action danger" onClick={deleteVoice}>Delete</button>
              </div>
            </>
          ) : (
            <div className="hk-voice-sub">Up to 60 seconds</div>
          )}
        </div>
        {isRecording ? (
          <span className="hk-voice-timer live">{formatTime(elapsedSec)} / 1:00</span>
        ) : isRecorded ? (
          <span className="hk-voice-timer">{formatTime(value.voiceDurationSec ?? 0)}</span>
        ) : null}
      </div>

      {/* Notes */}
      <div className="hk-evidence-sublabel" style={{ marginTop: 4 }}>
        <span>Text note</span>
        <span>Optional · 280 chars</span>
      </div>
      <div className="hk-notes-wrap">
        <textarea
          className="hk-notes-input"
          maxLength={280}
          value={value.note}
          onChange={(event) => onChange({ ...value, note: event.target.value.slice(0, 280) })}
          placeholder="Anything the owner should know?"
          rows={3}
        />
        <div className="hk-notes-counter">{remaining} left</div>
      </div>

      {/* Photo */}
      <div className="hk-evidence-sublabel" style={{ marginTop: 4 }}>
        <span>Photo</span>
        <span className={photoRequired && !photoAttached ? 'req-tag' : undefined}>
          {photoRequired ? (photoAttached ? 'Attached' : 'Required') : 'Optional'}
        </span>
      </div>
      <label
        className={
          photoAttached
            ? 'hk-photo-card attached'
            : photoRequired
              ? 'hk-photo-card required'
              : 'hk-photo-card'
        }
      >
        {photoAttached && value.photoUrl ? (
          <img src={value.photoUrl} alt="" className="hk-photo-thumb" />
        ) : (
          <span className="hk-photo-ico" aria-hidden>
            <Camera size={22} />
          </span>
        )}
        <div className="hk-photo-text">
          <div className="hk-photo-label">{photoAttached ? value.photoName : 'Add a photo'}</div>
          <div className="hk-photo-sub">
            {photoAttached
              ? 'Tap to replace'
              : photoRequired
                ? 'A photo is required to complete this task'
                : 'Optional — helps the owner verify the work'}
          </div>
        </div>
        <span className="hk-photo-cta">{photoAttached ? 'Replace' : 'Add'}</span>
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(event) => handlePhotoChange(event.target.files?.[0])}
        />
      </label>
    </div>
  );
}

function formatTime(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
