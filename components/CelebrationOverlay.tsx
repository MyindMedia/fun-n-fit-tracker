
import React, { useEffect, useState } from 'react';

export interface Celebration {
  type: 'RANK_UP' | 'BADGE_EARNED' | 'GAME_END';
  studentName: string;
  achievement: string;
  studentAvatar?: string;
  rankIcon?: string;
  badgeIcon?: string;
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
  const gradientStyle = isGameEnd && celebration.winningHouseColor
    ? { background: `linear-gradient(to bottom right, ${celebration.winningHouseColor}, #facc15, #fb923c)` }
    : { background: 'linear-gradient(to bottom right, #facc15, #fb923c, #f97316)' };

  return (
    <div className="fixed inset-0 z-[700] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      <div className={`rounded-5xl p-12 md:p-20 text-center max-w-3xl mx-4 shadow-2xl animate-bounce-in relative overflow-hidden`} style={gradientStyle}>
        {/* Animated background glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent animate-pulse pointer-events-none" />

        <div className="relative z-10">
          {isGameEnd ? (
            <div className="text-7xl md:text-9xl mb-6 md:mb-8 animate-bounce">🏆</div>
          ) : (
            <div className="text-7xl md:text-9xl mb-6 md:mb-8 animate-bounce">🎉</div>
          )}

          {/* Student Avatar with Rank Icon */}
          {celebration.studentAvatar && (
            <div className="relative inline-block mb-6">
              <img
                src={celebration.studentAvatar}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full border-8 border-white shadow-2xl object-cover animate-scale-in"
                alt={celebration.studentName}
              />
              {celebration.type === 'RANK_UP' && celebration.rankIcon && (
                <div className="absolute -bottom-4 -right-4 w-20 h-20 md:w-24 md:h-24 bg-white rounded-full border-4 border-yellow-300 shadow-2xl flex items-center justify-center animate-spin-in">
                  <img src={celebration.rankIcon} className="w-16 h-16 md:w-20 md:h-20 object-contain" alt="Rank" />
                </div>
              )}
              {celebration.type === 'BADGE_EARNED' && celebration.badgeIcon && (
                <div className="absolute -bottom-4 -right-4 w-20 h-20 md:w-24 md:h-24 bg-white rounded-full border-4 border-yellow-300 shadow-2xl flex items-center justify-center animate-spin-in">
                  <img src={celebration.badgeIcon} className="w-16 h-16 md:w-20 md:h-20 object-contain" alt="Badge" />
                </div>
              )}
            </div>
          )}

          {isGameEnd ? (
            <>
              {/* Game End Celebration */}
              {celebration.gameTitle && (
                <div className="text-3xl md:text-4xl font-bold text-white/90 mb-6">
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
                  <div className="text-4xl md:text-5xl font-black text-white drop-shadow-lg">
                    🏆 {celebration.winningHouseName} Wins!
                  </div>
                </div>
              )}

              {/* MVP */}
              {celebration.mvpName && celebration.mvpAvatar && (
                <div className="mt-8 pt-8 border-t-4 border-white/30">
                  <div className="text-2xl md:text-3xl font-bold text-white/90 mb-4">
                    ⭐ MVP ⭐
                  </div>
                  <img
                    src={celebration.mvpAvatar}
                    className="w-24 h-24 md:w-32 md:h-32 rounded-full border-8 border-white shadow-2xl mx-auto mb-4 object-cover animate-scale-in"
                    alt={celebration.mvpName}
                  />
                  <div className="text-4xl md:text-5xl font-black text-white drop-shadow-lg">
                    {celebration.mvpName}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Rank Up / Badge Earned */}
              <div className="text-5xl md:text-6xl font-black text-white mb-4 drop-shadow-lg animate-slide-up">
                {celebration.studentName}
              </div>

              <div className="text-2xl md:text-3xl font-bold text-white/90 mb-4 uppercase tracking-wider">
                {celebration.type === 'RANK_UP' ? '⬆️ Promoted to' : '⭐ Earned'}
              </div>

              <div className="text-6xl md:text-7xl font-black text-white mt-4 drop-shadow-2xl animate-scale-in">
                {celebration.achievement}
              </div>
            </>
          )}
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
