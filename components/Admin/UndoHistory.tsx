
import React, { useEffect, useState } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { Ic } from '../icons';

const UndoHistory: React.FC<{ adminName: string }> = ({ adminName }) => {
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  useEffect(() => {
    supabaseService.getActiveGames().then(setActiveSessions);
    const u = supabaseService.on('active_games_update', setActiveSessions);
    return () => u();
  }, []);

  if (activeSessions.length === 0) return null;

  return (
    <div className="pz-scope pz-card p-8" style={{ borderColor: 'rgba(239, 68, 68, 0.25)' }}>
      <h2 className="text-xl text-white mb-6 tracking-tight flex items-center gap-3">
         <span className="bg-red-500 text-white p-2 inline-flex items-center justify-center"><Ic.History size={16} /></span> Scoring Safety Net
      </h2>
      <div className="space-y-4">
        {activeSessions.map(session => (
          <div key={session.id} className="flex justify-between items-center bg-white/5 p-4 border border-white/10">
             <div>
                <div className="text-xs font-black text-white">{session.title}</div>
                <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Live Session</div>
             </div>
             <button
               onClick={() => supabaseService.undoLastScoreEvent(session.id, adminName)}
               className="touch-btn bg-red-500/10 border border-red-500/40 text-red-400 px-6 py-2 min-h-[44px] text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all"
             >
               Undo Last Action
             </button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[9px] font-black uppercase text-center leading-relaxed" style={{ color: 'var(--pz-text)' }}>
        * Undoing reverses the latest recorded point action.
      </p>
    </div>
  );
};

export default UndoHistory;
