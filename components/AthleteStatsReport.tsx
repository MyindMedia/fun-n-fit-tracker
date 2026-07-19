import React, { useEffect, useState } from 'react';
import { Student, Badge, Rank } from '../types';
import { gameCenter } from '../services/gameCenter';
import { supabaseService } from '../services/supabaseService';
import { Ic, DataIcon } from './icons';

interface Props {
  student: Student;
}

type Medal = { _id?: string; id?: string; title: string; key: string; createdAt: number; note?: string | null };
type GameStat = { gameSessionId: string; gameTitle: string; endTime: number; points: number; awards: string[] };
type Challenge = { id: string; title: string; type: string | null; progress: number; requirement: number | null; isCompleted: boolean };

const fmtDate = (ts: number): string =>
  ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

/** Full stats report for one athlete: ranking, awards, games, challenges, achievements. */
const AthleteStatsReport: React.FC<Props> = ({ student }) => {
  const [medals, setMedals] = useState<Medal[]>([]);
  const [games, setGames] = useState<GameStat[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, g, c, b, r] = await Promise.all([
          gameCenter.medalsForStudent(student.id),
          gameCenter.gameStatsForStudent(student.id, 20),
          gameCenter.challengesForStudent(student.id),
          supabaseService.getBadges(),
          supabaseService.getRanks(),
        ]);
        if (cancelled) return;
        setMedals(m as Medal[]);
        setGames(g as GameStat[]);
        setChallenges(c as Challenge[]);
        setBadges(b);
        setRanks(r);
      } catch (e) {
        console.error('Stats report load failed:', e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [student.id]);

  const currentRankIndex = ranks.findIndex(r => r.id === student.rankId);
  const currentRank = ranks[currentRankIndex];
  const nextRank = ranks[currentRankIndex + 1] || null;
  const earnedBadges = badges.filter(b => student.badges?.includes(b.id));
  const challengesWon = challenges.filter(c => c.isCompleted).length;

  const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="pz-card-sm p-4 text-center" style={{ background: 'var(--pz-panel-2)' }}>
      <div className="pz-display text-2xl" style={{ color: 'var(--pz-volt)' }}>{value}</div>
      <div className="text-[9px] font-black uppercase tracking-widest mt-0.5" style={{ color: 'var(--pz-text)' }}>{label}</div>
    </div>
  );
  const SectionHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h4 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--pz-text)' }}>{children}</h4>
  );

  return (
    <div className="space-y-8 pz-scope">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Points" value={student.points.toLocaleString()} />
        <Stat label="Rank" value={<span className="text-base">{currentRank?.name ?? '—'}</span>} />
        <Stat label="Medals" value={medals.length} />
        <Stat label="Games" value={games.length} />
      </div>

      {nextRank && currentRank && (
        <div>
          <SectionHead>Ranking</SectionHead>
          <div className="pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--pz-text)' }}>
              <span>{currentRank.name}</span><span>{nextRank.name}</span>
            </div>
            <div className="h-3 bg-white/10 overflow-hidden rounded-full">
              <div className="h-full" style={{ width: `${Math.min(100, Math.max(0, ((student.points - currentRank.threshold) / Math.max(1, nextRank.threshold - currentRank.threshold)) * 100))}%`, background: 'var(--pz-volt)' }} />
            </div>
            <div className="text-center text-[11px] mt-2" style={{ color: 'var(--pz-text)' }}>
              {Math.max(0, nextRank.threshold - student.points)} pts to {nextRank.name}
            </div>
          </div>
        </div>
      )}

      <div>
        <SectionHead>Awards · {medals.length}</SectionHead>
        {medals.length === 0 ? (
          <div className="text-sm italic" style={{ color: 'var(--pz-text)' }}>No awards yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {medals.map((m, i) => (
              <div key={m._id ?? m.id ?? i} className="pz-card-sm p-3 flex items-center gap-3" style={{ background: 'var(--pz-panel-2)' }}>
                <span style={{ color: 'var(--pz-volt)' }}><Ic.Medal size={18} /></span>
                <span className="flex-grow font-bold text-sm text-white truncate">{m.title}</span>
                <span className="text-[11px]" style={{ color: 'var(--pz-text)' }}>{fmtDate(m.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHead>Games Played · {games.length}</SectionHead>
        {games.length === 0 ? (
          <div className="text-sm italic" style={{ color: 'var(--pz-text)' }}>No games tracked yet.</div>
        ) : (
          <div className="space-y-2">
            {games.map(g => (
              <div key={g.gameSessionId} className="pz-card-sm p-3 flex items-center gap-3" style={{ background: 'var(--pz-panel-2)' }}>
                <div className="flex-grow min-w-0">
                  <div className="text-sm font-bold text-white truncate">{g.gameTitle}</div>
                  <div className="text-[11px] flex items-center gap-2 flex-wrap" style={{ color: 'var(--pz-text)' }}>
                    <span>{fmtDate(g.endTime)}</span>
                    {g.awards.length > 0 && (
                      <span className="inline-flex items-center gap-1" style={{ color: 'var(--pz-volt)' }}><Ic.Medal size={11} /> {g.awards.join(', ')}</span>
                    )}
                  </div>
                </div>
                <div className="pz-display text-lg shrink-0" style={{ color: 'var(--pz-volt)' }}>{g.points >= 0 ? '+' : ''}{g.points}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHead>Challenges · {challengesWon} won</SectionHead>
        {challenges.length === 0 ? (
          <div className="text-sm italic" style={{ color: 'var(--pz-text)' }}>No challenges yet.</div>
        ) : (
          <div className="space-y-2">
            {challenges.map(c => (
              <div key={c.id} className="pz-card-sm p-3 flex items-center gap-3" style={{ background: 'var(--pz-panel-2)' }}>
                <span className={c.isCompleted ? 'text-emerald-400' : 'text-white/30'}>
                  {c.isCompleted ? <Ic.CheckCircle size={18} /> : <Ic.Star size={18} />}
                </span>
                <div className="flex-grow min-w-0">
                  <div className="text-sm font-bold text-white truncate">{c.title}</div>
                  {c.type && <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--pz-text)' }}>{c.type}</div>}
                </div>
                <span className="text-[11px] font-black" style={{ color: c.isCompleted ? 'var(--pz-volt)' : 'var(--pz-text)' }}>
                  {c.isCompleted ? 'Won' : c.requirement ? `${c.progress}/${c.requirement}` : `${c.progress}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHead>Achievements · {earnedBadges.length}</SectionHead>
        {earnedBadges.length === 0 ? (
          <div className="text-sm italic" style={{ color: 'var(--pz-text)' }}>No badges earned yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {earnedBadges.map(b => (
              <div key={b.id} className="pz-card-sm p-3 flex flex-col items-center text-center gap-2" style={{ background: 'var(--pz-panel-2)' }}>
                <span className="text-amber-300"><DataIcon glyph={b.icon} size={28} /></span>
                <div className="font-black text-white text-[11px] uppercase leading-tight">{b.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loaded && <div className="text-center text-xs" style={{ color: 'var(--pz-text)' }}>Loading stats…</div>}
    </div>
  );
};

export default AthleteStatsReport;
