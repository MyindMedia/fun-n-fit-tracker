import React, { useEffect, useState } from 'react';
import { gameCenter } from '../../services/gameCenter';
import { Ic } from '../icons';

// Pubzi theme: small notched cut-corner shape for inline elements
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

const BOOST_OPTIONS = [1, 1.5, 2, 3];

// Global point multiplier control (2x Fridays etc.). Applies to every
// positive award academy-wide; spends and refunds stay 1:1.
const BoostControl: React.FC = () => {
  const [mult, setMult] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => gameCenter.subscribePointMultiplier(setMult), []);

  const applyBoost = async (value: number) => {
    setBusy(true);
    try {
      await gameCenter.setPointMultiplier(value);
      window.dispatchEvent(new CustomEvent('coach-toast', {
        detail: { message: value > 1 ? `${value}x point boost is ON` : 'Point boost turned off' },
      }));
    } catch (err: any) {
      alert(err?.message || 'Failed to update the boost');
    } finally {
      setBusy(false);
    }
  };

  const active = mult > 1;

  return (
    <div
      className="pz-card-sm p-4"
      style={active ? { borderColor: 'var(--pz-volt)', background: 'rgba(203,254,28,0.06)' } : undefined}
    >
      <div className="flex items-center gap-3 mb-3">
        <span style={{ color: active ? 'var(--pz-volt)' : 'var(--pz-text)' }}><Ic.Bolt size={22} /></span>
        <div className="flex-grow">
          <div className="font-black text-white uppercase tracking-wide text-[15px]">Point Boost</div>
          <div className="text-xs" style={{ color: active ? 'var(--pz-volt)' : 'var(--pz-text)' }}>
            {active ? `${mult}x active — every award is multiplied` : 'Off — awards are worth face value'}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {BOOST_OPTIONS.map(b => {
          const isActive = mult === b;
          return (
            <button
              key={b}
              onClick={() => applyBoost(b)}
              disabled={busy}
              className="touch-btn min-h-[44px] py-2 text-sm font-black transition-all disabled:opacity-50"
              style={{
                clipPath: NOTCH_SM,
                background: isActive ? 'var(--pz-volt)' : 'var(--pz-panel-2)',
                color: isActive ? '#0B0E13' : 'var(--pz-text)',
                border: isActive ? '1px solid var(--pz-volt)' : '1px solid var(--pz-border)',
              }}
            >
              {b === 1 ? 'Off' : `${b}x`}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BoostControl;
