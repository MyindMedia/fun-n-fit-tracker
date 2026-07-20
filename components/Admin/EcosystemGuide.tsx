import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RANKS } from '../../constants';
import { Rank } from '../../types';
import {
  VOLT_PERKS,
  VOLT_WILDCARDS,
  VOLT_MAX_LEVEL,
  VOLT_SPECIALTY_META,
  voltXpForLevel,
  VoltPerkDef,
  VoltWildcardDef,
} from '../../voltCatalog';
import VoltMedallion, { VoltLevelHex } from '../volt/VoltMedallion';
import { Ic } from '../icons';

// New-coach onboarding: the "How the Ecosystem Works" explainer. Read-only,
// it renders straight from constants.ts (RANKS) and voltCatalog.ts (perks,
// levels), so it always matches the live system without duplicating any data.
// Style mirrors the pz-* dark system (volt-green accent, NOTCH clip corners).

// Pubzi theme: notched cut-corner shapes for inline elements.
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const NOTCH_XS = 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)';

// Volt levels to spotlight as medallions (evenly across the 1..40 climb).
const VOLT_MILESTONE_LEVELS = [1, 5, 10, 15, 20, 25, 30, 35, 40].filter((n) => n <= VOLT_MAX_LEVEL);

// A committed athlete's steady pace: 4 sessions a week, ~45 XP a session.
const XP_PER_WEEK = 4 * 45;

// Every perk + wildcard unlock, flattened and ordered by the level it opens at.
type Unlock = { level: number; label: string; blurb: string; kind: 'perk' | 'wildcard' };

// ── The pop-up detail modal ──────────────────────────────────────────────────
// One modal reused for ranks, Volt levels, perks and wildcards. Portaled to the
// body so it floats above the whole admin board (fixed inset-0, z-300, backdrop).
type Selected =
  | { kind: 'rank'; rank: Rank }
  | { kind: 'level'; level: number }
  | { kind: 'perk'; perk: VoltPerkDef }
  | { kind: 'wildcard'; wildcard: VoltWildcardDef }
  | null;

const InfoModal: React.FC<{ selected: Selected; onClose: () => void; allUnlocks: Unlock[] }> = ({
  selected,
  onClose,
  allUnlocks,
}) => {
  if (!selected) return null;

  let body: React.ReactNode = null;

  if (selected.kind === 'rank') {
    const rank = selected.rank;
    body = (
      <>
        <div className="flex flex-col items-center text-center gap-3">
          {rank.icon ? (
            <img src={rank.icon} alt={rank.name} className="w-24 h-24 object-contain" />
          ) : (
            <div className="w-24 h-24 flex items-center justify-center" style={{ color: rank.color }}>
              <Ic.Medal size={64} />
            </div>
          )}
          <div>
            <div className="pz-eyebrow mb-1">Rank</div>
            <h3 className="pz-display text-2xl text-white tracking-tight">{rank.name}</h3>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#0B0E13]"
            style={{ background: 'var(--pz-volt)', clipPath: NOTCH_XS }}
          >
            <Ic.Bolt size={12} /> {rank.threshold.toLocaleString()} XP
          </span>
        </div>
        {rank.description && (
          <p className="mt-4 text-sm text-center" style={{ color: 'var(--pz-text)' }}>
            {rank.description}
          </p>
        )}
        <div className="mt-4 pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
          <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--pz-volt)' }}>
            What it means
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--pz-text)' }}>
            {rank.name} is a lifetime-XP milestone. Once a kid crosses{' '}
            {rank.threshold.toLocaleString()} XP they hold this rank for good. Because rank rides lifetime
            XP (not the spendable wallet), seasonal point resets and shop spending never take it away.
          </p>
        </div>
      </>
    );
  } else if (selected.kind === 'level') {
    const level = selected.level;
    const xp = voltXpForLevel(level);
    const atThisLevel = allUnlocks.filter((u) => u.level === level);
    const nextUnlock = allUnlocks.find((u) => u.level > level);
    body = (
      <>
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex justify-center">
            <VoltLevelHex level={level} size={96} />
          </div>
          <div>
            <div className="pz-eyebrow mb-1">Volt Level</div>
            <h3 className="pz-display text-2xl text-white tracking-tight">Level {level}</h3>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#0B0E13]"
            style={{ background: 'var(--pz-volt)', clipPath: NOTCH_XS }}
          >
            <Ic.Bolt size={12} /> {xp.toLocaleString()} XP to reach
          </span>
        </div>
        <div className="mt-4 pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
          <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--pz-volt)' }}>
            Unlocks at this level
          </div>
          {atThisLevel.length > 0 ? (
            <ul className="space-y-2">
              {atThisLevel.map((u) => (
                <li key={`${u.kind}-${u.label}`} className="text-xs" style={{ color: 'var(--pz-text)' }}>
                  <span className="font-black text-white">{u.label}</span>
                  {u.kind === 'wildcard' && (
                    <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider" style={{ color: '#D9A441' }}>
                      Wildcard
                    </span>
                  )}
                  <div className="text-[11px] leading-snug">{u.blurb}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--pz-text)' }}>
              No new perk opens at exactly this level. Volt Levels climb on lifetime XP, so the number keeps
              rising even between unlocks.
              {nextUnlock && (
                <>
                  {' '}
                  Next up: <span className="font-black text-white">{nextUnlock.label}</span> at Level {nextUnlock.level}.
                </>
              )}
            </p>
          )}
        </div>
      </>
    );
  } else if (selected.kind === 'perk') {
    const perk = selected.perk;
    const spec = VOLT_SPECIALTY_META[perk.specialty];
    body = (
      <>
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex justify-center">
            <VoltMedallion perk={perk} state="unlocked" size={110} showLabel />
          </div>
          <div>
            <div className="pz-eyebrow mb-1" style={{ color: spec.color }}>
              {spec.name} Perk
            </div>
            <h3 className="pz-display text-2xl text-white tracking-tight">{perk.name}</h3>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#0B0E13]"
            style={{ background: 'var(--pz-volt)', clipPath: NOTCH_XS }}
          >
            <Ic.Lock size={12} /> Unlocks at Volt Level {perk.unlockLevel}
          </span>
        </div>
        <div className="mt-4 pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
          <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--pz-volt)' }}>
            What it does
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--pz-text)' }}>
            {perk.blurb} Perks are free to equip once the Volt Level opens them.
          </p>
        </div>
      </>
    );
  } else if (selected.kind === 'wildcard') {
    const wildcard = selected.wildcard;
    body = (
      <>
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex justify-center">
            <VoltMedallion wildcard={wildcard} state="unlocked" size={110} showLabel />
          </div>
          <div>
            <div className="pz-eyebrow mb-1" style={{ color: '#D9A441' }}>
              Wildcard
            </div>
            <h3 className="pz-display text-2xl text-white tracking-tight">{wildcard.name}</h3>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#0B0E13]"
            style={{ background: 'var(--pz-volt)', clipPath: NOTCH_XS }}
          >
            <Ic.Lock size={12} /> Unlocks at Volt Level {wildcard.unlockLevel}
          </span>
        </div>
        <div className="mt-4 pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
          <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--pz-volt)' }}>
            What it does
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--pz-text)' }}>
            {wildcard.blurb} A wildcard is a single game-changing rule a kid slots on top of their three perks.
          </p>
        </div>
      </>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[300] pz-scope flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="pz-card relative w-full max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="touch-btn absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/60 active:scale-95 transition-transform"
        >
          <Ic.XMark size={18} />
        </button>
        {body}
      </div>
    </div>,
    document.body
  );
};

// ── Collapsible section ──────────────────────────────────────────────────────
const Section: React.FC<{
  id: string;
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ eyebrow, title, icon, open, onToggle, children }) => (
  <div className="pz-card overflow-hidden">
    <button
      onClick={onToggle}
      aria-expanded={open}
      className="touch-btn w-full flex items-center gap-3 p-4 text-left active:bg-white/5 transition-colors"
    >
      <span className="flex-shrink-0 text-[#CBFE1C]">{icon}</span>
      <div className="flex-grow min-w-0">
        <div className="pz-eyebrow mb-0.5">{eyebrow}</div>
        <h3 className="text-sm text-white uppercase tracking-wide font-black">{title}</h3>
      </div>
      <span
        className="flex-shrink-0 text-white/50 transition-transform"
        style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
      >
        <Ic.ChevronRight size={20} />
      </span>
    </button>
    {open && <div className="px-4 pb-5 pt-1 border-t border-white/10">{children}</div>}
  </div>
);

const EcosystemGuide: React.FC = () => {
  const [open, setOpen] = useState<Record<string, boolean>>({ points: true });
  const [selected, setSelected] = useState<Selected>(null);

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  // Ranks sorted low to high (defensive: constants.ts is already ordered).
  const ranks = useMemo(() => [...RANKS].sort((a, b) => a.threshold - b.threshold), []);
  const apexRank = ranks[ranks.length - 1];

  // Perks + wildcards, ordered by unlock level, for the Volt track and modal.
  const perksByLevel = useMemo(() => [...VOLT_PERKS].sort((a, b) => a.unlockLevel - b.unlockLevel), []);
  const wildcardsByLevel = useMemo(
    () => [...VOLT_WILDCARDS].sort((a, b) => a.unlockLevel - b.unlockLevel),
    []
  );
  const allUnlocks = useMemo<Unlock[]>(
    () =>
      [
        ...VOLT_PERKS.map((p) => ({ level: p.unlockLevel, label: p.name, blurb: p.blurb, kind: 'perk' as const })),
        ...VOLT_WILDCARDS.map((w) => ({ level: w.unlockLevel, label: w.name, blurb: w.blurb, kind: 'wildcard' as const })),
      ].sort((a, b) => a.level - b.level),
    []
  );

  // Honest, computed pace estimate (uses the live Apex threshold, not a guess).
  const weeksToApex = Math.max(1, Math.round(apexRank.threshold / XP_PER_WEEK));
  const yearsToApex = (weeksToApex / 52).toFixed(1);

  return (
    <div className="space-y-4">
      {/* Intro card: the two-currency mental model, in plain language */}
      <div className="pz-card p-5 sm:p-6">
        <div className="pz-eyebrow mb-2">Coach Orientation</div>
        <h2 className="pz-display text-xl sm:text-2xl text-white tracking-tight mb-2">
          How the Ecosystem Works
        </h2>
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--pz-text)' }}>
          Two currencies power everything a kid does. Points are the spendable wallet, XP is the permanent
          career ladder. Get this one idea and the rest of the system clicks into place.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#CBFE1C]"><Ic.Coin size={20} /></span>
              <span className="font-black text-white uppercase tracking-wide text-[13px]">Points (the wallet)</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--pz-text)' }}>
              Kids earn points in games and check-ins, then spend them in the shop and on powerups. Every point
              also adds to the house score. Points reset each season, so the wallet starts fresh.
            </p>
          </div>
          <div className="pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#CBFE1C]"><Ic.Bolt size={20} /></span>
              <span className="font-black text-white uppercase tracking-wide text-[13px]">XP (the career ladder)</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--pz-text)' }}>
              XP mirrors the points a kid earns (1 to 1, before any multipliers) and never goes down. It drives
              both the Volt Level and the Rank, so spending or a seasonal reset can never demote a kid.
            </p>
          </div>
        </div>

        <div
          className="mt-4 flex items-start gap-2 p-3 text-xs leading-relaxed"
          style={{ background: 'rgba(203,254,28,0.08)', border: '1px solid rgba(203,254,28,0.25)', clipPath: NOTCH_SM, color: 'var(--pz-text)' }}
        >
          <span className="flex-shrink-0 mt-0.5 text-[#CBFE1C]"><Ic.Info size={16} /></span>
          <span>
            <span className="font-black text-white">The takeaway:</span> because rank and Volt Level ride lifetime
            XP, a kid's standing only ever climbs. Spending points and season resets touch the wallet, never the ladder.
          </span>
        </div>
      </div>

      {/* Section 1: Points vs XP, side by side */}
      <Section
        id="points"
        eyebrow="The two currencies"
        title="Points vs XP"
        icon={<Ic.Coin size={22} />}
        open={!!open.points}
        onToggle={() => toggle('points')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#CBFE1C]"><Ic.Coin size={18} /></span>
              <span className="font-black text-white uppercase tracking-wide text-xs">Points</span>
            </div>
            <dl className="space-y-2 text-xs" style={{ color: 'var(--pz-text)' }}>
              <div><dt className="font-black text-white/80 uppercase text-[10px] tracking-widest">Earned by</dt><dd>Games, check-ins, tasks, partner visits</dd></div>
              <div><dt className="font-black text-white/80 uppercase text-[10px] tracking-widest">Spent on</dt><dd>Shop items and powerups</dd></div>
              <div><dt className="font-black text-white/80 uppercase text-[10px] tracking-widest">Also feeds</dt><dd>The house / team score</dd></div>
              <div><dt className="font-black text-white/80 uppercase text-[10px] tracking-widest">Resets</dt><dd>Every season</dd></div>
            </dl>
          </div>
          <div className="pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#CBFE1C]"><Ic.Bolt size={18} /></span>
              <span className="font-black text-white uppercase tracking-wide text-xs">XP (totalXp)</span>
            </div>
            <dl className="space-y-2 text-xs" style={{ color: 'var(--pz-text)' }}>
              <div><dt className="font-black text-white/80 uppercase text-[10px] tracking-widest">Earned by</dt><dd>Mirrors positive point earnings (1 to 1, before multipliers)</dd></div>
              <div><dt className="font-black text-white/80 uppercase text-[10px] tracking-widest">Spent on</dt><dd>Nothing, XP is never spent</dd></div>
              <div><dt className="font-black text-white/80 uppercase text-[10px] tracking-widest">Drives</dt><dd>The Volt Level and the Rank</dd></div>
              <div><dt className="font-black text-white/80 uppercase text-[10px] tracking-widest">Resets</dt><dd>Never (it only goes up)</dd></div>
            </dl>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--pz-text)' }}>
          In short: a kid can blow their whole wallet in the shop and their Rank and Volt Level do not budge.
          Multipliers (boosts, perks, event days) grow the points they pocket, but XP always tracks the base
          earning, so the ladder stays fair.
        </p>
      </Section>

      {/* Section 2: Ranks */}
      <Section
        id="ranks"
        eyebrow="Lifetime XP, 10 tiers"
        title="Ranks (Road to Apex)"
        icon={<Ic.Medal size={22} />}
        open={!!open.ranks}
        onToggle={() => toggle('ranks')}
      >
        <p className="mt-3 mb-3 text-xs leading-relaxed" style={{ color: 'var(--pz-text)' }}>
          {ranks.length} ranks, driven entirely by lifetime XP and monotonic (they only climb). Tap any rank to
          see what it takes. The early ranks arrive in the opening weeks, and about {yearsToApex} years of steady
          work (4 sessions a week, roughly 45 XP each) reaches {apexRank.name}.
        </p>
        <div className="overflow-x-auto custom-scrollbar pb-2 -mx-1 px-1">
          <div className="flex items-stretch gap-2 min-w-max">
            {ranks.map((rank) => (
              <button
                key={rank.id}
                onClick={() => setSelected({ kind: 'rank', rank })}
                className="touch-btn flex flex-col items-center gap-1.5 px-2 py-3 w-[86px] shrink-0 border active:scale-95 transition-transform"
                style={{ clipPath: NOTCH_SM, borderColor: 'var(--pz-border)', background: 'var(--pz-panel-2)' }}
              >
                {rank.icon ? (
                  <img src={rank.icon} alt={rank.name} className="w-11 h-11 object-contain" />
                ) : (
                  <span style={{ color: rank.color }}><Ic.Medal size={40} /></span>
                )}
                <div className="text-[10px] font-black uppercase tracking-wide text-center leading-tight text-white truncate max-w-full">
                  {rank.name}
                </div>
                <span className="text-[9px] font-black uppercase" style={{ color: 'var(--pz-volt)' }}>
                  {rank.threshold.toLocaleString()} XP
                </span>
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Section 3: Volt Levels & Perks */}
      <Section
        id="volt"
        eyebrow="Lifetime XP, 40 levels"
        title="Volt Levels & Perks"
        icon={<Ic.Bolt size={22} />}
        open={!!open.volt}
        onToggle={() => toggle('volt')}
      >
        <p className="mt-3 mb-3 text-xs leading-relaxed" style={{ color: 'var(--pz-text)' }}>
          The same lifetime XP also powers {VOLT_MAX_LEVEL} Volt Levels. Levels come fast early and turn into a
          season-long grind up top (Level {VOLT_MAX_LEVEL} sits at {voltXpForLevel(VOLT_MAX_LEVEL).toLocaleString()} XP).
          Each level a kid reaches can open a free perk. Tap a medallion for detail.
        </p>

        {/* Milestone level medallions */}
        <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--pz-volt)' }}>
          Level milestones
        </div>
        <div className="overflow-x-auto custom-scrollbar pb-2 -mx-1 px-1">
          <div className="flex items-end gap-3 min-w-max">
            {VOLT_MILESTONE_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => setSelected({ kind: 'level', level })}
                className="touch-btn flex flex-col items-center gap-1 shrink-0 active:scale-95 transition-transform"
                aria-label={`Volt Level ${level}`}
              >
                <VoltLevelHex level={level} size={58} />
                <span className="text-[9px] font-black uppercase" style={{ color: 'var(--pz-text)' }}>
                  {voltXpForLevel(level).toLocaleString()} XP
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Perk unlock track */}
        <div className="text-[10px] font-black uppercase tracking-widest mt-5 mb-2" style={{ color: 'var(--pz-volt)' }}>
          Perks unlock as you climb
        </div>
        <div className="flex flex-wrap gap-3">
          {perksByLevel.map((perk) => (
            <button
              key={perk.key}
              onClick={() => setSelected({ kind: 'perk', perk })}
              className="touch-btn flex flex-col items-center gap-1 w-[84px] active:scale-95 transition-transform"
              aria-label={`${perk.name} perk`}
            >
              <span
                className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 text-[#0B0E13]"
                style={{ background: 'var(--pz-volt)', clipPath: NOTCH_XS }}
              >
                Lvl {perk.unlockLevel}
              </span>
              <VoltMedallion perk={perk} state="unlocked" size={66} showLabel />
              <span className="text-[9px] leading-snug text-center" style={{ color: 'var(--pz-text)' }}>
                {perk.blurb}
              </span>
            </button>
          ))}
        </div>

        {/* Wildcards */}
        <div className="text-[10px] font-black uppercase tracking-widest mt-5 mb-2" style={{ color: '#D9A441' }}>
          Wildcards (one big rule on top)
        </div>
        <div className="flex flex-wrap gap-3">
          {wildcardsByLevel.map((wildcard) => (
            <button
              key={wildcard.key}
              onClick={() => setSelected({ kind: 'wildcard', wildcard })}
              className="touch-btn flex flex-col items-center gap-1 w-[84px] active:scale-95 transition-transform"
              aria-label={`${wildcard.name} wildcard`}
            >
              <span
                className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 text-[#0B0E13]"
                style={{ background: '#D9A441', clipPath: NOTCH_XS }}
              >
                Lvl {wildcard.unlockLevel}
              </span>
              <VoltMedallion wildcard={wildcard} state="unlocked" size={66} showLabel />
              <span className="text-[9px] leading-snug text-center" style={{ color: 'var(--pz-text)' }}>
                {wildcard.blurb}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <InfoModal selected={selected} onClose={() => setSelected(null)} allUnlocks={allUnlocks} />
    </div>
  );
};

export default EcosystemGuide;
