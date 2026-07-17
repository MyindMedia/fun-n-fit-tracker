import React, { useEffect, useMemo, useState } from 'react';
import { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { Student, HouseId } from '../../types';
import { HOUSES } from '../../constants';
import StudentAvatar from '../StudentAvatar';
import { Ic } from '../icons';

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ||
  'https://dependable-spoonbill-535.convex.cloud';

const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
const HOUSE_KEYS: HouseId[] = [HouseId.UNITY, HouseId.SAGE, HouseId.SPARK, HouseId.VALOR];

interface DraftData {
  assignments: Record<string, HouseId>;
  revealAt: number | null;
  updatedBy: string;
}

// House Draft: stage where every athlete lands, balanced or hand-placed.
// Nothing is visible to kids or parents until the coach reveals - manually
// or at a scheduled date. Drag a player onto a house logo, or tap the player
// then tap the house.
const HouseDraft: React.FC<{ students: Student[]; adminName: string; onRefresh: () => void }> = ({
  students,
  adminName,
  onRefresh,
}) => {
  const client = useMemo(() => new ConvexClient(CONVEX_URL), []);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // Live draft subscription so two admins see the same staging
    const unsub = client.onUpdate(api.houses.draft, {}, (d) => setDraft(d as DraftData | null));
    return () => { unsub(); void client.close(); };
  }, [client]);

  const assignments = draft?.assignments ?? {};
  const coach = adminName || 'Coach';

  const stagedCounts = useMemo(() => {
    const counts = {} as Record<HouseId, number>;
    for (const h of HOUSE_KEYS) counts[h] = 0;
    for (const s of students) {
      const staged = assignments[s.id];
      counts[(staged ?? s.houseId) as HouseId] += 1;
    }
    return counts;
  }, [students, assignments]);

  const changedCount = students.filter(s => assignments[s.id] && assignments[s.id] !== s.houseId).length;
  const hasDraft = Object.keys(assignments).length > 0;

  const place = async (studentId: string, house: HouseId) => {
    setSelected(null);
    await client.mutation(api.houses.assign, { studentId: studentId as never, house, adminName: coach });
  };

  const randomize = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await client.mutation(api.houses.randomize, { adminName: coach });
      setNotice('Balanced draft staged. Nothing is visible until you reveal.');
    } finally { setBusy(false); }
  };

  const revealNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await client.mutation(api.houses.revealNow, { adminName: coach });
      setConfirmReveal(false);
      setNotice('Houses revealed! The board is celebrating.');
      onRefresh();
    } finally { setBusy(false); }
  };

  const schedule = async () => {
    if (!scheduleAt || busy) return;
    const atMs = new Date(scheduleAt).getTime();
    setBusy(true);
    try {
      await client.mutation(api.houses.scheduleReveal, { atMs, adminName: coach });
      setNotice(`Reveal scheduled for ${new Date(atMs).toLocaleString()}.`);
    } catch (e: any) {
      setNotice(e?.message?.replace(/^.*Uncaught Error:\s*/, '').split(' at ')[0] || 'Could not schedule');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="pz-card p-4 sm:p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <span style={{ color: 'var(--pz-volt)' }}><Ic.Home size={24} /></span>
          <div className="flex-grow min-w-[220px]">
            <div className="font-black text-white uppercase tracking-wide text-[15px]">House Draft</div>
            <div className="text-xs" style={{ color: 'var(--pz-text)' }}>
              Stage placements here — kids and parents see NOTHING until you reveal. Drag a player onto
              a house, or tap the player then tap the house.
            </div>
          </div>
          <button
            onClick={() => void randomize()}
            disabled={busy}
            className="pz-btn min-h-[44px] px-4 text-xs font-black uppercase tracking-widest disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1.5"><Ic.Dice size={16} /> Randomize (balanced)</span>
          </button>
          {hasDraft && (
            <button
              onClick={() => void client.mutation(api.houses.clearDraft, {})}
              className="pz-btn-ghost min-h-[44px] px-4 text-xs font-black uppercase tracking-widest"
            >
              Clear draft
            </button>
          )}
        </div>
        {notice && (
          <div className="mt-3 text-xs font-bold" style={{ color: 'var(--pz-volt)' }}>{notice}</div>
        )}
      </div>

      {/* House drop zones */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {HOUSE_KEYS.map(h => {
          const house = HOUSES[h];
          return (
            <div
              key={h}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const sid = e.dataTransfer.getData('text/fnf-student');
                if (sid) void place(sid, h);
              }}
              onClick={() => { if (selected) void place(selected, h); }}
              className="pz-card p-4 text-center select-none transition-all"
              style={{
                borderColor: selected ? house.colorHex : 'var(--pz-border)',
                cursor: selected ? 'pointer' : 'default',
                background: `linear-gradient(160deg, ${house.colorHex}14, transparent 60%), var(--pz-panel)`,
              }}
            >
              {house.customIcon
                ? <img src={house.customIcon} alt={house.name} className="w-20 h-20 object-contain mx-auto mb-2 pointer-events-none" />
                : <div className="text-5xl mb-2">{house.mascot}</div>}
              <div className="pz-display text-sm" style={{ color: house.colorHex }}>{house.name}</div>
              <div className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: 'var(--pz-text)' }}>
                {stagedCounts[h]} player{stagedCounts[h] === 1 ? '' : 's'} staged
              </div>
              {selected && (
                <div className="text-[9px] font-black uppercase mt-1" style={{ color: house.colorHex }}>
                  Tap to place here
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Roster chips */}
      <div className="pz-card p-4 sm:p-5">
        <div className="pz-eyebrow mb-3">
          Enrolled players ({students.length}){changedCount > 0 ? ` — ${changedCount} staged to move` : ''}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
          {students.map(s => {
            const staged = assignments[s.id];
            const effective = (staged ?? s.houseId) as HouseId;
            const isSelected = selected === s.id;
            const moves = staged && staged !== s.houseId;
            return (
              <div
                key={s.id}
                draggable
                onDragStart={e => e.dataTransfer.setData('text/fnf-student', s.id)}
                onClick={() => setSelected(isSelected ? null : s.id)}
                className="flex items-center gap-3 p-2.5 cursor-grab active:cursor-grabbing select-none"
                style={{
                  clipPath: NOTCH_SM,
                  background: isSelected ? `${HOUSES[effective].colorHex}1f` : 'var(--pz-panel-2)',
                  border: `1px solid ${isSelected ? HOUSES[effective].colorHex : 'var(--pz-border)'}`,
                }}
              >
                <StudentAvatar student={s} size="sm" showVoltLevel={false} />
                <div className="min-w-0 flex-grow">
                  <div className="text-xs font-black text-white truncate">{s.fullName}</div>
                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide">
                    <span style={{ color: HOUSES[s.houseId].colorHex }}>{HOUSES[s.houseId].name}</span>
                    {moves && (
                      <>
                        <Ic.ArrowRight size={10} style={{ color: 'var(--pz-text)' }} />
                        <span style={{ color: HOUSES[staged as HouseId].colorHex }}>{HOUSES[staged as HouseId].name}</span>
                      </>
                    )}
                  </div>
                </div>
                {isSelected && <span className="text-[8px] font-black uppercase shrink-0" style={{ color: 'var(--pz-volt)' }}>Pick a house</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Reveal controls */}
      {hasDraft && (
        <div className="pz-card p-4 sm:p-5" style={{ borderColor: 'rgba(203,254,28,0.4)' }}>
          <div className="pz-eyebrow mb-2">The reveal</div>
          {draft?.revealAt ? (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-sm font-bold text-white">
                Scheduled for {new Date(draft.revealAt).toLocaleString()}
              </div>
              <button
                onClick={() => void client.mutation(api.houses.cancelSchedule, {})}
                className="pz-btn-ghost min-h-[44px] px-4 text-xs font-black uppercase tracking-widest"
              >
                Cancel schedule
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--pz-text)' }}>
                  Reveal on a date
                </label>
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={e => setScheduleAt(e.target.value)}
                  className="px-3 py-2.5 bg-white/5 border border-white/10 text-sm font-bold text-white outline-none focus:border-[#CBFE1C]"
                  style={{ clipPath: NOTCH_SM, colorScheme: 'dark' }}
                />
              </div>
              <button
                onClick={() => void schedule()}
                disabled={!scheduleAt || busy}
                className="pz-btn-ghost min-h-[44px] px-4 text-xs font-black uppercase tracking-widest disabled:opacity-40"
              >
                Schedule
              </button>
              <div className="flex-grow" />
              {confirmReveal ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: 'var(--pz-text)' }}>Go live with the houses?</span>
                  <button
                    onClick={() => void revealNow()}
                    disabled={busy}
                    className="pz-btn min-h-[44px] px-4 text-xs font-black uppercase tracking-widest"
                  >
                    {busy ? 'Revealing…' : 'Yes, reveal'}
                  </button>
                  <button onClick={() => setConfirmReveal(false)} className="pz-btn-ghost min-h-[44px] px-3 text-xs font-black uppercase">
                    Not yet
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmReveal(true)}
                  className="pz-btn min-h-[44px] px-5 text-xs font-black uppercase tracking-widest"
                >
                  <span className="inline-flex items-center gap-1.5"><Ic.Confetti size={16} /> Reveal now</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HouseDraft;
