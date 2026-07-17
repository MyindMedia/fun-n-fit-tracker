import React from 'react';
import {
  VOLT_SPECIALTY_META,
  VOLT_SLOT_LABELS,
  VoltEffects,
  VoltLoadout as VoltLoadoutShape,
  VoltPerkDef,
  VoltWildcardDef,
  voltPerk,
} from '../../voltCatalog';
import VoltMedallion from './VoltMedallion';
import { Ic, IconProps } from '../icons';

const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const NOTCH_MD = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
const WILDCARD_GOLD = '#D9A441';

interface AbilityRow {
  icon: React.FC<IconProps>;
  title: string;
  value: string;
  detail: string;
}

// Each effect explained in kid terms — the "breakdown" of what a perk does.
const abilityRows = (effects: VoltEffects | undefined): AbilityRow[] => {
  const fx = effects ?? {};
  const rows: AbilityRow[] = [];
  if (fx.gamePct)
    rows.push({ icon: Ic.Controller, title: 'Game Points', value: `+${fx.gamePct}%`, detail: 'Every point a coach or game awards gets boosted.' });
  if (fx.earnPct)
    rows.push({ icon: Ic.Store, title: 'Around Town', value: `+${fx.earnPct}%`, detail: 'Partner visits and special tasks pay out more.' });
  if (fx.checkinFlat)
    rows.push({ icon: Ic.ClipboardCheck, title: 'Check-In Bonus', value: `+${fx.checkinFlat} pts`, detail: 'Added on top of your daily check-in, after every multiplier.' });
  if (fx.xpPct)
    rows.push({ icon: Ic.Chart, title: 'XP Gain', value: `+${fx.xpPct}%`, detail: 'Climb Volt Levels faster on everything you earn.' });
  if (fx.shopDiscountPct)
    rows.push({ icon: Ic.Tag, title: 'Shop Discount', value: `${fx.shopDiscountPct}% off`, detail: 'Gear and avatar items cost fewer points.' });
  if (fx.crateCapPlus)
    rows.push({ icon: Ic.Gift, title: 'Daily Crates', value: `+${fx.crateCapPlus}`, detail: 'Open more loot crates every single day.' });
  if (fx.tradeSlotsPlus)
    rows.push({ icon: Ic.Users, title: 'Trade Slots', value: `+${fx.tradeSlotsPlus}`, detail: 'Keep more trade offers on the table at once.' });
  if (fx.shardRefundPct)
    rows.push({ icon: Ic.Refresh, title: 'Shard Refund', value: `${fx.shardRefundPct}%`, detail: 'Maxed-out crate duplicates refund way more points.' });
  if (fx.boostMinutesPlus)
    rows.push({ icon: Ic.Timer, title: 'Boost Time', value: `+${fx.boostMinutesPlus} min`, detail: 'Activated boosts and XP tokens run longer.' });
  if (fx.demotionShield)
    rows.push({ icon: Ic.Muscle, title: 'Rank Shield', value: 'ON', detail: 'Big shop spends can drop your rank, but never cost penalty points.' });
  return rows;
};

// Wildcard rules that are not plain stat effects get their own breakdown row.
const wildcardRuleRow = (w: VoltWildcardDef): AbilityRow | null => {
  switch (w.rule) {
    case 'MARATHON':
      return { icon: Ic.Run, title: 'Long Runner', value: '25 min', detail: 'Boosts and XP tokens run 25 minutes instead of 15.' };
    case 'DOUBLE_BOOST':
      return { icon: Ic.Dice, title: 'Two At Once', value: 'x2', detail: 'Run two boosts at the same time, stacked.' };
    case 'PERK_GREED':
      return { icon: Ic.Plus, title: 'Flex Slot', value: '4th perk', detail: 'Unlocks a fourth perk slot that takes any perk from any row.' };
    default:
      return null; // HIGH_ROLLER / XP_TYCOON explain themselves via effects
  }
};

interface PerkDetailModalProps {
  perk?: VoltPerkDef;
  wildcard?: VoltWildcardDef;
  state: 'equipped' | 'unlocked' | 'locked';
  loadout: VoltLoadoutShape;
  busy?: boolean;
  onEquip: () => void;
  onUnequip: () => void;
  onClose: () => void;
}

// Animated deep-dive pop-up for one perk or wildcard: what it is, exactly
// what it does, and how it plays into a Combat Specialty.
const PerkDetailModal: React.FC<PerkDetailModalProps> = ({
  perk,
  wildcard,
  state,
  loadout,
  busy,
  onEquip,
  onUnequip,
  onClose,
}) => {
  const def = perk ?? wildcard;
  if (!def) return null;

  const accent = perk ? VOLT_SPECIALTY_META[perk.specialty].color : WILDCARD_GOLD;
  const rows = abilityRows(perk ? perk.effects : wildcard?.effects);
  if (wildcard) {
    const ruleRow = wildcardRuleRow(wildcard);
    if (ruleRow) rows.unshift(ruleRow);
  }

  // Specialty synergy: how far this perk's color is toward its bonus.
  const spec = perk ? VOLT_SPECIALTY_META[perk.specialty] : null;
  const specCount = perk
    ? [loadout.perk1, loadout.perk2, loadout.perk3]
        .map((k) => voltPerk(k))
        .filter((p) => p?.specialty === perk.specialty).length
    : 0;

  const locked = state === 'locked';
  const equipped = state === 'equipped';

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <style>{`
        @keyframes voltModalIn {
          0% { opacity: 0; transform: translateY(36px) scale(0.92); }
          65% { opacity: 1; transform: translateY(-5px) scale(1.015); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes voltMedallionPop {
          0% { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          70% { opacity: 1; transform: scale(1.08) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes voltGlowPulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(1.12); }
        }
        @keyframes voltRowIn {
          0% { opacity: 0; transform: translateX(-14px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Card */}
      <div
        className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto custom-scrollbar"
        style={{
          background: 'var(--pz-panel)',
          border: `1px solid ${accent}55`,
          borderBottom: 'none',
          clipPath: NOTCH_MD,
          animation: 'voltModalIn 0.34s cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
        }}
      >
        {/* Accent glow header */}
        <div className="relative flex flex-col items-center pt-7 pb-4 px-5 overflow-hidden">
          <div
            className="absolute -top-16 w-64 h-64 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${accent}40 0%, transparent 65%)`,
              animation: 'voltGlowPulse 2.6s ease-in-out infinite',
            }}
          />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 touch-btn w-9 h-9 flex items-center justify-center text-white/70 bg-white/5 border border-white/10"
            style={{ clipPath: NOTCH_SM }}
          >
            <Ic.XMark size={16} />
          </button>

          <div style={{ animation: 'voltMedallionPop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.08s both', filter: locked ? undefined : `drop-shadow(0 0 18px ${accent}66)` }}>
            <VoltMedallion perk={perk} wildcard={wildcard} size={128} state={state} />
          </div>

          <h3 className="pz-display text-2xl text-white mt-3 mb-1 text-center uppercase">{def.name}</h3>

          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <span
              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5"
              style={{ background: `${accent}26`, border: `1px solid ${accent}`, color: accent, clipPath: NOTCH_SM }}
            >
              {perk ? `${VOLT_SPECIALTY_META[perk.specialty].name} perk` : 'Wildcard'}
            </span>
            {perk && (
              <span
                className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 text-white/70 bg-white/5 border border-white/15"
                style={{ clipPath: NOTCH_SM }}
              >
                Perk {perk.slot} · {VOLT_SLOT_LABELS[perk.slot]}
              </span>
            )}
            <span
              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5"
              style={{
                clipPath: NOTCH_SM,
                background: locked ? 'rgba(255,255,255,0.06)' : `${accent}26`,
                border: `1px solid ${locked ? 'rgba(255,255,255,0.25)' : accent}`,
                color: locked ? 'rgba(255,255,255,0.6)' : accent,
              }}
            >
              {locked ? `Locks off at LVL ${def.unlockLevel}` : `LVL ${def.unlockLevel}`}
            </span>
          </div>

          <p className="text-xs text-center leading-relaxed mt-2.5 mb-0 max-w-[300px]" style={{ color: 'var(--pz-text)' }}>
            {def.blurb}
          </p>
        </div>

        {/* Abilities breakdown */}
        <div className="px-5 pb-4">
          <div className="pz-eyebrow mb-2">Abilities</div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div
                key={r.title}
                className="flex items-center gap-3 p-2.5"
                style={{
                  background: 'var(--pz-panel-2)',
                  border: '1px solid var(--pz-border)',
                  clipPath: NOTCH_SM,
                  animation: `voltRowIn 0.3s ease-out ${0.12 + i * 0.07}s both`,
                }}
              >
                <span className="shrink-0" style={{ color: accent }}>
                  <r.icon size={20} />
                </span>
                <div className="min-w-0 flex-grow">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-white">{r.title}</span>
                    <span
                      className="text-[10px] font-black px-1.5 py-0.5 shrink-0"
                      style={{ background: accent, color: '#0B0E13', clipPath: NOTCH_SM }}
                    >
                      {r.value}
                    </span>
                  </div>
                  <div className="text-[10px] leading-snug mt-0.5" style={{ color: 'var(--pz-text)' }}>
                    {r.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Specialty synergy (perks only) */}
        {perk && spec && (
          <div className="px-5 pb-4">
            <div
              className="flex items-center gap-3 p-3"
              style={{
                background: `${spec.color}12`,
                border: `1px solid ${spec.color}55`,
                clipPath: NOTCH_SM,
                animation: `voltRowIn 0.3s ease-out ${0.12 + rows.length * 0.07}s both`,
              }}
            >
              <div className="shrink-0">
                <VoltMedallion specialtyKey={perk.specialty} size={44} state="unlocked" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: spec.color }}>
                  {specCount} of 3 toward {spec.bonusName}
                </div>
                <div className="text-[10px] leading-snug mt-0.5" style={{ color: 'var(--pz-text)' }}>
                  {spec.bonusBlurb}
                </div>
                <div className="h-1.5 bg-white/10 mt-1.5 overflow-hidden" style={{ clipPath: NOTCH_SM }}>
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${(specCount / 3) * 100}%`, background: spec.color }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="px-5 pb-6 pt-1" style={{ paddingBottom: 'calc(1.5rem + var(--safe-area-bottom, 0px))' }}>
          {locked ? (
            <button
              disabled
              className="w-full min-h-[52px] font-black uppercase tracking-widest text-sm inline-flex items-center justify-center gap-2 text-white/50 bg-white/5 border border-white/15"
              style={{ clipPath: NOTCH_SM }}
            >
              <Ic.Lock size={16} /> Reach Volt Level {def.unlockLevel}
            </button>
          ) : equipped ? (
            <div className="flex gap-2">
              <div
                className="flex-grow min-h-[52px] font-black uppercase tracking-widest text-sm inline-flex items-center justify-center gap-2"
                style={{ background: `${accent}1f`, border: `1px solid ${accent}`, color: accent, clipPath: NOTCH_SM }}
              >
                <Ic.CheckCircle size={16} /> Equipped
              </div>
              <button
                onClick={onUnequip}
                disabled={busy}
                className="min-h-[52px] px-4 font-black uppercase tracking-widest text-xs text-white/80 bg-white/5 border border-white/20 disabled:opacity-50"
                style={{ clipPath: NOTCH_SM }}
              >
                Swap out
              </button>
            </div>
          ) : (
            <button
              onClick={onEquip}
              disabled={busy}
              className="w-full min-h-[52px] font-black uppercase tracking-widest text-sm inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ background: accent, color: '#0B0E13', clipPath: NOTCH_SM }}
            >
              <Ic.Bolt size={16} /> Equip {def.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerkDetailModal;
