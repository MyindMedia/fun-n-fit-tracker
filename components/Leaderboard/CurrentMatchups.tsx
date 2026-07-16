
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

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[40] flex flex-col gap-2 pointer-events-none w-full max-w-lg px-6">
      {activeSessions.map((session, idx) => {
        const sessionRoster = students.filter(s => session.roster.includes(s.id));
        
        return (
          <div key={session.id} className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border-b-4 border-brand-blue flex items-center justify-between pointer-events-auto animate-slide-up">
            <div className="flex items-center gap-4">
              <div className="bg-slate-900 text-white w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0">{idx + 1}</div>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Live Game</div>
                <div className="text-sm font-black text-slate-800 leading-tight truncate max-w-[140px]">{session.title}</div>
              </div>
            </div>
            
            <div className="flex -space-x-2 overflow-hidden px-2">
              {sessionRoster.slice(0, 4).map(s => (
                <img 
                  key={s.id} 
                  src={s.avatarUrl} 
                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-100" 
                  title={s.fullName}
                />
              ))}
              {sessionRoster.length > 4 && (
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-slate-500">
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
