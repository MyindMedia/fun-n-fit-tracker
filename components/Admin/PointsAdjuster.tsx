import React, { useState } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { AudioService } from '../../utils/audio';

// Matches the notched button aesthetic used across the admin surfaces.
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const PRESETS = [10, 50, 100, 500];

interface PointsAdjusterProps {
  studentId: string;
  displayName: string;
  initialPoints: number;
  adminName: string;
  /** Build the ledger description for a signed amount. Defaults to Coach award/deduction. */
  descFor?: (amount: number) => string;
  /** Fired after any successful change so the host can refresh its own data. */
  onAdjusted?: () => void;
  /** Tighter layout for the roster popover. */
  compact?: boolean;
}

/**
 * Single source of truth for per-athlete point changes: preset +/- chips, a
 * custom amount, and a one-tap Zero Out. Shared by the athlete profile modal,
 * the athlete editor, and the roster row popover so behavior never drifts.
 *
 * Zero Out resets only the SPENDABLE wallet to 0 — lifetime XP and rank are
 * untouched (the engine grants XP on positive amounts only, so nothing demotes).
 * It is ledgered and reversible (undo the last action, or re-award).
 */
const PointsAdjuster: React.FC<PointsAdjusterProps> = ({
  studentId, displayName, initialPoints, adminName, descFor, onAdjusted, compact,
}) => {
  const [points, setPoints] = useState(initialPoints);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmZero, setConfirmZero] = useState(false);

  const defaultDesc = (amount: number) => (amount > 0 ? 'Coach award' : 'Coach deduction');

  const adjust = async (amount: number) => {
    if (busy || amount === 0 || !adminName) return;
    if (amount < 0 && points <= 0) return; // nothing to take
    setBusy(true);
    try {
      await supabaseService.addPoints(studentId, amount, 'MANUAL', (descFor ?? defaultDesc)(amount), adminName);
      // Optimistic: the wallet floors at 0. Positive awards can be scaled by live
      // multipliers server-side, so the host's refresh reconciles the exact total.
      setPoints((p) => Math.max(0, p + amount));
      try { amount > 0 ? AudioService.playRandomAward() : AudioService.playPointLost(); } catch {}
      onAdjusted?.();
    } finally {
      setBusy(false);
    }
    // No coach-toast on purpose: addPoints writes a POINTS activity row that the
    // admin notification subscription already turns into the on-screen toast.
  };

  const handleZeroOut = async () => {
    if (busy || points <= 0 || !adminName) return;
    setBusy(true);
    try {
      await supabaseService.zeroOutPoints(studentId, adminName);
      setPoints(0);
      try { AudioService.playPointLost(); } catch {}
      onAdjusted?.();
    } finally {
      setBusy(false);
      setConfirmZero(false);
    }
  };

  const applyCustom = (sign: 1 | -1) => {
    const v = parseInt(custom || '0', 10);
    if (v > 0) { adjust(sign * v); setCustom(''); }
  };

  const presetBtn = compact ? 'py-3 text-base' : 'py-6 text-lg';

  return (
    <div className={compact ? 'space-y-4' : 'space-y-8'}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Current</div>
        <div className="pz-display text-2xl text-[#CBFE1C] leading-none">{points.toLocaleString()} <span className="text-xs">pts</span></div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        <div className="space-y-3">
          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Add</div>
          <div className="grid grid-cols-2 gap-3">
            {PRESETS.map((val) => (
              <button key={val} disabled={busy} onClick={() => adjust(val)}
                className={`${presetBtn} bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-black hover:border-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50`}
                style={{ clipPath: NOTCH_SM }}>+{val}</button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-[10px] font-black text-red-400 uppercase tracking-widest">Deduct</div>
          <div className="grid grid-cols-2 gap-3">
            {PRESETS.map((val) => (
              <button key={val} disabled={busy || points <= 0} onClick={() => adjust(-val)}
                className={`${presetBtn} bg-red-500/10 border border-red-500/40 text-red-400 font-black hover:border-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50`}
                style={{ clipPath: NOTCH_SM }}>-{val}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--pz-text)' }}>Custom Amount</div>
        <div className="flex items-center gap-3">
          <input type="text" inputMode="numeric" value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Points"
            className="w-24 px-3 py-2 bg-white/5 border border-white/10 text-white font-black placeholder-white/40 focus:border-[#CBFE1C] outline-none"
            style={{ clipPath: NOTCH_SM }} />
          <button disabled={busy || !parseInt(custom || '0', 10)} onClick={() => applyCustom(1)}
            className="px-4 py-2 bg-emerald-500 text-emerald-950 font-black disabled:opacity-50" style={{ clipPath: NOTCH_SM }}>Add +</button>
          <button disabled={busy || points <= 0 || !parseInt(custom || '0', 10)} onClick={() => applyCustom(-1)}
            className="px-4 py-2 bg-red-600 text-white font-black disabled:opacity-50" style={{ clipPath: NOTCH_SM }}>Deduct −</button>
        </div>
      </div>

      <div className="pt-3 border-t border-white/10">
        {!confirmZero ? (
          <button disabled={busy || points <= 0} onClick={() => setConfirmZero(true)}
            className="w-full py-3 bg-red-600/15 border border-red-600/40 text-red-300 font-black uppercase text-xs tracking-widest hover:bg-red-600/25 hover:border-red-500 transition-all disabled:opacity-40"
            style={{ clipPath: NOTCH_SM }}>
            Zero Out Points
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold text-center" style={{ color: 'var(--pz-text)' }}>
              Reset <span className="text-white">{displayName}</span> to <span className="text-red-300 font-black">0</span>?
              {' '}({points.toLocaleString()} → 0). Rank and XP stay; reversible.
            </p>
            <div className="flex gap-3">
              <button disabled={busy} onClick={() => setConfirmZero(false)}
                className="flex-1 py-3 bg-white/5 border border-white/10 text-white/70 font-black uppercase text-xs tracking-widest disabled:opacity-50" style={{ clipPath: NOTCH_SM }}>Cancel</button>
              <button disabled={busy} onClick={handleZeroOut}
                className="flex-1 py-3 bg-red-600 text-white font-black uppercase text-xs tracking-widest hover:bg-red-500 transition-all disabled:opacity-50" style={{ clipPath: NOTCH_SM }}>
                {busy ? 'Zeroing…' : 'Zero Out'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PointsAdjuster;
