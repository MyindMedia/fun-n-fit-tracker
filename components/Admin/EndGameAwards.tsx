import React, { useState } from 'react';
import { GameSession, Student } from '../../types';
import { gameCenter } from '../../services/gameCenter';
import { supabaseService } from '../../services/supabaseService';
import { AdminNotifications } from '../../utils/notifications';
import { GEAR_ITEMS } from '../../gearCatalog';
import { getStudentDisplayName } from '../../utils/studentDisplay';

interface Props {
  session: GameSession;
  students: Student[];
  adminName: string;
  onClose: () => void;
}

// Preset accolades; coaches can hand any of these to the game's participants.
const MEDAL_CHIPS = [
  { key: 'legend', title: 'Session Legend' },
  { key: 'mvp', title: 'MVP' },
  { key: 'hustle', title: 'Hustle' },
  { key: 'teamwork', title: 'Teamwork' },
  { key: 'sportsmanship', title: 'Sportsmanship' },
];

const EndGameAwards: React.FC<Props> = ({ session, students, adminName, onClose }) => {
  const roster = students.filter(s => session.roster.includes(s.id));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState(10);
  const [giftKey, setGiftKey] = useState<string>(GEAR_ITEMS[0]?.key ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');

  const ids = Array.from(selected);
  const toggle = (id: string) =>
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const selectAll = () => setSelected(new Set(roster.map(s => s.id)));
  const clear = () => setSelected(new Set());

  const run = async (label: string, fn: () => Promise<void>) => {
    if (busy || ids.length === 0) return;
    setBusy(true);
    setStatus('');
    try {
      await fn();
      setStatus(label);
    } catch (e: any) {
      AdminNotifications.error(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const awardPoints = () =>
    run(`Awarded +${amount} to ${ids.length} player${ids.length !== 1 ? 's' : ''}`, async () => {
      await supabaseService.addBatchPoints(ids, amount, `${session.title || 'Game'}: wrap-up`, adminName, session.id);
    });

  const awardMedal = (key: string, title: string) =>
    run(`${title} awarded to ${ids.length} player${ids.length !== 1 ? 's' : ''}`, async () => {
      await gameCenter.awardMedals({ studentIds: ids, key, title, awardedBy: adminName, gameSessionId: session.id });
    });

  const giftItem = () => {
    const item = GEAR_ITEMS.find(g => g.key === giftKey);
    return run(`Gifted ${item?.name ?? 'item'} to ${ids.length}`, async () => {
      for (const id of ids) await gameCenter.grantGear(id, giftKey, adminName);
    });
  };

  return (
    <div
      className="pz-scope fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="pz-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#CBFE1C]">Wrap Up</div>
            <h2 className="text-xl text-white tracking-tight">{session.title || 'Game'}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center text-lg leading-none shrink-0"
          >×</button>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>
            Players · {selected.size}/{roster.length}
          </span>
          <div className="flex gap-3">
            <button onClick={selectAll} className="text-[10px] font-black text-[#CBFE1C]">Select all</button>
            <button onClick={clear} className="text-[10px] font-black text-white/50">Clear</button>
          </div>
        </div>
        <div className="max-h-40 overflow-y-auto space-y-1 mb-4 border border-white/10 rounded-lg p-2" style={{ background: 'var(--pz-panel-2)' }}>
          {roster.map(s => (
            <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="w-4 h-4 accent-[#CBFE1C]" />
              {s.avatarUrl && <img src={s.avatarUrl} className="w-7 h-7 rounded-full border border-white/10 object-cover" alt="" />}
              <span className="text-sm text-white truncate">{getStudentDisplayName(s).primary}</span>
            </label>
          ))}
        </div>

        {/* Points */}
        <div className="mb-4">
          <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--pz-text)' }}>Points</div>
          <div className="flex gap-2 flex-wrap items-center">
            {[5, 10, 25, 50].map(a => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                className={`px-3 py-2 text-sm font-black rounded-lg ${amount === a ? 'bg-[#CBFE1C] text-[#0B0E13]' : 'bg-white/5 text-white/60 border border-white/10'}`}
              >+{a}</button>
            ))}
            <button onClick={awardPoints} disabled={busy || ids.length === 0} className="flex-grow pz-btn py-2 text-xs disabled:opacity-40">
              Award +{amount} to {ids.length}
            </button>
          </div>
        </div>

        {/* Awards / medals */}
        <div className="mb-4">
          <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--pz-text)' }}>Awards</div>
          <div className="flex gap-2 flex-wrap">
            {MEDAL_CHIPS.map(m => (
              <button
                key={m.key}
                onClick={() => awardMedal(m.key, m.title)}
                disabled={busy || ids.length === 0}
                className="px-3 py-2 text-xs font-black rounded-lg bg-white/5 text-white border border-white/10 hover:border-[#CBFE1C] transition-all disabled:opacity-40"
              >{m.title}</button>
            ))}
          </div>
        </div>

        {/* Gift an item (rare) */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--pz-text)' }}>Gift Item · rare</div>
          <div className="flex gap-2">
            <select
              value={giftKey}
              onChange={e => setGiftKey(e.target.value)}
              className="flex-grow p-2 text-sm rounded-lg border border-white/10 bg-[#171C27] text-white outline-none focus:border-[#CBFE1C]"
            >
              {GEAR_ITEMS.map(g => <option key={g.key} value={g.key}>{g.name} ({g.rank})</option>)}
            </select>
            <button onClick={giftItem} disabled={busy || ids.length === 0} className="px-4 py-2 text-xs font-black rounded-lg bg-white/10 text-white border border-white/10 disabled:opacity-40">Gift</button>
          </div>
        </div>

        {status && (
          <div className="mt-4 text-center text-sm font-bold text-[#CBFE1C]">{status}</div>
        )}
      </div>
    </div>
  );
};

export default EndGameAwards;
