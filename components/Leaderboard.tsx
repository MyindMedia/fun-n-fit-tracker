
import React, { useEffect, useState, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { House, NotificationEvent, Student, TimeRange, HouseId, Rank, GameSession } from '../types';
import { HOUSES, APP_LOGO_URL } from '../constants';
import GameOverlay from './GameOverlay';
import CurrentMatchups from './Leaderboard/CurrentMatchups';
import StudentProfileModal from './StudentProfileModal';
import { AudioService } from '../utils/audio';
import CelebrationOverlay, { Celebration } from './CelebrationOverlay';
import StudentAvatar from './StudentAvatar';
import { useRef } from 'react';
import { getStudentDisplayName } from '../utils/studentDisplay';
import { gameCenter } from '../services/gameCenter';
import { medalColor } from './TrophyCase';
import { Ic } from './icons';
import { gearItem, GEAR_RANK_COLORS } from '../gearCatalog';
import { pzDelay } from './useReveal';

// Pubzi theme: small notched cut-corner shape for inline elements
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

const ActivityTicker: React.FC<{ events: NotificationEvent[] }> = ({ events }) => {
  // Filter: show achievements and manual points, exclude attendance/system noise; include game winners
  const playerEvents = events.filter(e => {
    if (e.type === 'POINTS') {
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('checked in') || msg.includes('marked absent') || msg.includes('roll call reset') || msg.includes('launch')) {
        return false;
      }
      return true;
    }
    return e.type === 'RANK_UP' || e.type === 'BADGE_EARNED' || e.type === 'GAME_END';
  });
  // Ephemeral highlights for newly added items only
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());

  // Helper to determine if event is a key update (all filtered events are key updates)
  const isKeyUpdate = (event: NotificationEvent) => {
    return event.type === 'RANK_UP' || event.type === 'BADGE_EARNED' || event.type === 'POINTS' || event.type === 'GAME_END';
  };

  useEffect(() => {
    if (playerEvents.length === 0) return;
    const currentIds: Set<string> = new Set(playerEvents.map(e => String(e.id)));
    const newIds: string[] = [];
    currentIds.forEach(id => { if (!prevIdsRef.current.has(id)) newIds.push(id); });
    if (newIds.length > 0) {
      setHighlightedIds(prev => {
        const next = new Set(prev);
        newIds.forEach(id => next.add(id));
        return next;
      });
      setTimeout(() => {
        setHighlightedIds(prev => {
          const next = new Set(prev);
          newIds.forEach(id => next.delete(id));
          return next;
        });
      }, 5000);
    }
    prevIdsRef.current = currentIds;
  }, [playerEvents]);

  if (playerEvents.length === 0) return null;

  // Duplicate events multiple times for seamless infinite loop
  const repeatedEvents = [...playerEvents, ...playerEvents, ...playerEvents, ...playerEvents];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[120] pz-scope flex items-stretch overflow-hidden"
      style={{ background: 'var(--pz-panel)', borderTop: '1px solid var(--pz-border)' }}
    >
      {/* Broadcast lower-third station tag */}
      <div
        className="shrink-0 relative z-10 flex items-center gap-2 pl-4 pr-7 pz-display text-xs"
        style={{ background: 'var(--pz-volt)', color: '#0B0E13', clipPath: 'polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%)' }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: '#0B0E13' }} />
        Live
      </div>
      <div className="flex-1 overflow-hidden flex items-center py-3">
        <div className="whitespace-nowrap flex animate-ticker-infinite">
          {repeatedEvents.map((e, i) => {
            const isKey = isKeyUpdate(e);
            const isNew = highlightedIds.has(String(e.id)) && i < playerEvents.length; // highlight only first pass
            return (
              <div
                key={`${e.id}-${i}`}
                className="flex items-center gap-4 px-12 relative"
                style={{
                  borderRight: '1px solid var(--pz-border)',
                  background: isNew && isKey ? 'var(--pz-panel-2)' : undefined
                }}
              >
                {isNew && isKey && (
                  <div className="absolute inset-0 border-2 border-emerald-500 animate-flash-border pointer-events-none" />
                )}
                <span className="font-bold uppercase text-[10px] tracking-widest" style={{ color: 'var(--pz-text)' }}>
                  {new Date(e.timestamp).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}
                </span>

                {/* Show badge image for BADGE_EARNED events */}
                {e.type === 'BADGE_EARNED' && e.badge?.icon && (
                  <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-emerald-400 p-1 flex items-center justify-center shrink-0">
                    <img src={e.badge.icon} className="w-full h-full object-contain" alt="Badge" />
                  </div>
                )}

                {/* Show rank icon for RANK_UP events */}
                {e.type === 'RANK_UP' && e.rank?.icon && (
                  <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-yellow-400 p-1 flex items-center justify-center shrink-0">
                    <img src={e.rank.icon} className="w-full h-full object-contain" alt="Rank" />
                  </div>
                )}
                {/* Show trophy for GAME_END */}
                {e.type === 'GAME_END' && (
                  <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-yellow-400 p-1 flex items-center justify-center shrink-0">
                    <span className="text-yellow-400 flex items-center"><Ic.Trophy size={16} /></span>
                  </div>
                )}

                {/* Amount pill for POINTS updates */}
                {e.type === 'POINTS' && typeof e.amount === 'number' && (
                  <div
                    className={`px-2 py-0.5 text-[10px] font-black shrink-0 border ${e.amount >= 0 ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-red-500/20 border-red-400 text-red-300'}`}
                    style={{ clipPath: NOTCH_SM }}
                  >
                    {e.amount >= 0 ? '+' : ''}{e.amount}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {/* Player name in bold */}
                  {e.studentName && (
                    <span className="text-sm font-black text-white uppercase tracking-wide">
                      {e.studentName}
                    </span>
                  )}
                  {/* Event message */}
                  <span className="text-xs font-bold tracking-wide inline-flex items-center gap-1.5" style={{ color: isNew && isKey ? '#34d399' : 'var(--pz-text)' }}>
                    {e.type === 'RANK_UP' && <Ic.Trophy size={14} className="shrink-0" />}
                    {e.type === 'BADGE_EARNED' && <Ic.Star size={14} className="shrink-0" />}
                    {e.type === 'POINTS' && <Ic.Muscle size={14} className="shrink-0" />}
                    {e.type === 'GAME_END' && <Ic.Flag size={14} className="shrink-0" />}
                    {e.message}
                  </span>
                  {isNew && isKey && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-2" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Leaderboard: React.FC = () => {
  const [houses, setHouses] = useState<House[]>([]);
  const [topStudents, setTopStudents] = useState<Student[]>([]);
  const [recentEvents, setRecentEvents] = useState<NotificationEvent[]>([]);
  const [pointFlash, setPointFlash] = useState<{ id: string; amount: number; name: string; message: string; avatar?: string; xPos: number } | null>(null);
  const [statusFlash, setStatusFlash] = useState<{ id: string; isOut: boolean; name: string; avatar?: string; xPos: number } | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Student | null>(null);
  const [houseDetail, setHouseDetail] = useState<{ house: House; students: Student[] } | null>(null);
  // Today is the main board: fresh start at zero every day before sessions.
  const [timeRange, setTimeRange] = useState<TimeRange>('DAY');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCelebration, setCurrentCelebration] = useState<Celebration | null>(null);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [highlightedHouse, setHighlightedHouse] = useState<HouseId | null>(null);
  const [houseGlow, setHouseGlow] = useState<Record<string, 'up' | 'down' | null>>({});
  const [drillLeaderboard, setDrillLeaderboard] = useState<{students: Student[], houses: Record<HouseId, number>} | null>(null);
  const [activeGameTitle, setActiveGameTitle] = useState<string | null>(null);
  // Coach pause: mirrors pausedAt on the first active session (mapSession
  // carries pausedAt/pausedMs through both getActiveGames and the live
  // active_games_update subscription, which re-emits on every patch).
  const [activeGamePaused, setActiveGamePaused] = useState(false);
  // Global point boost + recent coach medals (Legends wall)
  const [boostMult, setBoostMult] = useState(1);
  const [medalWall, setMedalWall] = useState<Array<{ _id: string; key: string; title: string; fullName: string; houseId: HouseId | null; avatarUrl: string | null; awardedBy: string; createdAt: number }>>([]);
  useEffect(() => gameCenter.subscribePointMultiplier(setBoostMult), []);
  const lastRankById = useRef<Record<string, string>>({});
  const lastHousePointsRef = useRef<Record<string, number>>({});
  const lastLevelUpSoundTs = useRef<number>(0);
  // One-shot broadcast entrance (presentation only): `.pz-in` is applied
  // declaratively once the first load settles, so the banner/cards/panel play
  // their staggered reveal exactly once. Anything mounting afterwards (leader
  // swaps, reorders, polling refreshes) renders with `.pz-in` already present
  // — instantly visible, never re-animated on the projector.
  const [entranceIn, setEntranceIn] = useState(false);
  useEffect(() => {
    if (entranceIn || isLoading) return;
    // Let the hidden state paint for one frame so the transition runs.
    const raf = requestAnimationFrame(() => setEntranceIn(true));
    return () => cancelAnimationFrame(raf);
  }, [entranceIn, isLoading]);
  const revealCls = entranceIn ? 'pz-reveal pz-in' : 'pz-reveal';

  // Deduplicated level-up sound - only plays if not played in last 3 seconds
  const playLevelUpOnce = () => {
    const now = Date.now();
    if (now - lastLevelUpSoundTs.current > 3000) {
      lastLevelUpSoundTs.current = now;
      AudioService.playLevelUp();
    }
  };

  const refreshData = async (showLoadingState = false) => {
    try {
      // Only show loading spinner on initial load, not on updates
      if (showLoadingState) {
        setIsLoading(true);
      }
      setError(null);
      const [{ houses: h, topStudents: ts }, events, ranksData, activeSessions] = await Promise.all([
        supabaseService.getLeaderboardData(timeRange),
        supabaseService.getGlobalActivity(),
        supabaseService.getRanks(),
        supabaseService.getActiveGames()
      ]);

      // Check for point increases to trigger highlights
      h.forEach(newHouse => {
        const prev = lastHousePointsRef.current[newHouse.id] ?? null;
        if (prev !== null && prev !== undefined && newHouse.totalPoints !== prev) {
          const change: 'up' | 'down' = newHouse.totalPoints > prev ? 'up' : 'down';
          setHouseGlow(g => ({ ...g, [newHouse.id]: change }));
          setTimeout(() => setHouseGlow(g => ({ ...g, [newHouse.id]: null })), 2000);
        }
        lastHousePointsRef.current[newHouse.id] = newHouse.totalPoints;
      });

      setHouses(h);
      setTopStudents(ts);
      setRecentEvents(events);
      setRanks(ranksData);
      ts.forEach(s => { lastRankById.current[s.id] = s.rankId; });

      // Legends wall — latest coach medals
      try {
        setMedalWall(await gameCenter.recentMedals(6) as any);
      } catch (err) {
        console.warn('Failed to load medal wall:', err);
      }

      // Fetch game leaderboard if there's an active game
      if (activeSessions && activeSessions.length > 0) {
        const activeGame = activeSessions[0];
        setActiveGameTitle(activeGame.title);
        setActiveGamePaused(activeGame.pausedAt != null);
        try {
          const drillData = await supabaseService.getDrillLeaderboard(activeGame.id);
          setDrillLeaderboard(drillData);
        } catch (err) {
          console.error('Failed to fetch drill leaderboard:', err);
        }
      } else {
        setActiveGameTitle(null);
        setActiveGamePaused(false);
        setDrillLeaderboard(null);
      }
    } catch (err: any) {
      console.error(`Leaderboard refresh failed: ${err?.message || err}`);
      setError(err?.message || 'Failed to load leaderboard data. Please check your internet connection.');
    } finally {
      if (showLoadingState) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    // Initial load shows loading spinner
    refreshData(true);
    try {
      const raw = localStorage.getItem('rank_up_event');
      if (raw) {
        const cele = JSON.parse(raw);
        if (cele && Date.now() - (cele.ts || 0) < 15000) {
          AudioService.playCongratulations();
          setCurrentCelebration(cele);
          localStorage.removeItem('rank_up_event');
        }
      }
    } catch (err) {
      console.warn('Failed to load rank-up event from localStorage:', err);
    }

    // REAL-TIME UPDATES: Event-driven updates for instant changes
    const u1 = supabaseService.on('points_update', async (updatedStudent: Student) => {
      // Detect rank-up even if notifications table is missing
      try {
        const ranksData = await supabaseService.getRanks();
        const prevRankId = lastRankById.current[updatedStudent.id];
        console.log('👤 Points update for:', updatedStudent.fullName, 'prevRank:', prevRankId, 'newRank:', updatedStudent.rankId);
        if (prevRankId && prevRankId !== updatedStudent.rankId) {
          const prevRank = ranksData.find(r => r.id === prevRankId);
          const newRank = ranksData.find(r => r.id === updatedStudent.rankId);
          console.log('🔄 Rank changed!', prevRank?.name, '→', newRank?.name);
          if (prevRank && newRank && newRank.threshold > prevRank.threshold) {
            console.log('🎉 TRIGGERING RANK-UP CELEBRATION!', updatedStudent.fullName, '→', newRank.name);
            AudioService.playCongratulations();
            setCurrentCelebration({
              type: 'RANK_UP',
              studentName: updatedStudent.fullName,
              achievement: newRank.name,
              studentAvatar: updatedStudent.avatarUrl,
              rankIcon: newRank.icon
            });
          }
        }
        lastRankById.current[updatedStudent.id] = updatedStudent.rankId;
      } catch (err) {
        console.warn('Rank change detection failed:', err);
      }
      refreshData(false);
    });
    const u2 = supabaseService.on('notification', async (e) => {
      setRecentEvents(prev => [e, ...prev].slice(0, 20));
      // Points bubbles are handled by points_broadcast for better sync
      if (e.type === 'RANK_UP') {
        playLevelUpOnce();
        // Load student and rank to show avatar and icon in overlay
        try {
          const [students, ranksData] = await Promise.all([
            supabaseService.getStudents(),
            supabaseService.getRanks()
          ]);
          const stu = students.find(s => s.id === e.studentId);
          const rank = stu ? ranksData.find(r => r.id === stu.rankId) : null;
          // Extract rank name fallback from message
          const rankMatch = (e.message || '').match(/Promoted to (.+?)!/);
          const rankName = rankMatch ? rankMatch[1] : (rank?.name ?? 'New Rank');
          setCurrentCelebration({
            type: 'RANK_UP',
            studentName: stu?.fullName || e.studentName || 'Student',
            achievement: rankName,
            studentAvatar: stu?.avatarUrl,
            rankIcon: rank?.icon
          });
        } catch (err) {
          console.warn('Failed to load student/rank data for celebration:', err);
          const rankMatch = (e.message || '').match(/Promoted to (.+?)!/);
          const rankName = rankMatch ? rankMatch[1] : 'New Rank';
          setCurrentCelebration({
            type: 'RANK_UP',
            studentName: e.studentName || 'Student',
            achievement: rankName
          });
        }
      }
      if (e.type === 'BADGE_EARNED') {
        AudioService.playBadgeEarned();
        // Extract badge name from message (e.g., "Achievement Unlocked: Speed Demon!")
        const badgeMatch = e.message.match(/Achievement Unlocked: (.+?)!/);
        const badgeName = badgeMatch ? badgeMatch[1] : 'New Badge';
        setCurrentCelebration({
          type: 'BADGE_EARNED',
          studentName: e.studentName || 'Student',
          achievement: badgeName,
          studentAvatar: e.avatarUrl,
          badgeIcon: e.badge?.icon
        });
      }
    });
    const u5 = supabaseService.on('rank_up_broadcast', (cele: Celebration) => {
      console.log('📢 Received rank_up_broadcast event:', cele);
      playLevelUpOnce();
      setCurrentCelebration(cele);
    });

    // Listen for instant point broadcasts (faster than Postgres realtime)
    const u6 = supabaseService.on('points_broadcast', async (data: { studentId: string; studentName: string; amount: number; message: string; ts: number }) => {
      console.log('📢 Received points_broadcast event:', data);
      try { if (data.amount > 0) AudioService.playRandomAward(); else AudioService.playPointLost(); } catch (err) { console.warn('Audio playback failed:', err); }

      // Find student avatar
      const student = topStudents.find(s => s.id === data.studentId);
      const id = String(`${data.ts}-${Math.random()}`);

      // Random horizontal position: left(15%), left-center(30%), center(50%), right-center(70%), right(85%)
      const positions = [15, 30, 50, 70, 85];
      const xPos = positions[Math.floor(Math.random() * positions.length)];

      // Show floating bubble
      setPointFlash({ id, amount: data.amount, name: data.studentName, message: data.message, avatar: student?.avatarUrl, xPos });
      setTimeout(() => setPointFlash(null), 2500);

      // Refresh data to update leaderboard
      refreshData(false);
    });

    // Listen for player IN/OUT status changes
    const u7 = supabaseService.on('player_status', async (data: { sessionId: string; studentId: string; isOut: boolean }) => {
      console.log('📢 Received player_status event:', data);

      // Find student info
      const student = topStudents.find(s => s.id === data.studentId);
      if (!student) return; // Only show bubble if we know the student

      const id = String(`status-${Date.now()}-${Math.random()}`);
      const positions = [15, 30, 50, 70, 85];
      const xPos = positions[Math.floor(Math.random() * positions.length)];

      // Play appropriate sound
      try {
        if (data.isOut) {
          AudioService.playWarningBeep();
        } else {
          AudioService.playCountdownBeep();
        }
      } catch (err) {
        console.warn('Audio playback failed:', err);
      }

      // Show floating status bubble
      const displayName = student.gamerTag || student.fullName?.split(' ')[0] || 'Player';
      setStatusFlash({ id, isOut: data.isOut, name: displayName, avatar: student.avatarUrl, xPos });
      setTimeout(() => setStatusFlash(null), 2500);
    });
    const u3 = supabaseService.on('game_end', async (data: any) => {
      refreshData(false);

      // Show game end celebration with winning house and MVP
      if (data?.results) {
        const students = await supabaseService.getStudents();
        const winningHouse = data.results.winningHouseId ? HOUSES[data.results.winningHouseId as HouseId] : null;
        const mvpStudent = students.find(s => s.id === data.results.mvpStudentId);

        if (winningHouse || mvpStudent) {
          AudioService.playWinnerFanfare();
          setCurrentCelebration({
            type: 'GAME_END',
            studentName: '', // Not used for game end
            achievement: '', // Not used for game end
            gameTitle: data.game?.title || 'Game Complete',
            winningHouseName: winningHouse?.name,
            winningHouseIcon: winningHouse?.customIcon,
            winningHouseColor: winningHouse?.colorHex,
            mvpName: mvpStudent?.fullName,
            mvpAvatar: mvpStudent?.avatarUrl
          });
        }
      }
    });
    const u4 = supabaseService.on('game_start', () => refreshData(false));
    // Live pause state: games.active re-emits on every patch, so a coach
    // pause/resume lands here immediately with pausedAt on the mapped session.
    const u8 = supabaseService.on('active_games_update', (rows: GameSession[]) => {
      if (rows && rows.length > 0) {
        setActiveGameTitle(rows[0].title);
        setActiveGamePaused(rows[0].pausedAt != null);
      } else {
        setActiveGamePaused(false);
      }
    });
    const onLocalRankUp = (e: any) => {
      const cele = e?.detail as Celebration;
      if (!cele) return;
      playLevelUpOnce();
      setCurrentCelebration(cele);
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'rank_up_event' && ev.newValue) {
        try {
          const cele = JSON.parse(ev.newValue);
          playLevelUpOnce();
          setCurrentCelebration(cele);
        } catch (err) {
          console.warn('Failed to parse rank-up storage event:', err);
        }
      }
    };
    window.addEventListener('rank-up', onLocalRankUp as any);
    window.addEventListener('storage', onStorage);
    const onLocalGameEnd = (e: any) => {
      const data = e?.detail;
      if (!data?.results) return;
      AudioService.playWinnerFanfare();
      (async () => {
        const students = await supabaseService.getStudents();
        const winningHouse = data.results.winningHouseId ? HOUSES[data.results.winningHouseId as HouseId] : null;
        const mvpStudent = students.find(s => s.id === data.results.mvpStudentId);
        setCurrentCelebration({
          type: 'GAME_END',
          studentName: '',
          achievement: '',
          gameTitle: data.game?.title || 'Game Complete',
          winningHouseName: winningHouse?.name,
          winningHouseIcon: winningHouse?.customIcon,
          winningHouseColor: winningHouse?.colorHex,
          mvpName: mvpStudent?.fullName,
          mvpAvatar: mvpStudent?.avatarUrl
        });
      })();
    };
    const onStorageGameEnd = (ev: StorageEvent) => {
      if (ev.key === 'game_end_event' && ev.newValue) {
        try {
          const data = JSON.parse(ev.newValue);
          onLocalGameEnd({ detail: data });
        } catch (err) {
          console.warn('Failed to parse game-end storage event:', err);
        }
      }
    };
    window.addEventListener('game-end', onLocalGameEnd as any);
    window.addEventListener('storage', onStorageGameEnd);

    // BACKUP POLLING: Refresh every 10 seconds to ensure live updates always happen
    // This ensures the screen stays live even if real-time events miss something
    const pollingInterval = setInterval(() => {
      console.log('🔄 Live polling refresh...');
      refreshData(false);
    }, 10000); // Every 10 seconds

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
      u8();
      window.removeEventListener('rank-up', onLocalRankUp as any);
      window.removeEventListener('storage', onStorage);
      clearInterval(pollingInterval);
      window.removeEventListener('game-end', onLocalGameEnd as any);
      window.removeEventListener('storage', onStorageGameEnd);
    };
  }, [timeRange]);

  const chartData = useMemo(() => {
    const data = houses.map(h => ({
      name: h.name,
      points: h.totalPoints,
      color: h.colorHex,
      icon: h.customIcon
    })).sort((a, b) => b.points - a.points);
    console.log('📊 Chart Data:', data);
    console.log('🏠 Houses:', houses);
    return data;
  }, [houses]);

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-10 pb-20 md:pb-24 gap-6 md:gap-8 overflow-y-auto relative pz-scope pz-arena">
      <GameOverlay />
      {/* Floating Point Toast (angular broadcast style) */}
      {pointFlash && (
        <div className="fixed inset-0 z-[700] pointer-events-none overflow-hidden pz-scope">
          <div
            className={`absolute -translate-x-1/2 ${
              pointFlash.amount >= 0 ? 'animate-points-float-up' : 'animate-points-break-fall'
            }`}
            style={{
              left: `${pointFlash.xPos}%`,
              top: '50%',
              filter: pointFlash.amount >= 0
                ? 'drop-shadow(0 0 20px rgba(16, 185, 129, 0.45))'
                : 'drop-shadow(0 0 20px rgba(239, 68, 68, 0.45))'
            }}
          >
            <div
              className="pz-card relative flex items-center gap-4 px-6 py-4"
              style={{ borderColor: pointFlash.amount >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)' }}
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-1.5"
                style={{ background: pointFlash.amount >= 0 ? '#10b981' : '#ef4444' }}
              />
              {/* Avatar */}
              {pointFlash.avatar ? (
                <img src={pointFlash.avatar} className="w-[64px] h-[64px] rounded-full border-2 object-cover shrink-0" style={{ borderColor: pointFlash.amount >= 0 ? '#10b981' : '#ef4444' }} />
              ) : (
                <div className={`w-[64px] h-[64px] rounded-full bg-white/10 flex items-center justify-center shrink-0 ${pointFlash.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pointFlash.amount >= 0 ? <Ic.Star size={32} /> : <Ic.XCircle size={32} />}
                </div>
              )}

              {/* Name & Message */}
              <div className="flex flex-col min-w-0">
                <div className="pz-display text-white text-xl md:text-2xl leading-tight truncate">
                  {pointFlash.name}
                </div>
                <div className="text-sm font-semibold" style={{ color: 'var(--pz-text)' }}>{pointFlash.message}</div>
              </div>

              {/* Points readout */}
              <div className={`pz-display text-4xl md:text-5xl ml-2 shrink-0 ${pointFlash.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {pointFlash.amount >= 0 ? '+' : ''}{pointFlash.amount}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Floating Status Toast (IN/OUT) */}
      {statusFlash && (
        <div className="fixed inset-0 z-[700] pointer-events-none overflow-hidden pz-scope">
          <div
            className={`absolute -translate-x-1/2 ${
              statusFlash.isOut ? 'animate-points-break-fall' : 'animate-points-float-up'
            }`}
            style={{
              left: `${statusFlash.xPos}%`,
              top: '50%',
              filter: statusFlash.isOut
                ? 'drop-shadow(0 0 20px rgba(239, 68, 68, 0.45))'
                : 'drop-shadow(0 0 20px rgba(14, 165, 233, 0.45))'
            }}
          >
            <div
              className="pz-card relative flex items-center gap-4 px-6 py-4"
              style={{ borderColor: statusFlash.isOut ? 'rgba(239, 68, 68, 0.7)' : 'rgba(14, 165, 233, 0.7)' }}
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-1.5"
                style={{ background: statusFlash.isOut ? '#ef4444' : '#0ea5e9' }}
              />
              {/* Avatar */}
              {statusFlash.avatar ? (
                <img src={statusFlash.avatar} className="w-[64px] h-[64px] rounded-full border-2 object-cover shrink-0" style={{ borderColor: statusFlash.isOut ? '#ef4444' : '#0ea5e9' }} />
              ) : (
                <div className={`w-[64px] h-[64px] rounded-full bg-white/10 flex items-center justify-center shrink-0 ${statusFlash.isOut ? 'text-red-400' : 'text-sky-400'}`}>
                  {statusFlash.isOut ? <Ic.XCircle size={32} /> : <Ic.CheckCircle size={32} />}
                </div>
              )}

              {/* Name */}
              <div className="flex flex-col min-w-0">
                <div className="pz-display text-white text-xl md:text-2xl leading-tight truncate">
                  {statusFlash.name}
                </div>
                <div className="text-sm font-semibold" style={{ color: 'var(--pz-text)' }}>
                  {statusFlash.isOut ? 'Marked out' : 'Back in the game'}
                </div>
              </div>

              {/* Status readout */}
              <div className={`pz-display text-3xl md:text-4xl ml-2 shrink-0 ${statusFlash.isOut ? 'text-red-400' : 'text-sky-400'}`}>
                {statusFlash.isOut ? 'OUT' : 'IN'}
              </div>
            </div>
          </div>
        </div>
      )}
      <CurrentMatchups />
      {selectedProfile && (
        <StudentProfileModal
          student={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}
      {houseDetail && (
        <div
          className="pz-scope fixed inset-0 z-[9998] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setHouseDetail(null)}
        >
          <div className="pz-card w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-4">
              {houseDetail.house.icon && <img src={houseDetail.house.icon} className="w-16 h-16 shrink-0 object-contain" alt="" />}
              <div className="min-w-0 flex-grow">
                <h2 className="text-2xl leading-none truncate" style={{ color: houseDetail.house.colorHex }}>{houseDetail.house.name}</h2>
                <div className="text-[10px] font-semibold uppercase tracking-[0.25em] mt-1" style={{ color: 'var(--pz-text)' }}>{houseDetail.house.mascot || 'Team'}</div>
              </div>
              <button
                onClick={() => setHouseDetail(null)}
                aria-label="Close"
                className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 text-lg leading-none"
              >×</button>
            </div>
            <div className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--pz-text)' }}>
              {houseDetail.students.length} player{houseDetail.students.length !== 1 ? 's' : ''}
            </div>
            <div className="space-y-2">
              {houseDetail.students.length === 0 ? (
                <div className="text-sm italic py-6 text-center" style={{ color: 'var(--pz-text)' }}>No players on this team yet.</div>
              ) : houseDetail.students.map((s, i) => {
                const studentRank = ranks.find(r => r.id === s.rankId);
                return (
                  <button
                    key={s.id}
                    onClick={() => { setHouseDetail(null); setSelectedProfile(s); }}
                    className="w-full pz-card-sm flex items-center gap-3 p-2.5 hover:border-[#CBFE1C] transition-all cursor-pointer text-left"
                    style={{ background: 'var(--pz-panel-2)' }}
                  >
                    <span className="text-xs font-black w-5 text-center shrink-0" style={{ color: 'var(--pz-text)' }}>{i + 1}</span>
                    <StudentAvatar student={s} rank={studentRank} size="sm" />
                    <span className="flex-grow font-bold text-sm text-white truncate">{s.fullName}</span>
                    <span className="text-sm font-black shrink-0" style={{ color: 'var(--pz-volt)' }}>{s.points}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 md:gap-8 lg:gap-10">
        <div className="flex-grow flex flex-col gap-5 md:gap-6 min-w-0">
          {/* Match board header */}
          <div className="flex flex-row justify-between items-end gap-4 shrink-0 flex-wrap">
            <div className="min-w-0">
              <div className="pz-eyebrow mb-2">
                {timeRange === 'DAY' ? "Today's board — fresh start every day" : timeRange === 'WEEK' ? 'This week on the gym floor' : 'Live from the gym floor'}
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-none tracking-tight">House Standings</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {boostMult > 1 && (
                <div className="pz-card-sm flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ borderColor: 'var(--pz-volt)', background: 'rgba(203,254,28,0.10)' }}>
                  <span style={{ color: 'var(--pz-volt)' }}><Ic.Bolt size={16} /></span>
                  <span className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--pz-volt)' }}>{boostMult}x Points</span>
                </div>
              )}
              {/* Board range: today resets nightly, season is all-time */}
              <div className="pz-card-sm flex items-center p-1 shrink-0">
                {([['DAY', 'Today'], ['WEEK', 'Week'], ['ALL', 'Season']] as Array<[TimeRange, string]>).map(([range, label]) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all"
                    style={timeRange === range
                      ? { background: 'var(--pz-volt)', color: '#0B0E13', clipPath: NOTCH_SM }
                      : { color: 'var(--pz-text)' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="pz-card-sm flex items-center gap-2.5 px-4 py-2.5 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full pz-live" style={{ background: 'var(--pz-volt)' }} />
                <span className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: 'var(--pz-volt)' }}>Live</span>
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="pz-card flex items-center justify-center min-h-[320px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto mb-4" style={{ borderColor: 'var(--pz-volt)' }}></div>
                <p className="font-bold" style={{ color: 'var(--pz-text)' }}>Loading standings...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="pz-card flex items-center justify-center min-h-[320px]" style={{ borderColor: 'rgba(239, 68, 68, 0.5)' }}>
              <div className="text-center px-8 py-10">
                <div className="mb-4 flex justify-center text-red-400"><Ic.Warning size={56} /></div>
                <h3 className="text-xl text-red-400 mb-2">Error Loading Data</h3>
                <p className="mb-6" style={{ color: 'var(--pz-text)' }}>{error}</p>
                <button
                  onClick={refreshData}
                  className="pz-btn px-6 py-3 text-sm"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {!isLoading && !error && chartData.length === 0 && (
            <div className="pz-card flex items-center justify-center min-h-[320px]">
              <div className="text-center px-8 py-10">
                <div className="mb-4 flex justify-center" style={{ color: 'var(--pz-volt)' }}><Ic.Run size={56} /></div>
                <h3 className="text-2xl text-white mb-2">Ready to Start!</h3>
                <p className="font-medium" style={{ color: 'var(--pz-text)' }}>No houses configured. Check your database setup.</p>
              </div>
            </div>
          )}

          {/* House clan banners — rank order reads top to bottom / #1 dominant */}
          {!isLoading && !error && chartData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
              {chartData.map((entry, idx) => {
                const house = houses.find(h => h.name === entry.name);
                const glow = house ? houseGlow[house.id] : null;
                const isLeader = idx === 0;
                const glowFilter = glow === 'up'
                  ? 'drop-shadow(0 0 18px rgba(16, 185, 129, 0.55))'
                  : glow === 'down'
                    ? 'drop-shadow(0 0 18px rgba(239, 68, 68, 0.55))'
                    : isLeader
                      ? 'drop-shadow(0 0 22px rgba(203, 254, 28, 0.16))'
                      : 'none';
                const scoreColor = glow === 'up' ? '#6ee7b7' : glow === 'down' ? '#fca5a5' : '#ffffff';
                return (
                  <div
                    key={entry.name}
                    onClick={async () => {
                      if (!house) return;
                      const all = await supabaseService.getStudents();
                      const roster = all.filter(s => s.houseId === house.id).sort((a, b) => b.points - a.points);
                      setHouseDetail({ house, students: roster });
                    }}
                    className={`${isLeader ? 'md:col-span-3' : ''} cursor-pointer`}
                    style={{ filter: glowFilter, transition: 'filter 0.4s ease' }}
                  >
                    {isLeader ? (
                      /* #1 — the dominant banner */
                      <div
                        className={`pz-card relative flex items-center gap-4 sm:gap-8 p-5 sm:p-8 ${revealCls}`}
                        style={{ borderColor: 'rgba(203, 254, 28, 0.45)' }}
                      >
                        <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: entry.color }} />
                        <img src={entry.icon} alt={entry.name} className="w-20 h-20 sm:w-28 sm:h-28 shrink-0 drop-shadow-lg pz-float" />
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-3 mb-1.5 sm:mb-2.5">
                            <span className="pz-display text-[10px] sm:text-xs px-2.5 py-1" style={{ background: 'var(--pz-volt)', color: '#0B0E13', clipPath: NOTCH_SM }}>#1</span>
                            {house?.mascot && (
                              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] truncate" style={{ color: 'var(--pz-text)' }}>{house.mascot}</span>
                            )}
                          </div>
                          <h2 className="text-2xl sm:text-4xl lg:text-5xl leading-none truncate" style={{ color: entry.color }}>{entry.name}</h2>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="pz-display text-4xl sm:text-6xl lg:text-7xl leading-none" style={{ color: scoreColor, transition: 'color 0.4s ease' }}>
                            {Number(entry.points).toLocaleString()}
                          </div>
                          <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] mt-1 sm:mt-2" style={{ color: 'var(--pz-text)' }}>Points</div>
                        </div>
                      </div>
                    ) : (
                      /* #2–#4 — clearly ranked clan cards */
                      <div className={`pz-card relative h-full flex flex-col p-4 sm:p-5 ${revealCls}`} style={pzDelay(idx * 100)}>
                        <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: entry.color }} />
                        <div className="flex items-center justify-between mb-3">
                          <span className="pz-display text-[10px] px-2 py-1 border" style={{ borderColor: 'var(--pz-border)', color: 'var(--pz-text)', clipPath: NOTCH_SM }}>#{idx + 1}</span>
                          {house?.mascot && (
                            <span className="text-[9px] font-semibold uppercase tracking-[0.25em] truncate" style={{ color: 'var(--pz-text)' }}>{house.mascot}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <img src={entry.icon} alt={entry.name} className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 pz-float-slow" />
                          <div className="min-w-0">
                            <h3 className="text-lg sm:text-xl leading-none truncate" style={{ color: entry.color }}>{entry.name}</h3>
                            <div className="pz-display text-3xl sm:text-4xl mt-1.5 leading-none" style={{ color: scoreColor, transition: 'color 0.4s ease' }}>
                              {Number(entry.points).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-full lg:w-96 flex flex-col gap-4 md:gap-6 shrink-0">
          <div className={`pz-card p-4 md:p-6 relative ${revealCls}`} style={pzDelay(300)}>
            <div className="pz-eyebrow mb-1">Top Players</div>
            <h2 className="text-white text-lg md:text-xl mb-4 md:mb-5">Hall of Fame</h2>
            <div className="space-y-2 md:space-y-3">
              {topStudents.map((s, idx) => {
                const studentRank = ranks.find(r => r.id === s.rankId);
                return (
                <div
                  key={s.id}
                  onClick={() => setSelectedProfile(s)}
                  className="pz-card-sm relative flex items-center gap-3 p-3 hover:border-[#CBFE1C] transition-all cursor-pointer group/item active:scale-95"
                  style={{ background: 'var(--pz-panel-2)' }}
                >
                   <div className="relative shrink-0">
                      <StudentAvatar
                        student={s}
                        rank={studentRank}
                        size="md"
                        showVoltLevel
                      />
                      <div
                        className="absolute -top-2 -left-2 w-6 h-6 flex items-center justify-center text-[10px] font-black shadow-lg"
                        style={idx === 0
                          ? { background: 'var(--pz-volt)', color: '#0B0E13', clipPath: NOTCH_SM }
                          : { background: 'var(--pz-panel)', color: '#ffffff', border: '1px solid var(--pz-border)', clipPath: NOTCH_SM }}
                      >
                         {idx + 1}
                      </div>
                   </div>
                   <div className="flex-grow min-w-0">
                      {(() => {
                        const displayName = getStudentDisplayName(s);
                        return (
                          <>
                            <div className="text-white font-bold text-sm truncate">{displayName.primary}</div>
                            {displayName.secondary && (
                              <div className="text-[10px] truncate" style={{ color: 'var(--pz-text)' }}>{displayName.secondary}</div>
                            )}
                          </>
                        );
                      })()}
                      <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: HOUSES[s.houseId]?.colorHex }}>{HOUSES[s.houseId]?.name}</div>
                      {(() => {
                        const gear = gearItem(s.gearEquipped);
                        if (!gear) return null;
                        return (
                          <div className="flex items-center gap-1 mt-0.5" title={gear.flavor}>
                            <img src={gear.icon} alt="" className="w-4 h-4 object-contain shrink-0" />
                            <span className="text-[9px] font-bold uppercase tracking-wide truncate" style={{ color: GEAR_RANK_COLORS[gear.rank] }}>
                              {gear.name}
                            </span>
                          </div>
                        );
                      })()}
                   </div>
                   <div className="text-right">
                      <div className="pz-display text-white text-lg">{s.points.toLocaleString()}</div>
                      <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Points</div>
                   </div>
                </div>
              );
              })}
              {topStudents.length === 0 && <div className="text-center py-10 text-xs italic" style={{ color: 'var(--pz-text)' }}>Awaiting champions...</div>}
            </div>
          </div>

          {/* LEGENDS WALL — latest coach medals */}
          {medalWall.length > 0 && (
            <div className={`pz-card p-4 md:p-6 relative ${revealCls}`} style={pzDelay(400)}>
              <div className="pz-eyebrow mb-1">Superlatives</div>
              <h2 className="text-white text-lg md:text-xl mb-4">Legends Wall</h2>
              <div className="space-y-2">
                {medalWall.map(m => {
                  const color = medalColor(m.key);
                  return (
                    <div key={m._id} className="pz-card-sm flex items-center gap-3 p-3" style={{ background: 'var(--pz-panel-2)' }}>
                      <div
                        className="w-9 h-9 flex items-center justify-center shrink-0"
                        style={{ background: `${color}1f`, color, clipPath: NOTCH_SM, border: `1px solid ${color}55` }}
                      >
                        <Ic.Medal size={18} />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="text-white font-bold text-sm truncate">{m.fullName}</div>
                        <div className="text-[10px] font-black uppercase tracking-wide truncate" style={{ color }}>{m.title}</div>
                      </div>
                      <div className="text-[9px] font-bold uppercase text-right shrink-0" style={{ color: 'var(--pz-text)' }}>
                        {new Date(m.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* GAME LEADERBOARD - Shows current game standings */}
          {drillLeaderboard && activeGameTitle && (
            <div className="pz-card p-4 md:p-6 relative overflow-hidden animate-fade-in max-h-[450px] flex flex-col" style={{ borderColor: 'rgba(203, 254, 28, 0.35)' }}>
               <div className="relative z-10 overflow-y-auto custom-scrollbar pr-2">
                 <div className="flex items-center gap-2 mb-3 md:mb-4">
                   <span
                     className={`w-2.5 h-2.5 rounded-full shrink-0 ${activeGamePaused ? '' : 'pz-live'}`}
                     style={{ background: 'var(--pz-volt)', opacity: activeGamePaused ? 0.4 : undefined }}
                   />
                   <h2 className="text-white text-sm md:text-base lg:text-lg tracking-tight">
                     Live Game
                   </h2>
                   {activeGamePaused && (
                     <span className="ml-auto shrink-0 text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2 py-1 text-[#CBFE1C] bg-[#CBFE1C]/10 border border-[#CBFE1C]/40">
                       Paused
                     </span>
                   )}
                 </div>

                 <div className="pz-card-sm p-2.5 md:p-3 mb-3 md:mb-4" style={{ background: 'var(--pz-panel-2)' }}>
                   <div className="text-[8px] md:text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: 'var(--pz-text)' }}>Current Game</div>
                   <div className={`pz-display text-white text-base md:text-xl ${activeGamePaused ? 'opacity-60' : ''}`}>{activeGameTitle}</div>
                 </div>

                {/* House Standings for Current Game */}
                 <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4">
                   <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>House Scores</div>
                  {Object.entries(drillLeaderboard.houses)
                    .sort(([,a], [,b]) => Number(b) - Number(a))
                    .map(([houseId, points], idx) => {
                       const house = HOUSES[houseId as HouseId];
                       if (!house) return null;
                       return (
                         <div key={houseId} className="pz-card-sm relative p-2 md:p-3 flex items-center gap-2 md:gap-3" style={{ background: 'var(--pz-panel-2)' }}>
                           <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: house.colorHex }} />
                           <div className="w-5 h-5 md:w-6 md:h-6 bg-white/10 text-white flex items-center justify-center text-[9px] md:text-[10px] font-black shrink-0" style={{ clipPath: NOTCH_SM }}>
                             {idx + 1}
                           </div>
                           <img src={house.customIcon} className="w-6 h-6 md:w-8 md:h-8 shrink-0" alt={house.name} />
                           <div className="flex-grow min-w-0">
                             <div className="text-white font-black text-xs md:text-sm truncate">{house.name}</div>
                           </div>
                           <div className="pz-display text-white text-base md:text-lg shrink-0">{points}</div>
                         </div>
                       );
                     })}
                 </div>

                {/* Top 3 Students in Current Game */}
                 {drillLeaderboard.students.length > 0 && (
                   <div className="space-y-1.5 md:space-y-2">
                     <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Top Performers</div>
                     {drillLeaderboard.students.slice(0, 3).map((s, idx) => {
                       const studentRank = ranks.find(r => r.id === s.rankId);
                       return (
                         <div key={s.id} className="pz-card-sm p-2 md:p-3 flex items-center gap-2 md:gap-3" style={{ background: 'var(--pz-panel-2)' }}>
                           <div className="relative shrink-0">
                             <StudentAvatar student={s} rank={studentRank} size="sm" showVoltLevel />
                             <div
                               className="absolute -top-1 -left-1 w-4 h-4 md:w-5 md:h-5 flex items-center justify-center text-[8px] md:text-[9px] font-black shadow-lg"
                               style={idx === 0
                                 ? { background: 'var(--pz-volt)', color: '#0B0E13', clipPath: NOTCH_SM }
                                 : { background: 'var(--pz-panel)', color: '#ffffff', border: '1px solid var(--pz-border)', clipPath: NOTCH_SM }}
                             >
                               {idx + 1}
                             </div>
                           </div>
                           <div className="flex-grow min-w-0">
                             {(() => {
                               const displayName = getStudentDisplayName(s);
                               return (
                                 <>
                                   <div className="text-white font-bold text-[11px] md:text-xs truncate">{displayName.primary}</div>
                                   {displayName.secondary && (
                                     <div className="text-[8px] truncate" style={{ color: 'var(--pz-text)' }}>{displayName.secondary}</div>
                                   )}
                                 </>
                               );
                             })()}
                             <div className="text-[8px] md:text-[9px] font-black uppercase tracking-widest truncate" style={{ color: HOUSES[s.houseId]?.colorHex }}>{HOUSES[s.houseId]?.name}</div>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}
               </div>
            </div>
          )}
        </div>
      </div>
      <ActivityTicker events={recentEvents} />
    </div>
  );
};

export default Leaderboard;
