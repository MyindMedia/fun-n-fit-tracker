import React, { useEffect, useState } from 'react';
import { Student } from '../../types';
import {
  GEAR_ITEMS,
  GEAR_RANK_COLORS,
  GEAR_SOURCE_LABELS,
  GearItemDef,
  GearSource,
  gearFactor,
  gearItem,
} from '../../gearCatalog';
import { gameCenter } from '../../services/gameCenter';
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

  const load = async () => {
    try {
      const res = await gameCenter.gearShop(student.id);
      setRows(new Map(res.items.map(i => [i.key, i])));
      setEquipped(res.equipped);
      setBalance(res.points);
    } catch (err) {
      console.warn('Failed to load gear shop:', err);
    }
  };
  useEffect(() => { load(); }, [student.id]);

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
            const f = gearFactor(equipped, src);
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
                  <button
                    onClick={() => act(item.key, () => gameCenter.gearEquip(student.id, isEquipped ? null : item.key))}
                    disabled={!!busyKey}
                    className={`touch-btn flex-1 min-h-[42px] py-2 text-[10px] font-black uppercase tracking-widest ${isEquipped ? 'bg-white/10 text-white/60' : 'pz-btn'}`}
                    style={isEquipped ? { clipPath: NOTCH_SM } : undefined}
                  >
                    {busyKey === item.key ? '…' : isEquipped ? 'Equipped' : 'Equip'}
                  </button>
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
      </p>
    </div>
  );
};

export default GearShop;
