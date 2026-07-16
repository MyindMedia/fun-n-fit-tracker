import React, { useState, useEffect, useCallback } from 'react';
import { Student, Reward, Redemption, Rarity } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { gameCenter } from '../../services/gameCenter';

interface PerkShopProps {
  student: Student;
  onRefresh?: () => void;
}

// ── Rarity styling (Rocket League vibes) ─────────────────────────────────────

const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

const RARITY_META: Record<
  Rarity,
  { label: string; border: string; glow: string; header: string; strip: string; cost: string }
> = {
  common: {
    label: 'Common',
    border: 'border-slate-500/70',
    glow: '',
    header: 'bg-gradient-to-br from-slate-600/40 to-slate-800/60',
    strip: 'bg-slate-600 text-slate-100',
    cost: 'text-slate-300',
  },
  uncommon: {
    label: 'Uncommon',
    border: 'border-emerald-500/80',
    glow: 'shadow-lg shadow-emerald-500/20',
    header: 'bg-gradient-to-br from-emerald-500/25 to-emerald-900/40',
    strip: 'bg-emerald-500 text-emerald-950',
    cost: 'text-emerald-400',
  },
  rare: {
    label: 'Rare',
    border: 'border-blue-500/80',
    glow: 'shadow-lg shadow-blue-500/25',
    header: 'bg-gradient-to-br from-blue-500/25 to-blue-900/40',
    strip: 'bg-blue-500 text-white',
    cost: 'text-blue-400',
  },
  epic: {
    label: 'Epic',
    border: 'border-purple-500/80',
    glow: 'shadow-lg shadow-purple-500/30',
    header: 'bg-gradient-to-br from-purple-500/30 to-purple-900/40',
    strip: 'bg-purple-500 text-white',
    cost: 'text-purple-400',
  },
  legendary: {
    label: 'Legendary',
    border: 'border-amber-400',
    glow: 'shadow-xl shadow-amber-500/40',
    header: 'bg-gradient-to-br from-amber-400/30 via-orange-500/25 to-orange-900/40',
    strip: 'bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950',
    cost: 'text-amber-400',
  },
};

const STATUS_META: Record<Redemption['status'], { label: string; chip: string }> = {
  PENDING: { label: 'At the front desk', chip: 'bg-amber-100 text-amber-700' },
  FULFILLED: { label: 'Fulfilled', chip: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Refunded', chip: 'bg-slate-100 text-slate-500' },
};

/** Avatar skins auto-equip server-side; everything else is a real-world perk. */
const isSkin = (reward: Reward): boolean => reward.category === 'Virtual' && !!reward.value;

/** Pull the human-friendly part out of a wrapped Convex error message. */
const friendlyError = (err: unknown): string => {
  const raw = err instanceof Error ? err.message : String(err);
  const uncaught = raw.match(/Uncaught Error:\s*([^\n]+)/);
  if (uncaught) return uncaught[1].trim();
  const points = raw.match(/Not enough points[^\n]*/);
  if (points) return points[0].trim();
  return 'Redeem failed — please try again.';
};

const PerkShop: React.FC<PerkShopProps> = ({ student, onRefresh }) => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingKey, setRedeemingKey] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ reward: Reward; skin: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRedemptions = useCallback(async () => {
    try {
      const rows = await gameCenter.redemptionsForStudent(student.id);
      setRedemptions([...rows].sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error('Load redemptions failed:', err);
    }
  }, [student.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rewardsData, redemptionRows] = await Promise.all([
          supabaseService.getRewards(),
          gameCenter.redemptionsForStudent(student.id),
        ]);
        if (cancelled) return;
        setRewards(rewardsData);
        setRedemptions([...redemptionRows].sort((a, b) => b.createdAt - a.createdAt));
      } catch (err) {
        console.error('Perk shop load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student.id]);

  const inventory = student.inventory ?? [];

  // Legendary first, then price low→high inside each tier
  const sortedRewards = [...rewards].sort((a, b) => {
    const tier = RARITY_RANK[b.rarity ?? 'common'] - RARITY_RANK[a.rarity ?? 'common'];
    return tier !== 0 ? tier : a.cost - b.cost;
  });

  const handleRedeem = async (reward: Reward) => {
    if (!window.confirm(`Redeem ${reward.name} for ${reward.cost.toLocaleString()} pts?`)) return;
    setErrorMsg(null);
    setRedeemingKey(reward.id);
    try {
      await gameCenter.redeem(student.id, reward.id, 'STUDENT');
      setCelebration({ reward, skin: isSkin(reward) });
      await loadRedemptions();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Redeem failed:', err);
      setErrorMsg(friendlyError(err));
    } finally {
      setRedeemingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Balance banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-2xl flex justify-between items-center">
        <div>
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Your Balance</div>
          <div className="text-2xl font-black flex items-center gap-2">
            <span className="text-xl">🪙</span>
            {student.points.toLocaleString()} PTS
          </div>
        </div>
        <div className="text-3xl">🛒</div>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 flex items-start gap-2">
          <span className="text-lg">⚠️</span>
          <div className="flex-grow text-xs font-bold text-red-600 leading-snug">{errorMsg}</div>
          <button
            onClick={() => setErrorMsg(null)}
            className="touch-btn text-red-400 font-black px-1 leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Item shop grid */}
      <div>
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3">Item Shop</h3>
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading the shop...</div>
        ) : sortedRewards.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">🛒</div>
            <div className="text-sm font-medium">The shop is being restocked — check back soon!</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sortedRewards.map((reward) => {
              const rarity: Rarity = reward.rarity ?? 'common';
              const meta = RARITY_META[rarity];
              const skin = isSkin(reward);
              const owned = skin && inventory.includes(reward.id);
              const canAfford = student.points >= reward.cost;
              const busy = redeemingKey !== null;

              return (
                <div
                  key={reward.id}
                  className={`relative bg-slate-900 rounded-xl border-2 ${meta.border} ${meta.glow} overflow-hidden flex flex-col`}
                >
                  {/* Preview */}
                  <div className={`${meta.header} h-28 flex items-center justify-center relative`}>
                    {skin ? (
                      <img
                        src={reward.value}
                        alt={reward.name}
                        className="w-20 h-20 rounded-full border-2 border-white/30 object-cover"
                      />
                    ) : (
                      <span className="text-5xl drop-shadow-lg">{reward.icon}</span>
                    )}
                    {owned && (
                      <span className="absolute top-2 right-2 bg-emerald-500 text-emerald-950 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                        Owned
                      </span>
                    )}
                  </div>

                  {/* Rarity strip */}
                  <div className={`px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] ${meta.strip}`}>
                    {meta.label}
                  </div>

                  {/* Body */}
                  <div className="p-3 flex flex-col flex-grow">
                    <div className="font-black text-sm text-white leading-tight">{reward.name}</div>
                    {reward.description && (
                      <div className="text-[10px] text-slate-400 leading-snug mt-1">{reward.description}</div>
                    )}
                    <div className="mt-auto pt-3 space-y-2">
                      <div className={`text-xs font-black flex items-center gap-1 ${meta.cost}`}>
                        <span>🪙</span>
                        {reward.cost.toLocaleString()} pts
                      </div>
                      {owned ? (
                        <div className="w-full py-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-black uppercase tracking-widest text-center">
                          Owned
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRedeem(reward)}
                          disabled={!canAfford || busy}
                          className={`touch-btn w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                            !canAfford
                              ? 'bg-slate-800 text-slate-500'
                              : busy
                                ? 'bg-slate-700 text-slate-400'
                                : 'bg-gradient-to-r from-brand-blue to-blue-500 text-white active:scale-95'
                          }`}
                        >
                          {redeemingKey === reward.id
                            ? 'Redeeming...'
                            : !canAfford
                              ? `Need ${(reward.cost - student.points).toLocaleString()} more pts`
                              : 'Redeem'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My redemptions */}
      <div>
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3">My Redemptions</h3>
        {redemptions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Nothing redeemed yet — treat yourself!</div>
        ) : (
          <div className="space-y-2">
            {redemptions.map((r) => {
              const status = STATUS_META[r.status];
              return (
                <div key={r.id} className="bg-white rounded-xl p-3 border border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">
                    {r.rewardIcon || '🎁'}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="font-black text-sm text-slate-900 truncate">{r.rewardName}</div>
                    <div className="text-[10px] text-slate-400 font-bold">
                      🪙 {r.cost.toLocaleString()} pts • {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-1 rounded-full flex-shrink-0 ${status.chip}`}
                  >
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Celebration overlay */}
      {celebration && (
        <div
          className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setCelebration(null)}
        >
          <div
            className="bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl shadow-amber-500/20 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl mb-3">🎉</div>
            {celebration.skin && celebration.reward.value ? (
              <img
                src={celebration.reward.value}
                alt=""
                className="w-24 h-24 rounded-full border-4 border-amber-400 object-cover mx-auto mb-3"
              />
            ) : (
              <div className="text-6xl mb-3">{celebration.reward.icon}</div>
            )}
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400 mb-1">Redeemed!</div>
            <div className="text-xl font-black text-white mb-2">{celebration.reward.name}</div>
            <p className="text-xs text-slate-300 font-medium leading-relaxed mb-5">
              {celebration.skin
                ? 'Your avatar just changed — the new skin is equipped and live on the leaderboard!'
                : 'Request sent to the front desk — pick it up on your next visit!'}
            </p>
            <button
              onClick={() => setCelebration(null)}
              className="touch-btn w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 font-black text-xs uppercase tracking-widest"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerkShop;
