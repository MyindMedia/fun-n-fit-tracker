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
  avatarItem,
} from '../../avatarCatalog';
import { gameCenter } from '../../services/gameCenter';
import { supabaseService } from '../../services/supabaseService';
import { fitTokensClient } from '../../services/fitTokensClient';
import AvatarRig from './AvatarRig';
import { Ic } from '../icons';

const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

const slotKey = (slot: AvatarItemDef['slot']): 'hair' | 'top' | 'acc' =>
  slot === 'HAIRSTYLE' ? 'hair' : slot === 'TOP' ? 'top' : 'acc';

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

// Collapsible section: a tappable header (chevron + title + count) and, when
// open, its body. Categories stay collapsed by default so the pinned avatar
// preview keeps the focus; `right` hangs an extra control (e.g. "None") off the
// header without nesting buttons.
const Section: React.FC<{
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, count, open, onToggle, right, children }) => (
  <div className="border-b" style={{ borderColor: 'var(--pz-border)' }}>
    <div className="flex items-center justify-between">
      <button onClick={onToggle} className="touch-btn flex-grow flex items-center gap-2 px-4 py-3.5 text-left min-h-[48px]">
        <Ic.ChevronRight
          size={14}
          style={{ color: 'var(--pz-volt)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
        />
        <span className="pz-eyebrow">{title}</span>
        {count != null && <span className="text-[10px] font-bold" style={{ color: 'var(--pz-text)' }}>{count}</span>}
      </button>
      {right && <div className="pr-3">{right}</div>}
    </div>
    {open && <div className="px-4 pb-4">{children}</div>}
  </div>
);

interface AvatarStudioProps {
  student: Student;
  onClose: () => void;
  onSaved?: () => void;
}

// Character-select style studio: base silhouette + skin tones, layered hair /
// clothes / accessories / house merch. The avatar preview stays pinned in view
// while the option categories scroll and collapse below it. Any item can be
// tried on instantly; unowned items just can't be saved until they're unlocked.
const AvatarStudio: React.FC<AvatarStudioProps> = ({ student, onClose, onSaved }) => {
  const [look, setLook] = useState<AvatarLook>({
    ...DEFAULT_LOOK,
    // First visit: base the starter look on the athlete's gender (free items
    // only) — everything stays fully switchable.
    body: student.gender === 'Female' ? 'F' : 'M',
    hair: student.gender === 'Female' ? 'hair_bob' : DEFAULT_LOOK.hair,
    ...(student.avatarLook ?? {}),
  });
  const [owned, setOwned] = useState<Map<string, number>>(new Map());
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [balance, setBalance] = useState(student.points);
  // FitTokens: vanity-only currency, always shown as coin + number, never money
  const [tokenBalance, setTokenBalance] = useState(student.fitTokens ?? 0);
  // Which category is expanded (single-open accordion); null = all collapsed.
  const [openCat, setOpenCat] = useState<string | null>(null);
  // Unowned items still equipped when the kid hits Save (buy-or-drop prompt).
  const [savePrompt, setSavePrompt] = useState<AvatarItemDef[] | null>(null);

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

  // Try-on: tapping any item equips it on the preview, owned or not.
  const equip = (item: AvatarItemDef) => {
    setLook(prev => ({ ...prev, [slotKey(item.slot)]: item.key }));
  };

  // Purchase an item (points or FitTokens) and refresh ownership. Returns
  // whether it succeeded. Used from the save prompt.
  const buyItem = async (item: AvatarItemDef, withTokens: boolean): Promise<boolean> => {
    setBusyKey(item.key);
    try {
      if (withTokens) {
        const res = await fitTokensClient.buyAvatarItem(student.id, item.key);
        setTokenBalance(res.balance);
      } else {
        await supabaseService.purchaseWearable(student.id, item.key, item.cost);
        setBalance(b => b - item.cost);
      }
      await loadOwned();
      return true;
    } catch (err: any) {
      alert(err?.userMessage || err?.message || 'Purchase failed');
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  // Equipped items (hair/top/acc) the kid doesn't own yet — these are the ones
  // that can't be saved.
  const unownedEquipped = (): AvatarItemDef[] => {
    const keys = [look.hair, look.top, look.acc].filter(Boolean) as string[];
    const items = keys.map(k => avatarItem(k)).filter(Boolean) as AvatarItemDef[];
    return items.filter(it => !isUnlocked(it));
  };

  const persist = async (lookToSave: AvatarLook) => {
    setSaving(true);
    try {
      await gameCenter.saveAvatarLook(student.id, lookToSave);
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Failed to save your avatar');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const tryOn = unownedEquipped();
    if (tryOn.length === 0) { persist(look); return; }
    setSavePrompt(tryOn);
  };

  // Save without the tried-on items: revert those slots to the last saved look
  // (or the default / no accessory), then persist an all-owned look.
  const saveWithout = () => {
    const cleaned: AvatarLook = { ...look };
    for (const it of unownedEquipped()) {
      const sk = slotKey(it.slot);
      const fallback = sk === 'acc' ? (student.avatarLook?.acc ?? null) : (student.avatarLook as any)?.[sk] ?? (DEFAULT_LOOK as any)[sk];
      (cleaned as any)[sk] = fallback;
    }
    setSavePrompt(null);
    setLook(cleaned);
    persist(cleaned);
  };

  const buyFromPrompt = async (item: AvatarItemDef, withTokens: boolean) => {
    const ok = await buyItem(item, withTokens);
    if (!ok) return;
    const remaining = (savePrompt ?? []).filter(i => i.key !== item.key);
    if (remaining.length === 0) { setSavePrompt(null); persist(look); }
    else setSavePrompt(remaining);
  };

  // Hair sorts by the current style: matching set first, unisex next, the rest
  // last — everything stays wearable by everyone.
  const sections = useMemo(() => {
    const body = look.body ?? 'M';
    const tagRank = (t?: string) => (t === body ? 0 : t === 'U' || !t ? 1 : 2);
    const hair = AVATAR_ITEMS.filter(i => i.slot === 'HAIRSTYLE')
      .slice()
      .sort((a, b) => tagRank(a.tag) - tagRank(b.tag) || Number(!!b.isDefault) - Number(!!a.isDefault));
    return [
      { slot: 'HAIRSTYLE' as const, title: 'Hair', items: hair },
      { slot: 'TOP' as const, title: 'Clothes & Merch', items: AVATAR_ITEMS.filter(i => i.slot === 'TOP') },
      { slot: 'ACCESSORY' as const, title: 'Accessories', items: AVATAR_ITEMS.filter(i => i.slot === 'ACCESSORY') },
    ];
  }, [look.body]);

  const equippedKey = (slot: AvatarItemDef['slot']) =>
    slot === 'HAIRSTYLE' ? look.hair : slot === 'TOP' ? look.top : look.acc;

  const tryingOn = unownedEquipped();

  return (
    <div className="pz-scope flex flex-col h-full" style={{ background: 'var(--pz-bg)' }}>
      <AvatarFx />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: 'var(--pz-panel)', borderBottom: '1px solid var(--pz-border)' }}>
        <button onClick={onClose} className="touch-btn pz-btn-ghost font-bold text-xs px-3 py-1">Cancel</button>
        <h2 className="text-sm text-white uppercase tracking-wide inline-flex items-center gap-2"><Ic.Shirt size={18} /> Avatar Studio</h2>
        <div className="flex items-center gap-2.5">
          <div className="text-xs font-black" style={{ color: 'var(--pz-volt)' }}>{balance.toLocaleString()} pts</div>
          <div
            className="text-xs font-black inline-flex items-center gap-1 px-1.5 py-0.5"
            style={{ color: 'var(--pz-volt)', background: 'rgba(203,254,28,0.10)', clipPath: NOTCH_SM }}
            title="FitTokens"
          >
            <Ic.Coin size={13} /> {tokenBalance.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Pinned avatar preview — stays in view while the options scroll below */}
      <div className="relative flex flex-col items-center justify-end pt-3 pb-2 overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(180deg, #171C27 0%, #0B0E13 100%)', borderBottom: '1px solid var(--pz-border)' }}>
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
          style={{
            width: '260px', height: '260px', top: '-60px',
            background: 'radial-gradient(circle, rgba(203,254,28,0.14) 0%, transparent 65%)',
            animation: 'fnf-spot 3.2s ease-in-out infinite',
          }}
        />
        <AvatarRig look={look} size={150} idle />
        <div className="mt-1 text-center">
          <div className="pz-display text-lg text-white leading-none">{student.gamerTag || student.fullName}</div>
          <div className="text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: house.colorHex }}>{house.name} House</div>
        </div>
      </div>

      {/* Scrollable, collapsible option categories */}
      <div className="flex-grow overflow-y-auto custom-scrollbar">
        {/* Basics: body / skin / hair color */}
        <Section title="Basics" open={openCat === 'BASICS'} onToggle={() => setOpenCat(openCat === 'BASICS' ? null : 'BASICS')}>
          <div className="space-y-4">
            <div>
              <div className="pz-eyebrow mb-2">Style</div>
              <div className="grid grid-cols-2 gap-2 max-w-xs">
                {([['M', 'Boy'], ['F', 'Girl']] as const).map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => setLook(prev => ({ ...prev, body: code }))}
                    className="touch-btn min-h-[48px] py-2 border-2 text-xs font-black uppercase tracking-wide transition-all"
                    style={{
                      clipPath: NOTCH_SM,
                      borderColor: (look.body ?? 'M') === code ? 'var(--pz-volt)' : 'var(--pz-border)',
                      background: (look.body ?? 'M') === code ? 'rgba(203,254,28,0.10)' : 'var(--pz-panel-2)',
                      color: (look.body ?? 'M') === code ? 'var(--pz-volt)' : 'var(--pz-text)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
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
          </div>
        </Section>

        {/* Item categories */}
        {sections.map(section => (
          <Section
            key={section.slot}
            title={section.title}
            count={section.items.length}
            open={openCat === section.slot}
            onToggle={() => setOpenCat(openCat === section.slot ? null : section.slot)}
            right={
              section.slot === 'ACCESSORY' ? (
                <button
                  onClick={() => setLook(prev => ({ ...prev, acc: null }))}
                  className="touch-btn text-[10px] font-black uppercase px-2 py-1"
                  style={{ color: look.acc ? 'var(--pz-text)' : 'var(--pz-volt)' }}
                >
                  None
                </button>
              ) : undefined
            }
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {section.items.map(item => {
                const unlocked = isUnlocked(item);
                const isEquipped = equippedKey(item.slot) === item.key;
                const level = owned.get(item.key) ?? 0;
                const rarityColor = RARITY_COLORS[item.rarity];
                const previewLook: AvatarLook = {
                  ...look,
                  [slotKey(item.slot)]: item.key,
                };
                return (
                  <button
                    key={item.key}
                    onClick={() => equip(item)}
                    className="relative p-2 border-2 flex flex-col items-center gap-1 transition-all active:scale-[0.97]"
                    style={{
                      clipPath: NOTCH_SM,
                      borderColor: isEquipped ? 'var(--pz-volt)' : 'var(--pz-border)',
                      background: isEquipped ? 'rgba(203,254,28,0.08)' : 'var(--pz-panel-2)',
                    }}
                  >
                    <div>
                      <AvatarRig look={previewLook} size={64} />
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-wide text-center leading-tight truncate max-w-full text-white">
                      {item.name}
                    </div>
                    {!unlocked ? (
                      <div className="text-[9px] font-bold inline-flex items-center gap-1 flex-wrap justify-center" style={{ color: rarityColor }}>
                        <span className="inline-flex items-center gap-0.5"><Ic.Lock size={10} /> {item.cost}</span>
                        {item.tokenPrice != null && (
                          <span className="inline-flex items-center gap-0.5"><Ic.Coin size={10} /> {item.tokenPrice}</span>
                        )}
                      </div>
                    ) : level > 0 ? (
                      <div className="text-[9px] font-black uppercase" style={{ color: 'var(--pz-volt)' }}>{UPGRADE_TIERS[level]} tier</div>
                    ) : item.isDefault ? (
                      <div className="text-[9px] font-black uppercase" style={{ color: 'var(--pz-text)' }}>Free</div>
                    ) : (
                      <div className="text-[9px] font-bold" style={{ color: rarityColor }}>Owned</div>
                    )}
                    <span className="absolute bottom-0 inset-x-0 h-1" style={{ background: rarityColor, opacity: 0.8 }} />
                    {isEquipped && (
                      <span className="absolute top-1 right-1" style={{ color: 'var(--pz-volt)' }}><Ic.CheckCircle size={14} /></span>
                    )}
                    {isEquipped && !unlocked && (
                      <span className="absolute top-1 left-1" style={{ color: 'var(--pz-text)' }} title="Trying on"><Ic.Eye size={12} /></span>
                    )}
                  </button>
                );
              })}
            </div>
          </Section>
        ))}
      </div>

      {/* Try-on hint */}
      {tryingOn.length > 0 && (
        <div className="px-4 py-1.5 flex-shrink-0 text-[10px] font-bold inline-flex items-center justify-center gap-1.5" style={{ background: 'rgba(203,254,28,0.08)', color: 'var(--pz-volt)', borderTop: '1px solid rgba(203,254,28,0.2)' }}>
          <Ic.Eye size={12} /> Trying on {tryingOn.length} item{tryingOn.length > 1 ? 's' : ''} — buy to keep, or save without
        </div>
      )}

      {/* Action bar */}
      <div className="p-4 border-t border-white/10 flex gap-3 flex-shrink-0" style={{ background: 'var(--pz-panel)' }}>
        <button onClick={onClose} className="flex-1 pz-btn-ghost py-3 text-sm touch-btn min-h-[48px]">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 pz-btn py-3 text-sm touch-btn min-h-[48px] disabled:opacity-50">
          {saving ? 'Saving…' : 'Save My Avatar'}
        </button>
      </div>

      {/* Buy-or-save-without prompt for tried-on items */}
      {savePrompt && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-5" style={{ background: 'rgba(4,6,10,0.9)' }} onClick={() => setSavePrompt(null)}>
          <div className="pz-card w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="pz-eyebrow mb-1">You're trying these on</div>
            <p className="text-xs mb-4" style={{ color: 'var(--pz-text)' }}>
              Unlock them to keep them on your avatar, or save your look without them.
            </p>
            <div className="space-y-2 mb-5">
              {savePrompt.map(item => {
                const canPts = balance >= item.cost;
                const canTok = item.tokenPrice != null && tokenBalance >= item.tokenPrice;
                return (
                  <div key={item.key} className="flex items-center gap-2 p-2 border" style={{ borderColor: 'var(--pz-border)', clipPath: NOTCH_SM, background: 'var(--pz-panel-2)' }}>
                    <div className="w-10 h-10 shrink-0 rounded overflow-hidden" style={{ background: 'radial-gradient(circle at 50% 30%, #232B3B 0%, #14171E 80%)' }}>
                      <AvatarRig look={{ ...look, [slotKey(item.slot)]: item.key }} size="100%" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="text-xs font-black text-white truncate">{item.name}</div>
                      <div className="text-[10px] font-bold uppercase" style={{ color: RARITY_COLORS[item.rarity] }}>{item.rarity}</div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => buyFromPrompt(item, false)}
                        disabled={busyKey === item.key || !canPts}
                        className="touch-btn text-[10px] font-black uppercase px-2 py-1 inline-flex items-center gap-1 disabled:opacity-40"
                        style={{ clipPath: NOTCH_SM, background: 'rgba(203,254,28,0.12)', border: '1px solid rgba(203,254,28,0.4)', color: 'var(--pz-volt)' }}
                      >
                        <Ic.Lock size={9} /> {item.cost}
                      </button>
                      {item.tokenPrice != null && (
                        <button
                          onClick={() => buyFromPrompt(item, true)}
                          disabled={busyKey === item.key || !canTok}
                          className="touch-btn text-[10px] font-black uppercase px-2 py-1 inline-flex items-center gap-1 disabled:opacity-40"
                          style={{ clipPath: NOTCH_SM, background: 'rgba(203,254,28,0.12)', border: '1px solid rgba(203,254,28,0.4)', color: 'var(--pz-volt)' }}
                        >
                          <Ic.Coin size={9} /> {item.tokenPrice}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={saveWithout} disabled={saving} className="pz-btn w-full py-3 text-xs touch-btn min-h-[44px] mb-2 disabled:opacity-50">
              Save without these
            </button>
            <button onClick={() => setSavePrompt(null)} className="w-full text-[10px] font-black uppercase tracking-widest touch-btn py-1" style={{ color: 'var(--pz-text)' }}>
              Keep browsing
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarStudio;
