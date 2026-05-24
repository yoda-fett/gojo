// @ts-nocheck
'use client';

import { Mic, Play, Square, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 60;
const NEAR_CAP_SECONDS = 48;

// Static waveform bar heights — repeats during recording with a CSS pulse,
// stays muted/teal when recorded. Real RMS levels would replace these later.
const WAVE_HEIGHTS = [
  10, 18, 14, 24, 12, 20, 8, 16,
  22, 14, 10, 26, 18, 12, 20, 14,
  10, 16, 22, 12, 18, 14, 20, 10,
];

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Wireframe 09 §voice-hero — three visual states (idle / recording / recorded)
// with distinct copy, pulse-animated stop button, big timer, waveform graphic.
export function MicHeroRecorder({ value, onChange }: { value: any; onChange: (value: any) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => {
      setSeconds((current) => {
        const next = current + 1;
        if (next >= MAX_SECONDS) stop();
        return Math.min(next, MAX_SECONDS);
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [recording]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const nextRecorder = new MediaRecorder(stream);
      nextRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      nextRecorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: nextRecorder.mimeType || 'audio/webm' });
        onChange({ blob, seconds });
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.current = nextRecorder;
      setSeconds(0);
      setRecording(true);
      nextRecorder.start();
    } catch (err) {
      // Mic permission denied / unavailable. Surface a soft prompt — the
      // user can still proceed with text/photo, so we don't block.
      console.error('Mic unavailable:', err);
    }
  }

  function stop() {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  function reset() {
    onChange(null);
    setSeconds(0);
  }

  const recordedSeconds = value?.seconds ?? 0;
  const nearCap = recording && seconds >= NEAR_CAP_SECONDS;

  if (recording) {
    return (
      <section className="hk-voice-hero recording">
        <span className="hk-voice-hero-eyebrow">Recording · speak naturally</span>
        <button type="button" className="hk-voice-mic stop" onClick={stop} aria-label="Stop recording">
          <span className="pulse" aria-hidden />
          <Square size={32} fill="currentColor" />
        </button>
        <div className={`hk-voice-timer-big${nearCap ? '' : ''}`}>{formatTime(seconds)}</div>
        <div className="hk-waveform live" aria-hidden>
          {WAVE_HEIGHTS.map((h, i) => (
            <span key={i} style={{ height: `${h}px`, animationDelay: `${(i % 8) * 80}ms` }} />
          ))}
        </div>
        <div className="hk-voice-prompt warn">Tap to stop</div>
        <div className="hk-voice-hint">{nearCap ? 'Approaching 60s cap — wrap up.' : '60s cap · single clip'}</div>
      </section>
    );
  }

  if (value) {
    return (
      <section className="hk-voice-hero recorded">
        <span className="hk-voice-hero-eyebrow">Voice note saved</span>
        <button type="button" className="hk-voice-mic play" aria-label="Play voice note">
          <Play size={28} fill="currentColor" />
        </button>
        <div className="hk-voice-timer-big done">{formatTime(recordedSeconds)}</div>
        <div className="hk-waveform" aria-hidden>
          {WAVE_HEIGHTS.map((h, i) => (
            <span key={i} style={{ height: `${Math.max(4, h * 0.7)}px` }} />
          ))}
        </div>
        <div className="hk-voice-prompt">Voice note captured</div>
        <div className="hk-voice-hint">Owner will hear this. <strong>Tap mic to re-record</strong> or remove below.</div>
        <div className="hk-voice-actions">
          <button type="button" className="hk-voice-action" onClick={start}>Re-record</button>
          <button type="button" className="hk-voice-action danger" onClick={reset}>
            <Trash2 size={11} style={{ verticalAlign: -1, marginRight: 3 }} /> Delete
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="hk-voice-hero">
      <span className="hk-voice-hero-eyebrow">Voice first</span>
      <button type="button" className="hk-voice-mic" onClick={start} aria-label="Start recording">
        <Mic size={34} />
      </button>
      <div className="hk-voice-prompt">Tap to record</div>
      <div className="hk-voice-hint">
        Describe the issue in any language. <strong>Voice is fastest</strong> — owner reviews and decides.
      </div>
    </section>
  );
}
