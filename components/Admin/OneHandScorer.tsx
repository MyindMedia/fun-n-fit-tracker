
import React, { useState, useEffect, useRef } from 'react';
import { GameSession, Student, GameDefinition } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { HOUSES } from '../../constants';
import { AudioService } from '../../utils/audio';
import { AdminNotifications } from '../../utils/notifications';
import { getStudentDisplayName } from '../../utils/studentDisplay';
import { useStopwatch, StopwatchBar, fmtStopwatch } from './stopwatch';
import RelayRaceScorer from './RelayRaceScorer';

interface OneHandScorerProps {
  session: GameSession;
  students: Student[];
  adminName: string;
  gameLibrary: GameDefinition[];
}

// Per-player quick-score buttons (presets + custom), shared by every template so
// award/deduct behavior stays identical everywhere. In deduct mode the same
// buttons SUBTRACT points (and turn red) instead of adding.
const ScoreControls: React.FC<{
  label: string;
  deduct: boolean;
  custom: string;
  onCustomChange: (v: string) => void;
  onScore: (amount: number, desc: string) => void;
}> = ({ label, deduct, custom, onCustomChange, onScore }) => {
  const sign = deduct ? -1 : 1;
  const pfx = deduct ? '−' : '+';
  const desc = deduct ? `${label} Deduction` : `${label} Points`;
  const applyCustom = () => {
    const v = parseInt(custom || '0', 10);
    if (v > 0) { onScore(sign * v, 'Custom'); onCustomChange(''); }
  };
  return (
    <>
      {[1, 3, 5, 10].map(val => (
        <button
          key={val}
          onClick={() => onScore(sign * val, desc)}
          className={`flex-1 h-7 border rounded font-bold text-[9px] active:scale-95 ${deduct ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'bg-white/10 border-white/10 text-white'}`}
        >
          {pfx}{val}
        </button>
      ))}
      <input
        type="text"
        inputMode="numeric"
        value={custom}
        onChange={(e) => onCustomChange(e.target.value.replace(/[^0-9]/g, ''))}
        onKeyDown={(e) => { if (e.key === 'Enter') applyCustom(); }}
        className="w-8 h-7 border border-white/10 rounded text-center font-bold text-[10px] bg-[#171C27] text-white placeholder-white/30"
        placeholder="#"
      />
      <button
        onClick={applyCustom}
        className={`w-7 h-7 rounded font-black text-xs active:scale-95 ${deduct ? 'bg-red-600 text-white' : 'bg-[#CBFE1C] text-[#0B0E13]'}`}
      >
        {pfx}
      </button>
    </>
  );
};

const OneHandScorer: React.FC<OneHandScorerProps> = ({ session, students, adminName, gameLibrary }) => {
  // Look up game in the dynamic library passed from parent, fallback to session title if not found
  const game = gameLibrary.find(g => g.gameKey === session.gameKey);
  const roster = students.filter(s => session.roster.includes(s.id));
  const [lastEvents, setLastEvents] = useState<any[]>([]);
  // High-resolution stopwatch (milliseconds) shared by every timing template.
  const sw = useStopwatch();
  // Per-player lap splits (elapsed ms captured at each Lap press), newest last.
  const [laps, setLaps] = useState<Record<string, number[]>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  // Custom amount for the "award everyone still in" one-tap action (e.g. per round
  // in Zone Master).
  const [bulkCustom, setBulkCustom] = useState('');
  // Global scoring mode: DEDUCT flips every point button in the scorer to subtract.
  const [scoreMode, setScoreMode] = useState<'AWARD' | 'DEDUCT'>('AWARD');
  const deduct = scoreMode === 'DEDUCT';
  const [outs, setOuts] = useState<Record<string, boolean>>(() => (session.results?.outs || {}));

  useEffect(() => {
    const unsub = supabaseService.on('score_event', (e) => {
      if (e.sessionId === session.id) setLastEvents(prev => [e, ...prev].slice(0, 10));
    });
    return () => unsub();
  }, [session.id]);

  useEffect(() => {
    const unsub = supabaseService.on('player_status', (e: { sessionId: string; studentId: string; isOut: boolean }) => {
      if (e.sessionId !== session.id) return;
      setOuts(prev => ({ ...prev, [e.studentId]: e.isOut }));
    });
    return () => unsub();
  }, [session.id]);

  // Record a lap for one player: capture the live elapsed ms, keep it in local
  // state (shown next to the player) and persist through the existing lap path.
  const recordLap = (studentId: string) => {
    const ms = sw.lap();
    setLaps(prev => ({ ...prev, [studentId]: [...(prev[studentId] ?? []), ms] }));
    supabaseService.recordLapTime(session.id, studentId, ms, game?.displayName || session.title, adminName);
    AudioService.playWarningBeep();
  };

  const handleScore = async (studentId: string | undefined, houseId: any, amount: number, desc: string) => {
    if (amount === 0) return;
    // Paused game: scoring is locked (DrillLauncher also disables the buttons).
    if (session.pausedAt != null) return;
    if (studentId && outs[studentId]) return;
    try {
      await supabaseService.recordScoreEvent(session.id, studentId, houseId, amount, adminName, desc);
      if (amount > 0) {
        AudioService.playRandomAward();
        const student = studentId ? students.find(s => s.id === studentId) : null;
        const displayName = student ? getStudentDisplayName(student).primary : (houseId ? HOUSES[houseId].name : 'Team');
        AdminNotifications.pointsAwarded(amount, displayName);
      } else {
        AudioService.playPointLost();
      }
    } catch (err: any) {
      console.error('Score event failed:', err);
      AdminNotifications.error(`Failed to record score: ${err.message || 'Please try again'}`);
    }
  };

  const undo = async () => {
    await supabaseService.undoLastScoreEvent(session.id, adminName);
    AudioService.playWarningBeep();
  };

  // Everyone still in the game (rostered, not marked out).
  const stillInIds = roster.filter(s => !outs[s.id]).map(s => s.id);

  // Last person standing wins automatically: when a multi-player game is down
  // to a single active player, that player is the winner.
  const lastStanding = roster.length > 1 && stillInIds.length === 1
    ? roster.find(s => s.id === stillInIds[0]) ?? null
    : null;
  const WINNER_BONUS = 25;
  const lastStandingRef = useRef<string | null>(null);
  const winnerAwardedRef = useRef(false);
  useEffect(() => {
    if (lastStanding && lastStandingRef.current !== lastStanding.id) {
      lastStandingRef.current = lastStanding.id;
      try { AudioService.playWinnerFanfare(); } catch (e) { /* audio optional */ }
      // Crown the last player standing automatically: a one-time Game Winner
      // bonus tagged to this game (guarded so reviving players can't double it).
      if (!winnerAwardedRef.current) {
        winnerAwardedRef.current = true;
        supabaseService
          .recordScoreEvent(session.id, lastStanding.id, undefined, WINNER_BONUS, adminName, 'Game Winner')
          .catch((err: any) => console.error('Auto winner bonus failed:', err));
        AdminNotifications.pointsAwarded(WINNER_BONUS, `${getStudentDisplayName(lastStanding).primary} · Winner`);
      }
    }
    if (!lastStanding) lastStandingRef.current = null;
  }, [lastStanding]);

  // One tap awards the same points to every player still in the game. Since
  // game scoring is time-windowed over the ledger, these count for the game.
  const bulkAwardStillIn = async (amount: number) => {
    if (session.pausedAt != null || stillInIds.length === 0 || amount === 0) return;
    try {
      const suffix = amount < 0 ? ' (deduction)' : '';
      await supabaseService.addBatchPoints(stillInIds, amount, `${session.title || 'Game'}: still in${suffix}`, adminName, session.id);
      if (amount > 0) AudioService.playRandomAward(); else AudioService.playPointLost();
      AdminNotifications.pointsAwarded(amount, `${stillInIds.length} still in`);
    } catch (err: any) {
      console.error('Bulk still-in adjust failed:', err);
      AdminNotifications.error(`Failed: ${err.message || 'Please try again'}`);
    }
  };

  const renderTemplateUI = () => {
    // Default to Rep Counter if game definition is missing (e.g. custom quick game)
    const template = game?.templateId || 'TEMPLATE_REP_COUNTER';

    switch (template) {
      case 'TEMPLATE_RELAY':
        return (
          <RelayRaceScorer
            session={session}
            students={students}
            adminName={adminName}
            game={game}
            sw={sw}
          />
        );

      case 'TEMPLATE_TIME_TRIAL':
        return (
          <div className="space-y-3">
            {/* Millisecond stopwatch: Start / Stop / Reset. Reset zeroes the CLOCK
                only so you can time the next runner — recorded laps stay put. Every
                lap is saved as it's logged, and the fastest of the set is chosen
                when the game ends. */}
            <StopwatchBar sw={sw} label="Clock" />
            {/* Player Rows */}
            <div className="space-y-0.5">
              {roster.map(s => {
                const isOut = outs[s.id];
                const firstName = s.fullName?.split(' ')[0] || s.gamerTag || 'Player';
                const myLaps = laps[s.id] ?? [];
                return (
                  <div
                    key={s.id}
                    className={`rounded-lg ${isOut ? 'bg-red-500/10 opacity-40' : 'bg-white/5'}`}
                  >
                    <div className="flex items-center gap-1.5 py-1 px-1.5">
                      {/* Avatar + Name */}
                      <img src={s.avatarUrl} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      <div className="w-14 min-w-0">
                        <div className="font-bold text-[10px] text-white truncate leading-tight">{firstName}</div>
                        <div className="text-[8px] font-semibold leading-tight" style={{ color: HOUSES[s.houseId].colorHex }}>{s.points}</div>
                      </div>

                      {/* Point Buttons - 1, 3, 5, 10, custom + LAP */}
                      {!isOut ? (
                        <div className="flex items-center gap-0.5 flex-1">
                          <ScoreControls
                            label={game?.displayName || 'Time Trial'}
                            deduct={deduct}
                            custom={customValues[s.id] ?? ''}
                            onCustomChange={(v) => setCustomValues(cv => ({ ...cv, [s.id]: v }))}
                            onScore={(amount, desc) => handleScore(s.id, undefined, amount, desc)}
                          />
                          <button
                            onClick={() => recordLap(s.id)}
                            className="px-2 h-7 bg-brand-blue text-white rounded font-black text-[8px] uppercase active:scale-95"
                          >
                            LAP
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1" />
                      )}
                      <button
                        onClick={() => supabaseService.togglePlayerStatus(session.id, s.id, !isOut, adminName)}
                        className={`w-8 h-7 rounded font-bold text-[8px] active:scale-95 ${isOut ? 'bg-emerald-500 text-white' : 'bg-red-500/15 text-red-400'}`}
                      >
                        {isOut ? 'IN' : 'OUT'}
                      </button>
                    </div>

                    {/* Recorded laps for this player (most recent 3) */}
                    {myLaps.length > 0 && (
                      <div className="flex items-center gap-1 px-1.5 pb-1 flex-wrap">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Laps</span>
                        {myLaps.slice(-3).map((ms, i) => (
                          <span
                            key={i}
                            className="text-[9px] font-mono font-bold text-[#CBFE1C] bg-[#CBFE1C]/10 border border-[#CBFE1C]/30 rounded px-1.5 py-0.5"
                          >
                            {fmtStopwatch(ms)}
                          </span>
                        ))}
                        {myLaps.length > 3 && (
                          <span className="text-[8px] font-bold text-white/40">+{myLaps.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'TEMPLATE_ACCURACY':
        return (
          <div className="space-y-0.5">
            {roster.map(s => {
              const isOut = outs[s.id];
              const firstName = s.fullName?.split(' ')[0] || s.gamerTag || 'Player';
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-1.5 py-1 px-1.5 rounded-lg ${isOut ? 'bg-red-500/10 opacity-40' : 'bg-white/5'}`}
                >
                  {/* Avatar + Name */}
                  <img src={s.avatarUrl} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  <div className="w-16 min-w-0">
                    <div className="font-bold text-[10px] text-white truncate leading-tight">{firstName}</div>
                    <div className="text-[8px] font-semibold leading-tight" style={{ color: HOUSES[s.houseId].colorHex }}>{s.points}</div>
                  </div>

                  {/* Point Buttons - 1, 3, 5, 10, custom */}
                  {!isOut ? (
                    <div className="flex items-center gap-0.5 flex-1">
                      <ScoreControls
                        label={game?.displayName || 'Accuracy'}
                        deduct={deduct}
                        custom={customValues[s.id] ?? ''}
                        onCustomChange={(v) => setCustomValues(cv => ({ ...cv, [s.id]: v }))}
                        onScore={(amount, desc) => handleScore(s.id, undefined, amount, desc)}
                      />
                    </div>
                  ) : (
                    <div className="flex-1" />
                  )}
                  <button
                    onClick={() => supabaseService.togglePlayerStatus(session.id, s.id, !isOut, adminName)}
                    className={`w-8 h-7 rounded font-bold text-[8px] active:scale-95 ${isOut ? 'bg-emerald-500 text-white' : 'bg-red-500/15 text-red-400'}`}
                  >
                    {isOut ? 'IN' : 'OUT'}
                  </button>
                </div>
              );
            })}
          </div>
        );

      case 'TEMPLATE_REP_COUNTER':
      default:
        return (
          <div className="space-y-0.5">
            {roster.map(s => {
              const isOut = outs[s.id];
              const firstName = s.fullName?.split(' ')[0] || s.gamerTag || 'Player';
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-1.5 py-1 px-1.5 rounded-lg ${isOut ? 'bg-red-500/10 opacity-40' : 'bg-white/5'}`}
                >
                  {/* Avatar + Name */}
                  <img src={s.avatarUrl} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  <div className="w-16 min-w-0">
                    <div className="font-bold text-[10px] text-white truncate leading-tight">{firstName}</div>
                    <div className="text-[8px] font-semibold leading-tight" style={{ color: HOUSES[s.houseId].colorHex }}>{s.points}</div>
                  </div>

                  {/* Point Buttons - 1, 3, 5, 10, custom */}
                  {!isOut ? (
                    <div className="flex items-center gap-0.5 flex-1">
                      <ScoreControls
                        label={game?.displayName || 'Game'}
                        deduct={deduct}
                        custom={customValues[s.id] ?? ''}
                        onCustomChange={(v) => setCustomValues(cv => ({ ...cv, [s.id]: v }))}
                        onScore={(amount, desc) => handleScore(s.id, undefined, amount, desc)}
                      />
                    </div>
                  ) : (
                    <div className="flex-1" />
                  )}
                  <button
                    onClick={() => supabaseService.togglePlayerStatus(session.id, s.id, !isOut, adminName)}
                    className={`w-8 h-7 rounded font-bold text-[8px] active:scale-95 ${isOut ? 'bg-emerald-500 text-white' : 'bg-red-500/15 text-red-400'}`}
                  >
                    {isOut ? 'IN' : 'OUT'}
                  </button>
                </div>
              );
            })}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Award / Deduct mode — flips every point button in the scorer to subtract */}
      <div className="shrink-0 flex bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
        {(['AWARD', 'DEDUCT'] as const).map(m => {
          const active = scoreMode === m;
          const isDeduct = m === 'DEDUCT';
          return (
            <button
              key={m}
              onClick={() => setScoreMode(m)}
              className={`flex-1 py-2 rounded-md text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${active ? (isDeduct ? 'bg-red-600 text-white' : 'bg-[#CBFE1C] text-[#0B0E13]') : 'text-white/50 hover:text-white'}`}
            >
              {isDeduct ? '− Deduct' : '+ Award'}
            </button>
          );
        })}
      </div>
      <div className="flex-grow overflow-y-auto custom-scrollbar">
        {renderTemplateUI()}
      </div>
      {lastStanding && (
        <div className="shrink-0 flex items-center gap-3 p-3 rounded-lg border animate-fade-in" style={{ background: 'rgba(203,254,28,0.12)', borderColor: 'rgba(203,254,28,0.55)' }}>
          <span className="text-2xl">🏆</span>
          <div className="flex-grow min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest text-[#CBFE1C]">Last Standing · Winner</div>
            <div className="font-black text-white truncate">{getStudentDisplayName(lastStanding).primary}</div>
          </div>
        </div>
      )}
      {stillInIds.length > 0 && (
        <div className="shrink-0 bg-white/5 border border-white/10 rounded-lg p-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-[#CBFE1C] whitespace-nowrap">
              All still in · {stillInIds.length}
            </div>
            <div className="flex gap-1.5">
              {[1, 3, 5, 10].map(amt => (
                <button
                  key={amt}
                  onClick={() => bulkAwardStillIn(deduct ? -amt : amt)}
                  disabled={session.pausedAt != null}
                  className={`font-black px-3 py-1.5 rounded-lg text-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${deduct ? 'bg-red-600 text-white' : 'bg-[#CBFE1C] text-[#0B0E13]'}`}
                >
                  {deduct ? '−' : '+'}{amt}
                </button>
              ))}
            </div>
          </div>
          {/* Custom amount to/from EVERY still-in player in one tap (e.g. Zone Master rounds). */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              value={bulkCustom}
              onChange={(e) => setBulkCustom(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => {
                const v = parseInt(bulkCustom || '0', 10);
                if (e.key === 'Enter' && v > 0 && session.pausedAt == null) { bulkAwardStillIn(deduct ? -v : v); setBulkCustom(''); }
              }}
              placeholder={deduct ? 'Custom amount from all still in' : 'Custom amount to all still in'}
              className="flex-1 h-9 px-3 bg-[#171C27] border border-white/10 rounded-lg text-white font-bold text-xs placeholder-white/30 focus:border-[#CBFE1C] outline-none"
            />
            <button
              onClick={() => { const v = parseInt(bulkCustom || '0', 10); if (v > 0) { bulkAwardStillIn(deduct ? -v : v); setBulkCustom(''); } }}
              disabled={session.pausedAt != null || !parseInt(bulkCustom || '0', 10)}
              className={`h-9 px-4 font-black rounded-lg text-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${deduct ? 'bg-red-600 text-white' : 'bg-[#CBFE1C] text-[#0B0E13]'}`}
            >
              {deduct ? 'Deduct All' : 'Award All'}
            </button>
          </div>
        </div>
      )}
      <UndoBar lastEvents={lastEvents} onUndo={undo} />
    </div>
  );
};

const UndoBar: React.FC<{ lastEvents: any[], onUndo: () => void }> = ({ lastEvents, onUndo }) => {
  if (lastEvents.length === 0) return null;
  return (
    <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-2 shrink-0">
      <div className="text-[9px] text-white/50 truncate flex-1">
        {lastEvents[0] && `${lastEvents[0].amount > 0 ? '+' : ''}${lastEvents[0].amount} ${lastEvents[0].description}`}
      </div>
      <button onClick={onUndo} className="bg-red-500 text-white font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-wider active:scale-95 shrink-0">Undo</button>
    </div>
  );
};

export default OneHandScorer;
