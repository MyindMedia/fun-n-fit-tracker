
import React, { useState } from 'react';
import { GameSession, Student } from '../../types';
// Fix: Import supabaseService instead of deprecated mockBackend
import { supabaseService } from '../../services/supabaseService';
import GameSessionDetailModal from './GameSessionDetailModal';
import { Ic } from '../icons';

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
    <section className="pz-scope pz-card p-8">
      <h2 className="text-3xl text-white mb-8 tracking-tight inline-flex items-center gap-2.5"><Ic.Timer size={24} className="text-[#CBFE1C]" /> Active Session Manager</h2>

      {!isSelectingRoster ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black mb-2 uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Activity Name</label>
            <input
              type="text"
              value={gameTitle}
              onChange={(e) => setGameTitle(e.target.value)}
              className="w-full px-5 py-4 border border-white/10 bg-[#171C27] font-black text-white placeholder-white/40 focus:border-[#CBFE1C] outline-none"
              placeholder="e.g. Sprints"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black mb-2 uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Duration (Min)</label>
            <input
              type="number"
              value={gameDuration}
              onChange={(e) => setGameDuration(Number(e.target.value))}
              className="w-full px-5 py-4 border border-white/10 bg-[#171C27] font-black text-white text-center focus:border-[#CBFE1C] outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setIsSelectingRoster(true)}
              disabled={!gameTitle.trim()}
              className="pz-btn w-full py-4 disabled:opacity-30 hover:scale-[1.02] transition-all"
            >
              Set Roster
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-[#CBFE1C] tracking-widest text-sm">Select Participating Athletes ({selectedRoster.size})</h3>
             <button onClick={() => setIsSelectingRoster(false)} className="text-white/40 font-black text-xs uppercase hover:text-white transition-colors">Cancel</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 max-h-48 overflow-y-auto p-2 border border-white/10 custom-scrollbar">
            {activeStudents.map(s => (
              <div
                key={s.id}
                onClick={() => toggleStudent(s.id)}
                className={`p-3 border cursor-pointer transition-all text-xs font-black flex items-center gap-2 ${selectedRoster.has(s.id) ? 'bg-[#171C27] border-[#CBFE1C] text-white' : 'bg-white/5 border-white/10 text-white/50 hover:border-[#CBFE1C]/50'}`}
              >
                <div className={`w-3 h-3 rounded-full border ${selectedRoster.has(s.id) ? 'bg-[#CBFE1C] border-[#CBFE1C]' : 'bg-white/10 border-white/20'}`} />
                {s.fullName}
              </div>
            ))}
            {activeStudents.length === 0 && <div className="col-span-3 text-center py-4 text-xs italic" style={{ color: 'var(--pz-text)' }}>No athletes marked as present today!</div>}
          </div>
          <button
            onClick={handleLaunch}
            disabled={selectedRoster.size === 0}
            className="pz-btn w-full py-5 disabled:opacity-30 transition-all"
          >
            Launch {gameTitle} Game
          </button>
        </div>
      )}

      <div className="mt-10 space-y-6">
        <h3 className="text-[10px] tracking-widest" style={{ color: 'var(--pz-text)' }}>Active Games</h3>
        {activeGames.length === 0 && (
          <div className="text-center py-10 bg-white/[0.02] border border-dashed border-white/15 italic text-sm" style={{ color: 'var(--pz-text)' }}>No games currently running.</div>
        )}
        {activeGames.map(g => (
          <div key={g.id} className="pz-card-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-[#CBFE1C]/40 transition-all" style={{ background: 'var(--pz-panel-2)' }}>
            <div>
              <div className="pz-display text-2xl text-white">{g.title}</div>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-[10px] font-black text-[#CBFE1C] uppercase tracking-widest">Coach {g.startedBy}</span>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>{g.roster.length} Athletes Participating</span>
              </div>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
               <div className="text-right mr-4 hidden md:block">
                  <div className="text-[10px] font-black uppercase" style={{ color: 'var(--pz-text)' }}>Remaining</div>
                  <div className="font-mono font-black text-[#CBFE1C] text-xl">
                    {Math.max(0, Math.floor((g.endTime - now)/60000))}m
                  </div>
               </div>
               <button
                 onClick={() => setManagingGame(g)}
                 className="pz-btn-ghost flex-grow md:flex-none px-6 py-4 text-xs"
               >
                 Manage Game
               </button>
               <button
                 // Fix: Use supabaseService instead of mockBackend
                 onClick={() => supabaseService.stopGame(g.id)}
                 className="bg-red-500/10 text-red-400 border border-red-500/40 font-black px-6 py-4 uppercase tracking-wider hover:bg-red-500 hover:text-white transition-all text-xs"
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
