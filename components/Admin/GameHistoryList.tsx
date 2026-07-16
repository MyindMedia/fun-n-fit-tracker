
import React from 'react';
import { GameSession } from '../../types';
import { HOUSES } from '../../constants';

interface GameHistoryListProps {
  history: GameSession[];
}

const GameHistoryList: React.FC<GameHistoryListProps> = ({ history }) => {
  return (
    <section className="pz-scope pz-card p-8">
      <h2 className="text-3xl text-white mb-8 tracking-tight">📜 Game History</h2>
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {history.length === 0 && (
          <div className="text-center py-10 italic" style={{ color: 'var(--pz-text)' }}>No historical data found.</div>
        )}
        {history.map(h => (
          <div key={h.id} className="pz-card-sm p-5 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-[#CBFE1C]/40 transition-colors" style={{ background: 'var(--pz-panel-2)' }}>
            <div>
              <div className="font-black text-lg text-white">{h.title}</div>
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>
                Coach {h.startedBy?.toUpperCase() || 'SYSTEM'} • {new Date(h.endTime).toLocaleString()}
              </div>
            </div>
            {h.results && (
              <div className="flex items-center gap-6">
                {h.results.winningHouseId && (
                  <div className="text-right">
                    <div className="text-[8px] font-black uppercase" style={{ color: 'var(--pz-text)' }}>Winning House</div>
                    <div className="font-black text-sm uppercase" style={{ color: HOUSES[h.results.winningHouseId].colorHex }}>
                      {HOUSES[h.results.winningHouseId].name}
                    </div>
                  </div>
                )}
                <div className="px-4 py-2 border border-white/10 text-center min-w-[80px]" style={{ background: 'var(--pz-bg)' }}>
                  <div className="text-[8px] font-black uppercase" style={{ color: 'var(--pz-text)' }}>Score</div>
                  <div className="font-mono font-black text-[#CBFE1C] text-sm">{h.results.winningHouseScore} pts</div>
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
