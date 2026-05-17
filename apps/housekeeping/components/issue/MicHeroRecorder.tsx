// @ts-nocheck
'use client';

import { Mic, RotateCcw, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 60;

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

  return (
    <section style={{ display: 'grid', placeItems: 'center', gap: 10, padding: '20px 0 14px' }}>
      <button
        aria-label={recording ? 'Stop recording' : 'Start recording'}
        type="button"
        onClick={recording ? stop : start}
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          border: '0',
          display: 'grid',
          placeItems: 'center',
          background: recording ? '#B42318' : '#1DA888',
          color: 'white',
          boxShadow: '0 14px 30px rgba(29,168,136,0.26)',
        }}
      >
        {recording ? <Square size={30} fill="currentColor" /> : <Mic size={34} />}
      </button>
      <strong style={{ fontSize: 13 }}>{recording ? `Recording ${seconds}s` : value ? `${value.seconds}s voice note` : 'Tap to record'}</strong>
      {value ? (
        <button type="button" onClick={reset} style={{ border: 0, background: 'transparent', color: '#127C69', fontWeight: 900, minHeight: 36 }}>
          <RotateCcw size={15} style={{ verticalAlign: -2, marginRight: 4 }} />
          Re-record
        </button>
      ) : (
        <span style={{ color: '#66736F', fontSize: 12 }}>60s max</span>
      )}
    </section>
  );
}
