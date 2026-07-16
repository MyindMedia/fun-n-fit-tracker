
import React, { useEffect, useState, useRef } from 'react';
import { GameSession, GameResult, Student, Rank } from '../types';
import { supabaseService } from '../services/supabaseService';
import { HOUSES } from '../constants';
import { AudioService } from '../utils/audio';
import { Ic } from './icons';

interface QueuedLevelUp {
  studentId: string;
  studentName: string;
  studentAvatar?: string;
  rankName: string;
  rankIcon?: string;
  ts: number;
}

const GameOverlay: React.FC = () => {
  const [activeGames, setActiveGames] = useState<GameSession[]>([]);
  const [pendingStarts, setPendingStarts] = useState<Array<{ id: string; title: string; startTime: number; endTime: number }>>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [gameResults, setGameResults] = useState<{game: GameSession, results: GameResult}[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [finalCountdownSec, setFinalCountdownSec] = useState<number | null>(null);
  const [showThirtyAlert, setShowThirtyAlert] = useState(false);

  const [gameOverFlash, setGameOverFlash] = useState<Array<{ id: string; title: string }>>([]);
  const [drillLeaderboards, setDrillLeaderboards] = useState<Record<string, {
    students: Array<{ student: Student; drillScore: number }>;
    houses: Record<string, number>;
  }>>({});
  const [outsMap, setOutsMap] = useState<Record<string, Record<string, boolean>>>({});
  const [startUI, setStartUI] = useState<{ title: string; phase: 'title' | 'countdown' | null; text?: string } | null>(null);
  const [confettiPieces, setConfettiPieces] = useState<Array<{ id: string; left: number; top: number; size: number; color: string; delay: number; duration: number }>>([]);

  // Queue for level-ups that happen during games - shown after winner modal
  const [queuedLevelUps, setQueuedLevelUps] = useState<QueuedLevelUp[]>([]);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);

  const gameStates = useRef<Record<string, {
    hasPlayed30Warning: boolean,
    lastAnnouncedSecond: number,
    hasAnnouncedStart: boolean,
    hasAnnouncedGo: boolean,
    hasStopped: boolean,
    hasPlayedStartAudio: boolean,
    hasPlayedGameOverAudio: boolean,
    hasPlayedWinnerAudio: boolean
  }>>({});

  // Latest state mirrored into refs so the mount-only effect below can read fresh
  // values without depending on them (deps of [activeGames, students] made this
  // effect re-run on every fetch, looping forever once the backend responds).
  const activeGamesRef = useRef<GameSession[]>([]);
  const studentsRef = useRef<Student[]>([]);
  useEffect(() => { activeGamesRef.current = activeGames; }, [activeGames]);
  useEffect(() => { studentsRef.current = students; }, [students]);

  useEffect(() => {
    // Ensure audio is ready for game sounds
    AudioService.preload();

    const loadInitialData = async () => {
      const currentGames = await supabaseService.getActiveGames();
      const currentStudents = await supabaseService.getStudents();
      const currentRanks = await supabaseService.getRanks();
      setActiveGames(currentGames);
      setStudents(currentStudents);
      setRanks(currentRanks);
    };
    loadInitialData();

    const unsubStart = supabaseService.on('game_start', (newGame: GameSession) => {
      setActiveGames(prev => [...prev, newGame]);
      try {
        const id = String(newGame.id);
        const localStart = Date.now() + 3000;
        const startTime = Math.max(newGame.startTime, localStart);
        setPendingStarts(prev => [...prev.filter(p => p.id !== id), { id, title: newGame.title, startTime, endTime: newGame.endTime }]);
      } catch (err) {
        console.warn('Failed to process game start:', err);
      }

      // Initialize game state if not exists
      if (!gameStates.current[newGame.id]) {
        gameStates.current[newGame.id] = {
          hasPlayed30Warning: false,
          lastAnnouncedSecond: -1,
          hasAnnouncedStart: false,
          hasAnnouncedGo: false,
          hasStopped: false,
          hasPlayedStartAudio: false,
          hasPlayedGameOverAudio: false,
          hasPlayedWinnerAudio: false
        };
      }

      // Only play audio if not already played for this game
      if (!gameStates.current[newGame.id].hasPlayedStartAudio) {
        gameStates.current[newGame.id].hasPlayedStartAudio = true;
        console.log('🎮 Game starting - announcing title:', newGame.title);

        // Unlock audio context before playing
        AudioService.unlock();

        setStartUI({ title: newGame.title, phase: 'title' });
        // Announce game title with speech
        AudioService.speak(newGame.title, true);

        setTimeout(() => {
          setStartUI({ title: newGame.title, phase: 'countdown', text: '3' });
          console.log('🔊 Playing game start sound');
          AudioService.playGameStartAssetOnly();

          setTimeout(() => {
            setStartUI({ title: newGame.title, phase: 'countdown', text: '2' });
            AudioService.speak('2');
          }, 1000);

          setTimeout(() => {
            setStartUI({ title: newGame.title, phase: 'countdown', text: '1' });
            AudioService.speak('1');
          }, 2000);

          setTimeout(() => {
            setStartUI({ title: newGame.title, phase: 'countdown', text: 'Go!' });
            AudioService.speak('Go!', true);
          }, 3000);

          setTimeout(() => setStartUI(null), 4000);
        }, 1500); // Give speech more time to complete
      }
    });
    const unsubStartCast = supabaseService.on('game_start_broadcast', (d: any) => {
      const id = String(d.id);
      const localStart = Date.now() + 3000;
      const startTime = Math.max(d.startTime || localStart, localStart);
      setPendingStarts(prev => [...prev.filter(p => p.id !== id), { id, title: d.title, startTime, endTime: d.endTime }]);

      // Initialize game state if not exists
      if (!gameStates.current[id]) {
        gameStates.current[id] = {
          hasPlayed30Warning: false,
          lastAnnouncedSecond: -1,
          hasAnnouncedStart: false,
          hasAnnouncedGo: false,
          hasStopped: false,
          hasPlayedStartAudio: false,
          hasPlayedGameOverAudio: false,
          hasPlayedWinnerAudio: false
        };
      }

      // Only play audio if not already played for this game (prevents duplicate from game_start event)
      if (!gameStates.current[id].hasPlayedStartAudio) {
        gameStates.current[id].hasPlayedStartAudio = true;
        console.log('🎮 Game starting (broadcast) - announcing title:', d.title);

        // Unlock audio context before playing
        AudioService.unlock();

        setStartUI({ title: d.title, phase: 'title' });
        // Announce game title with speech
        AudioService.speak(d.title, true);

        setTimeout(() => {
          setStartUI({ title: d.title, phase: 'countdown', text: '3' });
          console.log('🔊 Playing game start sound');
          AudioService.playGameStartAssetOnly();

          setTimeout(() => {
            setStartUI({ title: d.title, phase: 'countdown', text: '2' });
            AudioService.speak('2');
          }, 1000);

          setTimeout(() => {
            setStartUI({ title: d.title, phase: 'countdown', text: '1' });
            AudioService.speak('1');
          }, 2000);

          setTimeout(() => {
            setStartUI({ title: d.title, phase: 'countdown', text: 'Go!' });
            AudioService.speak('Go!', true);
          }, 3000);

          setTimeout(() => setStartUI(null), 4000);
        }, 1500); // Give speech more time to complete
      }
    });
    const unsubStatus = supabaseService.on('player_status', (e: { sessionId: string; studentId: string; isOut: boolean }) => {
      setOutsMap(prev => ({ ...prev, [e.sessionId]: { ...(prev[e.sessionId] || {}), [e.studentId]: e.isOut } }));
    });

    const unsubUpdate = supabaseService.on('active_games_update', (games: GameSession[]) => {
       setActiveGames(games);
       try {
         const now = Date.now();
         const ids = new Set(games.map(g => String(g.id)));
         // Ensure upcoming starts show countdown overlay
         const upcoming = games
           .filter(g => g.startTime > now)
           .map(g => ({ id: String(g.id), title: g.title, startTime: g.startTime, endTime: g.endTime }));
         setPendingStarts(prev => {
           const keep = prev.filter(p => ids.has(p.id) && p.startTime > now);
           const mergedIds = new Set(keep.map(k => k.id));
           const added: typeof keep = [];
         upcoming.forEach(u => { if (!mergedIds.has(u.id)) added.push(u); });
          return [...keep, ...added];
        });
      } catch {}
    });

    const unsubEnd = supabaseService.on('game_end', (data: { game: GameSession, results: GameResult }) => {
      console.log('🏁 Supabase game_end event received:', data.game.id, data.game.title);
      const gameId = String(data.game.id);

      setActiveGames(prev => {
        const filtered = prev.filter(g => g.id !== data.game.id);
        console.log('Removed game from activeGames. Remaining:', filtered.length);
        return filtered;
      });

      // Initialize game state if not exists
      if (!gameStates.current[data.game.id]) {
        gameStates.current[data.game.id] = {
          hasPlayed30Warning: false,
          lastAnnouncedSecond: -1,
          hasAnnouncedStart: false,
          hasAnnouncedGo: false,
          hasStopped: false,
          hasPlayedStartAudio: false,
          hasPlayedGameOverAudio: false,
          hasPlayedWinnerAudio: false
        };
      }

      // Only show game over popup and play audio once
      if (!gameStates.current[data.game.id].hasPlayedGameOverAudio) {
        gameStates.current[data.game.id].hasPlayedGameOverAudio = true;
        console.log('🎵 Playing game over audio for:', data.game.title);

        // Unlock audio before playing
        AudioService.unlock();

        setGameOverFlash(prev => [...prev, { id: gameId, title: data.game.title }]);

        // Play game over audio and wait for it to finish before showing winner
        (async () => {
          try {
            await AudioService.playGameOverLogo();
          } catch (err) {
            console.warn('Game over audio failed:', err);
          }

          // After audio finishes, wait a bit then show winner modal
          setTimeout(() => {
            setGameOverFlash(prev => prev.filter(g => g.id !== gameId));
            setGameResults(prev => [...prev, data]);
          }, 1000);
        })();
      }
    });
    const unsubEndCast = supabaseService.on('game_end_broadcast', (d: any) => {
      const id = String(d.id || '');
      if (id) setActiveGames(prev => prev.filter(g => String(g.id) !== id));
      if (d?.results && d?.game) {
        const gameObj = activeGamesRef.current.find(g => String(g.id) === id) || d.game;

        // Initialize game state if not exists
        if (!gameStates.current[id]) {
          gameStates.current[id] = {
            hasPlayed30Warning: false,
            lastAnnouncedSecond: -1,
            hasAnnouncedStart: false,
            hasAnnouncedGo: false,
            hasStopped: false,
            hasPlayedStartAudio: false,
            hasPlayedGameOverAudio: false,
            hasPlayedWinnerAudio: false
          };
        }

        // Only show game over popup and play audio once (prevents duplicate from game_end event)
        if (!gameStates.current[id].hasPlayedGameOverAudio) {
          gameStates.current[id].hasPlayedGameOverAudio = true;
          const title = (gameObj as any)?.title || d.game.title;
          console.log('🎵 Playing game over audio (broadcast) for:', title);

          // Unlock audio before playing
          AudioService.unlock();

          setGameOverFlash(prev => [...prev, { id, title }]);

          // Play game over audio and wait for it to finish before showing winner
          (async () => {
            try {
              await AudioService.playGameOverLogo();
            } catch (err) {
              console.warn('Game over audio failed:', err);
            }

            // After audio finishes, wait a bit then show winner modal
            setTimeout(() => {
              setGameOverFlash(prev => prev.filter(g => g.id !== id));
              setGameResults(prev => [...prev, { game: gameObj as GameSession, results: d.results }]);
            }, 1000);
          })();
        }
      }
    });

    // Listen for rank-ups during active games - queue them to show after winner screen
    const unsubRankUp = supabaseService.on('rank_up_broadcast', async (cele: any) => {
      // Only queue if there's an active game
      if (activeGamesRef.current.length > 0) {
        console.log('🎖️ Queuing level-up during game:', cele);
        const stu = studentsRef.current.find(s => s.id === cele.studentId) || (cele.studentName ? null : null);
        setQueuedLevelUps(prev => {
          // Avoid duplicates
          if (prev.some(q => q.studentId === cele.studentId && Date.now() - q.ts < 5000)) return prev;
          return [...prev, {
            studentId: cele.studentId || '',
            studentName: cele.studentName || stu?.fullName || 'Athlete',
            studentAvatar: cele.studentAvatar || stu?.avatarUrl,
            rankName: cele.achievement || 'New Rank',
            rankIcon: cele.rankIcon,
            ts: Date.now()
          }];
        });
      }
    });

    const unsubNotifRankUp = supabaseService.on('notification', async (e: any) => {
      if (e.type !== 'RANK_UP') return;
      // Only queue if there's an active game
      if (activeGamesRef.current.length > 0) {
        console.log('🎖️ Queuing level-up (notification) during game:', e);
        const stu = studentsRef.current.find(s => s.id === e.studentId);
        const rankMatch = (e.message || '').match(/Promoted to (.+?)!/);
        const rankName = rankMatch ? rankMatch[1] : 'New Rank';
        setQueuedLevelUps(prev => {
          // Avoid duplicates
          if (prev.some(q => q.studentId === e.studentId && Date.now() - q.ts < 5000)) return prev;
          return [...prev, {
            studentId: e.studentId || '',
            studentName: e.studentName || stu?.fullName || 'Athlete',
            studentAvatar: stu?.avatarUrl,
            rankName,
            rankIcon: undefined,
            ts: Date.now()
          }];
        });
      }
    });

    return () => {
      unsubStart();
      unsubEnd();
      unsubUpdate();
      unsubStartCast();
      unsubEndCast();
      unsubStatus();
      unsubRankUp();
      unsubNotifRankUp();
    };
  }, []);

  // Trigger winner modal with confetti, and play winner audio ONLY when modal appears
  useEffect(() => {
    if (gameResults.length === 0) return;
    const latest = gameResults[gameResults.length - 1];

    console.log('🏆 Winner modal triggered for:', latest.game.title);

    // Initialize game state if not exists
    if (!gameStates.current[latest.game.id]) {
      gameStates.current[latest.game.id] = {
        hasPlayed30Warning: false,
        lastAnnouncedSecond: -1,
        hasAnnouncedStart: false,
        hasAnnouncedGo: false,
        hasStopped: false,
        hasPlayedStartAudio: false,
        hasPlayedGameOverAudio: false,
        hasPlayedWinnerAudio: false
      };
    }

    // Play winner audio ONLY when this modal is displayed (modal already delayed by 3s from game_end)
    // This ensures game over audio plays first, then 3s delay, then winner audio
    if (!gameStates.current[latest.game.id].hasPlayedWinnerAudio) {
      gameStates.current[latest.game.id].hasPlayedWinnerAudio = true;
      console.log('🎵 Playing winner audio NOW for:', latest.game.title);
      try {
        AudioService.playGameWinner();
      } catch (e) {
        console.error('Failed to play winner audio:', e);
      }
    }

    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739'];
    const pieces = Array.from({ length: 50 }).map((_, i) => ({
      id: `${latest.game.id}-${i}`,
      left: Math.random() * 100,
      top: -10 - Math.random() * 10,
      size: 8 + Math.floor(Math.random() * 8),
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5,
      duration: 3 + Math.random() * 2
    }));
    setConfettiPieces(pieces);
    const ttl = setTimeout(() => {
      setGameResults(prev => prev.filter(r => r.game.id !== latest.game.id));
      setConfettiPieces([]);
      // After winner modal closes, show any queued level-ups
      if (queuedLevelUps.length > 0) {
        console.log('🎖️ Showing queued level-ups after winner screen:', queuedLevelUps.length);
        setShowLevelUpModal(true);
        AudioService.playLevelUp();
      }
    }, 12000);
    return () => clearTimeout(ttl);
  }, [gameResults, queuedLevelUps]);

  useEffect(() => {
    const onGameStartEvent = (e: any) => {
      const d = e?.detail;
      if (!d) return;
      const id = String(d.id || `local-${d.ts || d.startTime}`);
      setPendingStarts(prev => [...prev.filter(p => p.id !== id), { id, title: d.title, startTime: d.startTime, endTime: d.endTime }]);
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'game_start_event' && ev.newValue) {
        try {
          const d = JSON.parse(ev.newValue);
          const id = String(d.id || `local-${d.ts || d.startTime}`);
          setPendingStarts(prev => [...prev.filter(p => p.id !== id), { id, title: d.title, startTime: d.startTime, endTime: d.endTime }]);
        } catch (err) { console.warn('Failed to parse storage event:', err); }
      }
    };
    const onGameEndEvent = (e: any) => {
      const d = e?.detail;
      if (!d) return;
      const endedId = String(d.id || '');
      console.log('🏁 Game end event received, removing game:', endedId);
      setActiveGames(prev => {
        const filtered = prev.filter(g => String(g.id) !== endedId);
        console.log('Active games after removal:', filtered.length);
        return filtered;
      });
      // Also remove from pending starts if somehow still there
      setPendingStarts(prev => prev.filter(p => String(p.id) !== endedId));
    };
    const onStorageEnd = (ev: StorageEvent) => {
      if (ev.key === 'game_end_event' && ev.newValue) {
        try {
          const d = JSON.parse(ev.newValue);
          onGameEndEvent({ detail: d });
        } catch (err) { console.warn('Failed to parse storage event:', err); }
      }
    };
    window.addEventListener('game-start', onGameStartEvent as any);
    window.addEventListener('storage', onStorage);
    window.addEventListener('game-end', onGameEndEvent as any);
    window.addEventListener('storage', onStorageEnd);
    return () => {
      window.removeEventListener('game-start', onGameStartEvent as any);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('game-end', onGameEndEvent as any);
      window.removeEventListener('storage', onStorageEnd);
    };
  }, []);

  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try { const games = await supabaseService.getActiveGames(); setActiveGames(games); } catch (err) { console.warn('Failed to sync active games:', err); }
    }, 5000);
    return () => clearInterval(syncInterval);
  }, []);

  useEffect(() => {
    // Prune expired pending starts and ended games
    const pruneInterval = setInterval(() => {
      const now = Date.now();
      setPendingStarts(prev => prev.filter(p => p.startTime > now));

      // Remove games that have ended - but give 5 second buffer for game over sequence
      // This ensures countdown sounds and game over modal can play
      setActiveGames(prev => {
        const stillActive = prev.filter(g => now < g.endTime + 5000);
        if (stillActive.length !== prev.length) {
          console.log('🧹 Cleaned up', prev.length - stillActive.length, 'ended games (after 5s buffer)');
        }
        return stillActive;
      });
    }, 1000);

    return () => clearInterval(pruneInterval);
  }, []);

  useEffect(() => {
    if (activeGames.length === 0) {
      // Clear countdown displays when no games active
      setFinalCountdownSec(null);
      setShowThirtyAlert(false);
      return;
    }

    // Fetch drill leaderboards for active games
    const fetchLeaderboards = async () => {
      for (const game of activeGames) {
        const now = Date.now();
        if (now >= game.startTime && now < game.endTime) {
          try {
            const leaderboard = await supabaseService.getDrillLeaderboard(game.id);
            setDrillLeaderboards(prev => ({ ...prev, [game.id]: leaderboard }));
          } catch (e) {
            console.error('Failed to fetch drill leaderboard:', e);
          }
        }
      }
    };

    fetchLeaderboards();
    const leaderboardInterval = setInterval(fetchLeaderboards, 5000); // Refresh every 5 seconds

    const interval = setInterval(() => {
      const now = Date.now();
      let currentFinalCountdown: number | null = null;
      let shouldShow30Alert = false;

      // Debug: Log active games count
      if (activeGames.length > 0) {
        const game = activeGames[0];
        const remaining = Math.max(0, game.endTime - now);
        const remainingSec = Math.ceil(remaining / 1000);
        if (remainingSec <= 35 && remainingSec > 0) {
          console.log('⏱️ Game timer:', game.title, '- remaining:', remainingSec, 'seconds');
        }
      }

      activeGames.forEach(game => {
          if (!gameStates.current[game.id]) {
             gameStates.current[game.id] = {
                hasPlayed30Warning: false,
                lastAnnouncedSecond: -1,
                hasAnnouncedStart: false,
                hasAnnouncedGo: false,
                hasStopped: false,
                hasPlayedStartAudio: false,
                hasPlayedGameOverAudio: false,
                hasPlayedWinnerAudio: false
             };
          }

          const state = gameStates.current[game.id];
          const startDiff = game.startTime - now;
          const remaining = Math.max(0, game.endTime - now);
          const remainingSec = Math.ceil(remaining / 1000);

          // Game start countdown visuals (10..1) — audio triggered separately at 10
          if (startDiff > 0 && startDiff <= 10000) {
             const sec = Math.ceil(startDiff / 1000);
             if (sec !== state.lastAnnouncedSecond) {
               if (sec <= 10) {
                  console.log('🎯 Game start countdown:', sec, 'for game:', game.title);
                  state.lastAnnouncedSecond = sec;
                  // Audio for start countdown handled via playGameStartCountdown(title)
               }
             }
          } else if (startDiff <= 0 && startDiff > -500 && !state.hasAnnouncedGo) {
             // Game started - announce GO
             console.log('🚀 Game GO! for game:', game.title);
             state.hasAnnouncedGo = true;
             state.lastAnnouncedSecond = -1; // Reset for final countdown
             setFinalCountdownSec(null);
             setShowThirtyAlert(false);
          }

          // Only run end-game alerts AFTER game has started
          if (startDiff <= 0 && remaining > 0) {
            // 30-second warning - wider detection window
            if (remaining <= 30000 && remaining > 28000) {
              console.log('🔶 30-second zone detected:', remaining, 'ms, hasPlayed30Warning:', state.hasPlayed30Warning);
              if (!state.hasPlayed30Warning) {
                console.log('⚠️ 30-second warning TRIGGERED for game:', game.title);
                AudioService.unlock();
                AudioService.playWarningBeep();
                AudioService.speak("Thirty seconds remaining");
                state.hasPlayed30Warning = true;
                shouldShow30Alert = true;
                setShowThirtyAlert(true); // Set immediately
                setTimeout(() => setShowThirtyAlert(false), 2500);
              }
            }

            // 10-second final countdown
            if (remaining <= 10500 && remainingSec > 0 && remainingSec <= 10) {
               console.log('🔴 10-second zone:', remainingSec, 'lastAnnounced:', state.lastAnnouncedSecond);

               // Play countdown sound when first entering 10-second countdown
               if (state.lastAnnouncedSecond === -1 || state.lastAnnouncedSecond > 10) {
                  console.log('🔊 ENTERING 10-second countdown for:', game.title);
                  AudioService.unlock();
                  AudioService.playTenSecondCountdown();
               }

               if (remainingSec !== state.lastAnnouncedSecond) {
                  console.log('🔟 Final countdown SPEAK:', remainingSec, 'for game:', game.title);
                  AudioService.unlock();
                  // Speak the countdown number
                  AudioService.speak(remainingSec.toString());
                  state.lastAnnouncedSecond = remainingSec;
               }
               currentFinalCountdown = remainingSec;
               console.log('🔴 Setting finalCountdownSec to:', remainingSec);
            }
          } else {
            // Debug why we're not in the end-game alert zone
            if (remaining <= 35000 && remaining > 0) {
              console.log('⏸️ Waiting for game start. startDiff:', startDiff, 'remaining:', remaining);
            }
          }

          // Clear countdown when game ends
          if (remaining <= 0) {
            state.lastAnnouncedSecond = -1;
            state.hasPlayed30Warning = false;
            if (!state.hasStopped) {
              state.hasStopped = true;
              try { supabaseService.stopGame(game.id); } catch (err) { console.warn('Failed to stop game:', err); }
            }
          }
      });

      // Update state based on all active games
      setShowThirtyAlert(shouldShow30Alert);
      setFinalCountdownSec(currentFinalCountdown);
    }, 500); // Reduced from 100ms for better performance

    return () => {
      clearInterval(interval);
      clearInterval(leaderboardInterval);
    };
  }, [activeGames]);

  return (
    <>


        {gameOverFlash.map(g => (
          <div key={`go-${g.id}`} className="fixed inset-0 z-[655] pz-scope flex items-center justify-center bg-black/70 backdrop-blur-xl animate-fade-in">
            <div className="animate-bounce-in" style={{ filter: 'drop-shadow(0 0 40px rgba(239, 68, 68, 0.35))' }}>
              <div className="pz-card text-white px-12 md:px-20 py-10 text-center" style={{ borderColor: 'rgba(239, 68, 68, 0.5)' }}>
                <div className="mb-6 flex justify-center text-red-500"><Ic.Flag size={80} /></div>
                <div className="pz-display text-4xl md:text-6xl text-red-400">Game Over</div>
                <div className="text-2xl md:text-3xl font-black mt-3" style={{ color: 'var(--pz-text)' }}>{g.title}</div>
              </div>
            </div>
          </div>
        ))}
        {gameResults.map((res, index) => {
             console.log('🏆 Winner modal rendering:', {
               gameId: res.game.id,
               winningHouseId: res.results.winningHouseId,
               mvpStudentId: res.results.mvpStudentId,
               studentsCount: students.length,
               ranksCount: ranks.length
             });

             const winnerHouse = res.results.winningHouseId ? HOUSES[res.results.winningHouseId] : null;
             const mvp = students.find(s => s.id === res.results.mvpStudentId);
             const mvpRank = mvp ? ranks.find(r => r.id === mvp.rankId) : null;

             console.log('🏆 Winner data:', {
               winnerHouse: winnerHouse?.name,
               mvp: mvp?.fullName,
               mvpRank: mvpRank?.name
             });

             const winnerAccent = winnerHouse?.colorHex || '#CBFE1C';

             return (
             <div key={res.game.id} className="fixed inset-0 z-[660] pz-scope flex items-center justify-center bg-black/60 backdrop-blur-lg p-4 animate-fade-in">
                <div className="max-w-3xl w-full animate-bounce-in" style={{ filter: `drop-shadow(0 0 40px ${winnerAccent}59)` }}>
                <div
                  className="relative p-10 text-center overflow-hidden"
                  style={{
                    background: `linear-gradient(to bottom right, ${winnerAccent}22, transparent 50%), var(--pz-panel)`,
                    border: `1px solid ${winnerAccent}66`,
                    clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)'
                  }}
                >
                  <div className="absolute inset-0 opacity-10 bg-gradient-to-tr from-white to-transparent animate-pulse" />
                  <div className="relative z-10">
                    <div className="pz-eyebrow text-sm md:text-base mb-4">Winning Team</div>
                    {winnerHouse ? (
                      <div className="flex flex-col items-center mb-8">
                        <img src={winnerHouse.customIcon} className="w-32 h-32 md:w-48 md:h-48 object-contain drop-shadow-xl" />
                        <div className="pz-display text-3xl md:text-4xl mt-4" style={{ color: winnerHouse.colorHex }}>
                          {winnerHouse.name}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xl mb-8" style={{ color: 'var(--pz-text)' }}>No team data available</div>
                    )}
                    <div className="pz-eyebrow text-sm md:text-base mb-4">MVP Player</div>
                    {mvp ? (
                      <div className="flex flex-col items-center">
                        <img src={mvp.avatarUrl} className="w-36 h-36 md:w-44 md:h-44 rounded-full border-8 shadow-xl object-cover" style={{ borderColor: winnerAccent }} />
                        {mvp.gamerTag ? (
                          <>
                            <div className="pz-display text-white text-2xl md:text-3xl mt-4">{mvp.gamerTag}</div>
                            <div className="font-bold text-lg mt-1" style={{ color: 'var(--pz-text)' }}>{mvp.fullName}</div>
                          </>
                        ) : (
                          <div className="pz-display text-white text-2xl md:text-3xl mt-4">{mvp.fullName}</div>
                        )}
                        <div className="font-black text-base uppercase mt-2" style={{ color: 'var(--pz-volt)' }}>{mvpRank?.name || 'Athlete'}</div>
                      </div>
                    ) : (
                      <div className="text-xl" style={{ color: 'var(--pz-text)' }}>No MVP data available</div>
                    )}
                  </div>
                  {confettiPieces.map(p => (
                    <div
                      key={p.id}
                      className="absolute rounded-sm animate-confetti-fall"
                      style={{
                        left: `${p.left}%`,
                        top: `${p.top}%`,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        backgroundColor: p.color,
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                        transform: `rotate(${Math.random() * 360}deg)`
                      }}
                    />
                  ))}
                </div>
                </div>
              </div>
             );
        })}

        {startUI && startUI.phase === 'title' && (
          <div className="fixed inset-0 z-[680] pz-scope flex items-center justify-center bg-black/70 backdrop-blur-xl px-6 animate-fade-in">
            <div className="max-w-2xl w-full animate-bounce-in" style={{ filter: 'drop-shadow(0 0 40px rgba(203, 254, 28, 0.35))' }}>
              <div className="pz-card p-8 md:p-12 text-center" style={{ borderColor: 'rgba(203, 254, 28, 0.5)' }}>
                <div className="pz-eyebrow mb-3">Now Loading</div>
                <div className="pz-display text-3xl md:text-4xl text-white">{startUI.title}</div>
              </div>
            </div>
          </div>
        )}
        {startUI && startUI.phase === 'countdown' && (
          <div className="fixed inset-0 z-[680] pz-scope flex items-center justify-center bg-black/80 backdrop-blur-xl px-6 animate-fade-in">
            <div className="max-w-4xl w-full animate-bounce-in" style={{ filter: 'drop-shadow(0 0 50px rgba(203, 254, 28, 0.4))' }}>
              <div className="pz-card p-12 md:p-20 text-center" style={{ borderColor: 'rgba(203, 254, 28, 0.5)' }}>
                <div className="pz-eyebrow text-base md:text-xl mb-4 md:mb-6">Starts In</div>
                <div className="pz-display text-4xl md:text-6xl lg:text-7xl text-white mb-6 md:mb-10 drop-shadow-2xl">{startUI.title}</div>
                <div className="pz-display text-[10rem] md:text-[15rem] lg:text-[20rem] animate-pulse leading-none" style={{ color: 'var(--pz-volt)', textShadow: '0 10px 20px rgba(0,0,0,0.8)' }}>{startUI.text}</div>
              </div>
            </div>
          </div>
        )}

        {showThirtyAlert && (
          <div className="fixed inset-0 z-[650] pz-scope flex items-center justify-center pointer-events-none animate-fade-in">
            <div className="animate-bounce-in" style={{ filter: 'drop-shadow(0 0 40px rgba(249, 115, 22, 0.45))' }}>
              <div className="pz-card text-white px-12 md:px-20 py-8 md:py-12 text-center" style={{ borderColor: 'rgba(249, 115, 22, 0.6)' }}>
                <div className="mb-4 flex justify-center text-orange-400"><Ic.Warning size={72} /></div>
                <div className="pz-display text-4xl md:text-6xl lg:text-7xl tracking-wider drop-shadow-2xl text-orange-400">
                  30 Seconds
                </div>
                <div className="text-2xl md:text-4xl font-black uppercase tracking-widest mt-2" style={{ color: 'var(--pz-text)' }}>
                  Remaining!
                </div>
              </div>
            </div>
          </div>
        )}

        {typeof finalCountdownSec === 'number' && finalCountdownSec > 0 && (
          <div className="fixed inset-0 z-[650] pz-scope flex items-center justify-center pointer-events-none animate-fade-in">
            <div className="animate-pulse" style={{ filter: 'drop-shadow(0 0 60px rgba(239, 68, 68, 0.5))' }}>
              <div
                className="text-white w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 flex flex-col items-center justify-center"
                style={{
                  background: 'linear-gradient(to bottom right, rgba(239, 68, 68, 0.25), transparent 60%), var(--pz-panel)',
                  border: '1px solid rgba(239, 68, 68, 0.6)',
                  clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)'
                }}
              >
                <div className="pz-display text-[8rem] md:text-[12rem] lg:text-[16rem] text-red-500 drop-shadow-2xl leading-none">
                  {finalCountdownSec}
                </div>
                <div className="text-xl md:text-3xl font-black uppercase tracking-widest -mt-4 md:-mt-8" style={{ color: 'var(--pz-text)' }}>
                  Seconds
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-4 left-0 right-0 z-40 pz-scope flex flex-col items-center gap-3 pointer-events-none px-4">
            {activeGames.map(game => {
                const now = Date.now();
                if (now < game.startTime) return null;
                const remaining = Math.max(0, game.endTime - now);
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                const isLowTime = remaining <= 30000;
                const isCritical = remaining <= 10000;

                // Hide game clock during 10-second countdown (large countdown circle takes over)
                if (isCritical) return null;

                return (
                  <div
                    key={game.id}
                    className={`backdrop-blur-sm px-6 py-2 md:px-8 md:py-3 flex items-center gap-4 pointer-events-auto transition-all ${isLowTime ? 'animate-pulse' : ''}`}
                    style={{
                      background: 'var(--pz-panel)',
                      border: isLowTime ? '1px solid rgba(249, 115, 22, 0.7)' : '1px solid var(--pz-border)',
                      clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
                    }}
                  >
                     <div className="text-sm md:text-lg font-black leading-tight text-white">
                       {game.title}
                     </div>
                     <div className="pz-display text-2xl md:text-4xl" style={{ color: isLowTime ? '#fb923c' : 'var(--pz-volt)' }}>
                        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
                     </div>
                  </div>
                );
            })}
        </div>

        {/* Level-Up Modal - Shows queued promotions after winner screen */}
        {showLevelUpModal && queuedLevelUps.length > 0 && (
          <div
            className="fixed inset-0 z-[670] pz-scope flex items-center justify-center bg-black/70 backdrop-blur-lg p-4 animate-fade-in"
            onClick={() => {
              setShowLevelUpModal(false);
              setQueuedLevelUps([]);
            }}
          >
            <div className="max-w-4xl w-full animate-bounce-in" style={{ filter: 'drop-shadow(0 0 40px rgba(203, 254, 28, 0.4))' }} onClick={e => e.stopPropagation()}>
            <div
              className="w-full p-8 text-center"
              style={{
                background: 'linear-gradient(to bottom right, rgba(203, 254, 28, 0.14), transparent 50%), var(--pz-panel)',
                border: '1px solid rgba(203, 254, 28, 0.5)',
                clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)'
              }}
            >
              <div className="pz-display text-sm md:text-lg tracking-widest mb-6 drop-shadow-lg" style={{ color: 'var(--pz-volt)' }}>
                {queuedLevelUps.length === 1 ? 'Level Up!' : `${queuedLevelUps.length} Players Leveled Up!`}
              </div>

              {/* Side-by-side layout for multiple level-ups */}
              <div className={`flex flex-wrap justify-center gap-6 ${queuedLevelUps.length > 2 ? 'gap-4' : 'gap-8'}`}>
                {queuedLevelUps.map((levelUp, idx) => (
                  <div
                    key={`${levelUp.studentId}-${idx}`}
                    className={`pz-card-sm flex flex-col items-center p-4 md:p-6 backdrop-blur-sm ${
                      queuedLevelUps.length === 1 ? 'w-64' : queuedLevelUps.length === 2 ? 'w-48 md:w-56' : 'w-36 md:w-44'
                    }`}
                    style={{ background: 'var(--pz-panel-2)' }}
                  >
                    {levelUp.studentAvatar ? (
                      <img
                        src={levelUp.studentAvatar}
                        className={`rounded-full border-4 shadow-xl object-cover ${
                          queuedLevelUps.length === 1 ? 'w-32 h-32 md:w-40 md:h-40' : 'w-20 h-20 md:w-28 md:h-28'
                        }`}
                        style={{ borderColor: 'var(--pz-volt)' }}
                      />
                    ) : (
                      <div className={`rounded-full bg-white/10 flex items-center justify-center ${
                        queuedLevelUps.length === 1 ? 'w-32 h-32 md:w-40 md:h-40' : 'w-20 h-20 md:w-28 md:h-28'
                      }`}>
                        <span className="text-white/40 flex items-center"><Ic.User size={40} /></span>
                      </div>
                    )}
                    <div className={`text-white font-black mt-3 drop-shadow-lg truncate max-w-full ${
                      queuedLevelUps.length === 1 ? 'text-xl md:text-2xl' : 'text-sm md:text-lg'
                    }`}>
                      {levelUp.studentName}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {levelUp.rankIcon && <span className="text-2xl">{levelUp.rankIcon}</span>}
                      <span className={`font-bold ${
                        queuedLevelUps.length === 1 ? 'text-lg' : 'text-xs md:text-sm'
                      }`} style={{ color: 'var(--pz-volt)' }}>
                        {levelUp.rankName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setShowLevelUpModal(false);
                  setQueuedLevelUps([]);
                }}
                className="pz-btn mt-8 px-8 py-3 text-sm active:scale-95"
              >
                Awesome!
              </button>
            </div>
            </div>
          </div>
        )}
    </>
  );
};

export default GameOverlay;
