
import React, { useEffect, useState } from 'react';
import { GameSession, Student } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { HOUSES } from '../../constants';

const CurrentMatchups: React.FC = () => {
  const [activeSessions, setActiveSessions] = useState<GameSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [sessions, s] = await Promise.all([
        supabaseService.getActiveGames(),
        supabaseService.getStudents()
      ]);
      setActiveSessions(sessions);
      setStudents(s);
    };
    fetchData();
    const u1 = supabaseService.on('active_games_update', setActiveSessions);
    const u2 = supabaseService.on('points_update', fetchData);
    return () => { u1(); u2(); };
  }, []);

  if (activeSessions.length === 0) return null;

  // Pubzi theme: small notched cut-corner shape for inline elements
  const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[40] flex flex-col gap-2 pointer-events-none w-full max-w-lg px-6 pz-scope">
      {activeSessions.map((session, idx) => {
        const sessionRoster = students.filter(s => session.roster.includes(s.id));

        return (
          <div
            key={session.id}
            className="pz-card relative p-4 flex items-center justify-between pointer-events-auto animate-slide-up"
            style={{ background: 'rgba(18, 22, 31, 0.96)' }}
          >
            <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'var(--pz-volt)' }} />
            <div className="flex items-center gap-4">
              <div
                className="pz-display w-8 h-8 flex items-center justify-center text-xs shrink-0 bg-white/10 text-white"
                style={{ clipPath: NOTCH_SM }}
              >
                {idx + 1}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest leading-none mb-1" style={{ color: 'var(--pz-volt)' }}>
                  <span className="w-1.5 h-1.5 rounded-full pz-live shrink-0" style={{ background: 'var(--pz-volt)' }} />
                  Live Game
                </div>
                <div className="text-sm font-bold text-white leading-tight truncate max-w-[140px]">{session.title}</div>
              </div>
            </div>

            <div className="flex -space-x-2 overflow-hidden px-2">
              {sessionRoster.slice(0, 4).map(s => (
                <img
                  key={s.id}
                  src={s.avatarUrl}
                  className="w-8 h-8 rounded-full border-2 shadow-sm"
                  style={{ borderColor: 'var(--pz-panel-2)' }}
                  title={s.fullName}
                />
              ))}
              {sessionRoster.length > 4 && (
                <div className="w-8 h-8 rounded-full bg-white/10 border-2 flex items-center justify-center text-[8px] font-black text-white/70" style={{ borderColor: 'var(--pz-panel-2)' }}>
                  +{sessionRoster.length - 4}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CurrentMatchups;
