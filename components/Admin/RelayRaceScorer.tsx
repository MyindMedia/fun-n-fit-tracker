import React, { useMemo, useState } from 'react';
import { GameSession, Student, GameDefinition, RelayConfig } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { HOUSES } from '../../constants';
import { AudioService } from '../../utils/audio';
import { AdminNotifications } from '../../utils/notifications';
import { getStudentDisplayName } from '../../utils/studentDisplay';
import { Ic } from '../icons';
import { Stopwatch, StopwatchBar, fmtStopwatch } from './stopwatch';

interface RelayRaceScorerProps {
  session: GameSession;
  students: Student[];
  adminName: string;
  game?: GameDefinition;
  sw: Stopwatch;
}

// Points by finishing position; everyone else who logs a time gets FINISH_POINTS.
const RANK_POINTS = [50, 30, 20];
const FINISH_POINTS = 10;

const ordinal = (n: number): string => {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
};

interface Competitor {
  key: string;
  name: string;
  subtitle?: string;
  memberIds: string[];
  houseColor?: string;
  avatarUrl?: string;
}

const DEFAULT_CONFIG: RelayConfig = {
  mode: 'INDIVIDUAL',
  scoring: 'TIME_TRIAL',
  headToHead: false,
  attempts: 1,
};

const RelayRaceScorer: React.FC<RelayRaceScorerProps> = ({ session, students, adminName, game, sw }) => {
  const config = session.relay ?? DEFAULT_CONFIG;
  const isTeam = config.mode === 'TEAM';
  const isPlacements = config.scoring === 'PLACEMENTS';
  const attemptsCap = isTeam ? Infinity : Math.max(1, config.attempts || 1);

  // Recorded attempt times (ms) per competitor, best = min.
  const [times, setTimes] = useState<Record<string, number[]>>({});
  // Coach-assigned placements (1-based) per competitor, for PLACEMENTS scoring.
  const [placements, setPlacements] = useState<Record<string, number>>({});
  // Head-to-head lanes (competitor keys).
  const [lanes, setLanes] = useState<{ a?: string; b?: string }>({});
  const [awarding, setAwarding] = useState(false);

  const roster = useMemo(
    () => students.filter(s => session.roster.includes(s.id)),
    [students, session.roster]
  );

  const competitors: Competitor[] = useMemo(() => {
    if (isTeam) {
      return (config.teams ?? []).map((t, i) => ({
        key: `team:${i}`,
        name: t.name || `Team ${i + 1}`,
        subtitle: `${t.memberIds.length} member${t.memberIds.length === 1 ? '' : 's'}`,
        memberIds: t.memberIds,
      }));
    }
    return roster.map(s => {
      const d = getStudentDisplayName(s);
      return {
        key: s.id,
        name: d.primary,
        subtitle: d.secondary,
        memberIds: [s.id],
        houseColor: HOUSES[s.houseId]?.colorHex,
        avatarUrl: s.avatarUrl,
      };
    });
  }, [isTeam, config.teams, roster]);

  const bestOf = (key: string): number | null => {
    const arr = times[key];
    return arr && arr.length ? Math.min(...arr) : null;
  };

  // Time-trial ranking: competitors that logged a time, fastest first.
  const ranked = useMemo(() => {
    return competitors
      .map(c => ({ c, best: bestOf(c.key) }))
      .filter(x => x.best != null)
      .sort((a, b) => (a.best as number) - (b.best as number));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitors, times]);

  const rankByKey = useMemo(() => {
    const m = new Map<string, number>();
    ranked.forEach((x, i) => m.set(x.c.key, i + 1));
    return m;
  }, [ranked]);

  const logTime = (c: Competitor) => {
    const attempts = times[c.key] ?? [];
    if (attempts.length >= attemptsCap) {
      AdminNotifications.error(`No attempts left for ${c.name} (${attemptsCap} max).`);
      return;
    }
    const ms = sw.lap();
    if (ms <= 0) {
      AdminNotifications.error('Start the stopwatch before logging a time.');
      return;
    }
    setTimes(prev => ({ ...prev, [c.key]: [...(prev[c.key] ?? []), ms] }));
    AudioService.playWarningBeep();
    // Individual competitors persist through the shared lap path (activity feed
    // + speed badge). Team times are not an individual's split, so we skip it.
    if (!isTeam) {
      supabaseService.recordLapTime(session.id, c.key, ms, game?.displayName || session.title, adminName);
    }
  };

  const setPlacement = (key: string, place: number) => {
    setPlacements(prev => {
      const next = { ...prev };
      if (next[key] === place) {
        delete next[key];
        return next;
      }
      // Keep placements unique; a spot belongs to one competitor.
      for (const k of Object.keys(next)) {
        if (next[k] === place) delete next[k];
      }
      next[key] = place;
      return next;
    });
  };

  const setLane = (lane: 'a' | 'b', key: string) => {
    setLanes(prev => {
      const next = { ...prev };
      // Same competitor can't hold both lanes.
      if (lane === 'a') {
        next.a = next.a === key ? undefined : key;
        if (next.b === key) next.b = undefined;
      } else {
        next.b = next.b === key ? undefined : key;
        if (next.a === key) next.a = undefined;
      }
      return next;
    });
  };

  const awardCompetitor = async (c: Competitor, points: number, label: string) => {
    for (const id of c.memberIds) {
      await supabaseService.recordScoreEvent(session.id, id, undefined, points, adminName, label);
    }
  };

  const awardByTime = async () => {
    if (awarding) return;
    if (ranked.length === 0) {
      AdminNotifications.error('No times recorded yet.');
      return;
    }
    setAwarding(true);
    try {
      for (let i = 0; i < ranked.length; i++) {
        const points = RANK_POINTS[i] ?? FINISH_POINTS;
        await awardCompetitor(ranked[i].c, points, `${game?.displayName || 'Relay'} · ${ordinal(i + 1)}`);
      }
      AudioService.playWinnerFanfare();
      AdminNotifications.pointsAwarded(RANK_POINTS[0], `${ranked[0].c.name} · Fastest`);
    } finally {
      setAwarding(false);
    }
  };

  const awardPlacements = async () => {
    if (awarding) return;
    const assigned = competitors.filter(c => placements[c.key]);
    if (assigned.length === 0) {
      AdminNotifications.error('Assign at least one placement first.');
      return;
    }
    setAwarding(true);
    try {
      for (const c of assigned) {
        const place = placements[c.key];
        const points = RANK_POINTS[place - 1] ?? FINISH_POINTS;
        await awardCompetitor(c, points, `${game?.displayName || 'Relay'} · ${ordinal(place)}`);
      }
      AudioService.playWinnerFanfare();
      const first = assigned.find(c => placements[c.key] === 1);
      AdminNotifications.pointsAwarded(RANK_POINTS[0], `${(first ?? assigned[0]).name} · Placed`);
    } finally {
      setAwarding(false);
    }
  };

  const clearTimes = () => {
    setTimes({});
    setPlacements({});
    setLanes({});
    sw.reset();
  };

  const laneName = (key?: string) => competitors.find(c => c.key === key)?.name;
  const laneBest = (key?: string) => (key ? bestOf(key) : null);
  const aBest = laneBest(lanes.a);
  const bBest = laneBest(lanes.b);
  const aLeads = aBest != null && (bBest == null || aBest < bBest);
  const bLeads = bBest != null && (aBest == null || bBest < aBest);

  return (
    <div className="space-y-3">
      {/* Config summary */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-[#CBFE1C] bg-[#CBFE1C]/10 border border-[#CBFE1C]/40 px-1.5 py-0.5">
          <Ic.Users size={9} /> {isTeam ? 'Team' : 'Individual'}
        </span>
        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-white/70 bg-white/5 border border-white/10 px-1.5 py-0.5">
          <Ic.Trophy size={9} /> {isPlacements ? 'Placements' : 'Time Trial'}
        </span>
        {config.headToHead && (
          <span className="text-[8px] font-black uppercase tracking-widest text-white/70 bg-white/5 border border-white/10 px-1.5 py-0.5">
            Head-to-Head
          </span>
        )}
        {!isTeam && (
          <span className="text-[8px] font-black uppercase tracking-widest text-white/70 bg-white/5 border border-white/10 px-1.5 py-0.5">
            {attemptsCap === Infinity ? '∞' : attemptsCap} attempt{attemptsCap === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Millisecond stopwatch: Start / Stop / Reset */}
      <StopwatchBar sw={sw} label="Race Clock" />

      {/* Head-to-head comparison */}
      {config.headToHead && (
        <div className="rounded-xl p-2.5 border border-white/10" style={{ background: 'var(--pz-panel-2)' }}>
          <div className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1.5 text-center">Current Heat</div>
          <div className="flex items-stretch gap-2">
            <div className={`flex-1 rounded-lg p-2 text-center border ${aLeads ? 'border-[#CBFE1C] bg-[#CBFE1C]/10' : 'border-white/10 bg-white/5'}`}>
              <div className="text-[8px] font-black uppercase tracking-widest text-white/40">Lane A</div>
              <div className="text-[11px] font-bold text-white truncate">{laneName(lanes.a) || 'TBD'}</div>
              <div className={`text-sm font-mono font-black tabular-nums ${aLeads ? 'text-[#CBFE1C]' : 'text-white/70'}`}>{aBest != null ? fmtStopwatch(aBest) : '--.---'}</div>
            </div>
            <div className="flex items-center text-[10px] font-black text-white/40">VS</div>
            <div className={`flex-1 rounded-lg p-2 text-center border ${bLeads ? 'border-[#CBFE1C] bg-[#CBFE1C]/10' : 'border-white/10 bg-white/5'}`}>
              <div className="text-[8px] font-black uppercase tracking-widest text-white/40">Lane B</div>
              <div className="text-[11px] font-bold text-white truncate">{laneName(lanes.b) || 'TBD'}</div>
              <div className={`text-sm font-mono font-black tabular-nums ${bLeads ? 'text-[#CBFE1C]' : 'text-white/70'}`}>{bBest != null ? fmtStopwatch(bBest) : '--.---'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Competitors */}
      {competitors.length === 0 ? (
        <div className="border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-white/40 text-xs font-bold">
          {isTeam ? 'No teams were set up for this relay.' : 'No athletes on the roster.'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {competitors.map(c => {
            const attempts = times[c.key] ?? [];
            const best = bestOf(c.key);
            const rank = rankByKey.get(c.key);
            const place = placements[c.key];
            const atCap = attempts.length >= attemptsCap;
            return (
              <div key={c.key} className="rounded-lg bg-white/5 border border-white/10 p-2">
                <div className="flex items-center gap-2">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-[#CBFE1C]">
                      <Ic.Users size={13} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {rank != null && !isPlacements && (
                        <span className="text-[9px] font-black text-[#0B0E13] bg-[#CBFE1C] rounded px-1 leading-4">{ordinal(rank)}</span>
                      )}
                      <span className="font-bold text-[11px] text-white truncate" style={c.houseColor ? { color: c.houseColor } : undefined}>{c.name}</span>
                    </div>
                    <div className="text-[8px] font-semibold text-white/40 truncate leading-tight">
                      {best != null ? `Best ${fmtStopwatch(best)}` : c.subtitle || 'No time yet'}
                    </div>
                  </div>
                  <button
                    onClick={() => logTime(c)}
                    disabled={atCap}
                    className="px-2.5 h-8 bg-[#CBFE1C] text-[#0B0E13] rounded font-black text-[9px] uppercase tracking-wide active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 flex-shrink-0"
                  >
                    <Ic.Timer size={11} /> Log
                  </button>
                </div>

                {/* Attempt splits */}
                {attempts.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {attempts.map((ms, i) => {
                      const isBest = ms === best;
                      return (
                        <span
                          key={i}
                          className={`text-[9px] font-mono font-bold rounded px-1.5 py-0.5 border ${isBest ? 'text-[#CBFE1C] bg-[#CBFE1C]/10 border-[#CBFE1C]/40' : 'text-white/60 bg-white/5 border-white/10'}`}
                        >
                          {fmtStopwatch(ms)}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Placement assignment (PLACEMENTS scoring) */}
                {isPlacements && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/40 mr-0.5">Place</span>
                    {[1, 2, 3].map(p => (
                      <button
                        key={p}
                        onClick={() => setPlacement(c.key, p)}
                        className={`flex-1 h-7 rounded font-black text-[9px] active:scale-95 border ${place === p ? 'bg-[#CBFE1C] text-[#0B0E13] border-[#CBFE1C]' : 'bg-white/5 text-white/70 border-white/10'}`}
                      >
                        {ordinal(p)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Head-to-head lane assignment */}
                {config.headToHead && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/40 mr-0.5">Lane</span>
                    <button
                      onClick={() => setLane('a', c.key)}
                      className={`flex-1 h-6 rounded font-black text-[9px] active:scale-95 border ${lanes.a === c.key ? 'bg-[#CBFE1C] text-[#0B0E13] border-[#CBFE1C]' : 'bg-white/5 text-white/70 border-white/10'}`}
                    >
                      A
                    </button>
                    <button
                      onClick={() => setLane('b', c.key)}
                      className={`flex-1 h-6 rounded font-black text-[9px] active:scale-95 border ${lanes.b === c.key ? 'bg-[#CBFE1C] text-[#0B0E13] border-[#CBFE1C]' : 'bg-white/5 text-white/70 border-white/10'}`}
                    >
                      B
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Award actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={clearTimes}
          className="pz-btn-ghost px-3 py-2.5 text-[10px] active:scale-95"
        >
          Clear
        </button>
        {isPlacements ? (
          <button
            onClick={awardPlacements}
            disabled={awarding}
            className="pz-btn flex-1 py-2.5 text-[10px] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Ic.Trophy size={14} /> Award Placements
          </button>
        ) : (
          <button
            onClick={awardByTime}
            disabled={awarding}
            className="pz-btn flex-1 py-2.5 text-[10px] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Ic.Trophy size={14} /> Award By Time
          </button>
        )}
      </div>
      <p className="text-[8px] text-white/30 text-center leading-tight">
        {isPlacements
          ? 'Awards 1st 50, 2nd 30, 3rd 20 points to the placed competitors.'
          : 'Ranks by best time and awards 50 / 30 / 20 to the podium, 10 to every other finisher.'}
      </p>
    </div>
  );
};

export default RelayRaceScorer;
