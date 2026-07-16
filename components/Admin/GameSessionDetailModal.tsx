
import React, { useState, useEffect, useRef } from 'react';
import { GameSession, Student } from '../../types';
import { supabaseService } from '../../services/supabaseService';

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
    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
       <div className="text-xl font-mono font-black text-slate-900 min-w-[60px]">{time}s</div>
       <button 
         onClick={() => setIsRunning(!isRunning)} 
         className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isRunning ? 'bg-orange-500 text-white' : 'bg-slate-900 text-white'}`}
       >
         {isRunning ? 'Stop' : 'Start'}
       </button>
       {time > 0 && !isRunning && (
         <button onClick={handleSave} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Log</button>
       )}
    </div>
  );
};

const GameSessionDetailModal: React.FC<GameSessionDetailModalProps> = ({ game, students, adminName, onClose }) => {
  const rosterStudents = students.filter(s => game.roster.includes(s.id));

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 className="text-4xl font-display font-black text-slate-900">{game.title}</h2>
            <p className="text-slate-400 font-black text-xs uppercase tracking-widest mt-1">Live Performance Tracking • Coach {game.startedBy}</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 text-slate-500 flex items-center justify-center font-bold text-xl hover:bg-slate-900 hover:text-white transition-all">✕</button>
        </div>

        <div className="flex-grow overflow-y-auto p-8 custom-scrollbar space-y-4">
          {rosterStudents.map(s => (
            <div key={s.id} className="bg-white border-2 border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-center gap-6 group hover:border-brand-blue/20 transition-all">
              <div className="flex items-center gap-6 flex-grow">
                <img src={s.avatarUrl} className="w-16 h-16 rounded-full bg-slate-100 border-2 border-white shadow-md object-cover" />
                <div>
                  <div className="text-xl font-black text-slate-900">{s.fullName}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Current Session Points: {s.points}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                 <StudentTimer student={s} gameTitle={game.title} adminName={adminName} />
                 <div className="flex gap-2 items-center">
                    {[1,3,5,10].map(val => (
                      <button 
                        key={val}
                        onClick={() => supabaseService.addPoints(s.id, val, 'MANUAL', `${game.title} Award`, adminName)} 
                        className="bg-slate-900 text-white w-12 h-10 rounded-xl font-black shadow-lg active:scale-95 transition-all flex items-center justify-center"
                      >
                        +{val}
                      </button>
                    ))}
                    <input type="number" className="w-16 h-10 border-2 border-slate-200 rounded-xl text-center font-black" placeholder="Custom" onKeyDown={(e) => { const v = Number((e.target as HTMLInputElement).value); if (e.key==='Enter' && v>0) supabaseService.addPoints(s.id, v, 'MANUAL', `${game.title} Custom`, adminName); }} />
                 </div>
              </div>
            </div>
          ))}
          {rosterStudents.length === 0 && <div className="text-center py-20 text-slate-400 italic">No athletes in this roster.</div>}
        </div>
        
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4 shrink-0">
           <button onClick={onClose} className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-widest shadow-xl hover:bg-black transition-all">Done Tracking</button>
        </div>
      </div>
    </div>
  );
};

export default GameSessionDetailModal;
