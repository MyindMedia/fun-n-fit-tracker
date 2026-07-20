
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GameSession, Student, GameDefinition, RelayConfig } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { HOUSES, GAME_LIBRARY } from '../../constants';
import OneHandScorer from './OneHandScorer';
import EndGameAwards from './EndGameAwards';
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

// Relay Race is configured (individual/team, time-trial/placements) before launch.
const isRelayGame = (g: GameDefinition): boolean => g.templateId === 'TEMPLATE_RELAY';

const DEFAULT_RELAY: RelayConfig = {
  mode: 'INDIVIDUAL',
  scoring: 'TIME_TRIAL',
  headToHead: false,
  attempts: 1,
  teams: [],
};

const NfcBadge: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => (
  <span
    className={`inline-flex items-center gap-1 font-black uppercase tracking-widest text-[#CBFE1C] bg-[#CBFE1C]/10 border border-[#CBFE1C]/40 ${
      size === 'sm' ? 'text-[8px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1'
    }`}
  >
    <Ic.Nfc size={size === 'sm' ? 10 : 13} /> NFC
  </span>
);

/* Accordion section for the guide sheet. Defined at module scope with its own
   open state: components created inside a render get a fresh identity on every
   parent re-render, which remounts the subtree and snaps native <details>
   closed (the admin re-renders constantly on live events — sections appeared
   to "flash" open then collapse). */
const GuideSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; initialOpen?: boolean }> = ({ title, icon, children, initialOpen }) => {
  const [open, setOpen] = useState(!!initialOpen);
  return (
    <details open={open} className="pz-card-sm group" style={{ background: 'var(--pz-panel-2)' }}>
      <summary
        onClick={(e) => { e.preventDefault(); setOpen(o => !o); }}
        className="flex items-center justify-between gap-3 p-4 min-h-[52px] cursor-pointer list-none select-none"
      >
        <span className="flex items-center gap-2.5 text-white font-black uppercase tracking-wider text-xs">
          <span className="text-[#CBFE1C]">{icon}</span> {title}
        </span>
        <span className={`text-white/40 transition-transform ${open ? 'rotate-90' : ''}`}><Ic.ChevronRight size={16} /></span>
      </summary>
      <div className="px-4 pb-4 text-sm leading-relaxed" style={{ color: 'var(--pz-text)' }}>
        {children}
      </div>
    </details>
  );
};

const GuideList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="space-y-2">
    {items.map((item, i) => (
      <li key={i} className="flex gap-2.5">
        <span className="text-[#CBFE1C] flex-shrink-0 mt-0.5"><Ic.ChevronRight size={13} /></span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

/* Mobile-first rules & guide sheet: every game's full playbook in
   stable accordion sections with huge taps and clean reading. */
const GameGuideSheet: React.FC<{ game: GameDefinition; onClose: () => void }> = ({ game, onClose }) => {
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

        <GuideSection title="How to play" icon={<Ic.Controller size={16} />} initialOpen>
          <GuideList items={game.rules} />
        </GuideSection>

        <GuideSection title="Setup" icon={<Ic.ClipboardCheck size={16} />}>
          {game.setupSteps.length > 0 ? <GuideList items={game.setupSteps} /> : <p>No setup needed — just gather the players.</p>}
          {game.equipmentChecklist.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1.5">Equipment</div>
              <GuideList items={game.equipmentChecklist} />
            </div>
          )}
        </GuideSection>

        <GuideSection title="Scoring" icon={<Ic.Bolt size={16} />}>
          <p>{game.scoringRules}</p>
        </GuideSection>

        <GuideSection title="Penalties & tie-breaker" icon={<Ic.Warning size={16} />}>
          <p><span className="text-white/80 font-bold">Penalties:</span> {game.penalties}</p>
          <p className="mt-2"><span className="text-white/80 font-bold">Tie-breaker:</span> {game.tieBreaker}</p>
        </GuideSection>

        <GuideSection title="Safety & accessibility" icon={<Ic.CheckCircle size={16} />}>
          <p><span className="text-white/80 font-bold">Safety:</span> {game.safetyNotes}</p>
          <p className="mt-2"><span className="text-white/80 font-bold">Adaptations:</span> {game.accessibilityVariants}</p>
        </GuideSection>

        {isNfcGame(game) && (
          <GuideSection title="NFC bands" icon={<Ic.Nfc size={16} />}>
            <p>
              Fully automatic. Launch this game and pick <span className="text-white/80 font-bold">NFC Bands</span>{' '}
              as the game mode — from that moment every wristband tap routes itself to this game and the rules decide
              what it means: {game.leaderboardMetric === 'time'
                ? 'taps clock laps and splits per player'
                : 'each tap banks points instantly'}. Absent kids are checked in on their first tap. Nothing to open,
              nothing to configure. (Pick <span className="text-white/80 font-bold">Manual</span> instead if you're
              playing without bands.)
            </p>
          </GuideSection>
        )}
      </div>
    </div>,
    document.body
  );
};

const fmtClock = (totalSeconds: number) => {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

// Session Timer Component. Both readouts freeze while the game is paused:
// the clock anchors to the pause moment (pausedAt), completed pauses are
// excluded from elapsed via pausedMs, and resume() extends endTime on the
// server so the countdown picks up exactly where it froze.
const SessionTimer: React.FC<{ session: GameSession }> = ({ session }) => {
  const [now, setNow] = useState(Date.now());
  const paused = session.pausedAt != null;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const anchor = paused ? (session.pausedAt as number) : now;
  const elapsed = Math.floor((anchor - session.startTime - (session.pausedMs ?? 0)) / 1000);
  const remaining = Math.ceil((session.endTime - anchor) / 1000);

  return (
    <>
      <div className={`bg-white/10 px-3 py-2 rounded-xl border border-white/10 flex flex-col items-center ${paused ? 'opacity-40' : ''}`}>
        <span className="text-[8px] font-black uppercase opacity-50">Time</span>
        <span className="text-sm font-black tabular-nums">{fmtClock(elapsed)}</span>
      </div>
      <div className={`bg-white/10 px-3 py-2 rounded-xl border border-white/10 flex flex-col items-center ${paused ? 'opacity-40' : ''}`}>
        <span className="text-[8px] font-black uppercase opacity-50">Left</span>
        <span className="text-sm font-black tabular-nums">{fmtClock(remaining)}</span>
      </div>
    </>
  );
};

const DrillLauncher: React.FC<DrillLauncherProps> = ({ adminName, students }) => {
  const [activeSessions, setActiveSessions] = useState<GameSession[]>([]);
  const [showLibrary, setShowLibrary] = useState<boolean>(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [showBulkAward, setShowBulkAward] = useState(false);
  const [wrapUpSession, setWrapUpSession] = useState<GameSession | null>(null);

  // Dynamic Game Data
  const [availableGames, setAvailableGames] = useState<GameDefinition[]>([]);
  const [customTitle, setCustomTitle] = useState('');

  // Drill Configuration State
  const [pendingGame, setPendingGame] = useState<GameDefinition | null>(null);
  const [guideGame, setGuideGame] = useState<GameDefinition | null>(null);
  const [selectedRoster, setSelectedRoster] = useState<Set<string>>(new Set());
  const [customDuration, setCustomDuration] = useState<string>('10');
  // NFC-capable games must pick a mode before launch; manual-only games skip it
  const [captureMode, setCaptureMode] = useState<'MANUAL' | 'NFC' | null>(null);
  // Relay Race launch config (only used when the pending game is a relay)
  const [relayCfg, setRelayCfg] = useState<RelayConfig | null>(null);

  useEffect(() => {
    const refreshSessions = () => {
      supabaseService.getActiveGames().then(games => {
        const now = Date.now();
        // A paused game's endTime is frozen, so it can drift past "now" while
        // the coach holds the pause. Never filter paused games out locally.
        const stillActive = games.filter(g => now < g.endTime || g.pausedAt != null);
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
        const stillActive = prev.filter(g => now < g.endTime || g.pausedAt != null);
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
    setCaptureMode(isNfcGame(game) ? null : 'MANUAL');
    setRelayCfg(isRelayGame(game) ? { ...DEFAULT_RELAY, teams: [] } : null);
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

  const openRelayRace = () => {
    openDrillConfig({
      gameKey: 'RELAY_RACE', displayName: 'Relay Race', category: 'Speed', houseTraitFocus: 'Mixed', minPlayers: 1, maxPlayers: 200, recommendedAgeBand: '5-18', durationDefaultSeconds: 600, equipmentChecklist: ['Cones', 'Baton (optional)'], setupSteps: ['Pick individual or team mode', 'Mark start/finish'], rules: ['Coach times each runner or team with the millisecond stopwatch', 'Best time counts across a player\'s attempts'], scoringRules: 'Time Trial ranks by best time (50/30/20 podium, 10 each finisher); Placements let the coach set 1st/2nd/3rd', penalties: 'None', tieBreaker: 'Fastest recorded time', safetyNotes: 'Clear running lanes', accessibilityVariants: 'Shorter legs, same handoff', coachScriptShort: 'Ready, set, GO!', dataCaptureFields: ['lap_time'], leaderboardMetric: 'time', templateId: 'TEMPLATE_RELAY'
    } as GameDefinition);
  };

  // ── Relay config helpers (team builder + toggles) ──────────────────────────
  const updateRelay = (patch: Partial<RelayConfig>) =>
    setRelayCfg(prev => (prev ? { ...prev, ...patch } : prev));

  const addRelayTeam = () =>
    setRelayCfg(prev => {
      if (!prev) return prev;
      const teams = prev.teams ?? [];
      return { ...prev, teams: [...teams, { name: `Team ${teams.length + 1}`, memberIds: [] }] };
    });

  const removeRelayTeam = (index: number) =>
    setRelayCfg(prev => {
      if (!prev) return prev;
      return { ...prev, teams: (prev.teams ?? []).filter((_, i) => i !== index) };
    });

  const renameRelayTeam = (index: number, name: string) =>
    setRelayCfg(prev => {
      if (!prev) return prev;
      const teams = (prev.teams ?? []).map((t, i) => (i === index ? { ...t, name } : t));
      return { ...prev, teams };
    });

  // A student belongs to at most one team: toggling on removes them from others.
  const toggleTeamMember = (index: number, studentId: string) =>
    setRelayCfg(prev => {
      if (!prev) return prev;
      const teams = (prev.teams ?? []).map((t, i) => {
        if (i === index) {
          const has = t.memberIds.includes(studentId);
          return { ...t, memberIds: has ? t.memberIds.filter(id => id !== studentId) : [...t.memberIds, studentId] };
        }
        return { ...t, memberIds: t.memberIds.filter(id => id !== studentId) };
      });
      return { ...prev, teams };
    });

  const toggleStudent = (id: string) => {
    const next = new Set(selectedRoster);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedRoster(next);
  };

  const handleFinalLaunch = async () => {
    if (!pendingGame || isLaunching) return;
    const isRelay = isRelayGame(pendingGame);

    // For team relays the roster is the union of every team's members; other
    // games use the selected athletes directly.
    let rosterIds: string[] = Array.from(selectedRoster);
    if (isRelay && relayCfg && relayCfg.mode === 'TEAM') {
      const teams = relayCfg.teams ?? [];
      const withMembers = teams.filter(t => t.memberIds.length > 0);
      if (withMembers.length === 0) {
        alert('Add at least one team with members before starting the relay.');
        return;
      }
      const ids = new Set<string>();
      withMembers.forEach(t => t.memberIds.forEach(id => ids.add(id)));
      rosterIds = Array.from(ids);
    }

    if (rosterIds.length === 0) {
      alert("Please select at least one athlete to participate.");
      return;
    }
    if (isNfcGame(pendingGame) && !captureMode) {
      alert('Pick a game mode first: Manual or NFC Bands.');
      return;
    }
    const durationNum = parseInt(customDuration || '0', 10);
    if (!durationNum || durationNum <= 0) {
      alert('Please enter a valid session duration in minutes (> 0).');
      return;
    }

    // Persist only teams that actually have members.
    const relayToSend = isRelay && relayCfg
      ? { ...relayCfg, teams: relayCfg.mode === 'TEAM' ? (relayCfg.teams ?? []).filter(t => t.memberIds.length > 0) : [] }
      : undefined;

    setIsLaunching(true);
    try {
      console.log(`Launching Game: ${pendingGame.displayName} with ${rosterIds.length} athletes.`);
      await supabaseService.startGame(
        pendingGame.gameKey,
        adminName,
        rosterIds,
        durationNum * 60,
        customTitle.trim() || undefined,
        captureMode ?? 'MANUAL',
        relayToSend
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

      {wrapUpSession && (
        <EndGameAwards
          session={wrapUpSession}
          students={students}
          adminName={adminName}
          onClose={() => setWrapUpSession(null)}
        />
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
          activeSessions.map(session => {
            const isPaused = session.pausedAt != null;
            return (
            <div key={session.id} className="pz-card overflow-hidden">
              {/* Session Header */}
              <div className="p-4 text-white" style={{ background: 'var(--pz-bg)', borderBottom: '1px solid var(--pz-border)' }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-grow">
                    <div className="text-[9px] font-black uppercase tracking-widest mb-0.5 text-[#CBFE1C]">Coach {session.startedBy}</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="pz-display text-lg tracking-tight leading-tight truncate">{session.title}</div>
                      {isPaused && (
                        <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 text-[#CBFE1C] bg-[#CBFE1C]/10 border border-[#CBFE1C]/40">
                          Paused
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        if (isPaused) await supabaseService.resumeGame(session.id);
                        else await supabaseService.pauseGame(session.id);
                        const sessions = await supabaseService.getActiveGames();
                        setActiveSessions(sessions);
                      }}
                      className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase active:scale-95 flex items-center gap-1.5 ${
                        isPaused
                          ? 'bg-[#CBFE1C] text-[#0B0E13] hover:brightness-110'
                          : 'bg-white/10 border border-white/15 text-white hover:bg-white/20'
                      }`}
                    >
                      {isPaused ? (
                        <>
                          <span aria-hidden className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-current" />
                          Resume
                        </>
                      ) : (
                        <>
                          <span aria-hidden className="flex gap-[3px]">
                            <span className="w-[3px] h-[11px] bg-current" />
                            <span className="w-[3px] h-[11px] bg-current" />
                          </span>
                          Pause
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setWrapUpSession(session)}
                      className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase shrink-0 active:scale-95 border border-white/10"
                    >
                      Awards
                    </button>
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
                </div>
                <div className="flex gap-2">
                  <SessionTimer session={session} />
                  <div className="bg-white/10 px-3 py-2 rounded-xl border border-white/10 flex flex-col items-center">
                    <span className="text-[8px] font-black uppercase opacity-50">Athletes</span>
                    <span className="text-sm font-black">{session.roster.length}</span>
                  </div>
                </div>
              </div>

              {/* Scorer, locked while the game is paused */}
              <div className="p-3 max-h-[60vh] overflow-y-auto">
                {isPaused && (
                  <div className="mb-2 px-3 py-2 border border-[#CBFE1C]/40 bg-[#CBFE1C]/10 text-[#CBFE1C] text-[9px] font-black uppercase tracking-widest text-center">
                    Paused. Scoring is off until you resume.
                  </div>
                )}
                <div className={isPaused ? 'pointer-events-none opacity-40 select-none' : undefined}>
                  <OneHandScorer
                    session={session}
                    students={students}
                    adminName={adminName}
                    gameLibrary={combinedLibrary}
                  />
                </div>
              </div>
            </div>
          );})
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
              <button onClick={openRelayRace} className="col-span-2 min-h-[52px] p-4 border border-[#CBFE1C]/40 bg-[#CBFE1C]/10 text-[#CBFE1C] font-black uppercase text-[10px] tracking-widest active:scale-95 flex items-center justify-center gap-2">
                <Ic.Trophy size={16} /> Relay Race
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
            {/* Game Mode — required for NFC-capable games */}
            {isNfcGame(pendingGame) && (
              <div className="pz-card-sm p-4" style={!captureMode ? { borderColor: 'rgba(203,254,28,0.45)' } : undefined}>
                <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: 'var(--pz-text)' }}>
                  Game Mode {!captureMode && <span className="text-[#CBFE1C]">— pick one to start</span>}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCaptureMode('MANUAL')}
                    className={`touch-btn min-h-[64px] p-3 border-2 text-left transition-all active:scale-[0.98] ${
                      captureMode === 'MANUAL' ? 'border-[#CBFE1C] bg-[#CBFE1C]/10' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className={`text-xs font-black uppercase tracking-wide ${captureMode === 'MANUAL' ? 'text-[#CBFE1C]' : 'text-white'}`}>Manual</div>
                    <div className="text-[9px] mt-1 leading-tight" style={{ color: 'var(--pz-text)' }}>Coach scores by hand — no bands needed</div>
                  </button>
                  <button
                    onClick={() => setCaptureMode('NFC')}
                    className={`touch-btn min-h-[64px] p-3 border-2 text-left transition-all active:scale-[0.98] ${
                      captureMode === 'NFC' ? 'border-[#CBFE1C] bg-[#CBFE1C]/10' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className={`text-xs font-black uppercase tracking-wide inline-flex items-center gap-1.5 ${captureMode === 'NFC' ? 'text-[#CBFE1C]' : 'text-white'}`}>
                      <Ic.Nfc size={14} /> NFC Bands
                    </div>
                    <div className="text-[9px] mt-1 leading-tight" style={{ color: 'var(--pz-text)' }}>
                      Fully automatic — taps {pendingGame.leaderboardMetric === 'time' ? 'clock laps & splits' : 'bank points'} for every player
                    </div>
                  </button>
                </div>
              </div>
            )}

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

            {/* Relay Race setup */}
            {isRelayGame(pendingGame) && relayCfg && (
              <div className="pz-card-sm p-4 space-y-4" style={{ borderColor: 'rgba(203,254,28,0.35)' }}>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#CBFE1C] flex items-center gap-1.5">
                  <Ic.Trophy size={13} /> Relay Setup
                </div>

                {/* Mode: Individual or Team */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--pz-text)' }}>Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['INDIVIDUAL', 'TEAM'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => updateRelay({ mode: m })}
                        className={`min-h-[44px] p-2 border-2 text-xs font-black uppercase tracking-wide active:scale-[0.98] ${relayCfg.mode === m ? 'border-[#CBFE1C] bg-[#CBFE1C]/10 text-[#CBFE1C]' : 'border-white/10 bg-white/5 text-white'}`}
                      >
                        {m === 'INDIVIDUAL' ? 'Individual' : 'Team'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scoring: Time Trial or Placements */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--pz-text)' }}>Scoring</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['TIME_TRIAL', 'PLACEMENTS'] as const).map(sc => (
                      <button
                        key={sc}
                        onClick={() => updateRelay({ scoring: sc })}
                        className={`min-h-[44px] p-2 border-2 text-xs font-black uppercase tracking-wide active:scale-[0.98] ${relayCfg.scoring === sc ? 'border-[#CBFE1C] bg-[#CBFE1C]/10 text-[#CBFE1C]' : 'border-white/10 bg-white/5 text-white'}`}
                      >
                        {sc === 'TIME_TRIAL' ? 'Time Trial' : 'Placements'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Head-to-head toggle */}
                <button
                  onClick={() => updateRelay({ headToHead: !relayCfg.headToHead })}
                  className="w-full flex items-center justify-between gap-2 min-h-[44px] px-3 border-2 active:scale-[0.99] transition-colors"
                  style={{
                    borderColor: relayCfg.headToHead ? '#CBFE1C' : 'rgba(255,255,255,0.1)',
                    background: relayCfg.headToHead ? 'rgba(203,254,28,0.1)' : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <span className={`text-xs font-black uppercase tracking-wide ${relayCfg.headToHead ? 'text-[#CBFE1C]' : 'text-white'}`}>Head-to-Head</span>
                  <span className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-all ${relayCfg.headToHead ? 'bg-[#CBFE1C] justify-end' : 'bg-white/15 justify-start'}`}>
                    <span className="w-4 h-4 rounded-full bg-[#0B0E13]" />
                  </span>
                </button>

                {/* Attempts (individual only); best time counts */}
                {relayCfg.mode === 'INDIVIDUAL' && (
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--pz-text)' }}>Attempts per player (best time counts)</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateRelay({ attempts: Math.max(1, relayCfg.attempts - 1) })}
                        className="w-11 h-11 rounded-lg bg-white/10 border border-white/15 text-white font-black text-lg active:scale-95"
                      >
                        −
                      </button>
                      <div className="flex-1 text-center text-2xl font-black text-[#CBFE1C]">{relayCfg.attempts}</div>
                      <button
                        onClick={() => updateRelay({ attempts: Math.min(9, relayCfg.attempts + 1) })}
                        className="w-11 h-11 rounded-lg bg-white/10 border border-white/15 text-white font-black text-lg active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Team builder (team mode) */}
                {relayCfg.mode === 'TEAM' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Teams ({(relayCfg.teams ?? []).length})</label>
                      <button onClick={addRelayTeam} className="text-[9px] font-black text-[#CBFE1C] uppercase tracking-wider active:scale-95">+ Add Team</button>
                    </div>
                    {(relayCfg.teams ?? []).length === 0 ? (
                      <div className="text-[10px] text-white/40 font-bold text-center py-3 border border-dashed border-white/15">
                        Add a team, then tap athletes to add them.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {(relayCfg.teams ?? []).map((team, ti) => (
                          <div key={ti} className="border border-white/10 bg-white/5 p-2.5">
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="text"
                                value={team.name}
                                onChange={(e) => renameRelayTeam(ti, e.target.value)}
                                className="flex-1 bg-[#171C27] px-2 py-1.5 border border-white/10 font-bold text-white text-xs focus:border-[#CBFE1C] outline-none"
                                placeholder={`Team ${ti + 1}`}
                              />
                              <span className="text-[9px] font-black text-white/40">{team.memberIds.length}</span>
                              <button onClick={() => removeRelayTeam(ti)} aria-label="Remove team" className="w-8 h-8 rounded bg-red-500/15 text-red-400 flex items-center justify-center active:scale-95">
                                <Ic.XMark size={14} />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {students.map(s => {
                                const on = team.memberIds.includes(s.id);
                                return (
                                  <button
                                    key={s.id}
                                    onClick={() => toggleTeamMember(ti, s.id)}
                                    className={`text-[9px] font-bold px-2 py-1 border active:scale-95 ${on ? 'bg-[#CBFE1C] text-[#0B0E13] border-[#CBFE1C]' : 'bg-white/5 text-white/60 border-white/10'}`}
                                  >
                                    {s.gamerTag || s.fullName?.split(' ')[0] || 'Player'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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

            {/* Athletes. Team relays build their roster from the teams above */}
            {!(isRelayGame(pendingGame) && relayCfg?.mode === 'TEAM') && (
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
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 p-4 flex gap-3" style={{ background: 'var(--pz-panel)', borderTop: '1px solid var(--pz-border)' }}>
            <button onClick={() => setPendingGame(null)} className="pz-btn-ghost flex-1 py-4 text-xs active:scale-95">Cancel</button>
            <button
              onClick={handleFinalLaunch}
              disabled={
                isLaunching ||
                (isNfcGame(pendingGame) && !captureMode) ||
                (isRelayGame(pendingGame) && relayCfg?.mode === 'TEAM'
                  ? !(relayCfg.teams ?? []).some(t => t.memberIds.length > 0)
                  : selectedRoster.size === 0)
              }
              className="pz-btn flex-[2] py-4 text-xs active:scale-95 disabled:opacity-50"
            >
              {isLaunching
                ? 'Launching...'
                : isNfcGame(pendingGame) && !captureMode
                  ? 'Pick a game mode'
                  : captureMode === 'NFC'
                    ? 'Start Game · NFC Auto'
                    : 'Start Game'}
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
