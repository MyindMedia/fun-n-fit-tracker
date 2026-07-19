
import React, { useState, useEffect, useRef } from 'react';
import { GameSession, Student, GameDefinition } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { HOUSES } from '../../constants';
import { AudioService } from '../../utils/audio';
import { AdminNotifications } from '../../utils/notifications';
import { getStudentDisplayName } from '../../utils/studentDisplay';

interface OneHandScorerProps {
  session: GameSession;
  students: Student[];
  adminName: string;
  gameLibrary: GameDefinition[];
}

const OneHandScorer: React.FC<OneHandScorerProps> = ({ session, students, adminName, gameLibrary }) => {
  // Look up game in the dynamic library passed from parent, fallback to session title if not found
  const game = gameLibrary.find(g => g.gameKey === session.gameKey);
  const roster = students.filter(s => session.roster.includes(s.id));
  const [lastEvents, setLastEvents] = useState<any[]>([]);
  const [sessionStopwatch, setSessionStopwatch] = useState(0);
  const [isClockRunning, setIsClockRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
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

  useEffect(() => {
    if (isClockRunning) {
      timerRef.current = window.setInterval(() => {
        setSessionStopwatch(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isClockRunning]);

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
  const lastStandingRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastStanding && lastStandingRef.current !== lastStanding.id) {
      lastStandingRef.current = lastStanding.id;
      try { AudioService.playWinnerFanfare(); } catch (e) { /* audio optional */ }
    }
    if (!lastStanding) lastStandingRef.current = null;
  }, [lastStanding]);

  // One tap awards the same points to every player still in the game. Since
  // game scoring is time-windowed over the ledger, these count for the game.
  const bulkAwardStillIn = async (amount: number) => {
    if (session.pausedAt != null || stillInIds.length === 0) return;
    try {
      await supabaseService.addBatchPoints(stillInIds, amount, `${session.title || 'Game'}: still in`, adminName, session.id);
      AudioService.playRandomAward();
      AdminNotifications.pointsAwarded(amount, `${stillInIds.length} still in`);
    } catch (err: any) {
      console.error('Bulk still-in award failed:', err);
      AdminNotifications.error(`Failed to award: ${err.message || 'Please try again'}`);
    }
  };

  const renderTemplateUI = () => {
    // Default to Rep Counter if game definition is missing (e.g. custom quick game)
    const template = game?.templateId || 'TEMPLATE_REP_COUNTER';

    switch (template) {
      case 'TEMPLATE_TIME_TRIAL':
        return (
          <div className="space-y-3">
            {/* Compact Clock Header */}
            <div className="rounded-xl p-3 text-center text-white flex items-center justify-between border border-white/10" style={{ background: 'var(--pz-panel-2)' }}>
              <div className="text-[9px] font-black uppercase tracking-widest text-[#CBFE1C]">Clock</div>
              <div className="text-2xl font-mono font-black text-[#CBFE1C]">{sessionStopwatch}s</div>
              <button
                onClick={() => setIsClockRunning(!isClockRunning)}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider active:scale-95 ${isClockRunning ? 'bg-red-500 text-white' : 'bg-[#CBFE1C] text-[#0B0E13]'}`}
              >
                {isClockRunning ? 'Pause' : 'Start'}
              </button>
            </div>
            {/* Player Rows */}
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
                    <div className="w-14 min-w-0">
                      <div className="font-bold text-[10px] text-white truncate leading-tight">{firstName}</div>
                      <div className="text-[8px] font-semibold leading-tight" style={{ color: HOUSES[s.houseId].colorHex }}>{s.points}</div>
                    </div>

                    {/* Point Buttons - 1, 3, 5, 10, custom + LAP */}
                    {!isOut ? (
                      <div className="flex items-center gap-0.5 flex-1">
                        {[1, 3, 5, 10].map(val => (
                          <button
                            key={val}
                            onClick={() => handleScore(s.id, undefined, val, `${game?.displayName || 'Time Trial'} Points`)}
                            className="flex-1 h-7 bg-white/10 border border-white/10 text-white rounded font-bold text-[9px] active:scale-95"
                          >
                            +{val}
                          </button>
                        ))}
                        <input
                          type="text"
                          inputMode="numeric"
                          value={customValues[s.id] ?? ''}
                          onChange={(e) => setCustomValues(v => ({ ...v, [s.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                          onKeyDown={(e) => {
                            const num = parseInt(customValues[s.id] || '0', 10);
                            if (e.key === 'Enter' && num > 0) {
                              handleScore(s.id, undefined, num, `Custom`);
                              setCustomValues(v => ({ ...v, [s.id]: '' }));
                            }
                          }}
                          className="w-7 h-7 border border-white/10 rounded text-center font-bold text-[10px] bg-[#171C27] text-white placeholder-white/30"
                          placeholder="#"
                        />
                        <button
                          onClick={() => {
                            const v = parseInt(customValues[s.id] || '0', 10);
                            if (v > 0) {
                              handleScore(s.id, undefined, v, `Custom`);
                              setCustomValues(cv => ({ ...cv, [s.id]: '' }));
                            }
                          }}
                          className="w-6 h-7 bg-[#CBFE1C] text-[#0B0E13] rounded font-black text-[10px] active:scale-95"
                        >
                          +
                        </button>
                        <button
                          onClick={() => { supabaseService.recordLapTime(session.id, s.id, sessionStopwatch, game?.displayName || session.title, adminName); }}
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
                      {[1, 3, 5, 10].map(val => (
                        <button
                          key={val}
                          onClick={() => handleScore(s.id, undefined, val, `${game?.displayName || 'Accuracy'} Points`)}
                          className="flex-1 h-7 bg-white/10 border border-white/10 text-white rounded font-bold text-[9px] active:scale-95"
                        >
                          +{val}
                        </button>
                      ))}
                      <input
                        type="text"
                        inputMode="numeric"
                        value={customValues[s.id] ?? ''}
                        onChange={(e) => setCustomValues(v => ({ ...v, [s.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                        onKeyDown={(e) => {
                          const num = parseInt(customValues[s.id] || '0', 10);
                          if (e.key === 'Enter' && num > 0) {
                            handleScore(s.id, undefined, num, `Custom`);
                            setCustomValues(v => ({ ...v, [s.id]: '' }));
                          }
                        }}
                        className="w-8 h-7 border border-white/10 rounded text-center font-bold text-[10px] bg-[#171C27] text-white placeholder-white/30"
                        placeholder="#"
                      />
                      <button
                        onClick={() => {
                          const v = parseInt(customValues[s.id] || '0', 10);
                          if (v > 0) {
                            handleScore(s.id, undefined, v, `Custom`);
                            setCustomValues(cv => ({ ...cv, [s.id]: '' }));
                          }
                        }}
                        className="w-7 h-7 bg-[#CBFE1C] text-[#0B0E13] rounded font-black text-xs active:scale-95"
                      >
                        +
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
                      {[1, 3, 5, 10].map(val => (
                        <button
                          key={val}
                          onClick={() => handleScore(s.id, undefined, val, `${game?.displayName || 'Game'} Points`)}
                          className="flex-1 h-7 bg-white/10 border border-white/10 text-white rounded font-bold text-[9px] active:scale-95"
                        >
                          +{val}
                        </button>
                      ))}
                      <input
                        type="text"
                        inputMode="numeric"
                        value={customValues[s.id] ?? ''}
                        onChange={(e) => setCustomValues(v => ({ ...v, [s.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                        onKeyDown={(e) => {
                          const num = parseInt(customValues[s.id] || '0', 10);
                          if (e.key === 'Enter' && num > 0) {
                            handleScore(s.id, undefined, num, `Custom`);
                            setCustomValues(v => ({ ...v, [s.id]: '' }));
                          }
                        }}
                        className="w-8 h-7 border border-white/10 rounded text-center font-bold text-[10px] bg-[#171C27] text-white placeholder-white/30"
                        placeholder="#"
                      />
                      <button
                        onClick={() => {
                          const v = parseInt(customValues[s.id] || '0', 10);
                          if (v > 0) {
                            handleScore(s.id, undefined, v, `Custom`);
                            setCustomValues(cv => ({ ...cv, [s.id]: '' }));
                          }
                        }}
                        className="w-7 h-7 bg-[#CBFE1C] text-[#0B0E13] rounded font-black text-xs active:scale-95"
                      >
                        +
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
              );
            })}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
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
        <div className="shrink-0 bg-white/5 border border-white/10 rounded-lg p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-[#CBFE1C] whitespace-nowrap">
              All still in · {stillInIds.length}
            </div>
            <div className="flex gap-1.5">
              {[1, 3, 5, 10].map(amt => (
                <button
                  key={amt}
                  onClick={() => bulkAwardStillIn(amt)}
                  disabled={session.pausedAt != null}
                  className="bg-[#CBFE1C] text-[#0B0E13] font-black px-3 py-1.5 rounded-lg text-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  +{amt}
                </button>
              ))}
            </div>
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
