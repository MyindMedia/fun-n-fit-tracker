import React, { useEffect, useState } from 'react';
import { CheckIn } from '../../types';
import { gameCenter } from '../../services/gameCenter';

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [history, visits] = await Promise.all([
          gameCenter.checkinHistoryForStudent(studentId),
          gameCenter.visitsForStudent(studentId),
        ]);
        if (cancelled) return;
        setStats({
          streak: computeStreak(history),
          totalCheckIns: new Set(history.map((c) => c.date)).size,
          businessVisits: visits.length,
        });
      } catch (err) {
        console.error('Game center stats failed:', err);
        if (!cancelled) setStats({ streak: 0, totalCheckIns: 0, businessVisits: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const tiles: Array<{ icon: string; value: number | undefined; label: string }> = [
    { icon: '🔥', value: stats?.streak, label: 'Day Streak' },
    { icon: '✅', value: stats?.totalCheckIns, label: 'Check-Ins' },
    { icon: '🏪', value: stats?.businessVisits, label: 'Town Visits' },
  ];

  return (
    <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-2xl p-5 text-white">
      <div className="text-[10px] font-black uppercase text-indigo-300 tracking-widest mb-3">
        🎮 Game Center
      </div>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-xl mb-1">{t.icon}</div>
            <div className="text-2xl font-black">{stats ? t.value : '—'}</div>
            <div className="text-[9px] font-bold uppercase text-slate-400">{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameCenterStats;
