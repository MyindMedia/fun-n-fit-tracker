import React from 'react';
import { Rank } from '../types';
import { RANKS } from '../constants';
import { Ic } from './icons';

// Pubzi theme: small notched cut-corner shape for inline elements
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

interface LevelPathProps {
  points: number;
  rankId?: string;
  ranks?: Rank[]; // defaults to the bundled ladder
}

// The full level ladder: every rank from Noob to Apex, with achieved /
// current / next / locked states so kids can see exactly what's ahead.
const LevelPath: React.FC<LevelPathProps> = ({ points, rankId, ranks }) => {
  const ladder = (ranks && ranks.length > 0 ? ranks : RANKS)
    .slice()
    .sort((a, b) => a.threshold - b.threshold);

  let currentIndex = ladder.findIndex(r => r.id === rankId);
  if (currentIndex === -1) {
    // Derive from points when the id doesn't match a ladder entry
    currentIndex = ladder.reduce((acc, r, i) => (points >= r.threshold ? i : acc), 0);
  }

  return (
    <div className="pz-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="pz-eyebrow mb-1">Level Path</div>
          <h3 className="text-sm text-white uppercase tracking-wide">Your Road To Apex</h3>
        </div>
        <div className="text-right">
          <div className="pz-display text-xl" style={{ color: 'var(--pz-volt)' }}>{points.toLocaleString()}</div>
          <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>Points</div>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar pb-2 -mx-1 px-1">
        <div className="flex items-stretch gap-0 min-w-max">
          {ladder.map((rank, idx) => {
            const isCurrent = idx === currentIndex;
            const isAchieved = idx < currentIndex;
            const isNext = idx === currentIndex + 1;
            const ptsToGo = Math.max(0, rank.threshold - points);
            // Connector fill: complete for achieved segments, proportional into the next
            const segPct = isNext
              ? Math.min(100, Math.max(0, ((points - ladder[currentIndex].threshold) /
                  Math.max(1, rank.threshold - ladder[currentIndex].threshold)) * 100))
              : idx <= currentIndex ? 100 : 0;

            return (
              <div key={rank.id} className="flex items-center">
                {idx > 0 && (
                  <div className="w-8 sm:w-10 h-1 bg-white/10 relative shrink-0" aria-hidden>
                    <div className="absolute inset-y-0 left-0" style={{ width: `${segPct}%`, background: 'var(--pz-volt)' }} />
                  </div>
                )}
                <div
                  className="flex flex-col items-center gap-1.5 px-2 py-3 w-[86px] sm:w-[96px] shrink-0 border transition-all"
                  style={{
                    clipPath: NOTCH_SM,
                    borderColor: isCurrent ? 'var(--pz-volt)' : isAchieved ? 'rgba(203,254,28,0.25)' : 'var(--pz-border)',
                    background: isCurrent ? 'rgba(203,254,28,0.10)' : 'var(--pz-panel-2)',
                  }}
                >
                  <div className="relative">
                    <img
                      src={rank.icon}
                      alt={rank.name}
                      className="w-11 h-11 sm:w-12 sm:h-12 object-contain"
                      style={!isAchieved && !isCurrent ? { filter: 'grayscale(1)', opacity: 0.45 } : undefined}
                    />
                    {isAchieved && (
                      <span
                        className="absolute -bottom-1 -right-1 w-4 h-4 flex items-center justify-center"
                        style={{ background: 'var(--pz-volt)', color: '#0B0E13', clipPath: NOTCH_SM }}
                      >
                        <Ic.Check size={10} />
                      </span>
                    )}
                  </div>
                  <div
                    className="text-[10px] font-black uppercase tracking-wide text-center leading-tight truncate max-w-full"
                    style={{ color: isCurrent ? 'var(--pz-volt)' : isAchieved ? '#ffffff' : 'var(--pz-text)' }}
                  >
                    {rank.name}
                  </div>
                  {isCurrent ? (
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5" style={{ background: 'var(--pz-volt)', color: '#0B0E13', clipPath: NOTCH_SM }}>
                      You are here
                    </span>
                  ) : isNext ? (
                    <span className="text-[8px] font-black uppercase text-center" style={{ color: 'var(--pz-volt)' }}>
                      {ptsToGo.toLocaleString()} pts to go
                    </span>
                  ) : (
                    <span className="text-[8px] font-bold" style={{ color: 'var(--pz-text)' }}>
                      {rank.threshold.toLocaleString()} pts
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LevelPath;
