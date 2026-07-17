import React, { useEffect, useState } from 'react';
import { Student } from '../../types';
import { HOUSES, BADGES, RANKS } from '../../constants';
import { GEAR_RANK_COLORS, GEAR_SOURCE_LABELS, GearSource, gearItem } from '../../gearCatalog';
import { avatarItem, RARITY_COLORS } from '../../avatarCatalog';
import { gameCenter } from '../../services/gameCenter';
import { getStudentDisplayName } from '../../utils/studentDisplay';
import { medalColor, MedalRow } from '../TrophyCase';
import AvatarRig from '../avatar/AvatarRig';
import { Ic } from '../icons';

const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const SOURCES: GearSource[] = ['game', 'checkin', 'earn'];

export const badgeName = (id: string) => BADGES.find(b => b.id === id)?.name ?? id;
export const thingName = (kind: string, key: string) =>
  kind === 'BADGE' ? `${badgeName(key)} badge`
  : kind === 'GEAR' ? `${gearItem(key)?.name ?? key} gear`
  : avatarItem(key)?.name ?? key;

type Tradable = {
  badges: string[];
  items: Array<{ key: string; upgradeLevel: number }>;
  gear?: Array<{ key: string }>;
};
type Pick = { kind: 'BADGE' | 'ITEM' | 'GEAR'; key: string } | null;

/* Inspect another player: avatar, rank, equipped gear stats, badges, medals —
   and, for friends, a two-sided badge/item trade builder. */
const PlayerCard: React.FC<{
  viewer: Student;
  player: Student;
  canTrade: boolean;
  onClose: () => void;
}> = ({ viewer, player, canTrade, onClose }) => {
  const house = HOUSES[player.houseId];
  const rank = RANKS.find(r => r.id === player.rankId) || RANKS[0];
  const dn = getStudentDisplayName(player);
  const gear = gearItem(player.gearEquipped);

  const [medals, setMedals] = useState<MedalRow[]>([]);
  const [showTrade, setShowTrade] = useState(false);
  const [mine, setMine] = useState<Tradable | null>(null);
  const [theirs, setTheirs] = useState<Tradable | null>(null);
  const [give, setGive] = useState<Pick>(null);
  const [want, setWant] = useState<Pick>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    gameCenter.medalsForStudent(player.id)
      .then(rows => setMedals((rows as MedalRow[]).slice(0, 5)))
      .catch(() => {});
  }, [player.id]);

  const openTrade = async () => {
    setShowTrade(true);
    try {
      const [m, t] = await Promise.all([
        gameCenter.tradableInventory(viewer.id),
        gameCenter.tradableInventory(player.id),
      ]);
      setMine(m); setTheirs(t);
    } catch (err) {
      console.warn('Failed to load trade inventories:', err);
    }
  };

  const sendOffer = async () => {
    if (!give || !want) return;
    setSending(true);
    try {
      // INTEGRATION: services/gameCenter.ts (frozen) types proposeTrade kinds
      // as 'BADGE' | 'ITEM' but passes the strings straight through to
      // convex/trades.ts, so GEAR rides the same pipe. The casts below are
      // safe; widen the union to include 'GEAR' whenever that file unfreezes.
      await gameCenter.proposeTrade({
        fromStudentId: viewer.id,
        toStudentId: player.id,
        giveKind: give.kind as 'BADGE' | 'ITEM', giveKey: give.key,
        wantKind: want.kind as 'BADGE' | 'ITEM', wantKey: want.key,
      });
      alert(`Offer sent! ${player.fullName.split(' ')[0]} can accept it from their Friends tab.`);
      setShowTrade(false); setGive(null); setWant(null);
    } catch (err: any) {
      alert(err?.message || 'Could not send the offer');
    } finally {
      setSending(false);
    }
  };

  const InventoryPicker: React.FC<{
    label: string; inv: Tradable | null; picked: Pick; onPick: (p: Pick) => void;
  }> = ({ label, inv, picked, onPick }) => (
    <div>
      <div className="pz-eyebrow mb-2">{label}</div>
      {!inv ? (
        <div className="text-xs py-3" style={{ color: 'var(--pz-text)' }}>Loading…</div>
      ) : inv.badges.length === 0 && inv.items.length === 0 && (inv.gear ?? []).length === 0 ? (
        <div className="text-xs py-3" style={{ color: 'var(--pz-text)' }}>Nothing tradable yet</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {inv.badges.map(b => {
            const sel = picked?.kind === 'BADGE' && picked.key === b;
            return (
              <button key={b} onClick={() => onPick({ kind: 'BADGE', key: b })}
                className="touch-btn px-2.5 py-1.5 text-[10px] font-bold border-2 inline-flex items-center gap-1"
                style={{ clipPath: NOTCH_SM, borderColor: sel ? 'var(--pz-volt)' : 'rgba(245,158,11,0.35)', background: sel ? 'rgba(203,254,28,0.12)' : 'rgba(245,158,11,0.08)', color: '#fcd34d' }}>
                <Ic.Medal size={12} /> {badgeName(b)}
              </button>
            );
          })}
          {inv.items.map(it => {
            const item = avatarItem(it.key);
            if (!item) return null;
            const sel = picked?.kind === 'ITEM' && picked.key === it.key;
            return (
              <button key={it.key} onClick={() => onPick({ kind: 'ITEM', key: it.key })}
                className="touch-btn px-2.5 py-1.5 text-[10px] font-bold border-2 inline-flex items-center gap-1"
                style={{ clipPath: NOTCH_SM, borderColor: sel ? 'var(--pz-volt)' : `${RARITY_COLORS[item.rarity]}55`, background: sel ? 'rgba(203,254,28,0.12)' : `${RARITY_COLORS[item.rarity]}12`, color: RARITY_COLORS[item.rarity] }}>
                <Ic.Shirt size={12} /> {item.name}{it.upgradeLevel > 0 ? ` ★${it.upgradeLevel}` : ''}
              </button>
            );
          })}
          {(inv.gear ?? []).map(g => {
            const item = gearItem(g.key);
            if (!item) return null;
            const sel = picked?.kind === 'GEAR' && picked.key === g.key;
            const rc = GEAR_RANK_COLORS[item.rank];
            return (
              <button key={`gear-${g.key}`} onClick={() => onPick({ kind: 'GEAR', key: g.key })}
                className="touch-btn px-2.5 py-1.5 text-[10px] font-bold border-2 inline-flex items-center gap-1"
                style={{ clipPath: NOTCH_SM, borderColor: sel ? 'var(--pz-volt)' : `${rc}55`, background: sel ? 'rgba(203,254,28,0.12)' : `${rc}12`, color: rc }}>
                <img src={item.icon} alt="" className="w-3.5 h-3.5 object-contain" /> {item.rank} · {item.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-6" style={{ background: 'rgba(4,6,10,0.88)' }} onClick={onClose}>
      <div className="pz-card w-full sm:max-w-md max-h-[92vh] overflow-y-auto custom-scrollbar p-5" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          {player.avatarMode === 'AVATAR' ? (
            <div className="w-16 h-16 rounded-full border-3 overflow-hidden flex items-end justify-center shrink-0"
              style={{ borderColor: house.colorHex, borderWidth: 3, borderStyle: 'solid', background: 'radial-gradient(circle at 50% 30%, #232B3B 0%, #14171E 80%)' }}>
              <AvatarRig look={player.avatarLook} size="100%" />
            </div>
          ) : (
            <img src={player.avatarUrl} className="w-16 h-16 rounded-full object-cover shrink-0" style={{ border: `3px solid ${house.colorHex}` }} alt="" />
          )}
          <div className="min-w-0 flex-grow">
            <div className="pz-display text-lg text-white leading-tight truncate">{dn.primary}</div>
            {dn.secondary && <div className="text-[11px] truncate" style={{ color: 'var(--pz-text)' }}>{dn.secondary}</div>}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5" style={{ background: `${house.colorHex}20`, color: house.colorHex, clipPath: NOTCH_SM }}>{house.name}</span>
              <img src={rank.icon} className="w-4 h-4 object-contain" alt="" />
              <span className="text-[10px] font-bold" style={{ color: 'var(--pz-text)' }}>{rank.name} · {player.points.toLocaleString()} pts</span>
            </div>
          </div>
          <button onClick={onClose} className="touch-btn w-9 h-9 rounded-full bg-white/5 border border-white/10 text-white/60 shrink-0 flex items-center justify-center" aria-label="Close">
            <Ic.XMark size={16} />
          </button>
        </div>

        {/* Equipped gear */}
        {gear ? (
          <div className="pz-card-sm p-3 mb-3" style={{ borderColor: GEAR_RANK_COLORS[gear.rank] }}>
            <div className="flex items-center gap-3">
              <img src={gear.icon} className="w-10 h-10 object-contain shrink-0" alt="" />
              <div className="min-w-0 flex-grow">
                <div className="flex items-center gap-1.5">
                  <span className="pz-display text-[9px] px-1.5 py-0.5" style={{ background: GEAR_RANK_COLORS[gear.rank], color: '#0B0E13', clipPath: NOTCH_SM }}>{gear.rank}</span>
                  <span className="font-black text-white text-xs truncate">{gear.name}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 mt-1">
                  {SOURCES.map(src => {
                    const d = gear.effects[src];
                    if (!d) return null;
                    return (
                      <span key={src} className="text-[9px] font-bold" style={{ color: d > 0 ? '#34D399' : '#F87171' }}>
                        {d > 0 ? '▲+' : '▼'}{Math.round(d * 100)}% {GEAR_SOURCE_LABELS[src]}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[10px] font-bold uppercase mb-3" style={{ color: 'var(--pz-text)' }}>No gear equipped</div>
        )}

        {/* Badges */}
        <div className="mb-3">
          <div className="pz-eyebrow mb-2">Badges</div>
          {(player.badges?.length ?? 0) === 0 ? (
            <div className="text-xs" style={{ color: 'var(--pz-text)' }}>No badges yet</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {player.badges!.map(b => (
                <span key={b} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold"
                  style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)', color: '#fcd34d', clipPath: NOTCH_SM }}>
                  <Ic.Medal size={12} /> {badgeName(b)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Medals */}
        {medals.length > 0 && (
          <div className="mb-3">
            <div className="pz-eyebrow mb-2">Coach Medals</div>
            <div className="space-y-1.5">
              {medals.map(m => (
                <div key={m._id} className="flex items-center gap-2 text-[11px] font-bold">
                  <span style={{ color: medalColor(m.key) }}><Ic.Medal size={13} /></span>
                  <span style={{ color: medalColor(m.key) }}>{m.title}</span>
                  <span style={{ color: 'var(--pz-text)' }}>· {new Date(m.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trade */}
        {canTrade && !showTrade && (
          <button onClick={openTrade} className="pz-btn w-full py-3 text-xs touch-btn min-h-[48px] inline-flex items-center justify-center gap-2">
            <Ic.Refresh size={16} /> Propose a Trade
          </button>
        )}
        {showTrade && (
          <div className="pz-card-sm p-4 space-y-4" style={{ borderColor: 'rgba(203,254,28,0.4)' }}>
            <InventoryPicker label="You give" inv={mine} picked={give} onPick={setGive} />
            <InventoryPicker label={`You get (from ${player.fullName.split(' ')[0]})`} inv={theirs} picked={want} onPick={setWant} />
            {give && want && (
              <div className="text-[11px] font-bold text-center text-white">
                Your {thingName(give.kind, give.key)} ⇄ their {thingName(want.kind, want.key)}
              </div>
            )}
            <div className="text-[9px] leading-snug" style={{ color: 'var(--pz-text)' }}>
              Some gear never shows up here. Earned gear stays earned, and rank A, rank S, and
              boost items stay with their owner.
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowTrade(false); setGive(null); setWant(null); }} className="pz-btn-ghost flex-1 py-2.5 text-[10px] touch-btn min-h-[44px]">Never mind</button>
              <button onClick={sendOffer} disabled={!give || !want || sending}
                className={`flex-1 py-2.5 text-[10px] touch-btn min-h-[44px] font-black uppercase tracking-widest ${give && want && !sending ? 'pz-btn' : 'bg-white/10 text-slate-500'}`}
                style={!(give && want && !sending) ? { clipPath: NOTCH_SM } : undefined}>
                {sending ? 'Sending…' : 'Send Offer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerCard;
