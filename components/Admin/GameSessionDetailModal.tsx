
import React, { useState, useEffect, useRef } from 'react';
import { GameSession, Student } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { Ic } from '../icons';

interface GameSessionDetailModalProps {
  game: GameSession;
  students: Student[];
  adminName: string;
  onClose: () => void;
}

const StudentTimer: React.FC<{ student: Student; gameTitle: string; adminName: string }> = ({ student, gameTitle, adminName }) => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  const handleSave = async () => {
    await supabaseService.logGameTime(student.id, time, gameTitle, adminName);
    setIsRunning(false);
    setTime(0);
  };

  return (
    <div className="flex items-center gap-4 bg-white/5 p-4 border border-white/10">
       <div className="text-xl font-mono font-black text-white min-w-[60px]">{time}s</div>
       <button
         onClick={() => setIsRunning(!isRunning)}
         className={`px-4 py-2 text-[10px] font-black uppercase transition-all ${isRunning ? 'bg-orange-500 text-white' : 'bg-[#CBFE1C] text-[#0B0E13]'}`}
       >
         {isRunning ? 'Stop' : 'Start'}
       </button>
       {time > 0 && !isRunning && (
         <button onClick={handleSave} className="bg-emerald-500 text-white px-4 py-2 text-[10px] font-black uppercase">Log</button>
       )}
    </div>
  );
};

const GameSessionDetailModal: React.FC<GameSessionDetailModalProps> = ({ game, students, adminName, onClose }) => {
  const rosterStudents = students.filter(s => game.roster.includes(s.id));

  return (
    <div className="pz-scope fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="pz-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 sm:p-8 flex justify-between items-center gap-3 shrink-0" style={{ background: 'var(--pz-panel-2)', borderBottom: '1px solid var(--pz-border)' }}>
          <div>
            <h2 className="text-2xl sm:text-4xl text-white break-words">{game.title}</h2>
            <p className="font-black text-xs uppercase tracking-widest mt-1 text-[#CBFE1C]">Live Performance Tracking • Coach {game.startedBy}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-white/60 flex items-center justify-center hover:bg-[#CBFE1C] hover:text-[#0B0E13] transition-all"><Ic.XMark size={20} /></button>
        </div>

        <div className="flex-grow overflow-y-auto p-3 sm:p-8 custom-scrollbar space-y-4">
          {rosterStudents.map(s => (
            <div key={s.id} className="pz-card-sm p-4 sm:p-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-6 group hover:border-[#CBFE1C]/40 transition-all" style={{ background: 'var(--pz-panel-2)' }}>
              <div className="flex items-center gap-3 sm:gap-6 flex-grow min-w-0">
                <img src={s.avatarUrl} className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-full bg-white/10 border-2 border-white/10 object-cover" />
                <div className="min-w-0">
                  <div className="text-base sm:text-xl font-black text-white truncate">{s.fullName}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: 'var(--pz-text)' }}>Current Session Points: {s.points}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full md:w-auto">
                 <StudentTimer student={s} gameTitle={game.title} adminName={adminName} />
                 <div className="flex flex-wrap gap-2 items-center">
                    {[1,3,5,10].map(val => (
                      <button
                        key={val}
                        onClick={() => supabaseService.addPoints(s.id, val, 'MANUAL', `${game.title} Award`, adminName)}
                        className="bg-white/10 border border-white/10 text-white w-11 sm:w-12 h-10 shrink-0 font-black active:scale-95 transition-all flex items-center justify-center"
                      >
                        +{val}
                      </button>
                    ))}
                    <input type="number" className="w-16 h-10 shrink-0 border border-white/10 bg-[#171C27] text-white placeholder-white/30 text-center font-black focus:border-[#CBFE1C] outline-none" placeholder="Custom" onKeyDown={(e) => { const v = Number((e.target as HTMLInputElement).value); if (e.key==='Enter' && v>0) supabaseService.addPoints(s.id, v, 'MANUAL', `${game.title} Custom`, adminName); }} />
                 </div>
              </div>
            </div>
          ))}
          {rosterStudents.length === 0 && <div className="text-center py-20 italic" style={{ color: 'var(--pz-text)' }}>No athletes in this roster.</div>}
        </div>

        <div className="p-4 sm:p-8 flex justify-end gap-4 shrink-0" style={{ background: 'var(--pz-panel-2)', borderTop: '1px solid var(--pz-border)' }}>
           <button onClick={onClose} className="pz-btn px-10 py-4 transition-all">Done Tracking</button>
        </div>
      </div>
    </div>
  );
};

export default GameSessionDetailModal;
