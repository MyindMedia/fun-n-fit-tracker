
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GameSession, Student, GameDefinition } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { HOUSES, GAME_LIBRARY } from '../../constants';
import OneHandScorer from './OneHandScorer';
import BulkAwardForm from './BulkAwardForm';
import { generateGameIdeas } from '../../services/geminiService';
import { AdminNotifications } from '../../utils/notifications';

interface DrillLauncherProps {
  adminName: string;
  students: Student[];
}

// Session Timer Component
const SessionTimer: React.FC<{ session: GameSession }> = ({ session }) => {
  const [timeDisplay, setTimeDisplay] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - session.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setTimeDisplay(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session.startTime]);

  return (
    <div className="bg-white/10 px-3 py-2 rounded-xl border border-white/10 flex flex-col items-center">
      <span className="text-[8px] font-black uppercase opacity-50">Time</span>
      <span className="text-sm font-black tabular-nums">{timeDisplay}</span>
    </div>
  );
};

const DrillLauncher: React.FC<DrillLauncherProps> = ({ adminName, students }) => {
  const [activeSessions, setActiveSessions] = useState<GameSession[]>([]);
  const [showLibrary, setShowLibrary] = useState<boolean>(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [showBulkAward, setShowBulkAward] = useState(false);

  // Dynamic Game Data
  const [availableGames, setAvailableGames] = useState<GameDefinition[]>([]);
  const [customTitle, setCustomTitle] = useState('');

  // Drill Configuration State
  const [pendingGame, setPendingGame] = useState<GameDefinition | null>(null);
  const [selectedRoster, setSelectedRoster] = useState<Set<string>>(new Set());
  const [customDuration, setCustomDuration] = useState<string>('10');

  useEffect(() => {
    const refreshSessions = () => {
      supabaseService.getActiveGames().then(games => {
        const now = Date.now();
        const stillActive = games.filter(g => now < g.endTime);
        if (stillActive.length !== games.length) {
          console.log('🧹 Admin: Filtered out', games.length - stillActive.length, 'ended games');
        }
        setActiveSessions(stillActive);
      });
    };

    refreshSessions();
    supabaseService.getGameLibrary().then(setAvailableGames);

    const unsubStart = supabaseService.on('game_start', (session: GameSession) => {
      AdminNotifications.sessionStarted(session.title);
      refreshSessions();
    });

    const unsubEnd = supabaseService.on('game_end', (data: any) => {
      AdminNotifications.sessionEnded(data.game.title);
      console.log('🏁 Admin: Game ended, removing from active sessions:', data.game.title);
      setActiveSessions(prev => prev.filter(g => g.id !== data.game.id));
    });

    const unsubUpdate = supabaseService.on('active_games_update', setActiveSessions);
    const unsubPoints = supabaseService.on('points_update', refreshSessions);

    const cleanupInterval = setInterval(() => {
      setActiveSessions(prev => {
        const now = Date.now();
        const stillActive = prev.filter(g => now < g.endTime);
        if (stillActive.length !== prev.length) {
          console.log('🧹 Admin cleanup: Removed', prev.length - stillActive.length, 'ended games');
        }
        return stillActive;
      });
    }, 1000);

    return () => {
      unsubStart();
      unsubEnd();
      unsubUpdate();
      unsubPoints();
      clearInterval(cleanupInterval);
    };
  }, []);

  const openDrillConfig = (game: GameDefinition) => {
    setPendingGame(game);
    setCustomDuration(String(Math.ceil(game.durationDefaultSeconds / 60)));
    setCustomTitle(game.displayName);
    const presentIds = students.filter(s => s.isPresent).map(s => s.id);
    setSelectedRoster(new Set(presentIds));
    setShowLibrary(false);
  };

  const openCustomPoints = () => {
    openDrillConfig({
      gameKey: 'CUSTOM_POINTS', displayName: 'Custom Points Game', category: 'Custom', houseTraitFocus: 'Mixed', minPlayers: 1, maxPlayers: 200, recommendedAgeBand: '5-18', durationDefaultSeconds: 300, equipmentChecklist: [], setupSteps: [], rules: ['Coach awards points manually'], scoringRules: 'Buttons: +10, +25; penalties -10', penalties: 'Coach correction -10', tieBreaker: 'Highest points wins', safetyNotes: 'General safety', accessibilityVariants: 'Flexible rules', coachScriptShort: 'Work hard, earn points!', dataCaptureFields: [], leaderboardMetric: 'score', templateId: 'TEMPLATE_REP_COUNTER'
    } as GameDefinition);
  };

  const openCustomLap = () => {
    openDrillConfig({
      gameKey: 'CUSTOM_LAP', displayName: 'Custom Lap Stopwatch', category: 'Custom', houseTraitFocus: 'Mixed', minPlayers: 1, maxPlayers: 200, recommendedAgeBand: '5-18', durationDefaultSeconds: 600, equipmentChecklist: [], setupSteps: [], rules: ['Coach runs stopwatch and records laps'], scoringRules: 'Lap button records time and points', penalties: 'None', tieBreaker: 'Fastest lap', safetyNotes: 'Clear running path', accessibilityVariants: 'Shorter laps', coachScriptShort: 'Ready, set, GO!', dataCaptureFields: ['lap_time'], leaderboardMetric: 'time', templateId: 'TEMPLATE_TIME_TRIAL'
    } as GameDefinition);
  };

  const toggleStudent = (id: string) => {
    const next = new Set(selectedRoster);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedRoster(next);
  };

  const handleFinalLaunch = async () => {
    if (!pendingGame || isLaunching) return;
    if (selectedRoster.size === 0) {
      alert("Please select at least one athlete to participate.");
      return;
    }
    const durationNum = parseInt(customDuration || '0', 10);
    if (!durationNum || durationNum <= 0) {
      alert('Please enter a valid session duration in minutes (> 0).');
      return;
    }

    setIsLaunching(true);
    try {
      console.log(`Launching Game: ${pendingGame.displayName} with ${selectedRoster.size} athletes.`);
      await supabaseService.startGame(
        pendingGame.gameKey,
        adminName,
        Array.from(selectedRoster),
        durationNum * 60,
        customTitle.trim() || undefined
      );

      console.log('🔄 Refreshing active sessions after game start...');
      const updatedSessions = await supabaseService.getActiveGames();
      setActiveSessions(updatedSessions);

      setPendingGame(null);
    } catch (err: any) {
      console.error("Game Start Failed:", err);
      alert(`Error starting game: ${err.message || "Please check connection"}`);
    } finally {
      setIsLaunching(false);
    }
  };

  const askAiStrategist = async () => {
    setIsAiLoading(true);
    try {
      const housesData = await supabaseService.getLeaderboardData('ALL');
      const trailingHouse = housesData.houses.sort((a, b) => a.totalPoints - b.totalPoints)[0];
      const suggested = await generateGameIdeas(15, 'High');
      setAiSuggestion({ ...suggested, targetHouse: trailingHouse.name });
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const combinedLibrary = React.useMemo(() => {
    const map = new Map<string, GameDefinition>();
    [...availableGames, ...GAME_LIBRARY].forEach(g => { map.set(g.gameKey, g); });
    return Array.from(map.values());
  }, [availableGames]);

  return (
    <section className="space-y-4">
      {/* Bulk Award Modal - Portal to body */}
      {showBulkAward && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-4 md:p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <BulkAwardForm students={students} adminName={adminName} onComplete={() => setShowBulkAward(false)} />
          </div>
        </div>,
        document.body
      )}

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-display font-black text-slate-900 tracking-tight uppercase">Live Games</h2>
          <p className="text-slate-500 text-sm">Manage active sessions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={askAiStrategist}
            disabled={isAiLoading}
            className="flex-1 bg-white border-2 border-slate-200 text-slate-600 px-4 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isAiLoading ? 'Analyzing...' : '✨ AI'}
          </button>
          <button
            onClick={() => setShowLibrary(true)}
            className="flex-[2] bg-brand-blue text-white px-4 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95"
          >
            🎮 Launch Game
          </button>
        </div>
      </div>

      {/* AI Suggestion */}
      {aiSuggestion && (
        <div className="bg-gradient-to-br from-brand-blue to-blue-600 rounded-2xl p-4 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-6xl opacity-10 font-black">🤖</div>
          <div className="relative z-10">
            <div className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-80">AI Pick for {aiSuggestion.targetHouse}</div>
            <h3 className="text-lg font-display font-black mb-1">{aiSuggestion.title}</h3>
            <p className="text-xs opacity-90 mb-3 line-clamp-2">{aiSuggestion.description}</p>
            <button onClick={() => setAiSuggestion(null)} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-black text-[9px] uppercase">Dismiss</button>
          </div>
        </div>
      )}

      {/* Active Sessions */}
      <div className="space-y-4">
        {activeSessions.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center shadow-sm">
            <span className="text-4xl mb-3 block opacity-20">🏃‍♂️</span>
            <h3 className="text-lg font-display font-black text-slate-400 mb-3 uppercase tracking-tight">No Active Games</h3>
            <button
              onClick={() => setShowLibrary(true)}
              className="bg-slate-100 text-slate-500 hover:bg-brand-blue hover:text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
            >
              Open Library
            </button>
          </div>
        ) : (
          activeSessions.map(session => (
            <div key={session.id} className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              {/* Session Header */}
              <div className="bg-slate-900 p-4 text-white">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-grow">
                    <div className="text-[9px] font-black uppercase opacity-50 tracking-widest mb-0.5">Coach {session.startedBy}</div>
                    <div className="text-lg font-display font-black tracking-tight uppercase leading-tight truncate">{session.title}</div>
                  </div>
                  <button
                    onClick={async () => {
                      await supabaseService.stopGame(session.id);
                      const sessions = await supabaseService.getActiveGames();
                      setActiveSessions(sessions);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase shrink-0 active:scale-95"
                  >
                    End
                  </button>
                </div>
                <div className="flex gap-2">
                  <SessionTimer session={session} />
                  <div className="bg-white/10 px-3 py-2 rounded-xl border border-white/10 flex flex-col items-center">
                    <span className="text-[8px] font-black uppercase opacity-50">Athletes</span>
                    <span className="text-sm font-black">{session.roster.length}</span>
                  </div>
                </div>
              </div>

              {/* Scorer */}
              <div className="p-3 bg-white max-h-[60vh] overflow-y-auto">
                <OneHandScorer
                  session={session}
                  students={students}
                  adminName={adminName}
                  gameLibrary={combinedLibrary}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Game Library Modal - Portal to body */}
      {showLibrary && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between shadow-sm">
            <h2 className="text-lg font-display font-black uppercase tracking-tight">Game Library</h2>
            <button
              onClick={() => setShowLibrary(false)}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xl font-bold active:scale-95"
            >
              ✕
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-grow overflow-y-auto bg-slate-50 p-4 space-y-4">
            {/* Quick Start Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={openCustomPoints} className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 font-black uppercase text-[10px] tracking-widest active:scale-95">
                ⭐ Custom Points
              </button>
              <button onClick={openCustomLap} className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 font-black uppercase text-[10px] tracking-widest active:scale-95">
                ⏱️ Lap Timer
              </button>
            </div>

            {/* Game List */}
            <div className="space-y-3 pb-4">
              {availableGames.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold">Loading Library...</div>
              ) : (
                combinedLibrary.map(g => (
                  <div
                    key={g.gameKey}
                    onClick={() => openDrillConfig(g)}
                    className="p-4 rounded-xl border-2 border-slate-200 bg-white active:border-brand-blue active:bg-blue-50 transition-all"
                  >
                    <div className="text-[9px] font-black text-brand-blue uppercase mb-1 tracking-widest">{g.category}</div>
                    <div className="text-base font-display font-black text-slate-800 mb-1">{g.displayName}</div>
                    <p className="text-slate-500 text-xs line-clamp-1">{g.rules[0]}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Game Configuration Modal - Portal to body */}
      {pendingGame && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between shadow-sm">
            <div>
              <h2 className="text-lg font-display font-black uppercase tracking-tight">Configure Game</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pendingGame.displayName}</p>
            </div>
            <button
              onClick={() => setPendingGame(null)}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xl font-bold active:scale-95"
            >
              ✕
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-grow overflow-y-auto bg-slate-50 p-4 space-y-4">
            {/* Game Title */}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Game Title</label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold text-slate-900 text-sm"
                placeholder={pendingGame.displayName}
              />
            </div>

            {/* Duration */}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Duration (Minutes)</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="10"
                  className="flex-grow bg-slate-50 p-3 rounded-xl border border-slate-200 font-black text-2xl text-brand-blue text-center"
                />
                <span className="text-sm font-black text-slate-400 uppercase">min</span>
              </div>
            </div>

            {/* Athletes */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 pb-6">
              <div className="flex justify-between items-center mb-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Athletes ({selectedRoster.size})</label>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedRoster(new Set(students.map(s => s.id)))} className="text-[9px] font-black text-brand-blue uppercase">All</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setSelectedRoster(new Set())} className="text-[9px] font-black text-slate-400 uppercase">Clear</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-1">
                {students.map(s => (
                  <div
                    key={s.id}
                    onClick={() => toggleStudent(s.id)}
                    className={`p-2 rounded-lg border-2 transition-all active:scale-95 ${
                      selectedRoster.has(s.id)
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-100 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${selectedRoster.has(s.id) ? 'bg-brand-blue' : 'bg-slate-200'}`} />
                      <div className="min-w-0 flex-grow">
                        <div className="text-[10px] font-black truncate">{s.fullName}</div>
                        {s.gamerTag && (
                          <div className={`text-[8px] truncate ${selectedRoster.has(s.id) ? 'text-white/60' : 'text-slate-400'}`}>@{s.gamerTag}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 bg-white border-t border-slate-200 p-4 flex gap-3">
            <button onClick={() => setPendingGame(null)} className="flex-1 py-4 rounded-xl font-black uppercase text-xs text-slate-400 bg-slate-100 active:scale-95">Cancel</button>
            <button
              onClick={handleFinalLaunch}
              disabled={isLaunching || selectedRoster.size === 0}
              className="flex-[2] bg-brand-green text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isLaunching ? 'Launching...' : 'Start Game'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
};

export default DrillLauncher;
