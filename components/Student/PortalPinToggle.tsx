import React, { useEffect, useState } from 'react';
import { gameCenter } from '../../services/gameCenter';

/** Kids-portal control to turn the sign-in PIN on or off (and set it). */
const PortalPinToggle: React.FC<{ studentId: string }> = ({ studentId }) => {
  const [enabled, setEnabled] = useState(false);
  const [pin, setPin] = useState('');
  const [editingPin, setEditingPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    gameCenter
      .portalSettings(studentId)
      .then((s) => { setEnabled(s.enabled); setPin(s.pin || ''); })
      .catch(() => {});
  }, [studentId]);

  const toggle = async () => {
    if (busy) return;
    setStatus('');
    if (!enabled) {
      const p = editingPin || pin;
      if (!/^\d{4}$/.test(p)) { setStatus('Enter a 4-digit PIN first.'); return; }
      setBusy(true);
      try {
        await gameCenter.setPortalAccess(studentId, true, p);
        setEnabled(true); setPin(p); setEditingPin(''); setStatus('PIN sign-in is ON.');
      } catch (e: any) { setStatus(e?.message || 'Could not update.'); }
      finally { setBusy(false); }
    } else {
      setBusy(true);
      try {
        await gameCenter.setPortalAccess(studentId, false);
        setEnabled(false); setStatus('PIN sign-in is OFF.');
      } catch (e: any) { setStatus(e?.message || 'Could not update.'); }
      finally { setBusy(false); }
    }
  };

  return (
    <div className="pz-card p-5 text-white">
      <div className="pz-eyebrow mb-3">Sign-in PIN</div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold">{enabled ? 'PIN is ON' : 'PIN is OFF'}</div>
          <div className="text-[11px]" style={{ color: 'var(--pz-text)' }}>
            {enabled ? 'You need your 4-digit PIN to sign in.' : 'Turn on to require a PIN at sign-in.'}
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={busy}
          className={`touch-btn px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border disabled:opacity-50 shrink-0 ${enabled ? 'bg-[#CBFE1C] text-[#0B0E13] border-[#CBFE1C]' : 'bg-white/5 text-white/70 border-white/15'}`}
        >
          {busy ? '…' : enabled ? 'Turn Off' : 'Turn On'}
        </button>
      </div>
      {!enabled && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={editingPin}
            onChange={(e) => setEditingPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="4-digit PIN"
            className="w-28 px-3 py-2 rounded-lg border border-white/10 bg-[#171C27] text-white text-center tracking-[0.3em] font-black outline-none focus:border-[#CBFE1C]"
          />
          <span className="text-[11px]" style={{ color: 'var(--pz-text)' }}>set a PIN, then Turn On</span>
        </div>
      )}
      {enabled && pin && (
        <div className="mt-3 text-[11px]" style={{ color: 'var(--pz-text)' }}>
          Your PIN: <span className="font-black text-white tracking-[0.2em]">{pin}</span>
        </div>
      )}
      {status && <div className="mt-2 text-[11px] font-bold text-[#CBFE1C]">{status}</div>}
    </div>
  );
};

export default PortalPinToggle;
