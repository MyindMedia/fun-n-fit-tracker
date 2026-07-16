
import React, { useState } from 'react';
import { GameSession, Student } from '../../types';
// Fix: Import supabaseService instead of deprecated mockBackend
import { supabaseService } from '../../services/supabaseService';
import GameSessionDetailModal from './GameSessionDetailModal';

interface GameManagerProps {
  adminName: string;
  activeGames: GameSession[];
  students: Student[];
}

const GameManager: React.FC<GameManagerProps> = ({ adminName, activeGames, students }) => {
  const [gameTitle, setGameTitle] = useState('');
  const [gameDuration, setGameDuration] = useState(15);
  const [selectedRoster, setSelectedRoster] = useState<Set<string>>(new Set());
  const [isSelectingRoster, setIsSelectingRoster] = useState(false);
  const [managingGame, setManagingGame] = useState<GameSession | null>(null);
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeStudents = students.filter(s => s.isPresent);

  const toggleStudent = (id: string) => {
    const next = new Set(selectedRoster);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedRoster(next);
  };

  const handleLaunch = async () => {
    if (gameTitle.trim() && selectedRoster.size > 0) {
      // Fix: Use supabaseService instead of mockBackend.
      // Note: Using gameTitle as gameKey as this is a legacy component fix.
      await supabaseService.startGame(gameTitle.trim(), adminName, Array.from(selectedRoster), gameDuration * 60);

      // Force page refresh to show active game immediately
      console.log('🔄 Refreshing page to show active game...');
      window.location.reload();
    }
  };

  return (
    <section className="bg-white rounded-[2rem] shadow-xl p-8 border border-slate-200">
      <h2 className="text-3xl font-black text-slate-900 mb-8 font-display uppercase tracking-tight">⏱️ Active Session Manager</h2>
      
      {!isSelectingRoster ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Activity Name</label>
            <input 
              type="text" 
              value={gameTitle} 
              onChange={(e) => setGameTitle(e.target.value)} 
              className="w-full px-5 py-4 rounded-xl border-2 border-slate-200 bg-white font-black text-slate-900 focus:border-brand-blue outline-none shadow-sm" 
              placeholder="e.g. Sprints" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Duration (Min)</label>
            <input 
              type="number" 
              value={gameDuration} 
              onChange={(e) => setGameDuration(Number(e.target.value))} 
              className="w-full px-5 py-4 rounded-xl border-2 border-slate-200 bg-white font-black text-slate-900 text-center shadow-sm" 
            />
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => setIsSelectingRoster(true)}
              disabled={!gameTitle.trim()} 
              className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-xl disabled:opacity-30 uppercase tracking-widest hover:scale-[1.02] transition-all"
            >
              Set Roster
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-black text-brand-blue uppercase tracking-widest text-sm">Select Participating Athletes ({selectedRoster.size})</h3>
             <button onClick={() => setIsSelectingRoster(false)} className="text-slate-400 font-black text-xs uppercase hover:text-slate-600 transition-colors">Cancel</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 max-h-48 overflow-y-auto p-2 border-2 border-slate-50 rounded-2xl custom-scrollbar">
            {activeStudents.map(s => (
              <div 
                key={s.id} 
                onClick={() => toggleStudent(s.id)}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-xs font-black flex items-center gap-2 ${selectedRoster.has(s.id) ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500 hover:border-brand-blue'}`}
              >
                <div className={`w-3 h-3 rounded-full border ${selectedRoster.has(s.id) ? 'bg-brand-blue border-white' : 'bg-slate-200 border-slate-300'}`} />
                {s.fullName}
              </div>
            ))}
            {activeStudents.length === 0 && <div className="col-span-3 text-center py-4 text-slate-400 text-xs italic">No athletes marked as present today!</div>}
          </div>
          <button 
            onClick={handleLaunch} 
            disabled={selectedRoster.size === 0}
            className="w-full bg-brand-green text-white font-black py-5 rounded-2xl shadow-xl hover:bg-emerald-600 transition-all uppercase tracking-widest"
          >
            Launch {gameTitle} Game
          </button>
        </div>
      )}
      
      <div className="mt-10 space-y-6">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Games</h3>
        {activeGames.length === 0 && (
          <div className="text-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400 italic text-sm">No games currently running.</div>
        )}
        {activeGames.map(g => (
          <div key={g.id} className="p-6 bg-white border-2 border-slate-100 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-brand-blue/30 transition-all shadow-sm">
            <div>
              <div className="font-black text-2xl text-slate-900">{g.title}</div>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest">Coach {g.startedBy}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{g.roster.length} Athletes Participating</span>
              </div>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
               <div className="text-right mr-4 hidden md:block">
                  <div className="text-[10px] font-black text-slate-400 uppercase">Remaining</div>
                  <div className="font-mono font-black text-brand-blue text-xl">
                    {Math.max(0, Math.floor((g.endTime - now)/60000))}m
                  </div>
               </div>
               <button 
                 onClick={() => setManagingGame(g)}
                 className="flex-grow md:flex-none bg-slate-100 text-slate-900 font-black px-6 py-4 rounded-2xl uppercase tracking-wider hover:bg-slate-900 hover:text-white transition-all text-xs"
               >
                 Manage Game
               </button>
               <button 
                 // Fix: Use supabaseService instead of mockBackend
                 onClick={() => supabaseService.stopGame(g.id)} 
                 className="bg-red-50 text-red-500 border border-red-100 font-black px-6 py-4 rounded-2xl uppercase tracking-wider hover:bg-red-500 hover:text-white transition-all text-xs"
               >
                 Stop
               </button>
            </div>
          </div>
        ))}
      </div>

      {managingGame && (
        <GameSessionDetailModal 
          game={managingGame} 
          students={students} 
          adminName={adminName} 
          onClose={() => setManagingGame(null)} 
        />
      )}
    </section>
  );
};

export default GameManager;
