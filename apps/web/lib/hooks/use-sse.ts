'use client';

import { useEffect, useRef, useState } from 'react';

interface SsePayload {
  entityType: string;
  entityId: string;
  stateVersion: number;
  state: string;
  eventType: string;
  timestamp: string;
}

export function useSse(propertyId: string | null) {
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_RENDER_SSE_BASE_URL;
    if (!propertyId || !baseUrl) {
      setConnected(false);
      return undefined;
    }
    const url = `${baseUrl}/api/sse/events?propertyId=${encodeURIComponent(propertyId)}`;
    const es = new EventSource(url, { withCredentials: true });
    sourceRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    return () => {
      es.close();
      sourceRef.current = null;
    };
  }, [propertyId]);

  function subscribe(eventType: string, handler: (data: SsePayload) => void) {
    const source = sourceRef.current;
    if (!source) return () => undefined;
    const wrapper = (e: MessageEvent) => {
      try {
        handler(JSON.parse(e.data) as SsePayload);
      } catch {
        // Drop malformed payloads — server is the source of truth via state-check.
      }
    };
    source.addEventListener(eventType, wrapper as EventListener);
    return () => source.removeEventListener(eventType, wrapper as EventListener);
  }

  return { connected, subscribe };
}
