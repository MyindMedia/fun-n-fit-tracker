
import React, { useEffect, useState } from 'react';
import { supabaseService } from '../../services/supabaseService';

const UndoHistory: React.FC<{ adminName: string }> = ({ adminName }) => {
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  useEffect(() => {
    supabaseService.getActiveGames().then(setActiveSessions);
    const u = supabaseService.on('active_games_update', setActiveSessions);
    return () => u();
  }, []);

  if (activeSessions.length === 0) return null;

  return (
    <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-red-50">
      <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-3">
         <span className="bg-red-500 text-white p-2 rounded-xl text-xs">↩️</span> Scoring Safety Net
      </h2>
      <div className="space-y-4">
        {activeSessions.map(session => (
          <div key={session.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <div>
                <div className="text-xs font-black text-slate-800">{session.title}</div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Session</div>
             </div>
             <button 
               onClick={() => supabaseService.undoLastScoreEvent(session.id, adminName)}
               className="bg-white border-2 border-red-100 text-red-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all shadow-sm"
             >
               Undo Last Action
             </button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[9px] font-black text-slate-400 uppercase text-center leading-relaxed">
        * Undoing reverses the latest recorded point action.
      </p>
    </div>
  );
};

export default UndoHistory;
