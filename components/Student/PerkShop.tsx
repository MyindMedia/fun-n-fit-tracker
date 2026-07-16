import React, { useState, useEffect, useCallback } from 'react';
import { Student, Reward, Redemption, Rarity } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { gameCenter } from '../../services/gameCenter';
import { Ic, DataIcon } from '../icons';

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

// NOTE: the pz notch clip-path clips outer box-shadows, so rarity glows are
// drop-shadow filters applied on a wrapper div around each notched card.
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
    glow: 'drop-shadow(0 0 10px rgba(16,185,129,0.25))',
    header: 'bg-gradient-to-br from-emerald-500/25 to-emerald-900/40',
    strip: 'bg-emerald-500 text-emerald-950',
    cost: 'text-emerald-400',
  },
  rare: {
    label: 'Rare',
    border: 'border-blue-500/80',
    glow: 'drop-shadow(0 0 10px rgba(59,130,246,0.3))',
    header: 'bg-gradient-to-br from-blue-500/25 to-blue-900/40',
    strip: 'bg-blue-500 text-white',
    cost: 'text-blue-400',
  },
  epic: {
    label: 'Epic',
    border: 'border-purple-500/80',
    glow: 'drop-shadow(0 0 12px rgba(168,85,247,0.35))',
    header: 'bg-gradient-to-br from-purple-500/30 to-purple-900/40',
    strip: 'bg-purple-500 text-white',
    cost: 'text-purple-400',
  },
  legendary: {
    label: 'Legendary',
    border: 'border-amber-400',
    glow: 'drop-shadow(0 0 14px rgba(251,191,36,0.45))',
    header: 'bg-gradient-to-br from-amber-400/30 via-orange-500/25 to-orange-900/40',
    strip: 'bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950',
    cost: 'text-amber-400',
  },
};

const STATUS_META: Record<Redemption['status'], { label: string; chip: string }> = {
  PENDING: { label: 'At the front desk', chip: 'bg-amber-400/15 text-amber-300' },
  FULFILLED: { label: 'Fulfilled', chip: 'bg-emerald-400/15 text-emerald-300' },
  CANCELLED: { label: 'Refunded', chip: 'bg-white/10 text-slate-400' },
};

// Pubzi theme: small notched cut-corner shape for inline elements
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

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
      <div className="pz-card text-white p-4 flex justify-between items-center">
        <div>
          <div className="pz-eyebrow">Your Balance</div>
          <div className="pz-display text-2xl flex items-center gap-2" style={{ color: 'var(--pz-volt)' }}>
            <Ic.Coin size={22} />
            {student.points.toLocaleString()} PTS
          </div>
        </div>
        <div style={{ color: 'var(--pz-volt)' }}><Ic.Cart size={28} /></div>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/40 p-3 flex items-start gap-2" style={{ clipPath: NOTCH_SM }}>
          <span className="text-red-400 shrink-0 mt-0.5"><Ic.Warning size={18} /></span>
          <div className="flex-grow text-xs font-bold text-red-300 leading-snug">{errorMsg}</div>
          <button
            onClick={() => setErrorMsg(null)}
            className="touch-btn text-red-400 font-black px-1 leading-none"
          >
            <Ic.XMark size={16} />
          </button>
        </div>
      )}

      {/* Item shop grid */}
      <div>
        <h3 className="text-sm text-white uppercase tracking-wide mb-3">Item Shop</h3>
        {loading ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--pz-text)' }}>Loading the shop...</div>
        ) : sortedRewards.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--pz-text)' }}>
            <div className="mb-2 flex justify-center"><Ic.Cart size={40} /></div>
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
                <div key={reward.id} style={meta.glow ? { filter: meta.glow } : undefined}>
                  <div
                    className={`relative h-full border-2 ${meta.border} overflow-hidden flex flex-col`}
                    style={{ background: 'var(--pz-panel)', clipPath: NOTCH_SM }}
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
                      <span className="text-white drop-shadow-lg"><DataIcon glyph={reward.icon} size={48} /></span>
                    )}
                    {owned && (
                      <span className="absolute top-2 right-2 bg-emerald-500 text-emerald-950 text-[8px] font-black uppercase tracking-widest px-2 py-0.5" style={{ clipPath: NOTCH_SM }}>
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
                      <div className="text-[10px] leading-snug mt-1" style={{ color: 'var(--pz-text)' }}>{reward.description}</div>
                    )}
                    <div className="mt-auto pt-3 space-y-2">
                      <div className={`text-xs font-black flex items-center gap-1 ${meta.cost}`}>
                        <Ic.Coin size={14} />
                        {reward.cost.toLocaleString()} pts
                      </div>
                      {owned ? (
                        <div className="w-full py-2 bg-emerald-500/15 text-emerald-400 text-[10px] font-black uppercase tracking-widest text-center" style={{ clipPath: NOTCH_SM }}>
                          Owned
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRedeem(reward)}
                          disabled={!canAfford || busy}
                          className={`touch-btn min-h-[48px] w-full py-2 text-[10px] font-black uppercase tracking-wide transition-all ${
                            !canAfford
                              ? 'bg-white/5 text-slate-500'
                              : busy
                                ? 'bg-white/10 text-slate-400'
                                : 'pz-btn active:scale-95'
                          }`}
                          style={!canAfford || busy ? { clipPath: NOTCH_SM } : undefined}
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My redemptions */}
      <div>
        <h3 className="text-sm text-white uppercase tracking-wide mb-3">My Redemptions</h3>
        {redemptions.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--pz-text)' }}>Nothing redeemed yet — treat yourself!</div>
        ) : (
          <div className="space-y-2">
            {redemptions.map((r) => {
              const status = STATUS_META[r.status];
              return (
                <div key={r.id} className="pz-card-sm p-3 flex items-center gap-3" style={{ background: 'var(--pz-panel-2)' }}>
                  <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center text-white flex-shrink-0" style={{ clipPath: NOTCH_SM }}>
                    <DataIcon glyph={r.rewardIcon || '🎁'} size={20} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="font-black text-sm text-white truncate">{r.rewardName}</div>
                    <div className="text-[10px] font-bold flex items-center gap-1" style={{ color: 'var(--pz-text)' }}>
                      <Ic.Coin size={12} /> {r.cost.toLocaleString()} pts • {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-1 flex-shrink-0 ${status.chip}`}
                    style={{ clipPath: NOTCH_SM }}
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
          className="fixed inset-0 z-[260] pz-scope bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setCelebration(null)}
        >
          <div
            className="w-full max-w-sm animate-fade-in"
            style={{ filter: 'drop-shadow(0 0 24px rgba(251,191,36,0.35))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="border-2 border-amber-400/60 p-6 text-center"
              style={{ background: 'var(--pz-panel)', clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)' }}
            >
            <div className="mb-3 flex justify-center text-amber-400"><Ic.Confetti size={48} /></div>
            {celebration.skin && celebration.reward.value ? (
              <img
                src={celebration.reward.value}
                alt=""
                className="w-24 h-24 rounded-full border-4 border-amber-400 object-cover mx-auto mb-3"
              />
            ) : (
              <div className="mb-3 flex justify-center text-white"><DataIcon glyph={celebration.reward.icon} size={56} /></div>
            )}
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400 mb-1">Redeemed!</div>
            <div className="pz-display text-xl text-white mb-2">{celebration.reward.name}</div>
            <p className="text-xs text-slate-300 font-medium leading-relaxed mb-5">
              {celebration.skin
                ? 'Your avatar just changed — the new skin is equipped and live on the leaderboard!'
                : 'Request sent to the front desk — pick it up on your next visit!'}
            </p>
            <button
              onClick={() => setCelebration(null)}
              className="touch-btn min-h-[52px] w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 font-black text-xs uppercase tracking-widest"
              style={{ clipPath: NOTCH_SM }}
            >
              Awesome!
            </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerkShop;
