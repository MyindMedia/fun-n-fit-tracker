import React, { useEffect, useState } from 'react';
import { CheckIn } from '../../types';
import { gameCenter } from '../../services/gameCenter';
import { Ic, IconProps } from '../icons';

interface GameCenterStatsProps {
  studentId: string;
}

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Consecutive check-in days ending today (or yesterday, if they haven't arrived yet today). */
const computeStreak = (checkIns: CheckIn[]): number => {
  const days = new Set(checkIns.map((c) => c.date));
  const cursor = new Date();
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

const GameCenterStats: React.FC<GameCenterStatsProps> = ({ studentId }) => {
  const [stats, setStats] = useState<{
    streak: number;
    totalCheckIns: number;
    businessVisits: number;
  } | null>(null);
  const [games, setGames] = useState<Array<{
    gameSessionId: string; gameTitle: string; endTime: number; points: number; awards: string[];
  }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [history, visits, gameStats] = await Promise.all([
          gameCenter.checkinHistoryForStudent(studentId),
          gameCenter.visitsForStudent(studentId),
          gameCenter.gameStatsForStudent(studentId, 8),
        ]);
        if (cancelled) return;
        setStats({
          streak: computeStreak(history),
          totalCheckIns: new Set(history.map((c) => c.date)).size,
          businessVisits: visits.length,
        });
        setGames(gameStats);
      } catch (err) {
        console.error('Game center stats failed:', err);
        if (!cancelled) setStats({ streak: 0, totalCheckIns: 0, businessVisits: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const tiles: Array<{ icon: React.FC<IconProps>; value: number | undefined; label: string }> = [
    { icon: Ic.Fire, value: stats?.streak, label: 'Day Streak' },
    { icon: Ic.CheckCircle, value: stats?.totalCheckIns, label: 'Check-Ins' },
    { icon: Ic.Store, value: stats?.businessVisits, label: 'Town Visits' },
  ];

  const fmtDate = (ts: number): string =>
    ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

  return (
    <div className="pz-card p-5 text-white">
      <div className="pz-eyebrow mb-3 flex items-center gap-2">
        <Ic.Controller size={16} /> Game Center
      </div>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="pz-card-sm p-4 text-center" style={{ background: 'var(--pz-panel-2)' }}>
            <div className="mb-1 flex justify-center" style={{ color: 'var(--pz-volt)' }}><t.icon size={22} /></div>
            <div className="pz-display text-2xl" style={{ color: 'var(--pz-volt)' }}>{stats ? t.value : '—'}</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>{t.label}</div>
          </div>
        ))}
      </div>

      {games.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--pz-text)' }}>
            Points by Game
          </div>
          <div className="space-y-2">
            {games.map((g) => (
              <div
                key={g.gameSessionId}
                className="pz-card-sm p-3 flex items-center gap-3"
                style={{ background: 'var(--pz-panel-2)' }}
              >
                <div className="flex-grow min-w-0">
                  <div className="text-sm font-bold text-white truncate">{g.gameTitle}</div>
                  <div className="text-[11px] flex items-center gap-2 flex-wrap" style={{ color: 'var(--pz-text)' }}>
                    <span>{fmtDate(g.endTime)}</span>
                    {g.awards.length > 0 && (
                      <span className="inline-flex items-center gap-1" style={{ color: 'var(--pz-volt)' }}>
                        <Ic.Medal size={11} /> {g.awards.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="pz-display text-lg shrink-0" style={{ color: 'var(--pz-volt)' }}>
                  {g.points >= 0 ? '+' : ''}{g.points}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameCenterStats;
