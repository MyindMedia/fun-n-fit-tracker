import React, { useEffect, useState, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Student, GameSession, HouseId, Transaction } from '../types';
import { HOUSES, GAME_LIBRARY } from '../constants';

interface PlayerStats {
  student: Student;
  gamesPlayed: number;
  totalPoints: number;
  mvpCount: number;
  winCount: number;
  avgPointsPerGame: number;
  pointsGained: number;
  rankProgress: number;
  dodgeballGames: number;
  dodgeballWins: number;
  dodgeballMVPs: number;
}

interface HouseStats {
  houseId: HouseId;
  name: string;
  color: string;
  totalWins: number;
  totalPoints: number;
  gamesPlayed: number;
  winRate: number;
  topPlayer: Student | null;
  avgPointsPerGame: number;
  dodgeballWins: number;
  dodgeballGames: number;
}

interface AwardCategory {
  title: string;
  icon: string;
  description: string;
  winner: PlayerStats | null;
  runnerUp: PlayerStats | null;
}

type DateRange = 'week' | 'month' | 'quarter' | 'all' | 'custom';
type GameCategory = 'all' | 'dodgeball' | 'speed' | 'teamwork' | 'custom';
type ReportView = 'general' | 'dodgeball';

const GameStatsDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [gameHistory, setGameHistory] = useState<GameSession[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [gameCategory, setGameCategory] = useState<GameCategory>('all');
  const [reportView, setReportView] = useState<ReportView>('general');
  const [isLoading, setIsLoading] = useState(true);

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [studs, history, txs, ranksData] = await Promise.all([
          supabaseService.getStudents(),
          supabaseService.getGameHistory(),
          supabaseService.getTransactions(dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : dateRange === 'quarter' ? 90 : 365),
          supabaseService.getRanks()
        ]);
        setStudents(studs);
        setGameHistory(history);
        setTransactions(txs);
        setRanks(ranksData);
      } catch (e) {
        console.error('Failed to load stats data:', e);
      }
      setIsLoading(false);
    };
    loadData();
  }, [dateRange]);

  const dateFilteredGames = useMemo(() => {
    const now = Date.now();

    if (dateRange === 'custom') {
      const startTime = new Date(customStartDate).getTime();
      const endTime = new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000; // Include end date
      return gameHistory.filter(g => g.endTime >= startTime && g.endTime <= endTime);
    }

    const cutoff = dateRange === 'week' ? now - 7 * 24 * 60 * 60 * 1000
      : dateRange === 'month' ? now - 30 * 24 * 60 * 60 * 1000
      : dateRange === 'quarter' ? now - 90 * 24 * 60 * 60 * 1000
      : 0;
    return gameHistory.filter(g => g.endTime >= cutoff);
  }, [gameHistory, dateRange, customStartDate, customEndDate]);

  const filteredGames = useMemo(() => {
    if (gameCategory === 'all') return dateFilteredGames;
    if (gameCategory === 'dodgeball') {
      return dateFilteredGames.filter(g => {
        const gameDef = GAME_LIBRARY.find(lib => lib.gameKey === g.gameKey);
        return gameDef?.category === 'Dodgeball Season' || g.gameKey.includes('DODGE') || g.gameKey.includes('DBS_');
      });
    }
    return dateFilteredGames.filter(g => {
      const gameDef = GAME_LIBRARY.find(lib => lib.gameKey === g.gameKey);
      return gameDef?.category?.toLowerCase().includes(gameCategory);
    });
  }, [dateFilteredGames, gameCategory]);

  const dodgeballGames = useMemo(() => {
    return dateFilteredGames.filter(g => {
      const gameDef = GAME_LIBRARY.find(lib => lib.gameKey === g.gameKey);
      return gameDef?.category === 'Dodgeball Season' || g.gameKey.includes('DODGE') || g.gameKey.includes('DBS_');
    });
  }, [dateFilteredGames]);

  const playerStats = useMemo(() => {
    const stats: Record<string, PlayerStats> = {};

    students.forEach(student => {
      const currentRank = ranks.find(r => r.id === student.rankId);
      const nextRank = ranks.find(r => r.threshold > (currentRank?.threshold || 0));
      const progress = nextRank
        ? ((student.points - (currentRank?.threshold || 0)) / (nextRank.threshold - (currentRank?.threshold || 0))) * 100
        : 100;

      stats[student.id] = {
        student,
        gamesPlayed: 0,
        totalPoints: student.points,
        mvpCount: 0,
        winCount: 0,
        avgPointsPerGame: 0,
        pointsGained: 0,
        rankProgress: Math.min(100, Math.max(0, progress)),
        dodgeballGames: 0,
        dodgeballWins: 0,
        dodgeballMVPs: 0
      };
    });

    filteredGames.forEach(game => {
      if (!game.results) return;

      game.roster.forEach(studentId => {
        if (stats[studentId]) {
          stats[studentId].gamesPlayed++;
        }
      });

      if (game.results.mvpStudentId && stats[game.results.mvpStudentId]) {
        stats[game.results.mvpStudentId].mvpCount++;
      }

      if (game.results.winningHouseId) {
        game.roster.forEach(studentId => {
          const student = students.find(s => s.id === studentId);
          if (student && student.houseId === game.results?.winningHouseId && stats[studentId]) {
            stats[studentId].winCount++;
          }
        });
      }
    });

    dodgeballGames.forEach(game => {
      if (!game.results) return;

      game.roster.forEach(studentId => {
        if (stats[studentId]) {
          stats[studentId].dodgeballGames++;
        }
      });

      if (game.results.mvpStudentId && stats[game.results.mvpStudentId]) {
        stats[game.results.mvpStudentId].dodgeballMVPs++;
      }

      if (game.results.winningHouseId) {
        game.roster.forEach(studentId => {
          const student = students.find(s => s.id === studentId);
          if (student && student.houseId === game.results?.winningHouseId && stats[studentId]) {
            stats[studentId].dodgeballWins++;
          }
        });
      }
    });

    transactions.forEach(tx => {
      if (stats[tx.studentId]) {
        stats[tx.studentId].pointsGained += tx.amount;
      }
    });

    Object.values(stats).forEach(stat => {
      stat.avgPointsPerGame = stat.gamesPlayed > 0
        ? Math.round(stat.pointsGained / stat.gamesPlayed)
        : 0;
    });

    return Object.values(stats).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [students, filteredGames, dodgeballGames, transactions, ranks]);

  const houseStats = useMemo(() => {
    const stats: Record<HouseId, HouseStats> = {} as any;

    Object.values(HOUSES).forEach(house => {
      stats[house.id] = {
        houseId: house.id,
        name: house.name,
        color: house.colorHex,
        totalWins: 0,
        totalPoints: 0,
        gamesPlayed: 0,
        winRate: 0,
        topPlayer: null,
        avgPointsPerGame: 0,
        dodgeballWins: 0,
        dodgeballGames: 0
      };
    });

    filteredGames.forEach(game => {
      if (game.results?.winningHouseId) {
        stats[game.results.winningHouseId].totalWins++;
      }

      const housesInGame = new Set<HouseId>();
      game.roster.forEach(studentId => {
        const student = students.find(s => s.id === studentId);
        if (student) {
          housesInGame.add(student.houseId);
        }
      });
      housesInGame.forEach(houseId => {
        stats[houseId].gamesPlayed++;
      });
    });

    dodgeballGames.forEach(game => {
      if (game.results?.winningHouseId) {
        stats[game.results.winningHouseId].dodgeballWins++;
      }

      const housesInGame = new Set<HouseId>();
      game.roster.forEach(studentId => {
        const student = students.find(s => s.id === studentId);
        if (student) {
          housesInGame.add(student.houseId);
        }
      });
      housesInGame.forEach(houseId => {
        stats[houseId].dodgeballGames++;
      });
    });

    Object.values(HOUSES).forEach(house => {
      const houseStudents = playerStats.filter(p => p.student.houseId === house.id);
      stats[house.id].totalPoints = houseStudents.reduce((sum, p) => sum + p.totalPoints, 0);
      stats[house.id].topPlayer = houseStudents.length > 0 ? houseStudents[0].student : null;
      stats[house.id].winRate = stats[house.id].gamesPlayed > 0
        ? Math.round((stats[house.id].totalWins / stats[house.id].gamesPlayed) * 100)
        : 0;
      stats[house.id].avgPointsPerGame = stats[house.id].gamesPlayed > 0
        ? Math.round(stats[house.id].totalPoints / stats[house.id].gamesPlayed)
        : 0;
    });

    return Object.values(stats).sort((a, b) => b.totalWins - a.totalWins);
  }, [filteredGames, dodgeballGames, students, playerStats]);

  const dodgeballHouseStats = useMemo(() => {
    return [...houseStats].sort((a, b) => b.dodgeballWins - a.dodgeballWins);
  }, [houseStats]);

  const awards: AwardCategory[] = useMemo(() => {
    const sorted = [...playerStats];

    const byMVP = sorted.filter(p => p.gamesPlayed > 0).sort((a, b) => b.mvpCount - a.mvpCount);
    const byImproved = sorted.filter(p => p.pointsGained > 0).sort((a, b) => b.pointsGained - a.pointsGained);
    const byGames = sorted.filter(p => p.gamesPlayed > 0).sort((a, b) => b.gamesPlayed - a.gamesPlayed);
    const byWins = sorted.filter(p => p.winCount > 0).sort((a, b) => b.winCount - a.winCount);
    const byAvg = sorted.filter(p => p.gamesPlayed >= 3).sort((a, b) => b.avgPointsPerGame - a.avgPointsPerGame);
    const byProgress = sorted.filter(p => p.rankProgress > 0 && p.rankProgress < 100).sort((a, b) => b.rankProgress - a.rankProgress);
    const byPoints = sorted.sort((a, b) => b.totalPoints - a.totalPoints);

    return [
      { title: 'MVP', icon: '🏆', description: 'Most MVP titles', winner: byMVP[0] || null, runnerUp: byMVP[1] || null },
      { title: 'Top Scorer', icon: '⭐', description: 'Highest total points', winner: byPoints[0] || null, runnerUp: byPoints[1] || null },
      { title: 'Most Improved', icon: '📈', description: 'Greatest points gained', winner: byImproved[0] || null, runnerUp: byImproved[1] || null },
      { title: 'Iron Athlete', icon: '💪', description: 'Most games played', winner: byGames[0] || null, runnerUp: byGames[1] || null },
      { title: 'Champion', icon: '🥇', description: 'Most game wins', winner: byWins[0] || null, runnerUp: byWins[1] || null },
      { title: 'Consistent', icon: '🎯', description: 'Best avg per game', winner: byAvg[0] || null, runnerUp: byAvg[1] || null },
      { title: 'Rising Star', icon: '🌟', description: 'Closest to next rank', winner: byProgress[0] || null, runnerUp: byProgress[1] || null }
    ];
  }, [playerStats]);

  const dodgeballAwards: AwardCategory[] = useMemo(() => {
    const sorted = [...playerStats].filter(p => p.dodgeballGames > 0);

    const byMVP = [...sorted].sort((a, b) => b.dodgeballMVPs - a.dodgeballMVPs);
    const byWins = [...sorted].sort((a, b) => b.dodgeballWins - a.dodgeballWins);
    const byGames = [...sorted].sort((a, b) => b.dodgeballGames - a.dodgeballGames);

    return [
      { title: 'Dodgeball MVP', icon: '🎯', description: 'Most dodgeball MVPs', winner: byMVP[0] || null, runnerUp: byMVP[1] || null },
      { title: 'Dodgeball Champion', icon: '🏆', description: 'Most dodgeball wins', winner: byWins[0] || null, runnerUp: byWins[1] || null },
      { title: 'Dodgeball Warrior', icon: '💪', description: 'Most games played', winner: byGames[0] || null, runnerUp: byGames[1] || null },
    ];
  }, [playerStats]);

  const handlePrint = () => {
    window.print();
  };

  const dateRangeLabel = dateRange === 'week' ? 'This Week'
    : dateRange === 'month' ? 'This Month'
    : dateRange === 'quarter' ? 'This Quarter'
    : dateRange === 'custom' ? `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`
    : 'All Time';

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-blue mx-auto mb-3"></div>
          <p className="text-slate-600 font-bold text-sm">Loading Stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]">
      <div className="absolute inset-0 overflow-y-auto overscroll-contain -webkit-overflow-scrolling-touch">
        <div className="min-h-full flex flex-col bg-slate-50">
          {/* Sticky Header */}
          <div className="sticky top-0 z-20 bg-gradient-to-r from-brand-blue via-purple-600 to-brand-green text-white print:bg-brand-blue">
            <div className="px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h1 className="text-base font-display font-black uppercase tracking-tight truncate">
                    {reportView === 'dodgeball' ? '🏐 Dodgeball Season' : 'Awards Report'}
                  </h1>
                  <p className="text-white/80 text-[10px]">
                    {dateRangeLabel} • {new Date().toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0 print:hidden">
                  <button
                    onClick={handlePrint}
                    className="bg-white/20 border border-white/30 rounded-lg px-2 py-1.5 font-bold text-[10px] active:scale-95"
                  >
                    🖨️
                  </button>
                  <button
                    onClick={onClose}
                    className="bg-white/20 border border-white/30 rounded-lg w-8 h-8 font-bold text-sm active:scale-95 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* Report View Tabs */}
            <div className="flex bg-white/10 border-t border-white/20 print:hidden">
              <button
                onClick={() => setReportView('general')}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all active:opacity-70 ${
                  reportView === 'general' ? 'bg-white/20 text-white' : 'text-white/60'
                }`}
              >
                📊 General
              </button>
              <button
                onClick={() => setReportView('dodgeball')}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all active:opacity-70 ${
                  reportView === 'dodgeball' ? 'bg-white/20 text-white' : 'text-white/60'
                }`}
              >
                🏐 Dodgeball
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 px-3 py-2 bg-white/5 border-t border-white/10 print:hidden overflow-x-auto no-scrollbar">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="bg-white/20 border border-white/30 rounded-lg px-2 py-1.5 text-white font-bold text-[10px] shrink-0 appearance-none min-w-[70px]"
              >
                <option value="week" className="text-slate-900">Week</option>
                <option value="month" className="text-slate-900">Month</option>
                <option value="quarter" className="text-slate-900">Quarter</option>
                <option value="all" className="text-slate-900">All</option>
                <option value="custom" className="text-slate-900">Custom</option>
              </select>

              {/* Custom Date Range Pickers */}
              {dateRange === 'custom' && (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-white/70 text-[9px] font-bold">From:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-white/20 border border-white/30 rounded-lg px-2 py-1 text-white font-bold text-[10px] shrink-0"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-white/70 text-[9px] font-bold">To:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-white/20 border border-white/30 rounded-lg px-2 py-1 text-white font-bold text-[10px] shrink-0"
                    />
                  </div>
                </>
              )}

              {reportView === 'general' && (
                <select
                  value={gameCategory}
                  onChange={(e) => setGameCategory(e.target.value as GameCategory)}
                  className="bg-white/20 border border-white/30 rounded-lg px-2 py-1.5 text-white font-bold text-[10px] shrink-0 appearance-none min-w-[80px]"
                >
                  <option value="all" className="text-slate-900">All Games</option>
                  <option value="dodgeball" className="text-slate-900">Dodgeball</option>
                  <option value="speed" className="text-slate-900">Speed</option>
                  <option value="teamwork" className="text-slate-900">Teamwork</option>
                  <option value="custom" className="text-slate-900">Custom</option>
                </select>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 bg-white/10 border-t border-white/20">
              <div className="p-2 text-center border-r border-white/20">
                <div className="text-sm font-black">{reportView === 'dodgeball' ? dodgeballGames.length : filteredGames.length}</div>
                <div className="text-[7px] font-bold uppercase opacity-70">Games</div>
              </div>
              <div className="p-2 text-center border-r border-white/20">
                <div className="text-sm font-black">{students.length}</div>
                <div className="text-[7px] font-bold uppercase opacity-70">Athletes</div>
              </div>
              <div className="p-2 text-center border-r border-white/20">
                <div className="text-sm font-black">
                  {transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                </div>
                <div className="text-[7px] font-bold uppercase opacity-70">Points</div>
              </div>
              <div className="p-2 text-center">
                <div className="text-sm font-black">
                  {reportView === 'dodgeball'
                    ? playerStats.filter(p => p.dodgeballMVPs > 0).length
                    : playerStats.filter(p => p.mvpCount > 0).length
                  }
                </div>
                <div className="text-[7px] font-bold uppercase opacity-70">MVPs</div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-3 space-y-3 pb-6">
            {reportView === 'general' ? (
              <>
                {/* House Championship */}
                <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                    <h2 className="text-xs font-display font-black text-slate-900 uppercase flex items-center gap-2">
                      <span>🏠</span> House Championship
                    </h2>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {houseStats.map((house, index) => (
                      <div
                        key={house.houseId}
                        className={`rounded-xl p-2.5 relative overflow-hidden ${
                          index === 0 ? 'ring-2 ring-yellow-400 ring-offset-1' : ''
                        }`}
                        style={{ backgroundColor: `${house.color}15`, borderLeft: `3px solid ${house.color}` }}
                      >
                        {index === 0 && <div className="absolute top-0.5 right-0.5 text-sm">👑</div>}
                        <div className="text-lg font-black mb-0.5" style={{ color: house.color }}>#{index + 1}</div>
                        <div className="text-xs font-black text-slate-900 uppercase">{house.name}</div>
                        <div className="mt-1.5 space-y-0.5 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Wins:</span>
                            <span className="font-black">{house.totalWins}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Rate:</span>
                            <span className="font-black">{house.winRate}%</span>
                          </div>
                        </div>
                        {house.topPlayer && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                            <div className="flex items-center gap-1">
                              <img src={house.topPlayer.avatarUrl} className="w-4 h-4 rounded-full" alt="" />
                              <span className="text-[9px] font-bold truncate">{house.topPlayer.fullName}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Individual Awards */}
                <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                    <h2 className="text-xs font-display font-black text-slate-900 uppercase flex items-center gap-2">
                      <span>🏅</span> Individual Awards
                    </h2>
                  </div>
                  <div className="p-3 space-y-2">
                    {awards.slice(0, 5).map((award) => (
                      <div
                        key={award.title}
                        className="bg-slate-50 rounded-lg p-2.5 border border-slate-100"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="text-xl">{award.icon}</div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[10px] font-black text-slate-900 uppercase">{award.title}</h3>
                            <p className="text-[8px] text-slate-500 truncate">{award.description}</p>
                          </div>
                        </div>

                        {award.winner ? (
                          <div className="flex items-center gap-2 bg-yellow-50 rounded-lg p-2 border border-yellow-200">
                            <span className="text-sm">🥇</span>
                            <img src={award.winner.student.avatarUrl} className="w-7 h-7 rounded-full border-2 border-yellow-400" alt="" />
                            <div className="flex-grow min-w-0">
                              <div className="text-[10px] font-black truncate">{award.winner.student.fullName}</div>
                              <div className="text-[8px] font-bold" style={{ color: HOUSES[award.winner.student.houseId].colorHex }}>
                                {HOUSES[award.winner.student.houseId].name}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-2 text-slate-400 text-[10px]">No data</div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Top 10 Leaderboard */}
                <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                    <h2 className="text-xs font-display font-black text-slate-900 uppercase flex items-center gap-2">
                      <span>📊</span> Top 10 Athletes
                    </h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {playerStats.slice(0, 10).map((stat, index) => (
                      <div key={stat.student.id} className="flex items-center gap-2 p-2.5">
                        <div className={`text-sm font-black w-6 text-center shrink-0 ${
                          index === 0 ? 'text-yellow-500' :
                          index === 1 ? 'text-slate-400' :
                          index === 2 ? 'text-amber-600' : 'text-slate-300'
                        }`}>
                          {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                        </div>
                        <img src={stat.student.avatarUrl} className="w-8 h-8 rounded-full border-2 border-slate-200 shrink-0" alt="" />
                        <div className="flex-grow min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{stat.student.fullName}</div>
                          <div className="flex gap-2 text-[8px] font-bold text-slate-400">
                            <span>{stat.gamesPlayed}g</span>
                            {stat.mvpCount > 0 && <span className="text-yellow-500">{stat.mvpCount}MVP</span>}
                          </div>
                        </div>
                        <div
                          className="px-1.5 py-0.5 rounded text-[8px] font-black text-white shrink-0"
                          style={{ backgroundColor: HOUSES[stat.student.houseId].colorHex }}
                        >
                          {stat.totalPoints.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              /* DODGEBALL SEASON REPORT */
              <>
                {/* Dodgeball Season Header */}
                <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-4 text-white text-center">
                  <div className="text-3xl mb-1">🏐</div>
                  <h2 className="text-lg font-display font-black uppercase">Dodgeball Season</h2>
                  <p className="text-white/80 text-xs">{dodgeballGames.length} matches played</p>
                </div>

                {/* House Dodgeball Standings */}
                <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-red-50 px-3 py-2 border-b border-red-100">
                    <h2 className="text-xs font-display font-black text-red-800 uppercase flex items-center gap-2">
                      <span>🏆</span> House Standings
                    </h2>
                  </div>
                  <div className="p-3 space-y-2">
                    {dodgeballHouseStats.map((house, index) => (
                      <div
                        key={house.houseId}
                        className={`flex items-center gap-3 p-3 rounded-xl ${
                          index === 0 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 ring-2 ring-yellow-400' : 'bg-slate-50'
                        }`}
                      >
                        <div className={`text-xl font-black shrink-0 ${
                          index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-600' : 'text-slate-300'
                        }`}>
                          {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="font-black text-sm uppercase truncate" style={{ color: house.color }}>{house.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {house.dodgeballGames}g • {house.dodgeballGames > 0 ? Math.round((house.dodgeballWins / house.dodgeballGames) * 100) : 0}%
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xl font-black" style={{ color: house.color }}>{house.dodgeballWins}</div>
                          <div className="text-[8px] text-slate-400 uppercase font-bold">wins</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Dodgeball Awards */}
                <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-red-50 px-3 py-2 border-b border-red-100">
                    <h2 className="text-xs font-display font-black text-red-800 uppercase flex items-center gap-2">
                      <span>🎯</span> Season Awards
                    </h2>
                  </div>
                  <div className="p-3 space-y-2">
                    {dodgeballAwards.map((award) => (
                      <div
                        key={award.title}
                        className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-3 border border-red-100"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-2xl">{award.icon}</div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs font-black text-slate-900 uppercase">{award.title}</h3>
                            <p className="text-[9px] text-slate-500">{award.description}</p>
                          </div>
                        </div>

                        {award.winner ? (
                          <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-200">
                            <span className="text-lg">🥇</span>
                            <img src={award.winner.student.avatarUrl} className="w-9 h-9 rounded-full border-2 border-yellow-400 shrink-0" alt="" />
                            <div className="flex-grow min-w-0">
                              <div className="text-sm font-black truncate">{award.winner.student.fullName}</div>
                              <div className="text-[10px] font-bold" style={{ color: HOUSES[award.winner.student.houseId].colorHex }}>
                                {HOUSES[award.winner.student.houseId].name}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-lg font-black text-red-500">
                                {award.title.includes('MVP') ? award.winner.dodgeballMVPs :
                                 award.title.includes('Champion') ? award.winner.dodgeballWins :
                                 award.winner.dodgeballGames}
                              </div>
                              <div className="text-[8px] text-slate-400 uppercase">
                                {award.title.includes('MVP') ? 'MVPs' :
                                 award.title.includes('Champion') ? 'wins' : 'games'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-3 text-slate-400 text-xs">No dodgeball data yet</div>
                        )}

                        {award.runnerUp && (
                          <div className="flex items-center gap-2 mt-2 bg-slate-100 rounded-lg p-2">
                            <span className="text-sm">🥈</span>
                            <img src={award.runnerUp.student.avatarUrl} className="w-6 h-6 rounded-full border border-slate-300" alt="" />
                            <span className="text-[10px] font-bold truncate">{award.runnerUp.student.fullName}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Top Dodgeball Players */}
                <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-red-50 px-3 py-2 border-b border-red-100">
                    <h2 className="text-xs font-display font-black text-red-800 uppercase flex items-center gap-2">
                      <span>🔥</span> Top Players
                    </h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {playerStats
                      .filter(p => p.dodgeballGames > 0)
                      .sort((a, b) => b.dodgeballWins - a.dodgeballWins)
                      .slice(0, 10)
                      .map((stat, index) => (
                      <div key={stat.student.id} className="flex items-center gap-2 p-2.5">
                        <div className={`text-sm font-black w-6 text-center shrink-0 ${
                          index === 0 ? 'text-yellow-500' :
                          index === 1 ? 'text-slate-400' :
                          index === 2 ? 'text-amber-600' : 'text-slate-300'
                        }`}>
                          {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                        </div>
                        <img src={stat.student.avatarUrl} className="w-8 h-8 rounded-full border-2 border-slate-200 shrink-0" alt="" />
                        <div className="flex-grow min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{stat.student.fullName}</div>
                          <div className="flex gap-2 text-[8px] font-bold text-slate-400">
                            <span>{stat.dodgeballGames}g</span>
                            <span className="text-red-500">{stat.dodgeballWins}W</span>
                            {stat.dodgeballMVPs > 0 && <span className="text-yellow-500">{stat.dodgeballMVPs}MVP</span>}
                          </div>
                        </div>
                        <div
                          className="px-1.5 py-0.5 rounded text-[8px] font-black text-white shrink-0"
                          style={{ backgroundColor: HOUSES[stat.student.houseId].colorHex }}
                        >
                          {stat.dodgeballWins}W
                        </div>
                      </div>
                    ))}
                    {playerStats.filter(p => p.dodgeballGames > 0).length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        No dodgeball games yet
                      </div>
                    )}
                  </div>
                </section>

                {/* Recent Dodgeball Games */}
                <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-red-50 px-3 py-2 border-b border-red-100">
                    <h2 className="text-xs font-display font-black text-red-800 uppercase flex items-center gap-2">
                      <span>📜</span> Recent Games
                    </h2>
                  </div>
                  <div className="p-3 space-y-2">
                    {dodgeballGames.slice(0, 6).map((game) => {
                      const mvp = students.find(s => s.id === game.results?.mvpStudentId);
                      const winningHouse = game.results?.winningHouseId ? HOUSES[game.results.winningHouseId] : null;
                      const gameDef = GAME_LIBRARY.find(g => g.gameKey === game.gameKey);
                      return (
                        <div key={game.id} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                          <div className="flex justify-between items-start mb-1">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-xs text-slate-800 truncate">{game.title}</div>
                              <div className="text-[9px] text-slate-400 truncate">{gameDef?.displayName || 'Dodgeball'}</div>
                            </div>
                            <div className="text-[8px] text-slate-400 ml-2 shrink-0">
                              {new Date(game.endTime).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {winningHouse ? (
                              <div className="flex items-center gap-1">
                                <span className="text-sm">🏆</span>
                                <span className="text-xs font-black" style={{ color: winningHouse.colorHex }}>
                                  {winningHouse.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">No winner</span>
                            )}
                            {mvp && (
                              <div className="flex items-center gap-1 ml-auto">
                                <span className="text-[9px]">⭐</span>
                                <img src={mvp.avatarUrl} className="w-4 h-4 rounded-full" alt="" />
                                <span className="text-[9px] font-bold text-slate-600 truncate max-w-[60px]">{mvp.fullName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {dodgeballGames.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-sm">
                        No dodgeball games yet
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            {/* Footer */}
            <div className="bg-slate-200 rounded-lg p-3 text-center">
              <p className="text-[9px] text-slate-500 font-bold">
                Fun N' Fit Tracker • {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameStatsDashboard;
