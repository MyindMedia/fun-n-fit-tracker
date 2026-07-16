import React, { useEffect, useMemo, useState } from 'react';
import { Student } from '../../types';
import { HOUSES } from '../../constants';
import {
  AVATAR_ITEMS,
  AvatarItemDef,
  AvatarLook,
  DEFAULT_LOOK,
  HAIR_COLORS,
  RARITY_COLORS,
  SKIN_TONES,
  UPGRADE_TIERS,
} from '../../avatarCatalog';
import { gameCenter } from '../../services/gameCenter';
import { supabaseService } from '../../services/supabaseService';
import AvatarRig from './AvatarRig';
import { Ic } from '../icons';

const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

// Shared keyframes for the character-select feel (studio + crates render this once)
export const AvatarFx: React.FC = () => (
  <style>{`
    @keyframes fnf-idle-bob { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-7px) scale(1.012); } }
    @keyframes fnf-spot { 0%,100% { opacity: .55; } 50% { opacity: .9; } }
    @keyframes fnf-crate-shake { 0%,100% { transform: rotate(0); } 20% { transform: rotate(-6deg); } 40% { transform: rotate(5deg); } 60% { transform: rotate(-4deg); } 80% { transform: rotate(3deg); } }
    @keyframes fnf-reveal-pop { 0% { transform: scale(.4); opacity: 0; } 70% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes fnf-burst-ring { 0% { transform: scale(.2); opacity: .9; } 100% { transform: scale(2.4); opacity: 0; } }
  `}</style>
);

interface AvatarStudioProps {
  student: Student;
  onClose: () => void;
  onSaved?: () => void;
}

// Character-select style studio: base silhouette + skin tones, layered hair /
// clothes / accessories / house merch. Locked items can be bought with points.
const AvatarStudio: React.FC<AvatarStudioProps> = ({ student, onClose, onSaved }) => {
  const [look, setLook] = useState<AvatarLook>({ ...DEFAULT_LOOK, ...(student.avatarLook ?? {}) });
  const [owned, setOwned] = useState<Map<string, number>>(new Map());
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [balance, setBalance] = useState(student.points);

  const loadOwned = async () => {
    try {
      const rows = await gameCenter.ownedWearables(student.id);
      setOwned(new Map(rows.map(r => [r.key, r.upgradeLevel])));
    } catch (err) {
      console.warn('Failed to load wardrobe:', err);
    }
  };
  useEffect(() => { loadOwned(); }, [student.id]);

  const house = HOUSES[student.houseId];
  const isUnlocked = (item: AvatarItemDef) => item.isDefault || owned.has(item.key);

  const equip = (item: AvatarItemDef) => {
    const slotKey = item.slot === 'HAIRSTYLE' ? 'hair' : item.slot === 'TOP' ? 'top' : 'acc';
    setLook(prev => ({ ...prev, [slotKey]: item.key }));
  };

  const handleItemTap = async (item: AvatarItemDef) => {
    if (isUnlocked(item)) { equip(item); return; }
    if (balance < item.cost) {
      alert(`${item.name} costs ${item.cost} pts — you have ${balance}. Earn more or try a crate!`);
      return;
    }
    if (!window.confirm(`Unlock ${item.name} for ${item.cost} pts?`)) return;
    setBusyKey(item.key);
    try {
      await supabaseService.purchaseWearable(student.id, item.key, item.cost);
      setBalance(b => b - item.cost);
      await loadOwned();
      equip(item);
    } catch (err: any) {
      alert(err?.userMessage || err?.message || 'Purchase failed');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gameCenter.saveAvatarLook(student.id, look);
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Failed to save your avatar');
    } finally {
      setSaving(false);
    }
  };

  const sections = useMemo(() => ([
    { slot: 'HAIRSTYLE' as const, title: 'Hair', items: AVATAR_ITEMS.filter(i => i.slot === 'HAIRSTYLE') },
    { slot: 'TOP' as const, title: 'Clothes & Merch', items: AVATAR_ITEMS.filter(i => i.slot === 'TOP') },
    { slot: 'ACCESSORY' as const, title: 'Accessories', items: AVATAR_ITEMS.filter(i => i.slot === 'ACCESSORY') },
  ]), []);

  const equippedKey = (slot: AvatarItemDef['slot']) =>
    slot === 'HAIRSTYLE' ? look.hair : slot === 'TOP' ? look.top : look.acc;

  return (
    <div className="pz-scope flex flex-col h-full" style={{ background: 'var(--pz-bg)' }}>
      <AvatarFx />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: 'var(--pz-panel)', borderBottom: '1px solid var(--pz-border)' }}>
        <button onClick={onClose} className="touch-btn pz-btn-ghost font-bold text-xs px-3 py-1">Cancel</button>
        <h2 className="text-sm text-white uppercase tracking-wide inline-flex items-center gap-2"><Ic.Shirt size={18} /> Avatar Studio</h2>
        <div className="text-xs font-black" style={{ color: 'var(--pz-volt)' }}>{balance.toLocaleString()} pts</div>
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar">
        {/* Character-select stage */}
        <div className="relative flex flex-col items-center justify-end pt-6 pb-4 overflow-hidden" style={{ background: 'linear-gradient(180deg, #171C27 0%, #0B0E13 100%)', minHeight: '320px' }}>
          {/* spotlight */}
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
            style={{
              width: '340px', height: '340px', top: '-40px',
              background: 'radial-gradient(circle, rgba(203,254,28,0.14) 0%, transparent 65%)',
              animation: 'fnf-spot 3.2s ease-in-out infinite',
            }}
          />
          <AvatarRig look={look} size={240} idle />
          {/* podium */}
          <div className="relative mt-[-6px]" style={{ width: '230px' }}>
            <div style={{ height: '16px', background: 'rgba(203,254,28,0.16)', clipPath: 'polygon(6% 0, 94% 0, 100% 100%, 0 100%)' }} />
            <div style={{ height: '7px', background: 'rgba(255,255,255,0.06)', clipPath: 'polygon(2% 0, 98% 0, 100% 100%, 0 100%)' }} />
          </div>
          <div className="mt-3 text-center">
            <div className="pz-display text-xl text-white leading-none">{student.gamerTag || student.fullName}</div>
            <div className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: house.colorHex }}>{house.name} House</div>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {/* Skin tone */}
          <div>
            <div className="pz-eyebrow mb-2">Skin Tone</div>
            <div className="flex gap-2 flex-wrap">
              {SKIN_TONES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setLook(prev => ({ ...prev, skin: t.id }))}
                  className="touch-btn w-11 h-11 border-2 transition-all"
                  style={{
                    background: t.fill, clipPath: NOTCH_SM,
                    borderColor: look.skin === t.id ? 'var(--pz-volt)' : 'rgba(255,255,255,0.15)',
                    transform: look.skin === t.id ? 'scale(1.08)' : undefined,
                  }}
                  aria-label={`Skin tone ${t.id}`}
                />
              ))}
            </div>
          </div>

          {/* Hair color */}
          <div>
            <div className="pz-eyebrow mb-2">Hair Color</div>
            <div className="flex gap-2 flex-wrap">
              {HAIR_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setLook(prev => ({ ...prev, hairColor: c }))}
                  className="touch-btn w-11 h-11 border-2 transition-all"
                  style={{
                    background: c, clipPath: NOTCH_SM,
                    borderColor: look.hairColor === c ? 'var(--pz-volt)' : 'rgba(255,255,255,0.15)',
                    transform: look.hairColor === c ? 'scale(1.08)' : undefined,
                  }}
                  aria-label={`Hair color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Item sections */}
          {sections.map(section => (
            <div key={section.slot}>
              <div className="flex items-center justify-between mb-2">
                <div className="pz-eyebrow">{section.title}</div>
                {section.slot === 'ACCESSORY' && (
                  <button
                    onClick={() => setLook(prev => ({ ...prev, acc: null }))}
                    className="touch-btn text-[10px] font-black uppercase px-2 py-1"
                    style={{ color: look.acc ? 'var(--pz-text)' : 'var(--pz-volt)' }}
                  >
                    None
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {section.items.map(item => {
                  const unlocked = isUnlocked(item);
                  const isEquipped = equippedKey(item.slot) === item.key;
                  const level = owned.get(item.key) ?? 0;
                  const rarityColor = RARITY_COLORS[item.rarity];
                  const previewLook: AvatarLook = {
                    ...look,
                    [item.slot === 'HAIRSTYLE' ? 'hair' : item.slot === 'TOP' ? 'top' : 'acc']: item.key,
                  };
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleItemTap(item)}
                      disabled={busyKey === item.key}
                      className="relative p-2 border-2 flex flex-col items-center gap-1 transition-all active:scale-[0.97] disabled:opacity-50"
                      style={{
                        clipPath: NOTCH_SM,
                        borderColor: isEquipped ? 'var(--pz-volt)' : 'var(--pz-border)',
                        background: isEquipped ? 'rgba(203,254,28,0.08)' : 'var(--pz-panel-2)',
                      }}
                    >
                      <div style={{ opacity: unlocked ? 1 : 0.45, filter: unlocked ? undefined : 'grayscale(0.6)' }}>
                        <AvatarRig look={previewLook} size={64} />
                      </div>
                      <div className="text-[9px] font-black uppercase tracking-wide text-center leading-tight truncate max-w-full text-white">
                        {item.name}
                      </div>
                      {!unlocked ? (
                        <div className="text-[9px] font-bold inline-flex items-center gap-1" style={{ color: rarityColor }}>
                          <Ic.Lock size={10} /> {item.cost} pts
                        </div>
                      ) : level > 0 ? (
                        <div className="text-[9px] font-black uppercase" style={{ color: 'var(--pz-volt)' }}>{UPGRADE_TIERS[level]} tier</div>
                      ) : (
                        <div className="text-[9px] font-bold" style={{ color: rarityColor }}>{item.rarity}</div>
                      )}
                      <span className="absolute bottom-0 inset-x-0 h-1" style={{ background: rarityColor, opacity: 0.8 }} />
                      {isEquipped && (
                        <span className="absolute top-1 right-1" style={{ color: 'var(--pz-volt)' }}><Ic.CheckCircle size={14} /></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div className="p-4 border-t border-white/10 flex gap-3 flex-shrink-0" style={{ background: 'var(--pz-panel)' }}>
        <button onClick={onClose} className="flex-1 pz-btn-ghost py-3 text-sm touch-btn min-h-[48px]">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 pz-btn py-3 text-sm touch-btn min-h-[48px] disabled:opacity-50">
          {saving ? 'Saving…' : 'Save My Avatar'}
        </button>
      </div>
    </div>
  );
};

export default AvatarStudio;
