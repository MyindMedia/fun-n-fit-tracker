import React, { useEffect, useState } from 'react';
import { Student } from '../../types';
import {
  GEAR_DEFAULT_DURATION_MIN,
  GEAR_FACTOR_MAX,
  GEAR_FACTOR_MIN,
  GEAR_ITEMS,
  GEAR_RANK_COLORS,
  GEAR_SOURCE_LABELS,
  GearItemDef,
  GearSource,
  gearItem,
  isConsumable,
} from '../../gearCatalog';
import { gameCenter, localDate } from '../../services/gameCenter';
import { loadoutClient, LoadoutItem, LoadoutState } from '../../services/loadoutClient';
import { Ic } from '../icons';

const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const RANK_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };
const SOURCES: GearSource[] = ['game', 'checkin', 'earn'];

type ShopRow = { key: string; owned: boolean; equipped: boolean; progress: number | null };

interface GearShopProps {
  student: Student;
  onRefresh?: () => void;
}

// The Item Shop: ranked power gear with perks AND downsides. Wearing one
// multiplies real point earning — the loadout panel shows the live numbers.
const GearShop: React.FC<GearShopProps> = ({ student, onRefresh }) => {
  const [rows, setRows] = useState<Map<string, ShopRow>>(new Map());
  const [equipped, setEquipped] = useState<string | null>(student.gearEquipped ?? null);
  const [balance, setBalance] = useState(student.points);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loadout, setLoadout] = useState<LoadoutState | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());

  const load = async () => {
    try {
      const [res, lo] = await Promise.all([
        gameCenter.gearShop(student.id),
        loadoutClient.loadout(student.id, localDate()),
      ]);
      setRows(new Map(res.items.map(i => [i.key, i])));
      setEquipped(res.equipped);
      setBalance(res.points);
      setLoadout(lo);
      setNowTs(Date.now());
    } catch (err) {
      console.warn('Failed to load gear shop:', err);
    }
  };
  useEffect(() => { load(); }, [student.id]);

  // Tick the boost countdown once a second; refresh when the timer runs out.
  useEffect(() => {
    const active = loadout?.active;
    if (!active) return;
    const t = window.setInterval(() => {
      setNowTs(Date.now());
      if (active.expiresAt <= Date.now()) void load();
    }, 1000);
    return () => window.clearInterval(t);
  }, [loadout?.active?.expiresAt]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusyKey(key);
    try {
      await fn();
      await load();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'That did not work — try again');
    } finally {
      setBusyKey(null);
    }
  };

  const equippedItem = gearItem(equipped);
  const sorted = GEAR_ITEMS.slice().sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);

  // ── Consumable boosts ──────────────────────────────────────────────────────
  const activeBoost = loadout?.active && loadout.active.expiresAt > nowTs ? loadout.active : null;
  const activeBoostItem = gearItem(activeBoost?.gearKey);

  const mmss = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const activateBoost = (item: GearItemDef) => {
    if (item.usage === 'ONE_SHOT') {
      if (!window.confirm('This is used up when the timer ends. Use it now?')) return;
    }
    void act(item.key, () => loadoutClient.activateGear(student.id, item.key, localDate()));
  };

  // Bench = owned consumables; a burning ONE_SHOT is no longer owned, so the
  // live activation gets its own row while the timer runs.
  const STATE_ORDER: Record<string, number> = { ACTIVE: 0, READY: 1, USED_TODAY: 2 };
  const benchItems: LoadoutItem[] = [...(loadout?.items ?? [])];
  if (activeBoost && !benchItems.some(i => i.key === activeBoost.gearKey)) {
    benchItems.unshift({
      key: activeBoost.gearKey,
      state: 'ACTIVE',
      oneShot: activeBoost.kind === 'ONE_SHOT',
      expiresAt: activeBoost.expiresAt,
    });
  }
  benchItems.sort((a, b) => (STATE_ORDER[a.state] ?? 3) - (STATE_ORDER[b.state] ?? 3));

  const StatRows: React.FC<{ item: GearItemDef }> = ({ item }) => (
    <div className="space-y-1">
      {SOURCES.map(src => {
        const delta = item.effects[src];
        if (!delta) return null;
        const up = delta > 0;
        return (
          <div key={src} className="flex items-center gap-1.5 text-[10px] font-bold">
            <span style={{ color: up ? '#34D399' : '#F87171' }}>{up ? '▲' : '▼'}</span>
            <span style={{ color: up ? '#34D399' : '#F87171' }}>
              {up ? '+' : ''}{Math.round(delta * 100)}% {GEAR_SOURCE_LABELS[src]}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="pz-eyebrow mb-1">Item Shop</div>
          <h3 className="text-sm text-white uppercase tracking-wide">Power Gear</h3>
        </div>
        <div className="text-right">
          <div className="pz-display text-lg" style={{ color: 'var(--pz-volt)' }}>{balance.toLocaleString()}</div>
          <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>pts</div>
        </div>
      </div>

      {/* Live loadout stats */}
      <div
        className="pz-card-sm p-4"
        style={equippedItem ? { borderColor: GEAR_RANK_COLORS[equippedItem.rank] } : undefined}
      >
        <div className="flex items-center gap-3">
          {equippedItem ? (
            <img src={equippedItem.icon} alt="" className="w-12 h-12 object-contain shrink-0" />
          ) : (
            <div className="w-12 h-12 flex items-center justify-center shrink-0 bg-white/5 border border-white/10" style={{ clipPath: NOTCH_SM }}>
              <Ic.Bolt size={20} className="text-white/30" />
            </div>
          )}
          <div className="flex-grow min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Your loadout</div>
            <div className="font-black text-white text-sm truncate">
              {equippedItem ? equippedItem.name : 'No gear equipped'}
            </div>
          </div>
          {equippedItem && (
            <button
              onClick={() => act('unequip', () => gameCenter.gearEquip(student.id, null))}
              disabled={!!busyKey}
              className="touch-btn text-[9px] font-black uppercase px-2.5 py-1.5 bg-white/5 border border-white/10 text-white/60"
              style={{ clipPath: NOTCH_SM }}
            >
              Unequip
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {SOURCES.map(src => {
            // Live multiplier = passive gear x active boost, clamped once,
            // exactly how the server applies it.
            const passive = 1 + (equippedItem?.effects[src] ?? 0);
            const boost = 1 + (activeBoostItem?.effects[src] ?? 0);
            const f = Math.min(GEAR_FACTOR_MAX, Math.max(GEAR_FACTOR_MIN, passive * boost));
            const color = f > 1 ? '#34D399' : f < 1 ? '#F87171' : 'var(--pz-text)';
            return (
              <div key={src} className="text-center p-2 bg-white/5" style={{ clipPath: NOTCH_SM }}>
                <div className="pz-display text-base" style={{ color }}>x{f.toFixed(2)}</div>
                <div className="text-[8px] font-black uppercase leading-tight mt-0.5" style={{ color: 'var(--pz-text)' }}>
                  {GEAR_SOURCE_LABELS[src]}
                </div>
              </div>
            );
          })}
        </div>

        {/* Consumables strip: boosts fire from here, they never take the equipped slot */}
        {benchItems.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Boosts</div>
              {activeBoost && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5" style={{ background: 'rgba(203,254,28,0.15)', color: 'var(--pz-volt)', clipPath: NOTCH_SM }}>
                  Boost live
                </span>
              )}
            </div>
            <div className="space-y-2">
              {benchItems.map(bi => {
                const item = gearItem(bi.key);
                if (!item) return null;
                const isActive = bi.state === 'ACTIVE' && bi.expiresAt !== null;
                return (
                  <div
                    key={bi.key}
                    className="flex items-center gap-2.5 p-2 bg-white/5"
                    style={{ clipPath: NOTCH_SM, background: isActive ? 'rgba(203,254,28,0.08)' : undefined }}
                  >
                    <img src={item.icon} alt="" className="w-10 h-10 object-contain shrink-0" style={{ filter: bi.state === 'USED_TODAY' ? 'grayscale(0.7)' : undefined }} />
                    <div className="flex-grow min-w-0">
                      <div className="font-black text-white text-xs truncate">{item.name}</div>
                      <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>
                        {bi.oneShot ? 'Single use' : 'Once a day'} · {item.durationMin ?? GEAR_DEFAULT_DURATION_MIN} min
                      </div>
                    </div>
                    {isActive ? (
                      <div className="text-right shrink-0">
                        <div className="pz-display text-lg" style={{ color: 'var(--pz-volt)' }}>{mmss((bi.expiresAt ?? 0) - nowTs)}</div>
                        <div className="text-[8px] font-black uppercase" style={{ color: 'var(--pz-text)' }}>left</div>
                      </div>
                    ) : bi.state === 'USED_TODAY' ? (
                      <span className="text-[9px] font-black uppercase px-2.5 py-2 bg-white/10 text-white/40 shrink-0" style={{ clipPath: NOTCH_SM }}>
                        Used today
                      </span>
                    ) : (
                      <button
                        onClick={() => activateBoost(item)}
                        disabled={!!busyKey || !!activeBoost}
                        className={`touch-btn min-h-[42px] px-4 py-2 text-[10px] font-black uppercase tracking-widest shrink-0 ${activeBoost ? 'bg-white/10 text-slate-500' : 'pz-btn'}`}
                        style={activeBoost ? { clipPath: NOTCH_SM } : undefined}
                      >
                        {busyKey === item.key ? '…' : 'Activate'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* The racks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sorted.map(item => {
          const row = rows.get(item.key);
          const rankColor = GEAR_RANK_COLORS[item.rank];
          const isEquipped = equipped === item.key;
          const owned = row?.owned ?? false;
          const progress = row?.progress ?? null;
          const goalMet = item.unlock && progress !== null && progress >= item.unlock.count;
          return (
            <div
              key={item.key}
              className="pz-card-sm p-4 flex flex-col gap-2.5 relative"
              style={isEquipped ? { borderColor: rankColor, background: `${rankColor}0d` } : undefined}
            >
              <div className="flex items-start gap-3">
                <img src={item.icon} alt="" className="w-14 h-14 object-contain shrink-0" style={{ filter: owned || !item.unlock ? undefined : 'grayscale(0.35)' }} />
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="pz-display text-[10px] px-1.5 py-0.5 shrink-0"
                      style={{ background: rankColor, color: '#0B0E13', clipPath: NOTCH_SM }}
                    >
                      {item.rank}
                    </span>
                    <span className="font-black text-white text-sm truncate">{item.name}</span>
                  </div>
                  <div className="text-[10px] italic mt-1 leading-snug" style={{ color: 'var(--pz-text)' }}>{item.flavor}</div>
                </div>
                {isEquipped && <span style={{ color: rankColor }} className="shrink-0"><Ic.CheckCircle size={18} /></span>}
              </div>

              {isConsumable(item) && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5"
                    style={{ background: 'rgba(203,254,28,0.12)', color: 'var(--pz-volt)', clipPath: NOTCH_SM }}
                  >
                    {item.usage === 'ONE_SHOT' ? 'One and done' : 'Once a day'}
                  </span>
                  <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>
                    {item.durationMin ?? GEAR_DEFAULT_DURATION_MIN} min boost
                  </span>
                </div>
              )}

              <StatRows item={item} />

              {/* Achievement path */}
              {item.unlock && !owned && (
                <div>
                  <div className="flex justify-between text-[9px] font-bold uppercase mb-1" style={{ color: 'var(--pz-text)' }}>
                    <span>{item.unlock.label}</span>
                    <span style={{ color: goalMet ? '#34D399' : undefined }}>
                      {Math.min(progress ?? 0, item.unlock.count).toLocaleString()}/{item.unlock.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/10 overflow-hidden" style={{ clipPath: NOTCH_SM }}>
                    <div style={{ width: `${Math.min(100, ((progress ?? 0) / item.unlock.count) * 100)}%`, height: '100%', background: goalMet ? '#34D399' : rankColor }} />
                  </div>
                </div>
              )}

              <div className="mt-auto flex gap-2">
                {owned ? (
                  isConsumable(item) ? (
                    /* Consumables activate from the loadout panel up top; no Equip here */
                    <div
                      className="flex-1 min-h-[42px] py-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-center bg-white/5 border border-white/10 text-white/50"
                      style={{ clipPath: NOTCH_SM }}
                    >
                      In your loadout
                    </div>
                  ) : (
                    <button
                      onClick={() => act(item.key, () => gameCenter.gearEquip(student.id, isEquipped ? null : item.key))}
                      disabled={!!busyKey}
                      className={`touch-btn flex-1 min-h-[42px] py-2 text-[10px] font-black uppercase tracking-widest ${isEquipped ? 'bg-white/10 text-white/60' : 'pz-btn'}`}
                      style={isEquipped ? { clipPath: NOTCH_SM } : undefined}
                    >
                      {busyKey === item.key ? '…' : isEquipped ? 'Equipped' : 'Equip'}
                    </button>
                  )
                ) : (
                  <>
                    {goalMet && (
                      <button
                        onClick={() => act(item.key, () => gameCenter.gearClaim(student.id, item.key))}
                        disabled={!!busyKey}
                        className="touch-btn flex-1 min-h-[42px] py-2 text-[10px] font-black uppercase tracking-widest pz-btn"
                      >
                        {busyKey === item.key ? '…' : 'Claim — Earned!'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (balance < item.price) { alert(`${item.name} costs ${item.price} pts — you have ${balance}.`); return; }
                        if (window.confirm(`Buy ${item.name} for ${item.price} pts?`)) {
                          void act(item.key, () => gameCenter.gearBuy(student.id, item.key));
                        }
                      }}
                      disabled={!!busyKey}
                      className={`touch-btn flex-1 min-h-[42px] py-2 text-[10px] font-black uppercase tracking-widest ${goalMet ? 'bg-white/5 border border-white/10 text-white/50' : balance >= item.price ? 'pz-btn' : 'bg-white/10 text-slate-500'}`}
                      style={goalMet || balance < item.price ? { clipPath: NOTCH_SM } : undefined}
                    >
                      {busyKey === item.key ? '…' : `${item.price.toLocaleString()} pts`}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] leading-relaxed m-0" style={{ color: 'var(--pz-text)' }}>
        One gear piece equipped at a time. Green stats boost what you earn, red ones cost you —
        pick a build that fits how you play. Earn gear free by hitting the goal, or buy it outright.
        Boost items are different: fire one from your loadout for a quick burst. Once a day boosts
        recharge at midnight, and one and done boosts vanish after use. One boost runs at a time.
      </p>
    </div>
  );
};

export default GearShop;
