import React, { useCallback, useEffect, useRef, useState } from 'react';

// High-resolution stopwatch shared by every timing game (Time Trial, Relay Race,
// Custom Lap). It tracks milliseconds off a monotonic clock so the readout is
// accurate regardless of render cadence.

export interface Stopwatch {
  elapsedMs: number;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
  // Current elapsed ms at the moment of call (live even between ticks).
  lap: () => number;
}

// Format ms as MM:SS.mmm (drops the minutes segment under a minute -> SS.mmm).
export const fmtStopwatch = (ms: number): string => {
  const totalMs = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  const ss = seconds.toString().padStart(2, '0');
  const mmm = millis.toString().padStart(3, '0');
  if (minutes > 0) return `${minutes}:${ss}.${mmm}`;
  return `${ss}.${mmm}`;
};

export function useStopwatch(): Stopwatch {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  // performance.now() captured at the current run's start (null while stopped).
  const runStartRef = useRef<number | null>(null);
  // ms banked from previous runs (survives stop/resume without a reset).
  const accumRef = useRef(0);

  const current = useCallback(() => {
    const banked = accumRef.current;
    if (runStartRef.current == null) return banked;
    return banked + (performance.now() - runStartRef.current);
  }, []);

  const start = useCallback(() => {
    setIsRunning((running) => {
      if (running) return running;
      runStartRef.current = performance.now();
      return true;
    });
  }, []);

  const stop = useCallback(() => {
    setIsRunning((running) => {
      if (!running) return running;
      if (runStartRef.current != null) {
        accumRef.current += performance.now() - runStartRef.current;
        runStartRef.current = null;
      }
      setElapsedMs(accumRef.current);
      return false;
    });
  }, []);

  const reset = useCallback(() => {
    runStartRef.current = null;
    accumRef.current = 0;
    setIsRunning(false);
    setElapsedMs(0);
  }, []);

  const lap = useCallback(() => current(), [current]);

  // Render loop: a ~40ms interval keeps the milliseconds readout smooth without
  // burning a frame every rAF. The displayed value is computed from the clock,
  // so interval jitter never drifts the time.
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => setElapsedMs(current()), 40);
    return () => window.clearInterval(id);
  }, [isRunning, current]);

  return { elapsedMs, isRunning, start, stop, reset, lap };
}

// Start / Stop / Reset control bar with a live MM:SS.mmm readout. Matches the
// lime clock header used across the scorer templates.
export const StopwatchBar: React.FC<{
  sw: Stopwatch;
  label?: string;
  onReset?: () => void;
}> = ({ sw, label = 'Clock', onReset }) => (
  <div
    className="rounded-xl p-3 text-white flex items-center justify-between gap-2 border border-white/10"
    style={{ background: 'var(--pz-panel-2)' }}
  >
    <div className="flex flex-col min-w-0">
      <div className="text-[9px] font-black uppercase tracking-widest text-[#CBFE1C]">{label}</div>
      <div className="text-2xl font-mono font-black text-[#CBFE1C] tabular-nums leading-tight">
        {fmtStopwatch(sw.elapsedMs)}
      </div>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      {!sw.isRunning ? (
        <button
          onClick={sw.start}
          className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[#CBFE1C] text-[#0B0E13] active:scale-95"
        >
          Start
        </button>
      ) : (
        <button
          onClick={sw.stop}
          className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider bg-red-500 text-white active:scale-95"
        >
          Stop
        </button>
      )}
      <button
        onClick={() => { sw.reset(); onReset?.(); }}
        className="px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider bg-white/10 border border-white/15 text-white active:scale-95"
      >
        Reset
      </button>
    </div>
  </div>
);
