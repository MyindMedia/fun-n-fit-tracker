import React, { useEffect, useState } from 'react';
import { Student } from '../../types';
import { HOUSES } from '../../constants';
import { gameCenter } from '../../services/gameCenter';
import { medalColor, MedalRow } from '../TrophyCase';
import { Ic } from '../icons';

// Pubzi theme: small notched cut-corner shape for inline elements
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

const MEDAL_TYPES: Array<{ key: string; title: string }> = [
  { key: 'legend', title: 'Session Legend' },
  { key: 'mvp', title: 'MVP' },
  { key: 'hustle', title: 'Hustle Award' },
  { key: 'teamwork', title: 'Teamwork' },
  { key: 'sportsmanship', title: 'Sportsmanship' },
  { key: 'custom', title: 'Custom' },
];

const BONUS_OPTIONS = [0, 10, 25, 50];

interface MedalsPanelProps {
  students: Student[];
  adminName: string;
  onRefresh: () => void;
}

type WallRow = MedalRow & { fullName: string; houseId: string | null; avatarUrl: string | null };

// End-of-session Legends flow: pick a medal, pick your legends, award.
// Every medal is stamped with the coach who gave it.
const MedalsPanel: React.FC<MedalsPanelProps> = ({ students, adminName, onRefresh }) => {
  const [medalKey, setMedalKey] = useState('legend');
  const [customTitle, setCustomTitle] = useState('');
  const [bonus, setBonus] = useState(25);
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [wall, setWall] = useState<WallRow[]>([]);

  const loadWall = async () => {
    try {
      setWall((await gameCenter.recentMedals(40)) as WallRow[]);
    } catch (err) {
      console.warn('Failed to load medal wall:', err);
    }
  };

  useEffect(() => { loadWall(); }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const title = medalKey === 'custom'
    ? customTitle.trim()
    : MEDAL_TYPES.find(t => t.key === medalKey)!.title;
  const canAward = selected.size > 0 && !!title && !busy;

  const handleAward = async () => {
    if (!canAward) return;
    setBusy(true);
    try {
      const res = await gameCenter.awardMedals({
        studentIds: Array.from(selected),
        key: medalKey === 'custom' ? 'custom' : medalKey,
        title,
        note: note.trim() || undefined,
        bonusPoints: bonus > 0 ? bonus : undefined,
        awardedBy: adminName,
      });
      window.dispatchEvent(new CustomEvent('coach-toast', {
        detail: { message: `${res.awarded} × ${title} awarded`, amount: bonus > 0 ? bonus : undefined },
      }));
      setSelected(new Set());
      setNote('');
      await loadWall();
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to award medals');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (medalId: string) => {
    if (!window.confirm('Remove this medal? (Bonus points are not taken back.)')) return;
    try {
      await gameCenter.removeMedal(medalId);
      await loadWall();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove medal');
    }
  };

  // Present kids first — the Legends of the session that just ended
  const roster = [...students].sort((a, b) =>
    Number(b.isPresent) - Number(a.isPresent) || a.fullName.localeCompare(b.fullName)
  );

  return (
    <div className="space-y-4">
      {/* Step 1: medal type */}
      <div className="pz-card p-4 sm:p-5">
        <div className="pz-eyebrow mb-1">Step 1</div>
        <h3 className="text-sm text-white uppercase tracking-wide mb-3">Pick The Medal</h3>
        <div className="grid grid-cols-3 gap-2">
          {MEDAL_TYPES.map(t => {
            const color = t.key === 'custom' ? '#e2e8f0' : medalColor(t.key);
            const active = medalKey === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setMedalKey(t.key)}
                className="touch-btn min-h-[56px] p-2 border-2 text-center transition-all flex flex-col items-center gap-1"
                style={{
                  clipPath: NOTCH_SM,
                  borderColor: active ? color : 'var(--pz-border)',
                  background: active ? `${color}18` : 'var(--pz-panel-2)',
                  color: active ? color : 'var(--pz-text)',
                }}
              >
                <Ic.Medal size={18} />
                <span className="text-[10px] font-black uppercase tracking-wide leading-tight">{t.title}</span>
              </button>
            );
          })}
        </div>
        {medalKey === 'custom' && (
          <input
            type="text"
            value={customTitle}
            onChange={e => setCustomTitle(e.target.value)}
            placeholder="Custom medal title…"
            maxLength={30}
            className="mt-3 w-full px-4 py-3 bg-white/5 border border-white/10 text-sm font-bold text-white placeholder-white/40 outline-none focus:border-[#CBFE1C] transition-all"
            style={{ clipPath: NOTCH_SM }}
          />
        )}

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--pz-text)' }}>Bonus points</span>
          {BONUS_OPTIONS.map(b => (
            <button
              key={b}
              onClick={() => setBonus(b)}
              className="touch-btn px-4 py-2 text-xs font-black transition-all"
              style={{
                clipPath: NOTCH_SM,
                background: bonus === b ? 'var(--pz-volt)' : 'var(--pz-panel-2)',
                color: bonus === b ? '#0B0E13' : 'var(--pz-text)',
                border: bonus === b ? '1px solid var(--pz-volt)' : '1px solid var(--pz-border)',
              }}
            >
              {b === 0 ? 'None' : `+${b}`}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional shout-out (shows in their trophy case)…"
          maxLength={80}
          className="mt-3 w-full px-4 py-3 bg-white/5 border border-white/10 text-sm font-medium text-white placeholder-white/40 outline-none focus:border-[#CBFE1C] transition-all"
          style={{ clipPath: NOTCH_SM }}
        />
      </div>

      {/* Step 2: pick the legends */}
      <div className="pz-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="pz-eyebrow mb-1">Step 2</div>
            <h3 className="text-sm text-white uppercase tracking-wide">Pick Your Legends</h3>
          </div>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="touch-btn text-[10px] font-black uppercase" style={{ color: 'var(--pz-text)' }}>
              Clear ({selected.size})
            </button>
          )}
        </div>
        {roster.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--pz-text)' }}>No athletes enrolled yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {roster.map(s => {
              const isSel = selected.has(s.id);
              const house = HOUSES[s.houseId];
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className="touch-btn p-2.5 border-2 flex items-center gap-2.5 text-left transition-all active:scale-[0.98]"
                  style={{
                    clipPath: NOTCH_SM,
                    borderColor: isSel ? 'var(--pz-volt)' : 'var(--pz-border)',
                    background: isSel ? 'rgba(203,254,28,0.10)' : 'var(--pz-panel-2)',
                    opacity: s.isPresent ? 1 : 0.55,
                  }}
                >
                  <img
                    src={s.avatarUrl}
                    className="w-9 h-9 rounded-full border-2 object-cover shrink-0"
                    style={{ borderColor: house.colorHex }}
                    alt=""
                  />
                  <div className="min-w-0 flex-grow">
                    <div className="text-xs font-black text-white truncate">{s.fullName}</div>
                    <div className="text-[9px] font-bold uppercase" style={{ color: s.isPresent ? house.colorHex : 'var(--pz-text)' }}>
                      {s.isPresent ? house.name : 'Away today'}
                    </div>
                  </div>
                  {isSel && <span style={{ color: 'var(--pz-volt)' }}><Ic.CheckCircle size={18} /></span>}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={handleAward}
          disabled={!canAward}
          className={`mt-4 touch-btn min-h-[52px] w-full py-4 font-black text-sm uppercase tracking-widest transition-all ${canAward ? 'pz-btn' : 'bg-white/10 text-slate-500'}`}
          style={!canAward ? { clipPath: NOTCH_SM } : undefined}
        >
          {busy
            ? 'Awarding…'
            : selected.size === 0
              ? 'Select your legends above'
              : `Crown ${selected.size} ${title || 'Medal'}${selected.size > 1 ? 's' : ''}${bonus > 0 ? ` · +${bonus} pts each` : ''}`}
        </button>
      </div>

      {/* Recent medals wall */}
      <div className="pz-card p-4 sm:p-5">
        <div className="pz-eyebrow mb-1">The Wall</div>
        <h3 className="text-sm text-white uppercase tracking-wide mb-3">Recent Medals</h3>
        {wall.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--pz-text)' }}>No medals yet — crown your first Legend!</div>
        ) : (
          <div className="space-y-2 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
            {wall.map(m => {
              const color = medalColor(m.key);
              return (
                <div key={m._id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10" style={{ clipPath: NOTCH_SM }}>
                  {m.avatarUrl && (
                    <img src={m.avatarUrl} className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/20" alt="" />
                  )}
                  <div className="flex-grow min-w-0">
                    <div className="text-sm font-black text-white truncate">
                      {m.fullName} <span style={{ color }}>· {m.title}</span>
                    </div>
                    <div className="text-[10px] font-bold" style={{ color: 'var(--pz-text)' }}>
                      {new Date(m.createdAt).toLocaleDateString()} · by {m.awardedBy}{m.note ? ` · ${m.note}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(m._id)}
                    className="touch-btn w-8 h-8 bg-red-500/10 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0"
                    style={{ clipPath: NOTCH_SM }}
                    aria-label="Remove medal"
                  >
                    <Ic.Trash size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MedalsPanel;
