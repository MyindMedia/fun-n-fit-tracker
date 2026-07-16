
import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, Cell, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { supabaseService } from '../services/supabaseService';
import { House, NotificationEvent, Student, TimeRange, HouseId, Rank } from '../types';
import { HOUSES, APP_LOGO_URL } from '../constants';
import GameOverlay from './GameOverlay';
import CurrentMatchups from './Leaderboard/CurrentMatchups';
import StudentProfileModal from './StudentProfileModal';
import { AudioService } from '../utils/audio';
import CelebrationOverlay, { Celebration } from './CelebrationOverlay';
import StudentAvatar from './StudentAvatar';
import { useRef } from 'react';
import { getStudentDisplayName } from '../utils/studentDisplay';

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
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white py-3 z-[120] border-t border-white/10 overflow-hidden flex items-center">
       <div className="whitespace-nowrap flex animate-ticker-infinite">
          {repeatedEvents.map((e, i) => {
            const isKey = isKeyUpdate(e);
            const isNew = highlightedIds.has(String(e.id)) && i < playerEvents.length; // highlight only first pass
            return (
              <div
                key={`${e.id}-${i}`}
                className={`flex items-center gap-4 px-12 border-r border-white/10 relative ${
                  isNew && isKey ? 'bg-slate-800' : ''
                }`}
              >
                {isNew && isKey && (
                  <div className="absolute inset-0 border-2 border-emerald-500 animate-flash-border pointer-events-none" />
                )}
                <span className="text-brand-blue font-black uppercase text-[10px] tracking-widest">
                  {new Date(e.timestamp).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}
                </span>

                {/* Show badge image for BADGE_EARNED events */}
                {e.type === 'BADGE_EARNED' && e.badge?.icon && (
                  <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-emerald-400 p-1 flex items-center justify-center shrink-0">
                    <img src={e.badge.icon} className="w-full h-full object-contain" alt="Badge" />
                  </div>
                )}

                {/* Show rank icon for RANK_UP events */}
                {e.type === 'RANK_UP' && e.rank?.icon && (
                  <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-yellow-400 p-1 flex items-center justify-center shrink-0">
                    <img src={e.rank.icon} className="w-full h-full object-contain" alt="Rank" />
                  </div>
                )}
                {/* Show trophy for GAME_END */}
                {e.type === 'GAME_END' && (
                  <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-yellow-400 p-1 flex items-center justify-center shrink-0">
                    <span className="text-yellow-400">🏆</span>
                  </div>
                )}

                {/* Amount pill for POINTS updates */}
                {e.type === 'POINTS' && typeof e.amount === 'number' && (
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 border ${e.amount >= 0 ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-red-500/20 border-red-400 text-red-300'}`}>
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
                  <span className={`text-xs font-bold tracking-wide ${isNew && isKey ? 'text-emerald-400' : 'text-white'}`}>
                    {e.type === 'RANK_UP' && '🏆 '}
                    {e.type === 'BADGE_EARNED' && '⭐ '}
                    {e.type === 'POINTS' && '💪 '}
                    {e.type === 'GAME_END' && '🏁 '}
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
  );
};

const Leaderboard: React.FC = () => {
  const [houses, setHouses] = useState<House[]>([]);
  const [topStudents, setTopStudents] = useState<Student[]>([]);
  const [recentEvents, setRecentEvents] = useState<NotificationEvent[]>([]);
  const [pointFlash, setPointFlash] = useState<{ id: string; amount: number; name: string; message: string; avatar?: string; xPos: number } | null>(null);
  const [statusFlash, setStatusFlash] = useState<{ id: string; isOut: boolean; name: string; avatar?: string; xPos: number } | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Student | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCelebration, setCurrentCelebration] = useState<Celebration | null>(null);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [highlightedHouse, setHighlightedHouse] = useState<HouseId | null>(null);
  const [houseGlow, setHouseGlow] = useState<Record<string, 'up' | 'down' | null>>({});
  const [drillLeaderboard, setDrillLeaderboard] = useState<{students: Student[], houses: Record<HouseId, number>} | null>(null);
  const [activeGameTitle, setActiveGameTitle] = useState<string | null>(null);
  const lastRankById = useRef<Record<string, string>>({});
  const lastHousePointsRef = useRef<Record<string, number>>({});
  const lastLevelUpSoundTs = useRef<number>(0);

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

      // Fetch game leaderboard if there's an active game
      if (activeSessions && activeSessions.length > 0) {
        const activeGame = activeSessions[0];
        setActiveGameTitle(activeGame.title);
        try {
          const drillData = await supabaseService.getDrillLeaderboard(activeGame.id);
          setDrillLeaderboard(drillData);
        } catch (err) {
          console.error('Failed to fetch drill leaderboard:', err);
        }
      } else {
        setActiveGameTitle(null);
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
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-10 gap-6 md:gap-8 overflow-y-auto relative bg-slate-50">
      <GameOverlay />
      {/* Floating Point Bubble */}
      {pointFlash && (
        <div className="fixed inset-0 z-[700] pointer-events-none overflow-hidden">
          <div
            className={`absolute -translate-x-1/2 ${
              pointFlash.amount >= 0 ? 'animate-points-float-up' : 'animate-points-break-fall'
            }`}
            style={{
              left: `${pointFlash.xPos}%`,
              top: '50%'
            }}
          >
            <div className={`
              flex items-center gap-4 px-7 py-5 rounded-full border-[6px] shadow-2xl
              ${pointFlash.amount >= 0
                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-300 animate-sparkle-burst'
                : 'bg-gradient-to-br from-red-500 to-red-700 border-red-400 animate-red-pulse'
              }
            `}>
              {/* Avatar - 40% larger */}
              {pointFlash.avatar ? (
                <img src={pointFlash.avatar} className="w-[68px] h-[68px] rounded-full border-[3px] border-white shadow-lg object-cover" />
              ) : (
                <div className="w-[68px] h-[68px] rounded-full bg-white/30 flex items-center justify-center text-4xl">
                  {pointFlash.amount >= 0 ? '⭐' : '💔'}
                </div>
              )}

              {/* Name & Message - 40% larger */}
              <div className="flex flex-col">
                <div className="text-white text-2xl font-black uppercase tracking-wide drop-shadow">
                  {pointFlash.name}
                </div>
                <div className="text-white/90 text-sm font-semibold">{pointFlash.message}</div>
              </div>

              {/* Points Badge - 40% larger */}
              <div className={`
                px-6 py-3 rounded-full text-4xl font-black ml-2
                ${pointFlash.amount >= 0 ? 'bg-white text-emerald-600' : 'bg-white text-red-600'}
              `}>
                {pointFlash.amount >= 0 ? '+' : ''}{pointFlash.amount}
              </div>

              {/* Sparkles for positive - larger */}
              {pointFlash.amount >= 0 && (
                <>
                  <div className="absolute -top-3 -left-3 text-3xl animate-ping">✨</div>
                  <div className="absolute -top-2 -right-3 text-2xl animate-ping" style={{ animationDelay: '0.15s' }}>⭐</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Floating Status Bubble (IN/OUT) */}
      {statusFlash && (
        <div className="fixed inset-0 z-[700] pointer-events-none overflow-hidden">
          <div
            className={`absolute -translate-x-1/2 ${
              statusFlash.isOut ? 'animate-points-break-fall' : 'animate-points-float-up'
            }`}
            style={{
              left: `${statusFlash.xPos}%`,
              top: '50%'
            }}
          >
            <div className={`
              flex items-center gap-4 px-7 py-5 rounded-full border-[6px] shadow-2xl
              ${statusFlash.isOut
                ? 'bg-gradient-to-br from-red-500 to-red-700 border-red-400 animate-red-pulse'
                : 'bg-gradient-to-br from-blue-400 to-blue-600 border-blue-300 animate-sparkle-burst'
              }
            `}>
              {/* Avatar */}
              {statusFlash.avatar ? (
                <img src={statusFlash.avatar} className="w-[68px] h-[68px] rounded-full border-[3px] border-white shadow-lg object-cover" />
              ) : (
                <div className="w-[68px] h-[68px] rounded-full bg-white/30 flex items-center justify-center text-4xl">
                  {statusFlash.isOut ? '🚫' : '✅'}
                </div>
              )}

              {/* Name */}
              <div className="flex flex-col">
                <div className="text-white text-2xl font-black uppercase tracking-wide drop-shadow">
                  {statusFlash.name}
                </div>
                <div className="text-white/90 text-sm font-semibold">
                  {statusFlash.isOut ? 'Marked Out' : 'Back In Game'}
                </div>
              </div>

              {/* Status Badge */}
              <div className={`
                px-6 py-3 rounded-full text-3xl font-black ml-2
                ${statusFlash.isOut ? 'bg-white text-red-600' : 'bg-white text-blue-600'}
              `}>
                {statusFlash.isOut ? 'OUT' : 'IN'}
              </div>

              {/* Visual effects */}
              {statusFlash.isOut ? (
                <div className="absolute -top-2 -right-2 text-3xl">🚫</div>
              ) : (
                <>
                  <div className="absolute -top-3 -left-3 text-3xl animate-ping">✨</div>
                  <div className="absolute -top-2 -right-3 text-2xl animate-ping" style={{ animationDelay: '0.15s' }}>💪</div>
                </>
              )}
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

      <div className="flex flex-col lg:flex-row gap-6 md:gap-8 lg:gap-10">
        <div className="flex-grow flex flex-col gap-6 md:gap-8 min-w-0">
          <div className="bg-white rounded-3xl md:rounded-5xl p-6 md:p-8 lg:p-12 shadow-2xl border border-slate-100 flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-10 gap-4 shrink-0">
               <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-black text-slate-900 tracking-tight uppercase truncate">House Standings</h1>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-xs mt-2">Live Real-time Faction Competition</p>
               </div>
               
            </div>

            <div className="w-full h-[250px] sm:h-[280px] md:h-[320px] lg:h-[380px]">
              {isLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-brand-blue mx-auto mb-4"></div>
                    <p className="text-slate-400 font-bold">Loading standings...</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center px-8">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h3 className="text-xl font-black text-red-500 mb-2">Error Loading Data</h3>
                    <p className="text-slate-600 mb-4">{error}</p>
                    <button
                      onClick={refreshData}
                      className="px-6 py-3 bg-brand-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {!isLoading && !error && chartData.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center px-8">
                    <div className="text-6xl mb-4">🏃‍♂️</div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Ready to Start!</h3>
                    <p className="text-slate-400 font-medium">No houses configured. Check your database setup.</p>
                  </div>
                </div>
              )}

              {!isLoading && !error && chartData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 60, right: 30, left: 20, bottom: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={({ x, y, payload }) => {
                        const house = houses.find(h => h.name === payload.value);
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <image x={-48} y={0} width={96} height={96} xlinkHref={house?.customIcon} className="drop-shadow-md" />
                          </g>
                        );
                      }}
                    />
                    <Bar dataKey="points" radius={[12, 12, 0, 0]} isAnimationActive={false}>
                      {chartData.map((entry, index) => {
                        const house = houses.find(h => h.name === entry.name);
                        const isHighlighted = house && !!houseGlow[house.id];
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            filter={isHighlighted ? 'url(#glow)' : undefined}
                            opacity={isHighlighted ? 1 : 0.95}
                          />
                        );
                      })}
                      <LabelList
                         dataKey="points"
                         position="top"
                         content={({ x, y, width, value, index }) => {
                           const entry = chartData[index];
                           const house = houses.find(h => h.name === entry.name);
                          const glow = (house && houseGlow[house.id]) || null;
                          const glowColor = glow === 'up' ? 'emerald' : glow === 'down' ? 'red' : null;
                          const cx = Number(x) + Number(width) / 2;
                          const cy = Number(y) - 24;
                          return (
                            <g>
                              {glowColor && (
                                <circle cx={cx} cy={cy} r={22} fill="#ffffff" filter={`url(#${glowColor === 'emerald' ? 'greenGlow' : 'redGlow'})`} />
                              )}
                              <text
                                x={cx}
                                y={cy + 4}
                                textAnchor="middle"
                                className={`text-3xl font-display font-black fill-slate-900`}
                              >
                                {Number(value).toLocaleString()}
                              </text>
                            </g>
                          );
                        }}
                      />
                    </Bar>
                    <defs>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                      <filter id="greenGlow">
                        <feGaussianBlur stdDeviation="12" result="blur" />
                        <feFlood flood-color="#10b981" flood-opacity="0.4" />
                        <feComposite in2="blur" operator="in" />
                        <feMerge>
                          <feMergeNode />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <filter id="redGlow">
                        <feGaussianBlur stdDeviation="12" result="blur" />
                        <feFlood flood-color="#ef4444" flood-opacity="0.4" />
                        <feComposite in2="blur" operator="in" />
                        <feMerge>
                          <feMergeNode />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-96 flex flex-col gap-4 md:gap-6 shrink-0">
          <div className="bg-slate-900 rounded-3xl md:rounded-4xl p-4 md:p-6 shadow-2xl border border-white/10 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/20 blur-3xl -mr-16 -mt-16 group-hover:bg-brand-blue/40 transition-all duration-700" />
             <h2 className="text-white text-base md:text-lg font-display font-black mb-4 md:mb-5 uppercase tracking-tight flex items-center gap-2">
                <span className="text-yellow-400">👑</span> Hall of Fame
             </h2>
             <div className="space-y-2 md:space-y-3">
                {topStudents.map((s, idx) => {
                  const studentRank = ranks.find(r => r.id === s.rankId);
                  return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedProfile(s)}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer group/item active:scale-95"
                  >
                     <div className="relative shrink-0">
                        <StudentAvatar
                          student={s}
                          rank={studentRank}
                          size="md"
                        />
                        <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center text-[10px] font-black shadow-lg">
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
                                <div className="text-white/50 text-[10px] truncate">{displayName.secondary}</div>
                              )}
                            </>
                          );
                        })()}
                        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: HOUSES[s.houseId]?.colorHex }}>{HOUSES[s.houseId]?.name}</div>
                     </div>
                     <div className="text-right">
                        <div className="text-brand-blue font-display font-black text-lg">{s.points.toLocaleString()}</div>
                        <div className="text-[8px] font-black text-white/30 uppercase">Points</div>
                     </div>
                  </div>
                );
                })}
                {topStudents.length === 0 && <div className="text-center py-10 text-white/20 text-xs italic">Awaiting champions...</div>}
             </div>
          </div>

          {/* GAME LEADERBOARD - Shows current game standings */}
          {drillLeaderboard && activeGameTitle && (
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl md:rounded-4xl p-4 md:p-6 shadow-2xl border border-emerald-400/20 relative overflow-hidden animate-fade-in max-h-[450px] flex flex-col">
               <div className="absolute top-0 left-0 w-full h-full bg-white/5 backdrop-blur-sm" />
               <div className="relative z-10 overflow-y-auto custom-scrollbar pr-2">
                 <div className="flex items-center gap-2 mb-3 md:mb-4">
                   <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50" />
                   <h2 className="text-white text-sm md:text-base lg:text-lg font-display font-black uppercase tracking-tight">
                     Live Game
                   </h2>
                 </div>

                 <div className="bg-white/10 backdrop-blur-md rounded-xl md:rounded-2xl p-2.5 md:p-3 mb-3 md:mb-4 border border-white/20">
                   <div className="text-white/80 text-[8px] md:text-[9px] font-black uppercase tracking-widest mb-0.5">Current Game</div>
                   <div className="text-white font-display font-black text-base md:text-xl">{activeGameTitle}</div>
                 </div>

                {/* House Standings for Current Game */}
                 <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4">
                   <div className="text-white/80 text-[9px] md:text-[10px] font-black uppercase tracking-widest">House Scores</div>
                  {Object.entries(drillLeaderboard.houses)
                    .sort(([,a], [,b]) => Number(b) - Number(a))
                    .map(([houseId, points], idx) => {
                       const house = HOUSES[houseId as HouseId];
                       if (!house) return null;
                       return (
                         <div key={houseId} className="bg-white/10 backdrop-blur-md rounded-xl md:rounded-2xl p-2 md:p-3 border border-white/20 flex items-center gap-2 md:gap-3">
                           <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-white/20 text-white flex items-center justify-center text-[9px] md:text-[10px] font-black shrink-0">
                             {idx + 1}
                           </div>
                           <img src={house.customIcon} className="w-6 h-6 md:w-8 md:h-8 shrink-0" alt={house.name} />
                           <div className="flex-grow min-w-0">
                             <div className="text-white font-black text-xs md:text-sm truncate">{house.name}</div>
                           </div>
                           <div className="text-white font-display font-black text-base md:text-lg shrink-0">{points}</div>
                         </div>
                       );
                     })}
                 </div>

                {/* Top 3 Students in Current Game */}
                 {drillLeaderboard.students.length > 0 && (
                   <div className="space-y-1.5 md:space-y-2">
                     <div className="text-white/80 text-[9px] md:text-[10px] font-black uppercase tracking-widest">Top Performers</div>
                     {drillLeaderboard.students.slice(0, 3).map((s, idx) => {
                       const studentRank = ranks.find(r => r.id === s.rankId);
                       return (
                         <div key={s.id} className="bg-white/10 backdrop-blur-md rounded-xl md:rounded-2xl p-2 md:p-3 border border-white/20 flex items-center gap-2 md:gap-3">
                           <div className="relative shrink-0">
                             <StudentAvatar student={s} rank={studentRank} size="sm" />
                             <div className="absolute -top-1 -left-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center text-[8px] md:text-[9px] font-black shadow-lg">
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
                                     <div className="text-white/50 text-[8px] truncate">{displayName.secondary}</div>
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
