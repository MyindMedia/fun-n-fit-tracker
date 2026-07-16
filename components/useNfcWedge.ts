// Captures scans from USB NFC readers running in keyboard-emulation ("wedge")
// mode — the reader types the tag UID as a fast keystroke burst ending in
// Enter. Humans can't type hex that fast, so bursts are distinguishable from
// normal typing: every inter-key gap under BURST_GAP_MS and at least MIN_LEN
// characters. Also exposes Web NFC (Android Chrome) as a second input path.
import { useEffect, useRef, useState } from 'react';

const BURST_GAP_MS = 45;
const MIN_LEN = 4;
const CHAR_RE = /^[0-9a-zA-Z:-]$/;

export interface WedgeScan {
  uid: string;
  ts: number;
}

export function normalizeUid(raw: string): string {
  return raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

/** Global listener; returns the latest scan. Pass onScan for events. */
export function useNfcWedge(onScan?: (scan: WedgeScan) => void, enabled = true) {
  const [lastScan, setLastScan] = useState<WedgeScan | null>(null);
  const buffer = useRef('');
  const lastKeyTs = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const now = performance.now();
      const gap = now - lastKeyTs.current;
      lastKeyTs.current = now;

      if (e.key === 'Enter') {
        const raw = buffer.current;
        buffer.current = '';
        const uid = normalizeUid(raw);
        // Burst check happened per-key (buffer resets on slow gaps); length
        // check keeps stray Enter presses out.
        if (uid.length >= MIN_LEN) {
          // Swallow the reader's Enter so focused forms don't submit.
          e.preventDefault();
          e.stopPropagation();
          const scan = { uid, ts: Date.now() };
          setLastScan(scan);
          onScanRef.current?.(scan);
        }
        return;
      }

      if (e.key.length === 1 && CHAR_RE.test(e.key)) {
        // Slow gap = human typing; restart the buffer with this key.
        if (gap > BURST_GAP_MS) buffer.current = '';
        buffer.current += e.key;
        // A burst mid-flight shouldn't leak into focused inputs.
        if (buffer.current.length >= MIN_LEN && gap <= BURST_GAP_MS) {
          e.preventDefault();
        }
      } else if (e.key.length === 1) {
        buffer.current = '';
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [enabled]);

  return lastScan;
}

/** Web NFC (Android Chrome). Returns support flag + start function. */
export function useWebNfc(onScan?: (scan: WedgeScan) => void) {
  const [supported] = useState(() => typeof window !== 'undefined' && 'NDEFReader' in window);
  const [reading, setReading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const start = async () => {
    if (!supported || reading) return;
    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const reader = new (window as any).NDEFReader();
      await reader.scan({ signal: ctrl.signal });
      setReading(true);
      reader.onreading = (event: any) => {
        const uid = normalizeUid(event.serialNumber || '');
        if (uid.length >= MIN_LEN) {
          onScanRef.current?.({ uid, ts: Date.now() });
        }
      };
    } catch (e) {
      console.warn('Web NFC unavailable:', e);
      setReading(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setReading(false);
  };

  useEffect(() => stop, []);

  return { supported, reading, start, stop };
}
