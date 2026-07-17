import React, { useEffect, useState } from 'react';
import { Student } from '../../types';
import {
  VOLT_SPECIALTY_META,
  voltPerk,
  voltWildcard,
} from '../../voltCatalog';
import { voltClient, VoltProfile } from '../../services/voltClient';
import VoltMedallion, { VoltEmptySlot, VoltLevelHex } from './VoltMedallion';
import { Ic, IconProps } from '../icons';

const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

interface VoltStatsCardProps {
  student: Student;
  onOpenLoadout: () => void;
}

// COD-style player stats area for the Profile tab: Volt level + XP bar,
// the equipped medallion row (tap to open the loadout), and the combat
// record grid straight from the volt profile query.
const VoltStatsCard: React.FC<VoltStatsCardProps> = ({ student, onOpenLoadout }) => {
  const [profile, setProfile] = useState<VoltProfile | null>(null);

  // Live subscription: covers mount AND every loadout change made in the
  // full-screen sheet, no manual refetch needed.
  useEffect(() => voltClient.subscribeProfile(student.id, setProfile), [student.id]);

  if (!profile) {
    return (
      <div className="pz-card p-4">
        <div className="pz-eyebrow mb-1">Volt System</div>
        <div className="text-xs italic" style={{ color: 'var(--pz-text)' }}>Charging up...</div>
      </div>
    );
  }

  const { level, xp, nextLevel, loadout, activeSpecialty, stats } = profile;
  const xpPct = nextLevel
    ? Math.min(100, Math.max(0, ((nextLevel.span - nextLevel.needed) / Math.max(1, nextLevel.span)) * 100))
    : 100;
  const specMeta = activeSpecialty ? VOLT_SPECIALTY_META[activeSpecialty] : null;

  const slots: Array<{ id: string; perkKey?: string | null }> = [
    { id: 'perk1', perkKey: loadout.perk1 },
    { id: 'perk2', perkKey: loadout.perk2 },
    { id: 'perk3', perkKey: loadout.perk3 },
    ...(loadout.flex ? [{ id: 'flex', perkKey: loadout.flex }] : []),
  ];
  const wildcard = voltWildcard(loadout.wildcard);

  const statCells: Array<{ label: string; value: number; icon: React.FC<IconProps> }> = [
    { label: 'Points', value: stats.currentPoints, icon: Ic.Coin },
    { label: 'Lifetime', value: stats.lifetimePoints, icon: Ic.Chart },
    { label: 'Check-ins', value: stats.checkIns, icon: Ic.CheckCircle },
    { label: 'Medals', value: stats.medals, icon: Ic.Medal },
    { label: 'Crates', value: stats.cratesOpened, icon: Ic.Gift },
    { label: 'Trades', value: stats.tradesDone, icon: Ic.Refresh },
    { label: 'Town visits', value: stats.partnerVisits, icon: Ic.Store },
    { label: 'Band taps', value: stats.bandTaps, icon: Ic.Nfc },
  ];

  return (
    <div className="pz-card p-4 sm:p-5">
      {/* Level + XP */}
      <div className="flex items-center gap-4">
        <div className="shrink-0"><VoltLevelHex level={level} size={60} /></div>
        <div className="flex-grow min-w-0">
          <div className="pz-eyebrow mb-1">Volt Level {level}</div>
          <div className="h-3 bg-white/10 overflow-hidden" style={{ clipPath: NOTCH_SM }}>
            <div className="h-full transition-all duration-700" style={{ width: `${xpPct}%`, background: 'var(--pz-volt)' }} />
          </div>
          <div className="text-[10px] font-bold uppercase mt-1" style={{ color: 'var(--pz-text)' }}>
            {nextLevel
              ? `${xp.toLocaleString()} / ${(xp + nextLevel.needed).toLocaleString()} XP`
              : `${xp.toLocaleString()} XP · Max level`}
          </div>
        </div>
      </div>

      {/* Equipped medallion row, tap anywhere to open the loadout */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenLoadout}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenLoadout(); } }}
        className="mt-4 p-3 cursor-pointer transition-all hover:border-[#CBFE1C] active:scale-[0.99]"
        style={{ clipPath: NOTCH_SM, background: 'var(--pz-panel-2)', border: '1px solid var(--pz-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 flex-grow min-w-0 overflow-x-auto custom-scrollbar">
            {slots.map(s => {
              const p = voltPerk(s.perkKey);
              return p ? (
                <div key={s.id} className="shrink-0"><VoltMedallion perk={p} size={44} state="equipped" /></div>
              ) : (
                <div key={s.id} className="shrink-0"><VoltEmptySlot size={44} /></div>
              );
            })}
            <span className="w-px self-stretch shrink-0" style={{ background: 'var(--pz-border)' }} />
            {wildcard ? (
              <div className="shrink-0"><VoltMedallion wildcard={wildcard} size={44} state="equipped" /></div>
            ) : (
              <div className="shrink-0"><VoltEmptySlot size={44} /></div>
            )}
          </div>
          <span
            className="touch-btn shrink-0 inline-flex items-center gap-1 px-2.5 py-2 text-[10px] font-black uppercase tracking-widest"
            style={{ background: 'var(--pz-volt)', color: '#0B0E13', clipPath: NOTCH_SM }}
          >
            Loadout <Ic.ChevronRight size={12} />
          </span>
        </div>
        {specMeta && (
          <div
            className="mt-2 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5"
            style={{ color: specMeta.color }}
          >
            <Ic.Bolt size={12} /> {specMeta.bonusName} active
          </div>
        )}
      </div>

      {/* Combat record grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 mt-4">
        {statCells.map(cell => (
          <div key={cell.label} className="p-3 text-center" style={{ clipPath: NOTCH_SM, background: 'var(--pz-panel-2)' }}>
            <div className="flex justify-center mb-1" style={{ color: 'var(--pz-volt)' }}>
              <cell.icon size={16} />
            </div>
            <div className="pz-display text-lg text-white leading-none">{cell.value.toLocaleString()}</div>
            <div className="text-[9px] font-bold uppercase mt-1" style={{ color: 'var(--pz-text)' }}>{cell.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VoltStatsCard;
