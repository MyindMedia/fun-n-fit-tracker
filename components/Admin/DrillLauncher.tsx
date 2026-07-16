
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GameSession, Student, GameDefinition } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { HOUSES, GAME_LIBRARY } from '../../constants';
import OneHandScorer from './OneHandScorer';
import BulkAwardForm from './BulkAwardForm';
import { generateGameIdeas } from '../../services/geminiService';
import { AdminNotifications } from '../../utils/notifications';
import { Ic } from '../icons';

interface DrillLauncherProps {
  adminName: string;
  students: Student[];
}

// Games driven by wristband taps — badge them so coaches spot them instantly.
const isNfcGame = (g: GameDefinition): boolean =>
  g.category === 'NFC Arena' || (g.dataCaptureFields ?? []).some(f => f.startsWith('nfc'));

const NfcBadge: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => (
  <span
    className={`inline-flex items-center gap-1 font-black uppercase tracking-widest text-[#CBFE1C] bg-[#CBFE1C]/10 border border-[#CBFE1C]/40 ${
      size === 'sm' ? 'text-[8px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1'
    }`}
  >
    <Ic.Nfc size={size === 'sm' ? 10 : 13} /> NFC
  </span>
);

/* Mobile-first rules & guide sheet: every game's full playbook in native
   <details> accordions — no JS state per section, taps huge, reads clean. */
const GameGuideSheet: React.FC<{ game: GameDefinition; onClose: () => void }> = ({ game, onClose }) => {
  const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; open?: boolean }> = ({ title, icon, children, open }) => (
    <details open={open} className="pz-card-sm group" style={{ background: 'var(--pz-panel-2)' }}>
      <summary className="flex items-center justify-between gap-3 p-4 min-h-[52px] cursor-pointer list-none select-none">
        <span className="flex items-center gap-2.5 text-white font-black uppercase tracking-wider text-xs">
          <span className="text-[#CBFE1C]">{icon}</span> {title}
        </span>
        <span className="text-white/40 transition-transform group-open:rotate-90"><Ic.ChevronRight size={16} /></span>
      </summary>
      <div className="px-4 pb-4 text-sm leading-relaxed" style={{ color: 'var(--pz-text)' }}>
        {children}
      </div>
    </details>
  );

  const List: React.FC<{ items: string[] }> = ({ items }) => (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="text-[#CBFE1C] flex-shrink-0 mt-0.5"><Ic.ChevronRight size={13} /></span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );

  return createPortal(
    <div className="pz-scope fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'var(--pz-panel)', borderBottom: '1px solid var(--pz-border)' }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black text-[#CBFE1C] uppercase tracking-widest">{game.category}</span>
            {isNfcGame(game) && <NfcBadge />}
          </div>
          <h2 className="pz-display text-base text-white truncate">{game.displayName}</h2>
        </div>
        <button onClick={onClose} aria-label="Close guide" className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 active:scale-95 flex-shrink-0">
          <Ic.XMark size={20} />
        </button>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-3 pb-8" style={{ background: 'var(--pz-bg)' }}>
        {/* At-a-glance chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { icon: <Ic.Users size={12} />, text: `${game.minPlayers}–${game.maxPlayers} players` },
            { icon: <Ic.User size={12} />, text: `Ages ${game.recommendedAgeBand}` },
            { icon: <Ic.Timer size={12} />, text: `${Math.round(game.durationDefaultSeconds / 60)} min` },
            { icon: <Ic.Trophy size={12} />, text: game.leaderboardMetric },
          ].map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/80 bg-white/5 border border-white/10 px-2.5 py-1.5">
              {chip.icon} {chip.text}
            </span>
          ))}
        </div>

        {/* Coach script — the one-liner to yell */}
        <div className="pz-card-sm p-4 border-[#CBFE1C]/40" style={{ background: 'rgba(203,254,28,0.06)' }}>
          <div className="text-[9px] font-black uppercase tracking-widest text-[#CBFE1C] mb-1 flex items-center gap-1.5"><Ic.Megaphone size={12} /> Coach says</div>
          <div className="text-white font-bold text-sm">“{game.coachScriptShort}”</div>
        </div>

        <Section title="How to play" icon={<Ic.Controller size={16} />} open>
          <List items={game.rules} />
        </Section>

        <Section title="Setup" icon={<Ic.ClipboardCheck size={16} />}>
          {game.setupSteps.length > 0 ? <List items={game.setupSteps} /> : <p>No setup needed — just gather the players.</p>}
          {game.equipmentChecklist.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1.5">Equipment</div>
              <List items={game.equipmentChecklist} />
            </div>
          )}
        </Section>

        <Section title="Scoring" icon={<Ic.Bolt size={16} />}>
          <p>{game.scoringRules}</p>
        </Section>

        <Section title="Penalties & tie-breaker" icon={<Ic.Warning size={16} />}>
          <p><span className="text-white/80 font-bold">Penalties:</span> {game.penalties}</p>
          <p className="mt-2"><span className="text-white/80 font-bold">Tie-breaker:</span> {game.tieBreaker}</p>
        </Section>

        <Section title="Safety & accessibility" icon={<Ic.CheckCircle size={16} />}>
          <p><span className="text-white/80 font-bold">Safety:</span> {game.safetyNotes}</p>
          <p className="mt-2"><span className="text-white/80 font-bold">Adaptations:</span> {game.accessibilityVariants}</p>
        </Section>

        {isNfcGame(game) && (
          <Section title="NFC bands" icon={<Ic.Nfc size={16} />}>
            <p>
              This game uses wristband taps. Open <span className="text-white/80 font-bold">NFC Bands</span>, pick{' '}
              <span className="text-white/80 font-bold">Timing</span> (laps/splits) or{' '}
              <span className="text-white/80 font-bold">Points</span> (score per tap), and select this game under
              “Recording for” once it's launched — every tap then counts automatically.
            </p>
          </Section>
        )}
      </div>
    </div>,
    document.body
  );
};

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
  const [guideGame, setGuideGame] = useState<GameDefinition | null>(null);
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
        <div className="pz-scope fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="pz-card p-4 md:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <BulkAwardForm students={students} adminName={adminName} onComplete={() => setShowBulkAward(false)} />
          </div>
        </div>,
        document.body
      )}

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl text-white tracking-tight">Live Games</h2>
          <p className="text-sm" style={{ color: 'var(--pz-text)' }}>Manage active sessions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={askAiStrategist}
            disabled={isAiLoading}
            className="pz-btn-ghost flex-1 min-h-[48px] px-4 py-3 text-[10px] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isAiLoading ? 'Analyzing...' : <><Ic.Sparkle size={16} /> AI</>}
          </button>
          <button
            onClick={() => setShowLibrary(true)}
            className="pz-btn flex-[2] min-h-[48px] px-4 py-3 text-[10px] flex items-center justify-center gap-2 active:scale-95"
          >
            <Ic.Controller size={18} /> Launch Game
          </button>
        </div>
      </div>

      {/* AI Suggestion */}
      {aiSuggestion && (
        <div className="pz-card p-4 text-white relative overflow-hidden" style={{ borderColor: 'rgba(14, 165, 233, 0.5)' }}>
          <div className="absolute top-0 right-0 p-4 opacity-10"><Ic.Controller size={72} /></div>
          <div className="relative z-10">
            <div className="text-[9px] font-black uppercase tracking-widest mb-1 text-[#0ea5e9]">AI Pick for {aiSuggestion.targetHouse}</div>
            <h3 className="text-lg mb-1 text-white">{aiSuggestion.title}</h3>
            <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--pz-text)' }}>{aiSuggestion.description}</p>
            <button onClick={() => setAiSuggestion(null)} className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 font-black text-[9px] uppercase">Dismiss</button>
          </div>
        </div>
      )}

      {/* Active Sessions */}
      <div className="space-y-4">
        {activeSessions.length === 0 ? (
          <div className="border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
            <Ic.Run size={40} className="mx-auto mb-3 block opacity-20 text-white" />
            <h3 className="text-lg text-white/40 mb-3 tracking-tight">No Active Games</h3>
            <button
              onClick={() => setShowLibrary(true)}
              className="pz-btn-ghost px-6 py-3 text-[10px]"
            >
              Open Library
            </button>
          </div>
        ) : (
          activeSessions.map(session => (
            <div key={session.id} className="pz-card overflow-hidden">
              {/* Session Header */}
              <div className="p-4 text-white" style={{ background: 'var(--pz-bg)', borderBottom: '1px solid var(--pz-border)' }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-grow">
                    <div className="text-[9px] font-black uppercase tracking-widest mb-0.5 text-[#CBFE1C]">Coach {session.startedBy}</div>
                    <div className="pz-display text-lg tracking-tight leading-tight truncate">{session.title}</div>
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
              <div className="p-3 max-h-[60vh] overflow-y-auto">
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
        <div className="pz-scope fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 py-4 flex items-center justify-between" style={{ background: 'var(--pz-panel)', borderBottom: '1px solid var(--pz-border)' }}>
            <h2 className="text-lg text-white tracking-tight">Game Library</h2>
            <button
              onClick={() => setShowLibrary(false)}
              aria-label="Close"
              className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 active:scale-95"
            >
              <Ic.XMark size={20} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-grow overflow-y-auto p-4 space-y-4" style={{ background: 'var(--pz-bg)' }}>
            {/* Quick Start Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={openCustomPoints} className="min-h-[52px] p-4 border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-black uppercase text-[10px] tracking-widest active:scale-95 flex items-center justify-center gap-2">
                <Ic.Star size={16} /> Custom Points
              </button>
              <button onClick={openCustomLap} className="min-h-[52px] p-4 border border-sky-500/40 bg-sky-500/10 text-sky-400 font-black uppercase text-[10px] tracking-widest active:scale-95 flex items-center justify-center gap-2">
                <Ic.Timer size={16} /> Lap Timer
              </button>
            </div>

            {/* Game List */}
            <div className="space-y-3 pb-4">
              {availableGames.length === 0 ? (
                <div className="text-center py-12 font-bold" style={{ color: 'var(--pz-text)' }}>Loading Library...</div>
              ) : (
                combinedLibrary.map(g => (
                  <div
                    key={g.gameKey}
                    onClick={() => openDrillConfig(g)}
                    className="pz-card-sm p-4 active:border-[#CBFE1C] active:bg-white/5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[9px] font-black text-[#CBFE1C] uppercase tracking-widest">{g.category}</span>
                          {isNfcGame(g) && <NfcBadge />}
                        </div>
                        <div className="pz-display text-base text-white mb-1">{g.displayName}</div>
                        <p className="text-xs line-clamp-1" style={{ color: 'var(--pz-text)' }}>{g.rules[0]}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setGuideGame(g); }}
                        aria-label={`Rules & guide for ${g.displayName}`}
                        className="touch-btn flex-shrink-0 w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 active:scale-95 active:text-[#CBFE1C]"
                      >
                        <Ic.Note size={18} />
                      </button>
                    </div>
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
        <div className="pz-scope fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 py-4 flex items-center justify-between" style={{ background: 'var(--pz-panel)', borderBottom: '1px solid var(--pz-border)' }}>
            <div className="min-w-0">
              <h2 className="text-lg text-white tracking-tight">Configure Game</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#CBFE1C] flex items-center gap-2">
                {pendingGame.displayName}
                {isNfcGame(pendingGame) && <NfcBadge />}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setGuideGame(pendingGame)}
                className="touch-btn min-h-[44px] px-3 bg-white/5 border border-white/10 text-white/70 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 active:scale-95"
              >
                <Ic.Note size={14} /> Rules
              </button>
              <button
                onClick={() => setPendingGame(null)}
                aria-label="Close"
                className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 active:scale-95"
              >
                <Ic.XMark size={20} />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-grow overflow-y-auto p-4 space-y-4" style={{ background: 'var(--pz-bg)' }}>
            {/* Game Title */}
            <div className="pz-card-sm p-4">
              <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: 'var(--pz-text)' }}>Game Title</label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-[#171C27] p-3 border border-white/10 font-bold text-white placeholder-white/40 text-sm focus:border-[#CBFE1C] outline-none"
                placeholder={pendingGame.displayName}
              />
            </div>

            {/* Duration */}
            <div className="pz-card-sm p-4">
              <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: 'var(--pz-text)' }}>Duration (Minutes)</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="10"
                  className="flex-grow bg-[#171C27] p-3 border border-white/10 font-black text-2xl text-[#CBFE1C] placeholder-white/30 text-center focus:border-[#CBFE1C] outline-none"
                />
                <span className="text-sm font-black uppercase" style={{ color: 'var(--pz-text)' }}>min</span>
              </div>
            </div>

            {/* Athletes */}
            <div className="pz-card-sm p-4 pb-6">
              <div className="flex justify-between items-center mb-3">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Athletes ({selectedRoster.size})</label>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedRoster(new Set(students.map(s => s.id)))} className="text-[9px] font-black text-[#CBFE1C] uppercase">All</button>
                  <span className="text-white/20">|</span>
                  <button onClick={() => setSelectedRoster(new Set())} className="text-[9px] font-black text-white/40 uppercase">Clear</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-1">
                {students.map(s => (
                  <div
                    key={s.id}
                    onClick={() => toggleStudent(s.id)}
                    className={`p-2 border transition-all active:scale-95 ${
                      selectedRoster.has(s.id)
                        ? 'bg-[#171C27] border-[#CBFE1C] text-white'
                        : 'bg-white/5 border-white/10 text-white/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${selectedRoster.has(s.id) ? 'bg-[#CBFE1C]' : 'bg-white/20'}`} />
                      <div className="min-w-0 flex-grow">
                        <div className="text-[10px] font-black truncate">{s.fullName}</div>
                        {s.gamerTag && (
                          <div className={`text-[8px] truncate ${selectedRoster.has(s.id) ? 'text-white/60' : 'text-white/40'}`}>@{s.gamerTag}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 p-4 flex gap-3" style={{ background: 'var(--pz-panel)', borderTop: '1px solid var(--pz-border)' }}>
            <button onClick={() => setPendingGame(null)} className="pz-btn-ghost flex-1 py-4 text-xs active:scale-95">Cancel</button>
            <button
              onClick={handleFinalLaunch}
              disabled={isLaunching || selectedRoster.size === 0}
              className="pz-btn flex-[2] py-4 text-xs active:scale-95 disabled:opacity-50"
            >
              {isLaunching ? 'Launching...' : 'Start Game'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Rules & guide sheet (opens over the library or config views) */}
      {guideGame && <GameGuideSheet game={guideGame} onClose={() => setGuideGame(null)} />}
    </section>
  );
};

export default DrillLauncher;
