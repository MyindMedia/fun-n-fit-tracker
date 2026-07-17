import React, { useEffect, useState } from 'react';
import { Student } from '../../types';
import {
  VOLT_PERKS,
  VOLT_SLOT_LABELS,
  VOLT_SPECIALTY_META,
  VOLT_WILDCARDS,
  VoltEffects,
  VoltLoadout as VoltLoadoutShape,
  VoltPerkDef,
  VoltSlot,
  VoltSpecialty,
  VoltWildcardDef,
  voltActiveSpecialty,
  voltEffects,
  voltPerk,
  voltRule,
} from '../../voltCatalog';
import { voltClient, VoltProfile, VoltSlotKey } from '../../services/voltClient';
import VoltMedallion, { VoltLevelHex } from './VoltMedallion';
import PerkDetailModal from './PerkDetailModal';
import { Ic } from '../icons';

const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const WILDCARD_GOLD = '#D9A441';
const SPECIALTIES: VoltSpecialty[] = ['STRIKER', 'SCOUT', 'CAPTAIN'];

interface VoltLoadoutProps {
  student: Student;
  onClose: () => void;
  onChanged?: () => void;
}

// Convex wraps thrown mutation errors; dig the friendly line back out.
const friendlyError = (err: unknown): string => {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const m = raw.match(/Uncaught Error:\s*([^\n]+)/);
  const line = (m ? m[1] : raw).split(' at ')[0].trim();
  return line || 'That did not work, try again';
};

// Live "what your build does" chips from the merged loadout effects.
const effectChips = (fx: Required<VoltEffects>, loadout: VoltLoadoutShape): string[] => {
  const chips: string[] = [];
  if (fx.gamePct) chips.push(`+${fx.gamePct}% game points`);
  if (fx.earnPct) chips.push(`+${fx.earnPct}% around-town points`);
  if (fx.checkinFlat) chips.push(`+${fx.checkinFlat} check-in pts`);
  if (fx.xpPct) chips.push(`+${fx.xpPct}% XP`);
  if (fx.shopDiscountPct) chips.push(`${fx.shopDiscountPct}% shop discount`);
  if (fx.crateCapPlus) chips.push(`+${fx.crateCapPlus} crate${fx.crateCapPlus > 1 ? 's' : ''} a day`);
  if (fx.tradeSlotsPlus) chips.push(`+${fx.tradeSlotsPlus} trade slots`);
  if (fx.shardRefundPct) chips.push(`${fx.shardRefundPct}% shard refunds`);
  if (fx.boostMinutesPlus) chips.push(`+${fx.boostMinutesPlus} boost minutes`);
  if (fx.demotionShield) chips.push('No demotion penalty');
  if (voltRule(loadout, 'MARATHON')) chips.push('25 minute boosts');
  if (voltRule(loadout, 'DOUBLE_BOOST')) chips.push('Two boosts at once');
  if (voltRule(loadout, 'PERK_GREED')) chips.push('Fourth flex perk');
  return chips;
};

// Full-screen loadout sheet, same shell pattern as avatar/AvatarStudio.tsx.
const VoltLoadout: React.FC<VoltLoadoutProps> = ({ student, onClose, onChanged }) => {
  const [profile, setProfile] = useState<VoltProfile | null>(null);
  const [busySlot, setBusySlot] = useState<VoltSlotKey | null>(null);
  const [rowMsg, setRowMsg] = useState<{ slot: string; msg: string } | null>(null);
  // Deep-dive pop-up: which perk/wildcard is being inspected, and for which slot.
  const [detail, setDetail] = useState<{
    perk?: VoltPerkDef;
    wildcard?: VoltWildcardDef;
    slotKey: VoltSlotKey;
  } | null>(null);

  // Live profile subscription; also reconciles every optimistic equip.
  useEffect(() => voltClient.subscribeProfile(student.id, setProfile), [student.id]);

  const handleEquip = async (slot: VoltSlotKey, key: string | null) => {
    if (!profile || busySlot) return;
    const prev = profile;
    // Optimistic: apply locally with the shared catalog helpers, then let the
    // subscription reconcile from the server payload.
    const nextLoadout: VoltLoadoutShape = { ...profile.loadout, [slot]: key };
    if (slot === 'wildcard' && !voltRule(nextLoadout, 'PERK_GREED')) nextLoadout.flex = null;
    setProfile({
      ...profile,
      loadout: nextLoadout,
      activeSpecialty: voltActiveSpecialty(nextLoadout),
      effects: voltEffects(nextLoadout),
    });
    setBusySlot(slot);
    setRowMsg(null);
    try {
      await voltClient.equip(student.id, slot, key);
      if (onChanged) onChanged();
    } catch (err) {
      setProfile(prev);
      setRowMsg({ slot, msg: friendlyError(err) });
    } finally {
      setBusySlot(null);
    }
  };

  // Equip/unequip fired from inside the detail pop-up; optimistic close.
  const equipFromDetail = (key: string | null) => {
    if (!detail) return;
    const slotKey = detail.slotKey;
    setDetail(null);
    void handleEquip(slotKey, key);
  };

  if (!profile) {
    return (
      <div className="pz-scope flex flex-col h-full" style={{ background: 'var(--pz-bg)' }}>
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: 'var(--pz-panel)', borderBottom: '1px solid var(--pz-border)' }}>
          <button onClick={onClose} className="touch-btn pz-btn-ghost font-bold text-xs px-3 py-1">Close</button>
          <h2 className="pz-display text-sm text-white uppercase tracking-wide">Volt Loadout</h2>
          <div className="w-16" />
        </div>
        <div className="flex-grow flex items-center justify-center text-xs italic" style={{ color: 'var(--pz-text)' }}>
          Charging up your loadout...
        </div>
      </div>
    );
  }

  const { loadout, level, xp, nextLevel, activeSpecialty, unlockedPerks, unlockedWildcards } = profile;
  const xpPct = nextLevel ? Math.min(100, Math.max(0, ((nextLevel.span - nextLevel.needed) / Math.max(1, nextLevel.span)) * 100)) : 100;
  const chips = effectChips(profile.effects, loadout);
  const flexOpen = voltRule(loadout, 'PERK_GREED');

  // Plain render helpers (not nested components) so the rails keep their
  // DOM identity, and their scroll position, across optimistic re-renders.
  const renderInlineMsg = (slot: string) =>
    rowMsg && rowMsg.slot === slot ? (
      <div
        className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold"
        style={{ background: 'rgba(203,254,28,0.10)', border: '1px solid rgba(203,254,28,0.35)', color: 'var(--pz-volt)', clipPath: NOTCH_SM }}
      >
        <Ic.Info size={12} /> {rowMsg.msg}
      </div>
    ) : null;

  const renderPerkRow = (slot: VoltSlot) => {
    const slotKey = `perk${slot}` as VoltSlotKey;
    const equippedKey = loadout[slotKey as 'perk1' | 'perk2' | 'perk3'] ?? null;
    const rowPerks = VOLT_PERKS.filter(p => p.slot === slot).slice().sort((a, b) => a.unlockLevel - b.unlockLevel);
    const chipColor = voltPerk(equippedKey) ? VOLT_SPECIALTY_META[voltPerk(equippedKey)!.specialty].color : '#CBFE1C';
    return (
      <div key={slot} className="pz-card p-3 sm:p-4">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <div className="pz-display text-lg text-white leading-none">PERK {slot}</div>
          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>
            {VOLT_SLOT_LABELS[slot]}
          </div>
          <span
            className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 ml-auto"
            style={{ background: `${chipColor}26`, border: `1px solid ${chipColor}`, color: chipColor, clipPath: NOTCH_SM }}
          >
            Equip one
          </span>
        </div>
        <div className="flex gap-2.5 overflow-x-auto custom-scrollbar pb-1.5 -mx-1 px-1">
          {rowPerks.map(p => {
            const isEquipped = equippedKey === p.key;
            const isUnlocked = unlockedPerks.includes(p.key);
            return (
              <button
                key={p.key}
                onClick={() => setDetail({ perk: p, slotKey })}
                disabled={busySlot !== null}
                className="touch-btn shrink-0 disabled:opacity-70"
                title={p.blurb}
              >
                <VoltMedallion
                  perk={p}
                  size={82}
                  state={isEquipped ? 'equipped' : isUnlocked ? 'unlocked' : 'locked'}
                  showLabel
                />
              </button>
            );
          })}
        </div>
        {voltPerk(equippedKey) && (
          <div className="text-[10px] font-bold mt-1" style={{ color: 'var(--pz-text)' }}>
            {voltPerk(equippedKey)!.blurb}
          </div>
        )}
        {renderInlineMsg(slotKey)}
      </div>
    );
  };

  return (
    <div className="pz-scope flex flex-col h-full" style={{ background: 'var(--pz-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: 'var(--pz-panel)', borderBottom: '1px solid var(--pz-border)' }}>
        <button onClick={onClose} className="touch-btn pz-btn-ghost font-bold text-xs px-3 py-1">Close</button>
        <h2 className="pz-display text-sm text-white uppercase tracking-wide inline-flex items-center gap-2">
          <Ic.Bolt size={16} /> Volt Loadout
        </h2>
        <div className="w-16" />
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar">
        <div className="p-4 xl:p-6 space-y-4 max-w-[1700px] mx-auto">
          {/* Level hexagon + XP bar */}
          <div className="pz-card p-4 flex items-center gap-4">
            <div className="shrink-0"><VoltLevelHex level={level} size={64} /></div>
            <div className="flex-grow min-w-0">
              <div className="pz-eyebrow mb-1">Volt Level {level}</div>
              <div className="h-3 bg-white/10 overflow-hidden" style={{ clipPath: NOTCH_SM }}>
                <div className="h-full transition-all duration-700" style={{ width: `${xpPct}%`, background: 'var(--pz-volt)' }} />
              </div>
              <div className="text-[10px] font-bold uppercase mt-1" style={{ color: 'var(--pz-text)' }}>
                {nextLevel
                  ? `${nextLevel.needed.toLocaleString()} XP to LVL ${nextLevel.nextLevel}`
                  : 'Max level, you did it all'}
                <span className="ml-2" style={{ color: 'var(--pz-volt)' }}>{xp.toLocaleString()} XP total</span>
              </div>
            </div>
          </div>

          {/* Perk rows + Combat Specialty panel */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-4 items-start">
            <div className="space-y-4 min-w-0">
              {([1, 2, 3] as VoltSlot[]).map(slot => renderPerkRow(slot))}
            </div>

            {/* Combat Specialty */}
            <div className="pz-card p-4">
              <div className="pz-eyebrow mb-1">Combat Specialty</div>
              <div className="text-[10px] font-bold mb-3" style={{ color: 'var(--pz-text)' }}>
                Equip three perks of the same color to power up a bonus.
              </div>
              <div className="space-y-3">
                {SPECIALTIES.map(s => {
                  const meta = VOLT_SPECIALTY_META[s];
                  const isActive = activeSpecialty === s;
                  return (
                    <div
                      key={s}
                      className="flex items-center gap-3 p-2.5"
                      style={{
                        clipPath: NOTCH_SM,
                        background: isActive ? `${meta.color}1a` : 'var(--pz-panel-2)',
                        border: `1px solid ${isActive ? meta.color : 'var(--pz-border)'}`,
                        opacity: isActive ? 1 : 0.72,
                      }}
                    >
                      <div className="shrink-0">
                        <VoltMedallion specialtyKey={s} size={56} state={isActive ? 'equipped' : 'unlocked'} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="pz-display text-xs" style={{ color: meta.color }}>{meta.bonusName}</span>
                          {isActive && (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5" style={{ background: meta.color, color: '#0B0E13', clipPath: NOTCH_SM }}>
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] leading-snug mt-0.5" style={{ color: 'var(--pz-text)' }}>
                          {isActive ? meta.bonusBlurb : `Equip 3 ${meta.name} perks`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Wildcard row */}
          <div className="pz-card p-3 sm:p-4">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div className="pz-display text-lg text-white leading-none">WILDCARD</div>
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Rule benders</div>
              <span
                className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 ml-auto"
                style={{ background: 'rgba(217,164,65,0.14)', border: `1px solid ${WILDCARD_GOLD}`, color: WILDCARD_GOLD, clipPath: NOTCH_SM }}
              >
                Equip one
              </span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto custom-scrollbar pb-1.5 -mx-1 px-1">
              {VOLT_WILDCARDS.slice().sort((a, b) => a.unlockLevel - b.unlockLevel).map(w => {
                const isEquipped = loadout.wildcard === w.key;
                const isUnlocked = unlockedWildcards.includes(w.key);
                return (
                  <button
                    key={w.key}
                    onClick={() => setDetail({ wildcard: w, slotKey: 'wildcard' })}
                    disabled={busySlot !== null}
                    className="touch-btn shrink-0 disabled:opacity-70"
                    title={w.blurb}
                  >
                    <VoltMedallion wildcard={w} size={82} state={isEquipped ? 'equipped' : isUnlocked ? 'unlocked' : 'locked'} showLabel />
                  </button>
                );
              })}
            </div>
            {loadout.wildcard && (
              <div className="text-[10px] font-bold mt-1" style={{ color: 'var(--pz-text)' }}>
                {VOLT_WILDCARDS.find(w => w.key === loadout.wildcard)?.blurb}
              </div>
            )}
            {renderInlineMsg('wildcard')}
          </div>

          {/* Flex perk row, revealed by Perk Greed */}
          {flexOpen && (
            <div className="pz-card p-3 sm:p-4" style={{ borderColor: `${WILDCARD_GOLD}55` }}>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <div className="pz-display text-lg text-white leading-none">FLEX PERK</div>
                <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: WILDCARD_GOLD }}>
                  Perk Greed bonus, any row
                </div>
              </div>
              <div className="flex gap-2.5 overflow-x-auto custom-scrollbar pb-1.5 -mx-1 px-1">
                {VOLT_PERKS
                  .filter(p =>
                    unlockedPerks.includes(p.key) &&
                    (p.key === loadout.flex ||
                      ![loadout.perk1, loadout.perk2, loadout.perk3].includes(p.key)))
                  .slice()
                  .sort((a, b) => a.unlockLevel - b.unlockLevel)
                  .map(p => {
                    const isEquipped = loadout.flex === p.key;
                    return (
                      <button
                        key={p.key}
                        onClick={() => setDetail({ perk: p, slotKey: 'flex' })}
                        disabled={busySlot !== null}
                        className="touch-btn shrink-0 disabled:opacity-70"
                        title={p.blurb}
                      >
                        <VoltMedallion perk={p} size={82} state={isEquipped ? 'equipped' : 'unlocked'} showLabel />
                      </button>
                    );
                  })}
              </div>
              {renderInlineMsg('flex')}
            </div>
          )}

          {/* Live bonus summary */}
          <div className="pz-card p-4">
            <div className="pz-eyebrow mb-2">Your Bonuses</div>
            {chips.length === 0 ? (
              <div className="text-xs font-medium" style={{ color: 'var(--pz-text)' }}>
                Equip perks above to power up your build.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {chips.map(c => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide"
                    style={{ background: 'rgba(203,254,28,0.10)', border: '1px solid rgba(203,254,28,0.35)', color: 'var(--pz-volt)', clipPath: NOTCH_SM }}
                  >
                    <Ic.Bolt size={11} /> {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          <p className="text-[10px] leading-relaxed m-0" style={{ color: 'var(--pz-text)' }}>
            Perks are free to swap any time once your Volt Level unlocks them. Match all three
            perk colors to fire up a Combat Specialty bonus, and grab a wildcard to bend the rules.
          </p>
        </div>
      </div>

      {/* Perk / wildcard deep-dive pop-up */}
      {detail && (() => {
        const key = detail.perk?.key ?? detail.wildcard?.key ?? '';
        const equippedInSlot =
          detail.slotKey === 'wildcard'
            ? loadout.wildcard === key
            : detail.slotKey === 'flex'
              ? loadout.flex === key
              : loadout[detail.slotKey as 'perk1' | 'perk2' | 'perk3'] === key;
        const isUnlocked = detail.perk
          ? unlockedPerks.includes(key)
          : unlockedWildcards.includes(key);
        return (
          <PerkDetailModal
            perk={detail.perk}
            wildcard={detail.wildcard}
            state={equippedInSlot ? 'equipped' : isUnlocked ? 'unlocked' : 'locked'}
            loadout={loadout}
            busy={busySlot !== null}
            onEquip={() => equipFromDetail(key)}
            onUnequip={() => equipFromDetail(null)}
            onClose={() => setDetail(null)}
          />
        );
      })()}
    </div>
  );
};

export default VoltLoadout;
