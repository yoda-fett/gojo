// @ts-nocheck
'use client';

import { Mic, Pause, Play, Square, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 60;
const NEAR_CAP_SECONDS = 48;
const BAR_COUNT = 24;

// Floor height keeps the bars visible during silence.
const IDLE_BAR_HEIGHT = 4;

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Wireframe 09 §voice-hero — three visual states (idle / recording / recorded).
// Hotfix-10 fixes:
//   - Live waveform now driven by AnalyserNode RMS (was a static repeating array).
//   - Play button on the "recorded" state now actually plays the blob back.
export function MicHeroRecorder({ value, onChange }: { value: any; onChange: (value: any) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(IDLE_BAR_HEIGHT));
  const [playing, setPlaying] = useState(false);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const rafId = useRef<number | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const playbackUrl = useRef<string | null>(null);

  // ───────── Recording timer
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  // ───────── Reset playback resources when the blob changes
  // (covers re-record case — the old cached audio element / URL must not
  // leak through to the next clip).
  useEffect(() => {
    // Always tear down the previous audio element + URL.
    if (audioEl.current) {
      audioEl.current.pause();
      audioEl.current = null;
    }
    setPlaying(false);
    if (playbackUrl.current) {
      URL.revokeObjectURL(playbackUrl.current);
      playbackUrl.current = null;
    }
    if (!value?.blob) return;
    playbackUrl.current = URL.createObjectURL(value.blob);
    return () => {
      if (playbackUrl.current) {
        URL.revokeObjectURL(playbackUrl.current);
        playbackUrl.current = null;
      }
    };
  }, [value?.blob]);

  const tearDownAnalyser = useCallback(() => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    if (analyser.current) {
      try { analyser.current.disconnect(); } catch {}
      analyser.current = null;
    }
    if (audioCtx.current) {
      audioCtx.current.close().catch(() => {});
      audioCtx.current = null;
    }
    if (stream.current) {
      stream.current.getTracks().forEach((t) => t.stop());
      stream.current = null;
    }
    setBars(Array(BAR_COUNT).fill(IDLE_BAR_HEIGHT));
  }, []);

  useEffect(() => () => tearDownAnalyser(), [tearDownAnalyser]);

  async function start() {
    try {
      const next = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = next;
      chunks.current = [];

      // Wire up the analyser for live waveform bars.
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtx.current = ctx;
      const source = ctx.createMediaStreamSource(next);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.6;
      source.connect(an);
      analyser.current = an;

      const buf = new Uint8Array(an.frequencyBinCount);
      const sampleBars = () => {
        if (!analyser.current) return;
        analyser.current.getByteFrequencyData(buf);
        // Down-sample the FFT bins into BAR_COUNT buckets.
        const bucketSize = Math.max(1, Math.floor(buf.length / BAR_COUNT));
        const next: number[] = [];
        for (let i = 0; i < BAR_COUNT; i += 1) {
          let sum = 0;
          for (let j = 0; j < bucketSize; j += 1) {
            sum += buf[i * bucketSize + j] ?? 0;
          }
          const avg = sum / bucketSize; // 0–255
          // Map to a bar height in px (4–28). Slight gamma curve makes
          // moderate voice levels feel more responsive.
          const norm = Math.pow(avg / 255, 0.7);
          next.push(Math.max(IDLE_BAR_HEIGHT, Math.round(IDLE_BAR_HEIGHT + norm * 24)));
        }
        setBars(next);
        rafId.current = requestAnimationFrame(sampleBars);
      };
      sampleBars();

      // Wire up the recorder.
      const rec = new MediaRecorder(next);
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        onChange({ blob, seconds: secondsRef.current });
        tearDownAnalyser();
      };
      recorder.current = rec;
      setSeconds(0);
      setRecording(true);
      rec.start();
    } catch (err) {
      console.error('Mic unavailable:', err);
      tearDownAnalyser();
    }
  }

  // Keep a ref of the current seconds so onstop sees the right value
  // (onstop fires after setRecording(false), closure captures stale state).
  const secondsRef = useRef(0);
  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  function stop() {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  function reset() {
    if (audioEl.current) {
      audioEl.current.pause();
      audioEl.current = null;
    }
    setPlaying(false);
    onChange(null);
    setSeconds(0);
    setBars(Array(BAR_COUNT).fill(IDLE_BAR_HEIGHT));
  }

  function startPlaybackAnalyser(el: HTMLAudioElement) {
    // Mirrors the recording-side analyser: feed bars from the live audio output.
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtx.current = ctx;
      const source = ctx.createMediaElementSource(el);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.6;
      source.connect(an);
      // Must also connect to destination so the user actually hears playback.
      an.connect(ctx.destination);
      analyser.current = an;

      const buf = new Uint8Array(an.frequencyBinCount);
      const loop = () => {
        if (!analyser.current) return;
        analyser.current.getByteFrequencyData(buf);
        const bucketSize = Math.max(1, Math.floor(buf.length / BAR_COUNT));
        const next: number[] = [];
        for (let i = 0; i < BAR_COUNT; i += 1) {
          let sum = 0;
          for (let j = 0; j < bucketSize; j += 1) {
            sum += buf[i * bucketSize + j] ?? 0;
          }
          const avg = sum / bucketSize;
          const norm = Math.pow(avg / 255, 0.7);
          next.push(Math.max(IDLE_BAR_HEIGHT, Math.round(IDLE_BAR_HEIGHT + norm * 24)));
        }
        setBars(next);
        rafId.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      // If the browser blocks createMediaElementSource (rare), playback still
      // works — only the animated bars are lost. Don't break playback.
      console.warn('Playback analyser failed:', err);
    }
  }

  function togglePlayback() {
    if (!playbackUrl.current) return;
    if (audioEl.current && !audioEl.current.paused) {
      audioEl.current.pause();
      setPlaying(false);
      tearDownAnalyser();
      return;
    }
    if (!audioEl.current) {
      const el = new Audio(playbackUrl.current);
      el.crossOrigin = 'anonymous';
      el.onended = () => {
        setPlaying(false);
        tearDownAnalyser();
      };
      el.onerror = () => {
        setPlaying(false);
        tearDownAnalyser();
      };
      audioEl.current = el;
      startPlaybackAnalyser(el);
    }
    audioEl.current.play().then(() => setPlaying(true)).catch((err) => {
      console.error('Playback failed:', err);
      setPlaying(false);
      tearDownAnalyser();
    });
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
          {bars.map((h, i) => (
            <span key={i} style={{ height: `${h}px` }} />
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
        <button
          type="button"
          className="hk-voice-mic play"
          aria-label={playing ? 'Pause voice note' : 'Play voice note'}
          onClick={togglePlayback}
        >
          {playing ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
        </button>
        <div className="hk-voice-timer-big done">{formatTime(recordedSeconds)}</div>
        <div className={`hk-waveform${playing ? ' live' : ''}`} aria-hidden>
          {bars.map((h, i) => (
            <span key={i} style={{ height: `${playing ? h : Math.max(4, h * 0.7)}px` }} />
          ))}
        </div>
        <div className="hk-voice-prompt">{playing ? 'Playing…' : 'Voice note captured'}</div>
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
