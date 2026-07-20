import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Student, Badge, Rank } from '../types';
import { gameCenter } from '../services/gameCenter';
import { supabaseService } from '../services/supabaseService';
import { Ic, DataIcon } from './icons';
import LevelPath from './LevelPath';
import VoltStatsCard from './volt/VoltStatsCard';
import VoltLoadout from './volt/VoltLoadout';

interface Props {
  student: Student;
}

type Medal = { _id?: string; id?: string; title: string; key: string; createdAt: number; note?: string | null };
type GameStat = { gameSessionId: string; gameTitle: string; endTime: number; points: number; awards: string[] };
type Challenge = { id: string; title: string; type: string | null; progress: number; requirement: number | null; isCompleted: boolean };
type XpTxn = { id: string; amount: number; sourceType: string; description: string; createdAt: number };

const fmtDate = (ts: number): string =>
  ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
const fmtTime = (ts: number): string =>
  ts ? new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
// Friendly fallback label when an XP row has no description (source is the raw
// point-source enum from applyPoints).
const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Coach award',
  CHECKIN: 'Check-in',
  GAME: 'Game',
  FIT: 'Around town',
  AROUND_TOWN: 'Around town',
  TASK: 'Special task',
  JACKPOT: 'Jackpot',
  BONUS: 'Bonus',
};
const sourceLabel = (s: string): string => SOURCE_LABEL[s] ?? (s ? s.charAt(0) + s.slice(1).toLowerCase() : 'XP');

/** Full stats report for one athlete: ranking, awards, games, challenges, achievements. */
const AthleteStatsReport: React.FC<Props> = ({ student }) => {
  const [medals, setMedals] = useState<Medal[]>([]);
  const [games, setGames] = useState<GameStat[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [xpTxns, setXpTxns] = useState<XpTxn[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showLoadout, setShowLoadout] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, g, c, b, r, xp] = await Promise.all([
          gameCenter.medalsForStudent(student.id),
          gameCenter.gameStatsForStudent(student.id, 20),
          gameCenter.challengesForStudent(student.id),
          supabaseService.getBadges(),
          supabaseService.getRanks(),
          gameCenter.xpHistoryForStudent(student.id),
        ]);
        if (cancelled) return;
        setMedals(m as Medal[]);
        setGames(g as GameStat[]);
        setChallenges(c as Challenge[]);
        setBadges(b);
        setRanks(r);
        setXpTxns(xp as XpTxn[]);
      } catch (e) {
        console.error('Stats report load failed:', e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [student.id]);

  // Group the XP ledger by local day (xpTxns is already newest-first, so a Map
  // preserves newest-day-first order and newest-txn-first within each day).
  const xpByDay = useMemo(() => {
    const map = new Map<string, { label: string; total: number; txns: XpTxn[] }>();
    for (const t of xpTxns) {
      const d = new Date(t.createdAt);
      const key = d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
      let g = map.get(key);
      if (!g) {
        g = { label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), total: 0, txns: [] };
        map.set(key, g);
      }
      g.total += t.amount;
      g.txns.push(t);
    }
    return Array.from(map.entries()).map(([day, g]) => ({ day, ...g }));
  }, [xpTxns]);

  const currentRankIndex = ranks.findIndex(r => r.id === student.rankId);
  const currentRank = ranks[currentRankIndex];
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
      {/* Full-screen loadout editor, shared with the player portal. Portaled to
          <body> so it escapes the profile modal's backdrop-blur containing block
          and overflow-hidden clip (otherwise it renders cut off inside the card). */}
      {showLoadout && createPortal(
        <div className="fixed inset-0 z-[500] animate-fade-in" style={{ background: 'var(--pz-bg)' }}>
          <VoltLoadout student={student} onClose={() => setShowLoadout(false)} />
        </div>,
        document.body
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Points" value={student.points.toLocaleString()} />
        <Stat label="Rank" value={<span className="text-base">{currentRank?.name ?? '—'}</span>} />
        <Stat label="Medals" value={medals.length} />
        <Stat label="Games" value={games.length} />
      </div>

      {/* Rank ladder: the same "Road to Apex" path shown across every stats view */}
      <div>
        <SectionHead>Ranking</SectionHead>
        <LevelPath points={student.totalXp ?? 0} rankId={student.rankId} ranks={ranks.length > 0 ? ranks : undefined} />
      </div>

      {/* Volt level bar: the same COD-style card shown in the player portal */}
      <div>
        <SectionHead>Volt Level &amp; Loadout</SectionHead>
        <VoltStatsCard student={student} onOpenLoadout={() => setShowLoadout(true)} />
      </div>

      {/* Daily XP history: how this athlete has earned XP, day by day, with each
          earning event and a per-day total. Newest day first. */}
      <div>
        <SectionHead>Daily XP · {(student.totalXp ?? 0).toLocaleString()} lifetime</SectionHead>
        {xpTxns.length === 0 ? (
          <div className="text-sm italic" style={{ color: 'var(--pz-text)' }}>No XP earned yet.</div>
        ) : (
          <div className="space-y-3">
            {xpByDay.map(day => (
              <div key={day.day} className="pz-card-sm overflow-hidden" style={{ background: 'var(--pz-panel-2)' }}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                  <span className="text-[11px] font-black uppercase tracking-widest text-white">{day.label}</span>
                  <span className="pz-display text-base" style={{ color: 'var(--pz-volt)' }}>
                    {day.total >= 0 ? '+' : ''}{day.total} XP
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {day.txns.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="text-[10px] tabular-nums w-14 shrink-0" style={{ color: 'var(--pz-text)' }}>{fmtTime(t.createdAt)}</span>
                      <span className="flex-grow min-w-0 text-xs text-white truncate">{t.description || sourceLabel(t.sourceType)}</span>
                      <span className="text-xs font-black shrink-0" style={{ color: t.amount >= 0 ? 'var(--pz-volt)' : '#ef4444' }}>
                        {t.amount >= 0 ? '+' : ''}{t.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {xpTxns.length >= 250 && (
              <div className="text-[10px] text-center italic" style={{ color: 'var(--pz-text)' }}>
                Showing the most recent 250 XP entries.
              </div>
            )}
          </div>
        )}
      </div>

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
