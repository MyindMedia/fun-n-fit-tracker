import React, { useEffect, useState } from 'react';
import { Student } from '../types';
import { gameCenter } from '../services/gameCenter';
import { Ic } from './icons';

// Pubzi theme: small notched cut-corner shape for inline elements
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

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

  const badges = student.badges ?? [];
  const rewards = student.inventory ?? [];
  const nothingYet = !loading && medals.length === 0 && (!full || (badges.length === 0 && rewards.length === 0));

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

      {full && badges.length > 0 && (
        <div className="pz-card p-4 sm:p-5">
          <div className="pz-eyebrow mb-3">Badges Earned</div>
          <div className="flex flex-wrap gap-2">
            {badges.map(b => (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
                style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)', color: '#fcd34d', clipPath: NOTCH_SM }}
              >
                <Ic.Medal size={14} /> {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {full && rewards.length > 0 && (
        <div className="pz-card p-4 sm:p-5">
          <div className="pz-eyebrow mb-3">Rewards Collected</div>
          <div className="flex flex-wrap gap-2">
            {rewards.map(r => (
              <span
                key={r}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
                style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', clipPath: NOTCH_SM }}
              >
                <Ic.Gift size={14} /> {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {nothingYet && full && (
        <div className="pz-card p-6 text-center">
          <div className="mb-2 flex justify-center" style={{ color: 'var(--pz-volt)' }}><Ic.Sparkle size={28} /></div>
          <p className="text-sm font-medium m-0" style={{ color: 'var(--pz-text)' }}>The trophy case is waiting — keep training!</p>
        </div>
      )}
    </div>
  );
};

export default TrophyCase;
