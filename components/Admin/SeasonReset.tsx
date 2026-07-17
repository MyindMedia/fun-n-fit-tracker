import React, { useState } from 'react';
import { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { Ic } from '../icons';

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ||
  'https://dependable-spoonbill-535.convex.cloud';

const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const RED = '#f87171';

type Tier = 'POINTS' | 'XP' | 'FULL';

const TIERS: Array<{
  key: Tier;
  name: string;
  resets: string[];
  keeps: string[];
}> = [
  {
    key: 'POINTS',
    name: 'Zero out points',
    resets: ['Every player back to 0 points', 'Ranks back to Noob'],
    keeps: ['XP and Volt Levels', 'Medals, badges, achievements', 'Gear, avatars, FitTokens'],
  },
  {
    key: 'XP',
    name: 'Zero out XP and levels',
    resets: ['Every player back to 0 XP (Volt Level 1)', 'Perk loadouts cleared (unlock levels are gone)'],
    keeps: ['Point balances and ranks', 'Medals, badges, achievements', 'Gear, avatars, FitTokens'],
  },
  {
    key: 'FULL',
    name: 'Full reset: points, levels, achievements',
    resets: [
      'Every player back to 0 points and 0 XP',
      'Ranks to Noob, Volt Level 1, loadouts cleared',
      'Coach medals deleted, badges cleared',
      'All gear removed (owned + equipped + boosts)',
    ],
    keeps: ['Avatar items and looks', 'FitTokens (parent-paid, never touched)', 'Full point + XP history ledgers'],
  },
];

// Danger zone: tiered season reset with a REAL two-step confirmation.
// Step 1 picks the tier and arms the server (a one-time 6-digit code with a
// 5-minute fuse); step 2 requires retyping that code before anything runs.
const SeasonReset: React.FC<{ adminName: string; onRefresh: () => void }> = ({ adminName, onRefresh }) => {
  const [tier, setTier] = useState<Tier | null>(null);
  const [phrase, setPhrase] = useState('');
  const [armed, setArmed] = useState<{ code: string; tier: Tier; expiresAt: number } | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ tier: Tier; players: number } | null>(null);

  const client = React.useMemo(() => new ConvexClient(CONVEX_URL), []);

  const armReset = async () => {
    if (!tier || phrase.trim().toUpperCase() !== 'ZERO OUT' || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = (await client.mutation(api.resets.arm, { tier, adminName: adminName || 'Coach' })) as {
        code: string; tier: Tier; expiresAt: number;
      };
      setArmed(res);
      setCodeInput('');
    } catch (e: any) {
      setError(e?.message || 'Could not arm the reset');
    } finally {
      setBusy(false);
    }
  };

  const executeReset = async () => {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = (await client.mutation(api.resets.execute, {
        code: codeInput,
        adminName: adminName || 'Coach',
      })) as { tier: Tier; players: number };
      setDone(res);
      setArmed(null);
      setTier(null);
      setPhrase('');
      setCodeInput('');
      onRefresh();
    } catch (e: any) {
      setError((e?.message || 'Reset failed').replace(/^.*Uncaught Error:\s*/, '').split(' at ')[0]);
    } finally {
      setBusy(false);
    }
  };

  const cancelArm = async () => {
    setArmed(null);
    setCodeInput('');
    setError(null);
    try { await client.mutation(api.resets.disarm, {}); } catch { /* noop */ }
  };

  if (done) {
    return (
      <div className="pz-card p-6 text-center max-w-xl mx-auto">
        <div className="flex justify-center mb-3" style={{ color: 'var(--pz-volt)' }}><Ic.CheckCircle size={36} /></div>
        <h2 className="pz-display text-xl text-white mb-2">Reset complete</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--pz-text)' }}>
          {done.tier === 'POINTS' && `Points zeroed for ${done.players} players. Levels and achievements untouched.`}
          {done.tier === 'XP' && `XP and Volt Levels reset for ${done.players} players. Points untouched.`}
          {done.tier === 'FULL' && `Full reset for ${done.players} players: points, levels, and achievements cleared.`}
        </p>
        <button className="pz-btn px-6 py-3" onClick={() => setDone(null)}>Back</button>
      </div>
    );
  }

  if (armed) {
    const minutesLeft = Math.max(0, Math.ceil((armed.expiresAt - Date.now()) / 60000));
    return (
      <div className="pz-card p-5 sm:p-6 max-w-xl mx-auto" style={{ borderColor: `${RED}66` }}>
        <div className="pz-eyebrow mb-1" style={{ color: RED }}>Step 2 of 2 — confirm</div>
        <h2 className="pz-display text-lg text-white mb-3">
          {TIERS.find(t => t.key === armed.tier)?.name}
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--pz-text)' }}>
          Type this one-time code to run the reset. It expires in about {minutesLeft} minute{minutesLeft === 1 ? '' : 's'}.
        </p>
        <div
          className="pz-display text-3xl text-center tracking-[0.4em] py-3 mb-4"
          style={{ background: 'var(--pz-panel-2)', border: `1px solid ${RED}55`, clipPath: NOTCH_SM, color: RED }}
        >
          {armed.code}
        </div>
        <input
          inputMode="numeric"
          maxLength={6}
          value={codeInput}
          onChange={e => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={e => { if (e.key === 'Enter') void executeReset(); }}
          placeholder="Enter the code"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 text-lg font-black text-white text-center tracking-[0.35em] outline-none focus:border-red-400 mb-4"
          style={{ clipPath: NOTCH_SM }}
        />
        {error && <div className="text-sm mb-3" style={{ color: RED }}>{error}</div>}
        <div className="flex gap-3">
          <button
            onClick={() => void executeReset()}
            disabled={busy || codeInput.length !== 6}
            className="flex-grow min-h-[52px] font-black uppercase tracking-widest text-sm disabled:opacity-40"
            style={{ background: RED, color: '#0B0E13', clipPath: NOTCH_SM }}
          >
            {busy ? 'Resetting…' : 'Run the reset'}
          </button>
          <button onClick={() => void cancelArm()} className="pz-btn-ghost px-5 min-h-[52px] text-sm font-black uppercase">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="pz-card p-4 sm:p-5" style={{ borderColor: `${RED}55`, background: 'rgba(248,113,113,0.05)' }}>
        <div className="flex items-center gap-3">
          <span style={{ color: RED }}><Ic.Warning size={24} /></span>
          <div>
            <div className="font-black text-white uppercase tracking-wide text-[15px]">Danger zone</div>
            <div className="text-xs" style={{ color: 'var(--pz-text)' }}>
              These affect EVERY player and cannot be undone. FitTokens and avatar items are never touched.
              Point and XP history stays in the ledgers for the records.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {TIERS.map(t => {
          const selected = tier === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { setTier(selected ? null : t.key); setPhrase(''); setError(null); }}
              className="w-full text-left pz-card p-4 sm:p-5 transition-all"
              style={{ borderColor: selected ? RED : 'var(--pz-border)', background: selected ? 'rgba(248,113,113,0.06)' : undefined }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="w-5 h-5 shrink-0 border-2 flex items-center justify-center"
                  style={{ borderColor: selected ? RED : 'rgba(255,255,255,0.3)', clipPath: NOTCH_SM }}
                >
                  {selected && <span className="w-2.5 h-2.5" style={{ background: RED, clipPath: NOTCH_SM }} />}
                </span>
                <span className="font-black text-white uppercase tracking-wide text-[15px]">{t.name}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: RED }}>Resets</div>
                  {t.resets.map(line => (
                    <div key={line} className="text-[11px] leading-relaxed" style={{ color: 'var(--pz-text)' }}>- {line}</div>
                  ))}
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--pz-volt)' }}>Keeps</div>
                  {t.keeps.map(line => (
                    <div key={line} className="text-[11px] leading-relaxed" style={{ color: 'var(--pz-text)' }}>- {line}</div>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {tier && (
        <div className="pz-card p-4 sm:p-5" style={{ borderColor: `${RED}66` }}>
          <div className="pz-eyebrow mb-2" style={{ color: RED }}>Step 1 of 2 — arm</div>
          <p className="text-sm mb-3" style={{ color: 'var(--pz-text)' }}>
            Type <span className="font-black text-white">ZERO OUT</span> to arm this reset. You will get a
            one-time code to confirm in step 2.
          </p>
          <div className="flex gap-3 flex-wrap">
            <input
              value={phrase}
              onChange={e => setPhrase(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void armReset(); }}
              placeholder="ZERO OUT"
              className="flex-grow min-w-[160px] px-4 py-3 bg-white/5 border border-white/10 text-sm font-black text-white uppercase tracking-widest outline-none focus:border-red-400"
              style={{ clipPath: NOTCH_SM }}
            />
            <button
              onClick={() => void armReset()}
              disabled={busy || phrase.trim().toUpperCase() !== 'ZERO OUT'}
              className="min-h-[48px] px-5 font-black uppercase tracking-widest text-sm disabled:opacity-40"
              style={{ background: RED, color: '#0B0E13', clipPath: NOTCH_SM }}
            >
              {busy ? 'Arming…' : 'Arm reset'}
            </button>
          </div>
          {error && <div className="text-sm mt-3" style={{ color: RED }}>{error}</div>}
        </div>
      )}
    </div>
  );
};

export default SeasonReset;
