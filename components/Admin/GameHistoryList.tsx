
import React from 'react';
import { GameSession } from '../../types';
import { HOUSES } from '../../constants';

interface GameHistoryListProps {
  history: GameSession[];
}

const GameHistoryList: React.FC<GameHistoryListProps> = ({ history }) => {
  return (
    <section className="bg-white rounded-[2rem] shadow-xl p-8 border border-slate-200/50">
      <h2 className="text-3xl font-black text-slate-800 mb-8 font-display uppercase tracking-tight">📜 Game History</h2>
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {history.length === 0 && (
          <div className="text-center py-10 text-slate-400 italic">No historical data found.</div>
        )}
        {history.map(h => (
          <div key={h.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-slate-300 transition-colors">
            <div>
              <div className="font-black text-lg text-slate-800">{h.title}</div>
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Coach {h.startedBy?.toUpperCase() || 'SYSTEM'} • {new Date(h.endTime).toLocaleString()}
              </div>
            </div>
            {h.results && (
              <div className="flex items-center gap-6">
                {h.results.winningHouseId && (
                  <div className="text-right">
                    <div className="text-[8px] font-black text-slate-400 uppercase">Winning House</div>
                    <div className="font-black text-sm uppercase" style={{ color: HOUSES[h.results.winningHouseId].colorHex }}>
                      {HOUSES[h.results.winningHouseId].name}
                    </div>
                  </div>
                )}
                <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-center min-w-[80px]">
                  <div className="text-[8px] font-black text-slate-400 uppercase">Score</div>
                  <div className="font-mono font-black text-brand-blue text-sm">{h.results.winningHouseScore} pts</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default GameHistoryList;
