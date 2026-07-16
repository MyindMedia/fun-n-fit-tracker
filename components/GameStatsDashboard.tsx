import React, { useEffect, useState, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Student, GameSession, HouseId, Transaction } from '../types';
import { HOUSES, GAME_LIBRARY } from '../constants';
import { Ic, IconProps } from './icons';

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
  icon: React.FC<IconProps>;
  description: string;
  winner: PlayerStats | null;
  runnerUp: PlayerStats | null;
}

type DateRange = 'week' | 'month' | 'quarter' | 'all' | 'custom';
type GameCategory = 'all' | 'dodgeball' | 'speed' | 'teamwork' | 'custom';
type ReportView = 'general' | 'dodgeball';

// Pubzi theme: small notched cut-corner shape for inline elements
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

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
      { title: 'MVP', icon: Ic.Trophy, description: 'Most MVP titles', winner: byMVP[0] || null, runnerUp: byMVP[1] || null },
      { title: 'Top Scorer', icon: Ic.Star, description: 'Highest total points', winner: byPoints[0] || null, runnerUp: byPoints[1] || null },
      { title: 'Most Improved', icon: Ic.Chart, description: 'Greatest points gained', winner: byImproved[0] || null, runnerUp: byImproved[1] || null },
      { title: 'Iron Athlete', icon: Ic.Muscle, description: 'Most games played', winner: byGames[0] || null, runnerUp: byGames[1] || null },
      { title: 'Champion', icon: Ic.Medal, description: 'Most game wins', winner: byWins[0] || null, runnerUp: byWins[1] || null },
      { title: 'Consistent', icon: Ic.Target, description: 'Best avg per game', winner: byAvg[0] || null, runnerUp: byAvg[1] || null },
      { title: 'Rising Star', icon: Ic.Sparkle, description: 'Closest to next rank', winner: byProgress[0] || null, runnerUp: byProgress[1] || null }
    ];
  }, [playerStats]);

  const dodgeballAwards: AwardCategory[] = useMemo(() => {
    const sorted = [...playerStats].filter(p => p.dodgeballGames > 0);

    const byMVP = [...sorted].sort((a, b) => b.dodgeballMVPs - a.dodgeballMVPs);
    const byWins = [...sorted].sort((a, b) => b.dodgeballWins - a.dodgeballWins);
    const byGames = [...sorted].sort((a, b) => b.dodgeballGames - a.dodgeballGames);

    return [
      { title: 'Dodgeball MVP', icon: Ic.Target, description: 'Most dodgeball MVPs', winner: byMVP[0] || null, runnerUp: byMVP[1] || null },
      { title: 'Dodgeball Champion', icon: Ic.Trophy, description: 'Most dodgeball wins', winner: byWins[0] || null, runnerUp: byWins[1] || null },
      { title: 'Dodgeball Warrior', icon: Ic.Muscle, description: 'Most games played', winner: byGames[0] || null, runnerUp: byGames[1] || null },
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
      <div className="fixed inset-0 pz-scope bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center">
        <div className="pz-card p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 mx-auto mb-3" style={{ borderColor: 'var(--pz-volt)' }}></div>
          <p className="font-bold text-sm" style={{ color: 'var(--pz-text)' }}>Loading Stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 pz-scope bg-black/60 backdrop-blur-sm z-[1000]">
      <div className="absolute inset-0 overflow-y-auto overscroll-contain -webkit-overflow-scrolling-touch">
        <div className="min-h-full flex flex-col" style={{ background: 'var(--pz-bg)' }}>
          {/* Sticky Header */}
          <div className="sticky top-0 z-20 text-white print:bg-brand-blue" style={{ background: 'var(--pz-panel)', borderBottom: '1px solid var(--pz-border)' }}>
            <div className="px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="pz-eyebrow text-[9px]">Season Intel</div>
                  <h1 className="text-base tracking-tight truncate text-white flex items-center gap-2">
                    {reportView === 'dodgeball' ? <><Ic.Target size={16} className="shrink-0 text-orange-400" /> Dodgeball Season</> : 'Awards Report'}
                  </h1>
                  <p className="text-[10px]" style={{ color: 'var(--pz-text)' }}>
                    {dateRangeLabel} • {new Date().toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0 print:hidden">
                  <button
                    onClick={handlePrint}
                    className="bg-white/10 border border-white/10 px-2 py-1.5 font-bold text-[10px] active:scale-95 hover:border-[#CBFE1C] transition-all flex items-center justify-center"
                    style={{ clipPath: NOTCH_SM }}
                  >
                    <Ic.Printer size={16} />
                  </button>
                  <button
                    onClick={onClose}
                    className="bg-white/10 border border-white/10 w-8 h-8 font-bold text-sm active:scale-95 flex items-center justify-center hover:border-[#CBFE1C] hover:text-[#CBFE1C] transition-all"
                    style={{ clipPath: NOTCH_SM }}
                  >
                    <Ic.XMark size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Report View Tabs */}
            <div className="flex print:hidden" style={{ background: 'var(--pz-panel-2)', borderTop: '1px solid var(--pz-border)' }}>
              <button
                onClick={() => setReportView('general')}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all active:opacity-70 inline-flex items-center justify-center gap-1.5 ${
                  reportView === 'general' ? 'text-[#CBFE1C]' : 'text-white/50'
                }`}
                style={reportView === 'general' ? { boxShadow: 'inset 0 -2px 0 var(--pz-volt)' } : undefined}
              >
                <Ic.Chart size={14} /> General
              </button>
              <button
                onClick={() => setReportView('dodgeball')}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all active:opacity-70 inline-flex items-center justify-center gap-1.5 ${
                  reportView === 'dodgeball' ? 'text-[#CBFE1C]' : 'text-white/50'
                }`}
                style={reportView === 'dodgeball' ? { boxShadow: 'inset 0 -2px 0 var(--pz-volt)' } : undefined}
              >
                <Ic.Target size={14} /> Dodgeball
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 px-3 py-2 print:hidden overflow-x-auto no-scrollbar" style={{ background: 'var(--pz-panel-2)', borderTop: '1px solid var(--pz-border)' }}>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="bg-white/10 border border-white/10 px-2 py-1.5 text-white font-bold text-[10px] shrink-0 appearance-none min-w-[70px]"
                style={{ clipPath: NOTCH_SM }}
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
                    <span className="text-[9px] font-bold" style={{ color: 'var(--pz-text)' }}>From:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-white/10 border border-white/10 px-2 py-1 text-white font-bold text-[10px] shrink-0"
                      style={{ clipPath: NOTCH_SM }}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold" style={{ color: 'var(--pz-text)' }}>To:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-white/10 border border-white/10 px-2 py-1 text-white font-bold text-[10px] shrink-0"
                      style={{ clipPath: NOTCH_SM }}
                    />
                  </div>
                </>
              )}

              {reportView === 'general' && (
                <select
                  value={gameCategory}
                  onChange={(e) => setGameCategory(e.target.value as GameCategory)}
                  className="bg-white/10 border border-white/10 px-2 py-1.5 text-white font-bold text-[10px] shrink-0 appearance-none min-w-[80px]"
                  style={{ clipPath: NOTCH_SM }}
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
            <div className="grid grid-cols-4" style={{ background: 'var(--pz-panel-2)', borderTop: '1px solid var(--pz-border)' }}>
              <div className="p-2 text-center" style={{ borderRight: '1px solid var(--pz-border)' }}>
                <div className="pz-display text-sm" style={{ color: 'var(--pz-volt)' }}>{reportView === 'dodgeball' ? dodgeballGames.length : filteredGames.length}</div>
                <div className="text-[7px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>Games</div>
              </div>
              <div className="p-2 text-center" style={{ borderRight: '1px solid var(--pz-border)' }}>
                <div className="pz-display text-sm" style={{ color: 'var(--pz-volt)' }}>{students.length}</div>
                <div className="text-[7px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>Athletes</div>
              </div>
              <div className="p-2 text-center" style={{ borderRight: '1px solid var(--pz-border)' }}>
                <div className="pz-display text-sm" style={{ color: 'var(--pz-volt)' }}>
                  {transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                </div>
                <div className="text-[7px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>Points</div>
              </div>
              <div className="p-2 text-center">
                <div className="pz-display text-sm" style={{ color: 'var(--pz-volt)' }}>
                  {reportView === 'dodgeball'
                    ? playerStats.filter(p => p.dodgeballMVPs > 0).length
                    : playerStats.filter(p => p.mvpCount > 0).length
                  }
                </div>
                <div className="text-[7px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>MVPs</div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-3 space-y-3 pb-6">
            {reportView === 'general' ? (
              <>
                {/* House Championship */}
                <section className="pz-card overflow-hidden">
                  <div className="px-3 py-2" style={{ background: 'var(--pz-panel-2)', borderBottom: '1px solid var(--pz-border)' }}>
                    <h2 className="text-xs text-white uppercase flex items-center gap-2">
                      <Ic.Home size={16} /> House Championship
                    </h2>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {houseStats.map((house, index) => (
                      <div
                        key={house.houseId}
                        className="p-2.5 relative overflow-hidden"
                        style={{
                          backgroundColor: `${house.color}15`,
                          border: index === 0 ? '1px solid rgba(251, 191, 36, 0.6)' : '1px solid var(--pz-border)',
                          borderLeft: `3px solid ${house.color}`,
                          clipPath: NOTCH_SM
                        }}
                      >
                        {index === 0 && <div className="absolute top-0.5 right-0.5 text-yellow-400"><Ic.Trophy size={14} /></div>}
                        <div className="pz-display text-lg mb-0.5" style={{ color: house.color }}>#{index + 1}</div>
                        <div className="text-xs font-black text-white uppercase">{house.name}</div>
                        <div className="mt-1.5 space-y-0.5 text-[10px]">
                          <div className="flex justify-between">
                            <span style={{ color: 'var(--pz-text)' }}>Wins:</span>
                            <span className="font-black text-white">{house.totalWins}</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: 'var(--pz-text)' }}>Rate:</span>
                            <span className="font-black text-white">{house.winRate}%</span>
                          </div>
                        </div>
                        {house.topPlayer && (
                          <div className="mt-1.5 pt-1.5" style={{ borderTop: '1px solid var(--pz-border)' }}>
                            <div className="flex items-center gap-1">
                              <img src={house.topPlayer.avatarUrl} className="w-4 h-4 rounded-full" alt="" />
                              <span className="text-[9px] font-bold truncate text-white">{house.topPlayer.fullName}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Individual Awards */}
                <section className="pz-card overflow-hidden">
                  <div className="px-3 py-2" style={{ background: 'var(--pz-panel-2)', borderBottom: '1px solid var(--pz-border)' }}>
                    <h2 className="text-xs text-white uppercase flex items-center gap-2">
                      <Ic.Medal size={16} /> Individual Awards
                    </h2>
                  </div>
                  <div className="p-3 space-y-2">
                    {awards.slice(0, 5).map((award) => (
                      <div
                        key={award.title}
                        className="pz-card-sm p-2.5"
                        style={{ background: 'var(--pz-panel-2)' }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div style={{ color: 'var(--pz-volt)' }}><award.icon size={20} /></div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[10px] font-black text-white uppercase">{award.title}</h3>
                            <p className="text-[8px] truncate" style={{ color: 'var(--pz-text)' }}>{award.description}</p>
                          </div>
                        </div>

                        {award.winner ? (
                          <div className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 p-2" style={{ clipPath: NOTCH_SM }}>
                            <span className="text-yellow-400 flex items-center"><Ic.Medal size={16} /></span>
                            <img src={award.winner.student.avatarUrl} className="w-7 h-7 rounded-full border-2 border-yellow-400" alt="" />
                            <div className="flex-grow min-w-0">
                              <div className="text-[10px] font-black truncate text-white">{award.winner.student.fullName}</div>
                              <div className="text-[8px] font-bold" style={{ color: HOUSES[award.winner.student.houseId].colorHex }}>
                                {HOUSES[award.winner.student.houseId].name}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-2 text-[10px]" style={{ color: 'var(--pz-text)' }}>No data</div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Top 10 Leaderboard */}
                <section className="pz-card overflow-hidden">
                  <div className="px-3 py-2" style={{ background: 'var(--pz-panel-2)', borderBottom: '1px solid var(--pz-border)' }}>
                    <h2 className="text-xs text-white uppercase flex items-center gap-2">
                      <Ic.Chart size={16} /> Top 10 Athletes
                    </h2>
                  </div>
                  <div className="divide-y divide-white/5">
                    {playerStats.slice(0, 10).map((stat, index) => (
                      <div key={stat.student.id} className="flex items-center gap-2 p-2.5">
                        <div className={`text-sm font-black w-6 shrink-0 flex justify-center ${
                          index === 0 ? 'text-yellow-400' :
                          index === 1 ? 'text-slate-300' :
                          index === 2 ? 'text-amber-500' : 'text-slate-500'
                        }`}>
                          {index < 3 ? <Ic.Medal size={16} /> : `#${index + 1}`}
                        </div>
                        <img src={stat.student.avatarUrl} className="w-8 h-8 rounded-full border-2 border-white/20 shrink-0" alt="" />
                        <div className="flex-grow min-w-0">
                          <div className="text-xs font-bold text-white truncate">{stat.student.fullName}</div>
                          <div className="flex gap-2 text-[8px] font-bold" style={{ color: 'var(--pz-text)' }}>
                            <span>{stat.gamesPlayed}g</span>
                            {stat.mvpCount > 0 && <span className="text-yellow-400">{stat.mvpCount}MVP</span>}
                          </div>
                        </div>
                        <div
                          className="px-1.5 py-0.5 text-[8px] font-black text-white shrink-0"
                          style={{ backgroundColor: HOUSES[stat.student.houseId].colorHex, clipPath: NOTCH_SM }}
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
                <div className="pz-card p-4 text-white text-center" style={{ borderColor: 'rgba(249, 115, 22, 0.5)', background: 'linear-gradient(to right, rgba(239, 68, 68, 0.18), rgba(249, 115, 22, 0.12)), var(--pz-panel)' }}>
                  <div className="mb-1 flex justify-center text-orange-400"><Ic.Target size={32} /></div>
                  <h2 className="text-lg uppercase text-orange-400">Dodgeball Season</h2>
                  <p className="text-xs" style={{ color: 'var(--pz-text)' }}>{dodgeballGames.length} matches played</p>
                </div>

                {/* House Dodgeball Standings */}
                <section className="pz-card overflow-hidden">
                  <div className="px-3 py-2" style={{ background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid var(--pz-border)' }}>
                    <h2 className="text-xs text-red-400 uppercase flex items-center gap-2">
                      <Ic.Trophy size={16} /> House Standings
                    </h2>
                  </div>
                  <div className="p-3 space-y-2">
                    {dodgeballHouseStats.map((house, index) => (
                      <div
                        key={house.houseId}
                        className="flex items-center gap-3 p-3"
                        style={{
                          background: index === 0 ? 'linear-gradient(to right, rgba(251, 191, 36, 0.12), rgba(249, 115, 22, 0.08)), var(--pz-panel-2)' : 'var(--pz-panel-2)',
                          border: index === 0 ? '1px solid rgba(251, 191, 36, 0.6)' : '1px solid var(--pz-border)',
                          clipPath: NOTCH_SM
                        }}
                      >
                        <div className={`text-xl font-black shrink-0 flex items-center ${
                          index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-500' : 'text-slate-500'
                        }`}>
                          {index < 3 ? <Ic.Medal size={20} /> : `#${index + 1}`}
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="font-black text-sm uppercase truncate" style={{ color: house.color }}>{house.name}</div>
                          <div className="text-[10px]" style={{ color: 'var(--pz-text)' }}>
                            {house.dodgeballGames}g • {house.dodgeballGames > 0 ? Math.round((house.dodgeballWins / house.dodgeballGames) * 100) : 0}%
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="pz-display text-xl" style={{ color: house.color }}>{house.dodgeballWins}</div>
                          <div className="text-[8px] uppercase font-bold" style={{ color: 'var(--pz-text)' }}>wins</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Dodgeball Awards */}
                <section className="pz-card overflow-hidden">
                  <div className="px-3 py-2" style={{ background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid var(--pz-border)' }}>
                    <h2 className="text-xs text-red-400 uppercase flex items-center gap-2">
                      <Ic.Target size={16} /> Season Awards
                    </h2>
                  </div>
                  <div className="p-3 space-y-2">
                    {dodgeballAwards.map((award) => (
                      <div
                        key={award.title}
                        className="p-3"
                        style={{ background: 'linear-gradient(to right, rgba(239, 68, 68, 0.08), rgba(249, 115, 22, 0.05)), var(--pz-panel-2)', border: '1px solid rgba(239, 68, 68, 0.25)', clipPath: NOTCH_SM }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-red-400"><award.icon size={24} /></div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs font-black text-white uppercase">{award.title}</h3>
                            <p className="text-[9px]" style={{ color: 'var(--pz-text)' }}>{award.description}</p>
                          </div>
                        </div>

                        {award.winner ? (
                          <div className="flex items-center gap-2 p-2" style={{ background: 'var(--pz-panel)', border: '1px solid var(--pz-border)', clipPath: NOTCH_SM }}>
                            <span className="text-yellow-400 flex items-center"><Ic.Medal size={18} /></span>
                            <img src={award.winner.student.avatarUrl} className="w-9 h-9 rounded-full border-2 border-yellow-400 shrink-0" alt="" />
                            <div className="flex-grow min-w-0">
                              <div className="text-sm font-black truncate text-white">{award.winner.student.fullName}</div>
                              <div className="text-[10px] font-bold" style={{ color: HOUSES[award.winner.student.houseId].colorHex }}>
                                {HOUSES[award.winner.student.houseId].name}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="pz-display text-lg text-red-400">
                                {award.title.includes('MVP') ? award.winner.dodgeballMVPs :
                                 award.title.includes('Champion') ? award.winner.dodgeballWins :
                                 award.winner.dodgeballGames}
                              </div>
                              <div className="text-[8px] uppercase" style={{ color: 'var(--pz-text)' }}>
                                {award.title.includes('MVP') ? 'MVPs' :
                                 award.title.includes('Champion') ? 'wins' : 'games'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-3 text-xs" style={{ color: 'var(--pz-text)' }}>No dodgeball data yet</div>
                        )}

                        {award.runnerUp && (
                          <div className="flex items-center gap-2 mt-2 bg-white/5 p-2" style={{ clipPath: NOTCH_SM }}>
                            <span className="text-slate-300 flex items-center"><Ic.Medal size={14} /></span>
                            <img src={award.runnerUp.student.avatarUrl} className="w-6 h-6 rounded-full border border-white/20" alt="" />
                            <span className="text-[10px] font-bold truncate text-white">{award.runnerUp.student.fullName}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Top Dodgeball Players */}
                <section className="pz-card overflow-hidden">
                  <div className="px-3 py-2" style={{ background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid var(--pz-border)' }}>
                    <h2 className="text-xs text-red-400 uppercase flex items-center gap-2">
                      <Ic.Fire size={16} /> Top Players
                    </h2>
                  </div>
                  <div className="divide-y divide-white/5">
                    {playerStats
                      .filter(p => p.dodgeballGames > 0)
                      .sort((a, b) => b.dodgeballWins - a.dodgeballWins)
                      .slice(0, 10)
                      .map((stat, index) => (
                      <div key={stat.student.id} className="flex items-center gap-2 p-2.5">
                        <div className={`text-sm font-black w-6 shrink-0 flex justify-center ${
                          index === 0 ? 'text-yellow-400' :
                          index === 1 ? 'text-slate-300' :
                          index === 2 ? 'text-amber-500' : 'text-slate-500'
                        }`}>
                          {index < 3 ? <Ic.Medal size={16} /> : `#${index + 1}`}
                        </div>
                        <img src={stat.student.avatarUrl} className="w-8 h-8 rounded-full border-2 border-white/20 shrink-0" alt="" />
                        <div className="flex-grow min-w-0">
                          <div className="text-xs font-bold text-white truncate">{stat.student.fullName}</div>
                          <div className="flex gap-2 text-[8px] font-bold" style={{ color: 'var(--pz-text)' }}>
                            <span>{stat.dodgeballGames}g</span>
                            <span className="text-red-400">{stat.dodgeballWins}W</span>
                            {stat.dodgeballMVPs > 0 && <span className="text-yellow-400">{stat.dodgeballMVPs}MVP</span>}
                          </div>
                        </div>
                        <div
                          className="px-1.5 py-0.5 text-[8px] font-black text-white shrink-0"
                          style={{ backgroundColor: HOUSES[stat.student.houseId].colorHex, clipPath: NOTCH_SM }}
                        >
                          {stat.dodgeballWins}W
                        </div>
                      </div>
                    ))}
                    {playerStats.filter(p => p.dodgeballGames > 0).length === 0 && (
                      <div className="text-center py-8 text-sm" style={{ color: 'var(--pz-text)' }}>
                        No dodgeball games yet
                      </div>
                    )}
                  </div>
                </section>

                {/* Recent Dodgeball Games */}
                <section className="pz-card overflow-hidden">
                  <div className="px-3 py-2" style={{ background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid var(--pz-border)' }}>
                    <h2 className="text-xs text-red-400 uppercase flex items-center gap-2">
                      <Ic.History size={16} /> Recent Games
                    </h2>
                  </div>
                  <div className="p-3 space-y-2">
                    {dodgeballGames.slice(0, 6).map((game) => {
                      const mvp = students.find(s => s.id === game.results?.mvpStudentId);
                      const winningHouse = game.results?.winningHouseId ? HOUSES[game.results.winningHouseId] : null;
                      const gameDef = GAME_LIBRARY.find(g => g.gameKey === game.gameKey);
                      return (
                        <div key={game.id} className="pz-card-sm p-2.5" style={{ background: 'var(--pz-panel-2)' }}>
                          <div className="flex justify-between items-start mb-1">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-xs text-white truncate">{game.title}</div>
                              <div className="text-[9px] truncate" style={{ color: 'var(--pz-text)' }}>{gameDef?.displayName || 'Dodgeball'}</div>
                            </div>
                            <div className="text-[8px] ml-2 shrink-0" style={{ color: 'var(--pz-text)' }}>
                              {new Date(game.endTime).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {winningHouse ? (
                              <div className="flex items-center gap-1">
                                <span className="flex items-center" style={{ color: winningHouse.colorHex }}><Ic.Trophy size={14} /></span>
                                <span className="text-xs font-black" style={{ color: winningHouse.colorHex }}>
                                  {winningHouse.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px]" style={{ color: 'var(--pz-text)' }}>No winner</span>
                            )}
                            {mvp && (
                              <div className="flex items-center gap-1 ml-auto">
                                <span className="text-yellow-400 flex items-center"><Ic.Star size={12} /></span>
                                <img src={mvp.avatarUrl} className="w-4 h-4 rounded-full" alt="" />
                                <span className="text-[9px] font-bold truncate max-w-[60px]" style={{ color: 'var(--pz-text)' }}>{mvp.fullName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {dodgeballGames.length === 0 && (
                      <div className="text-center py-6 text-sm" style={{ color: 'var(--pz-text)' }}>
                        No dodgeball games yet
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            {/* Footer */}
            <div className="p-3 text-center" style={{ background: 'var(--pz-panel)', border: '1px solid var(--pz-border)', clipPath: NOTCH_SM }}>
              <p className="text-[9px] font-bold" style={{ color: 'var(--pz-text)' }}>
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
