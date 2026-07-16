import React, { useEffect, useState } from 'react';
import { Student } from '../../types';
import {
  AvatarLook,
  DEFAULT_LOOK,
  LOOT_BOXES,
  LootBoxDef,
  RARITY_COLORS,
  UPGRADE_TIERS,
} from '../../avatarCatalog';
import { gameCenter } from '../../services/gameCenter';
import AvatarRig from './AvatarRig';
import { AvatarFx } from './AvatarStudio';
import { Ic } from '../icons';

const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

type OpenResult = {
  outcome: 'NEW' | 'UPGRADE' | 'SHARDS';
  item: { key: string; name: string; slot: string; rarity: string };
  upgradeLevel: number;
  refund?: number;
  balance: number;
  opensToday: number;
  capPerDay: number;
};

interface LootCratesProps {
  student: Student;
  onRefresh?: () => void;
}

// Points-only crates: odds on the label, capped per day, duplicates always
// convert (upgrade tier or shard refund) — never a dead roll.
const LootCrates: React.FC<LootCratesProps> = ({ student, onRefresh }) => {
  const [status, setStatus] = useState<{ opensToday: number; capPerDay: number }>({ opensToday: 0, capPerDay: 3 });
  const [shakingBox, setShakingBox] = useState<string | null>(null);
  const [result, setResult] = useState<OpenResult | null>(null);

  const loadStatus = async () => {
    try { setStatus(await gameCenter.lootTodayStatus(student.id)); }
    catch (err) { console.warn('Failed to load crate status:', err); }
  };
  useEffect(() => { loadStatus(); }, [student.id]);

  const opensLeft = Math.max(0, status.capPerDay - status.opensToday);

  const handleOpen = async (box: LootBoxDef) => {
    if (shakingBox) return;
    if (opensLeft === 0) { alert(`Crate limit reached — come back tomorrow! (${status.capPerDay}/day)`); return; }
    if (student.points < box.cost) { alert(`A ${box.name} costs ${box.cost} pts — you have ${student.points}.`); return; }
    setShakingBox(box.key);
    try {
      // Let the shake play before the reveal lands
      const [res] = await Promise.all([
        gameCenter.openLootBox(student.id, box.key),
        new Promise(r => setTimeout(r, 900)),
      ]);
      setResult(res as OpenResult);
      setStatus({ opensToday: (res as OpenResult).opensToday, capPerDay: (res as OpenResult).capPerDay });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'The crate jammed — try again');
    } finally {
      setShakingBox(null);
    }
  };

  const previewLook: AvatarLook | null = result
    ? {
        ...DEFAULT_LOOK,
        ...(student.avatarLook ?? {}),
        [result.item.slot === 'HAIRSTYLE' ? 'hair' : result.item.slot === 'TOP' ? 'top' : 'acc']: result.item.key,
      }
    : null;

  return (
    <div className="space-y-3">
      <AvatarFx />
      <div className="flex items-center justify-between">
        <div>
          <div className="pz-eyebrow mb-1">Loot Crates</div>
          <h3 className="text-sm text-white uppercase tracking-wide">Spin The Wardrobe</h3>
        </div>
        <div className="text-right">
          <div className="pz-display text-lg" style={{ color: opensLeft > 0 ? 'var(--pz-volt)' : 'var(--pz-text)' }}>
            {opensLeft}/{status.capPerDay}
          </div>
          <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>Opens left today</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LOOT_BOXES.map(box => {
          const isPremium = box.key === 'PREMIUM';
          return (
            <div
              key={box.key}
              className="pz-card-sm p-4 flex flex-col gap-3"
              style={isPremium ? { borderColor: 'rgba(203,254,28,0.4)' } : undefined}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 flex items-center justify-center shrink-0"
                  style={{
                    background: isPremium ? 'rgba(203,254,28,0.12)' : 'var(--pz-panel-2)',
                    border: `2px solid ${isPremium ? 'var(--pz-volt)' : 'var(--pz-border)'}`,
                    clipPath: NOTCH_SM,
                    animation: shakingBox === box.key ? 'fnf-crate-shake 0.5s ease-in-out infinite' : undefined,
                    color: isPremium ? 'var(--pz-volt)' : '#9CA3AF',
                  }}
                >
                  <Ic.Gift size={28} />
                </div>
                <div className="flex-grow">
                  <div className="font-black text-white text-sm uppercase tracking-wide">{box.name}</div>
                  <div className="text-xs font-bold" style={{ color: 'var(--pz-volt)' }}>{box.cost} pts</div>
                </div>
              </div>

              {/* Published odds — always visible */}
              <div className="space-y-1">
                {(['common', 'uncommon', 'legendary'] as const).map(r => (
                  <div key={r} className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase w-20" style={{ color: RARITY_COLORS[r] }}>{r}</span>
                    <div className="flex-grow h-1.5 bg-white/10 overflow-hidden" style={{ clipPath: NOTCH_SM }}>
                      <div style={{ width: `${box.odds[r]}%`, height: '100%', background: RARITY_COLORS[r] }} />
                    </div>
                    <span className="text-[9px] font-bold w-8 text-right" style={{ color: 'var(--pz-text)' }}>{box.odds[r]}%</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleOpen(box)}
                disabled={!!shakingBox || opensLeft === 0 || student.points < box.cost}
                className={`touch-btn min-h-[44px] w-full py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
                  !shakingBox && opensLeft > 0 && student.points >= box.cost ? 'pz-btn' : 'bg-white/10 text-slate-500'
                }`}
                style={!(!shakingBox && opensLeft > 0 && student.points >= box.cost) ? { clipPath: NOTCH_SM } : undefined}
              >
                {shakingBox === box.key ? 'Opening…' : opensLeft === 0 ? 'Back tomorrow' : `Open Crate · ${box.cost} pts`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] leading-relaxed m-0" style={{ color: 'var(--pz-text)' }}>
        Crates cost points earned by showing up and playing — never money. Duplicates upgrade
        your item's tier; a maxed duplicate converts to shards (points back).
      </p>

      {/* Reveal overlay */}
      {result && previewLook && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6" style={{ background: 'rgba(4,6,10,0.88)' }} onClick={() => setResult(null)}>
          <div
            className="pz-card relative p-6 w-full max-w-sm text-center"
            style={{ borderColor: RARITY_COLORS[result.item.rarity as keyof typeof RARITY_COLORS] ?? 'var(--pz-border)', animation: 'fnf-reveal-pop 0.45s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full pointer-events-none"
              style={{ width: '180px', height: '180px', border: `3px solid ${RARITY_COLORS[result.item.rarity as keyof typeof RARITY_COLORS]}`, animation: 'fnf-burst-ring 0.8s ease-out forwards' }}
            />
            <div className="pz-eyebrow mb-1">
              {result.outcome === 'NEW' ? 'New Drop!' : result.outcome === 'UPGRADE' ? 'Upgraded!' : 'Shards!'}
            </div>
            <div className="flex justify-center my-2">
              <AvatarRig look={previewLook} size={170} idle />
            </div>
            <div className="pz-display text-2xl" style={{ color: RARITY_COLORS[result.item.rarity as keyof typeof RARITY_COLORS] }}>
              {result.item.name}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: RARITY_COLORS[result.item.rarity as keyof typeof RARITY_COLORS] }}>
              {result.item.rarity}
              {result.outcome === 'UPGRADE' && ` · ${UPGRADE_TIERS[result.upgradeLevel]} tier`}
            </div>
            {result.outcome === 'NEW' && (
              <div className="text-xs mt-2 font-bold" style={{ color: 'var(--pz-text)' }}>Equipped automatically — wear it proud!</div>
            )}
            {result.outcome === 'SHARDS' && (
              <div className="text-xs mt-2 font-bold" style={{ color: 'var(--pz-text)' }}>
                Already maxed — converted to +{result.refund} pts
              </div>
            )}
            <div className="text-[10px] mt-2 font-bold" style={{ color: 'var(--pz-text)' }}>Balance: {result.balance.toLocaleString()} pts</div>
            <button onClick={() => setResult(null)} className="pz-btn w-full mt-4 py-3 text-xs touch-btn min-h-[44px]">
              Keep Going
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LootCrates;
