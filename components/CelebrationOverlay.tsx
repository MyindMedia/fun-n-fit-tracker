
import React, { useEffect, useState } from 'react';
import { Ic } from './icons';

export interface Celebration {
  type: 'RANK_UP' | 'BADGE_EARNED' | 'GAME_END';
  studentName: string;
  achievement: string;
  studentAvatar?: string;
  rankIcon?: string;
  badgeIcon?: string;
  label?: string; // verb line above the achievement; defaults per type
  // Game end specific fields
  winningHouseName?: string;
  winningHouseIcon?: string;
  winningHouseColor?: string;
  mvpName?: string;
  mvpAvatar?: string;
  gameTitle?: string;
}

interface CelebrationOverlayProps {
  celebration: Celebration | null;
  onDismiss: () => void;
}

const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({ celebration, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (celebration) {
      console.log('🎉 Celebration overlay showing:', celebration);
      setIsVisible(true);
      const duration = celebration.type === 'GAME_END' ? 15000 : 6000;
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300); // Wait for fade out animation
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [celebration, onDismiss]);

  if (!celebration || !isVisible) return null;

  const isGameEnd = celebration.type === 'GAME_END';
  // Pubzi theme: volt by default, winning-house color on game end — glow lives on a
  // wrapper via drop-shadow because the notch clip-path would clip outer box-shadows.
  const accent = (isGameEnd && celebration.winningHouseColor) ? celebration.winningHouseColor : '#CBFE1C';
  const NOTCH = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';

  return (
    <div className="fixed inset-0 z-[700] pz-scope bg-black/70 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      <div className="animate-bounce-in max-w-3xl mx-4" style={{ filter: `drop-shadow(0 0 40px ${accent}66)` }}>
        <div
          className="p-12 md:p-20 text-center relative overflow-hidden"
          style={{
            background: `linear-gradient(to bottom right, ${accent}22, transparent 45%), var(--pz-panel)`,
            border: `1px solid ${accent}66`,
            clipPath: NOTCH
          }}
        >
        {/* Animated background glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent animate-pulse pointer-events-none" />

        <div className="relative z-10">
          {isGameEnd ? (
            <div className="mb-6 md:mb-8 flex justify-center animate-bounce" style={{ color: accent }}><Ic.Trophy size={80} /></div>
          ) : (
            <div className="mb-6 md:mb-8 flex justify-center animate-bounce" style={{ color: accent }}><Ic.Confetti size={80} /></div>
          )}

          {/* Student Avatar with Rank Icon */}
          {celebration.studentAvatar && (
            <div className="relative inline-block mb-6">
              <img
                src={celebration.studentAvatar}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full border-8 shadow-2xl object-cover animate-scale-in"
                style={{ borderColor: accent }}
                alt={celebration.studentName}
              />
              {celebration.type === 'RANK_UP' && celebration.rankIcon && (
                <div className="absolute -bottom-4 -right-4 w-20 h-20 md:w-24 md:h-24 bg-white rounded-full border-4 shadow-2xl flex items-center justify-center animate-spin-in" style={{ borderColor: accent }}>
                  <img src={celebration.rankIcon} className="w-16 h-16 md:w-20 md:h-20 object-contain" alt="Rank" />
                </div>
              )}
              {celebration.type === 'BADGE_EARNED' && celebration.badgeIcon && (
                <div className="absolute -bottom-4 -right-4 w-20 h-20 md:w-24 md:h-24 bg-white rounded-full border-4 shadow-2xl flex items-center justify-center animate-spin-in" style={{ borderColor: accent }}>
                  <img src={celebration.badgeIcon} className="w-16 h-16 md:w-20 md:h-20 object-contain" alt="Badge" />
                </div>
              )}
            </div>
          )}

          {isGameEnd ? (
            <>
              {/* Game End Celebration */}
              {celebration.gameTitle && (
                <div className="text-3xl md:text-4xl font-bold mb-6" style={{ color: 'var(--pz-text)' }}>
                  {celebration.gameTitle}
                </div>
              )}

              {/* Winning House */}
              {celebration.winningHouseIcon && (
                <div className="mb-8">
                  <img
                    src={celebration.winningHouseIcon}
                    className="w-32 h-32 md:w-40 md:h-40 mx-auto mb-4 drop-shadow-2xl animate-scale-in"
                    alt="Winning House"
                  />
                  <div className="pz-display text-4xl md:text-5xl drop-shadow-lg inline-flex items-center justify-center gap-3" style={{ color: accent }}>
                    <Ic.Trophy size={40} className="shrink-0" /> {celebration.winningHouseName} Wins!
                  </div>
                </div>
              )}

              {/* MVP */}
              {celebration.mvpName && celebration.mvpAvatar && (
                <div className="mt-8 pt-8 border-t border-white/10">
                  <div className="text-2xl md:text-3xl font-bold mb-4 uppercase tracking-[0.25em] flex items-center justify-center gap-3" style={{ color: 'var(--pz-volt)' }}>
                    <Ic.StarFilled size={26} /> MVP <Ic.StarFilled size={26} />
                  </div>
                  <img
                    src={celebration.mvpAvatar}
                    className="w-24 h-24 md:w-32 md:h-32 rounded-full border-8 shadow-2xl mx-auto mb-4 object-cover animate-scale-in"
                    style={{ borderColor: accent }}
                    alt={celebration.mvpName}
                  />
                  <div className="pz-display text-4xl md:text-5xl text-white drop-shadow-lg">
                    {celebration.mvpName}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Rank Up / Badge Earned */}
              <div className="pz-display text-5xl md:text-6xl text-white mb-4 drop-shadow-lg animate-slide-up">
                {celebration.studentName}
              </div>

              <div className="text-2xl md:text-3xl font-bold mb-4 uppercase tracking-wider flex items-center justify-center gap-2.5" style={{ color: 'var(--pz-text)' }}>
                {celebration.type === 'RANK_UP'
                  ? <><Ic.ArrowRight size={26} className="shrink-0" style={{ transform: 'rotate(-90deg)', color: 'var(--pz-volt)' }} /> {celebration.label ?? 'Promoted to'}</>
                  : <><Ic.Star size={26} className="shrink-0" style={{ color: 'var(--pz-volt)' }} /> {celebration.label ?? 'Earned'}</>}
              </div>

              <div className="pz-display text-6xl md:text-7xl mt-4 drop-shadow-2xl animate-scale-in" style={{ color: accent }}>
                {celebration.achievement}
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      {/* CSS Confetti */}
      <div className="confetti-container pointer-events-none">
        {[...Array(50)].map((_, i) => {
          const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA500', '#FF1493'];
          return (
            <div
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
                background: colors[i % colors.length],
              }}
            />
          );
        })}
      </div>

      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        .confetti {
          position: fixed;
          width: 12px;
          height: 12px;
          top: -10px;
          animation: confetti-fall linear infinite;
          border-radius: 2px;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        @keyframes bounce-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-bounce-in {
          animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-scale-in {
          animation: scale-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
        }

        @keyframes spin-in {
          0% {
            transform: scale(0) rotate(-180deg);
            opacity: 0;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        .animate-spin-in {
          animation: spin-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s both;
        }

        @keyframes slide-up {
          0% {
            transform: translateY(30px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-slide-up {
          animation: slide-up 0.6s ease-out 0.4s both;
        }
      `}</style>
    </div>
  );
};

export default CelebrationOverlay;
