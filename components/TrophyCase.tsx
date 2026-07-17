import React, { useEffect, useState } from 'react';
import { Student } from '../types';
import { gameCenter } from '../services/gameCenter';
import { voltClient } from '../services/voltClient';
import { milestoneProgress, VoltMilestoneDef } from '../voltCatalog';
import { BADGES, REWARDS } from '../constants';
import { Ic, IconProps } from './icons';

// Pubzi theme: small notched cut-corner shape for inline elements
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

const MilestoneIcon: React.FC<{ name: string; size?: number }> = ({ name, size = 14 }) => {
  const Cmp = (Ic as Record<string, React.FC<IconProps>>)[name] ?? Ic.Medal;
  return <Cmp size={size} />;
};

type MilestoneRow = VoltMilestoneDef & { earned: boolean; current: number };

// Milestone badges computed from the kid's REAL activity (check-ins, medals,
// crates, trades, town visits, band taps, lifetime points, Volt Level) plus
// any legacy badge keys stored on the student. Shared by the trophy case, the
// Stats tab, and player cards so every screen tells the same story.
export const EarnedBadges: React.FC<{ student: Student; compact?: boolean; showUpNext?: boolean }> = ({
  student,
  compact = false,
  showUpNext = true,
}) => {
  const [rows, setRows] = useState<MilestoneRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    voltClient
      .profile(student.id)
      .then(p => { if (alive) setRows(milestoneProgress(p.stats, p.level)); })
      .catch(err => { console.warn('Failed to load milestones:', err); if (alive) setRows([]); });
    return () => { alive = false; };
  }, [student.id]);

  const legacy = (student.badges ?? [])
    .map(id => BADGES.find(b => b.id === id))
    .filter((b): b is (typeof BADGES)[number] => !!b);

  if (rows === null) {
    return <div className="text-xs italic py-2" style={{ color: 'var(--pz-text)' }}>Loading badges…</div>;
  }

  const earned = rows.filter(r => r.earned);
  const upNext = showUpNext ? rows.filter(r => !r.earned).slice(0, compact ? 2 : 4) : [];

  return (
    <div className="space-y-3">
      {(earned.length > 0 || legacy.length > 0) ? (
        <div className="flex flex-wrap gap-2">
          {earned.map(m => (
            <span
              key={m.key}
              title={m.blurb}
              className={`inline-flex items-center gap-1.5 ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} font-bold`}
              style={{ background: `${m.color}14`, border: `1px solid ${m.color}55`, color: m.color, clipPath: NOTCH_SM }}
            >
              <MilestoneIcon name={m.icon} size={compact ? 12 : 14} /> {m.name}
            </span>
          ))}
          {legacy.map(b => (
            <span
              key={b.id}
              title={b.description}
              className={`inline-flex items-center gap-1.5 ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} font-bold`}
              style={{ background: `${b.color}14`, border: `1px solid ${b.color}55`, color: b.color, clipPath: NOTCH_SM }}
            >
              <Ic.Medal size={compact ? 12 : 14} /> {b.name}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-xs font-medium" style={{ color: 'var(--pz-text)' }}>
          No badges yet — they unlock automatically as you play.
        </div>
      )}

      {upNext.length > 0 && (
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--pz-text)' }}>
            Up next
          </div>
          <div className="flex flex-wrap gap-2">
            {upNext.map(m => (
              <span
                key={m.key}
                title={m.blurb}
                className={`inline-flex items-center gap-1.5 ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} font-bold`}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.2)', color: 'var(--pz-text)', clipPath: NOTCH_SM, opacity: 0.85 }}
              >
                <Ic.Lock size={compact ? 11 : 13} /> {m.name}
                <span style={{ opacity: 0.75 }}>{Math.min(m.current, m.threshold)}/{m.threshold}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export interface MedalRow {
  _id: string;
  key: string;
  title: string;
  note?: string | null;
  awardedBy: string;
  date: string;
  createdAt: number;
}

export const MEDAL_COLORS: Record<string, string> = {
  legend: '#CBFE1C',
  mvp: '#fbbf24',
  hustle: '#fb923c',
  teamwork: '#38bdf8',
  sportsmanship: '#34d399',
};

export const medalColor = (key: string): string => MEDAL_COLORS[key] ?? '#e2e8f0';

interface TrophyCaseProps {
  student: Student;
  /** show badge + reward sections too (full superlatives view) */
  full?: boolean;
}

// One place for everything a kid has earned: coach medals (superlatives),
// badges, and collected rewards.
const TrophyCase: React.FC<TrophyCaseProps> = ({ student, full = true }) => {
  const [medals, setMedals] = useState<MedalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    gameCenter
      .medalsForStudent(student.id)
      .then(rows => { if (alive) setMedals(rows as MedalRow[]); })
      .catch(err => console.warn('Failed to load medals:', err))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [student.id]);

  const rewards = (student.inventory ?? [])
    .map(id => REWARDS.find(r => r.id === id))
    .filter((r): r is (typeof REWARDS)[number] => !!r);

  return (
    <div className="space-y-4">
      {/* Coach medals — the superlatives record */}
      <div className="pz-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="pz-eyebrow mb-1">Superlatives</div>
            <h3 className="text-sm text-white uppercase tracking-wide">Coach Medals</h3>
          </div>
          <span className="pz-display text-xl" style={{ color: 'var(--pz-volt)' }}>{medals.length}</span>
        </div>

        {loading ? (
          <div className="text-center py-6 text-xs italic" style={{ color: 'var(--pz-text)' }}>Loading medals…</div>
        ) : medals.length === 0 ? (
          <div className="text-center py-6">
            <div className="mb-2 flex justify-center" style={{ color: 'var(--pz-text)' }}><Ic.Medal size={32} /></div>
            <div className="text-xs font-medium" style={{ color: 'var(--pz-text)' }}>
              No medals yet — coaches pick their Legends at the end of each session!
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {medals.map(m => {
              const color = medalColor(m.key);
              return (
                <div key={m._id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10" style={{ clipPath: NOTCH_SM }}>
                  <div
                    className="w-10 h-10 flex items-center justify-center shrink-0"
                    style={{ background: `${color}1f`, color, clipPath: NOTCH_SM, border: `1px solid ${color}55` }}
                  >
                    <Ic.Medal size={20} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="font-black text-sm" style={{ color }}>{m.title}</div>
                    <div className="text-[10px] font-bold" style={{ color: 'var(--pz-text)' }}>
                      {new Date(m.createdAt).toLocaleDateString()} · by {m.awardedBy}
                    </div>
                    {m.note && <div className="text-[11px] mt-0.5" style={{ color: 'var(--pz-text)' }}>{m.note}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {full && (
        <div className="pz-card p-4 sm:p-5">
          <div className="pz-eyebrow mb-3">Badges</div>
          <EarnedBadges student={student} />
        </div>
      )}

      {full && rewards.length > 0 && (
        <div className="pz-card p-4 sm:p-5">
          <div className="pz-eyebrow mb-3">Rewards Collected</div>
          <div className="flex flex-wrap gap-2">
            {rewards.map(r => (
              <span
                key={r.id}
                title={r.description}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
                style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', clipPath: NOTCH_SM }}
              >
                <Ic.Gift size={14} /> {r.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrophyCase;
