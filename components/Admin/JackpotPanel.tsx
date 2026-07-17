import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Student } from '../../types';
import { Ic } from '../icons';
import { getStudentDisplayName } from '../../utils/studentDisplay';
import {
  marketClient,
  JackpotPrize,
  JackpotPrizeKind,
  JackpotSpinRow,
} from '../../services/marketClient';

// Jackpot wheel: pick a kid (or random present kid), spin a volt prize wheel.
// The SERVER rolls the prize (convex/jackpot.ts spin); the wheel here only
// animates toward the returned prizeKey's segment. Never client-random.

const VOLT = '#CBFE1C';
const SEGMENT_FILLS = [VOLT, '#171E2B', '#2A3547', '#10151F'];

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

const segmentPath = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
};

const timeAgo = (ts: number): string => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

interface PrizeForm {
  key: string;
  label: string;
  kind: JackpotPrizeKind;
  value: string;
  weight: number;
  active: boolean;
  isNew?: boolean;
  dirty?: boolean;
}

const KIND_LABELS: Record<JackpotPrizeKind, string> = {
  POINTS: 'Points',
  TOKENS: 'FitTokens',
  AVATAR_ITEM: 'Avatar item',
};

const JackpotPanel: React.FC<{ students: Student[]; adminName: string; onRefresh: () => void }> = ({
  students,
  adminName,
  onRefresh,
}) => {
  const coach = adminName || 'Coach';
  const [wheelPrizes, setWheelPrizes] = useState<JackpotPrize[]>([]);
  const [editorRows, setEditorRows] = useState<PrizeForm[]>([]);
  const [recent, setRecent] = useState<JackpotSpinRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const [result, setResult] = useState<{ kidName: string; label: string } | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const selected = students.find((s) => s.id === selectedId) ?? null;

  const loadPrizes = async () => {
    try {
      const [all, actives] = await Promise.all([
        marketClient.listPrizes(),
        marketClient.listActivePrizes(),
      ]);
      setEditorRows(all.map((p) => ({
        key: p.key,
        label: p.label,
        kind: p.kind,
        value: p.value,
        weight: p.weight,
        active: p.active,
      })));
      setWheelPrizes(actives);
    } catch (err) {
      console.error('Failed to load jackpot prizes:', err);
    }
  };

  useEffect(() => {
    loadPrizes();
    const unsub = marketClient.subscribeRecentSpins(setRecent);
    return unsub;
  }, []);

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...students]
      .filter(
        (s) =>
          !q ||
          s.fullName.toLowerCase().includes(q) ||
          (s.gamerTag ?? '').toLowerCase().includes(q)
      )
      .sort(
        (a, b) => Number(b.isPresent) - Number(a.isPresent) || a.fullName.localeCompare(b.fullName)
      );
  }, [students, search]);

  const pickRandomPresent = () => {
    const present = students.filter((s) => s.isPresent);
    if (present.length === 0) {
      alert('No kids are checked in right now');
      return;
    }
    const pick = present[Math.floor(Math.random() * present.length)];
    setSelectedId(pick.id);
    setResult(null);
  };

  const handleSpin = async () => {
    if (!selected || spinning || wheelPrizes.length === 0) return;
    setResult(null);
    setSpinning(true);
    try {
      // Server first: the roll + fulfillment happen in one mutation.
      const res = await marketClient.spin(selected.id, coach);
      const idx = Math.max(0, wheelPrizes.findIndex((p) => p.key === res.prizeKey));
      const seg = 360 / wheelPrizes.length;
      // Land inside the winning segment (jitter is visual only, the prize is fixed)
      const jitter = (Math.random() - 0.5) * seg * 0.5;
      const landing = idx * seg + seg / 2 + jitter;
      const current = rotationRef.current;
      const currentMod = ((current % 360) + 360) % 360;
      const targetMod = (((360 - landing) % 360) + 360) % 360;
      const delta = (((targetMod - currentMod) % 360) + 360) % 360;
      const next = current + 5 * 360 + delta;
      rotationRef.current = next;
      setRotation(next);
      const kidName = getStudentDisplayName(selected).primary;
      window.setTimeout(() => {
        setSpinning(false);
        setResult({ kidName, label: res.label });
        onRefresh();
      }, 3400);
    } catch (err: any) {
      setSpinning(false);
      alert(err?.message || 'The spin did not go through, try again');
    }
  };

  // ── Prize editor helpers ────────────────────────────────────────────────────

  const updateRow = (key: string, patch: Partial<PrizeForm>) => {
    setEditorRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch, dirty: true } : r))
    );
  };

  const saveRow = async (row: PrizeForm) => {
    if (!row.label.trim()) {
      alert('Please give the prize a label');
      return;
    }
    setSavingKey(row.key);
    try {
      await marketClient.upsertPrize({
        key: row.key,
        label: row.label.trim(),
        kind: row.kind,
        value: row.value,
        weight: Math.max(0, Math.round(Number(row.weight) || 0)),
        active: row.active,
      });
      await loadPrizes();
    } catch (err: any) {
      alert(err?.message || 'Failed to save prize');
    } finally {
      setSavingKey(null);
    }
  };

  const deleteRow = async (row: PrizeForm) => {
    if (row.isNew) {
      setEditorRows((rows) => rows.filter((r) => r.key !== row.key));
      return;
    }
    if (!window.confirm(`Remove "${row.label}" from the prize pool?`)) return;
    setSavingKey(row.key);
    try {
      await marketClient.removePrize(row.key);
      await loadPrizes();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove prize');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleRow = async (row: PrizeForm) => {
    if (row.isNew) {
      updateRow(row.key, { active: !row.active });
      return;
    }
    setSavingKey(row.key);
    try {
      await marketClient.togglePrizeActive(row.key);
      await loadPrizes();
    } catch (err: any) {
      alert(err?.message || 'Failed to update prize');
    } finally {
      setSavingKey(null);
    }
  };

  const addRow = () => {
    const key = `p_${Date.now().toString(36)}`;
    setEditorRows((rows) => [
      ...rows,
      { key, label: 'New Prize', kind: 'POINTS', value: '25', weight: 5, active: false, isNew: true, dirty: true },
    ]);
  };

  const activeWeightTotal = editorRows
    .filter((r) => r.active)
    .reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  // ── Wheel geometry ──────────────────────────────────────────────────────────

  const seg = wheelPrizes.length > 0 ? 360 / wheelPrizes.length : 360;

  return (
    <div className="pz-scope space-y-4">
      <style>{`
        @keyframes jp-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.06); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes jp-glow {
          0%, 100% { box-shadow: 0 0 12px rgba(203, 254, 28, 0.25); }
          50% { box-shadow: 0 0 34px rgba(203, 254, 28, 0.55); }
        }
        @keyframes jp-fall {
          0% { transform: translateY(-12px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(140px) rotate(540deg); opacity: 0; }
        }
        .jp-result { animation: jp-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both, jp-glow 2s ease-in-out infinite; }
        .jp-bit { position: absolute; top: 0; width: 7px; height: 7px; border-radius: 2px; animation: jp-fall 1.6s ease-in infinite; }
      `}</style>

      <section className="pz-card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl sm:text-2xl text-white uppercase tracking-tight inline-flex items-center gap-2.5">
            <Ic.Dice size={24} className="text-[#CBFE1C]" /> Jackpot
          </h2>
        </div>
        <p className="text-xs text-[#ABABAB] mb-4">
          Pick a player, spin the wheel, the prize lands instantly. The server picks the prize, the wheel just shows it off.
        </p>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Kid picker */}
          <div className="pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="pz-eyebrow">Who is spinning</div>
              <button
                onClick={pickRandomPresent}
                className="touch-btn focus-ring pz-btn-ghost px-3 py-2 text-[10px] inline-flex items-center gap-1.5"
              >
                <Ic.Dice size={14} /> Random present kid
              </button>
            </div>

            {selected && (
              <div
                className="flex items-center gap-3 p-3 rounded-xl border mb-3"
                style={{ borderColor: 'rgba(203,254,28,0.5)', background: 'rgba(203,254,28,0.06)' }}
              >
                <img src={selected.avatarUrl} className="w-11 h-11 rounded-full object-cover border-2 border-[#CBFE1C]" alt="" />
                <div className="min-w-0">
                  <div className="font-black text-sm text-white break-words">
                    {getStudentDisplayName(selected).primary}
                  </div>
                  {getStudentDisplayName(selected).secondary && (
                    <div className="text-[10px] text-[#ABABAB] break-words">
                      {getStudentDisplayName(selected).secondary}
                    </div>
                  )}
                </div>
                <span
                  className={`ml-auto px-2 py-0.5 rounded text-[9px] font-black uppercase flex-shrink-0 ${
                    selected.isPresent ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-[#ABABAB]'
                  }`}
                >
                  {selected.isPresent ? 'Present' : 'Away'}
                </span>
              </div>
            )}

            <div className="relative mb-2">
              <Ic.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ABABAB]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the roster"
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-[#171C27] text-sm font-medium text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C]"
              />
            </div>

            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1 pr-1">
              {roster.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#ABABAB]">No players match</div>
              ) : (
                roster.map((s) => {
                  const name = getStudentDisplayName(s);
                  const isSel = s.id === selectedId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedId(s.id);
                        setResult(null);
                      }}
                      className={`touch-btn focus-ring w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors ${
                        isSel ? 'bg-[#CBFE1C]/10 border border-[#CBFE1C]/50' : 'border border-transparent hover:bg-white/5'
                      }`}
                    >
                      <img src={s.avatarUrl} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
                      <span className="min-w-0">
                        <span className="block text-xs font-black text-white break-words">{name.primary}</span>
                        {name.secondary && (
                          <span className="block text-[10px] text-[#ABABAB] break-words">{name.secondary}</span>
                        )}
                      </span>
                      <span
                        className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${s.isPresent ? 'bg-emerald-400' : 'bg-white/15'}`}
                        title={s.isPresent ? 'Present' : 'Away'}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Wheel */}
          <div className="pz-card-sm p-4 flex flex-col items-center" style={{ background: 'var(--pz-panel-2)' }}>
            <div className="pz-eyebrow self-start mb-3">The wheel</div>

            {wheelPrizes.length === 0 ? (
              <div className="text-center py-16 text-[#ABABAB]">
                <Ic.Dice size={40} className="mx-auto mb-2 opacity-40" />
                <div className="text-sm font-medium">No active prizes yet</div>
                <div className="text-xs">Add prizes in the pool editor below</div>
              </div>
            ) : (
              <>
                <div className="relative w-full max-w-[320px] mx-auto select-none">
                  {/* Pointer */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-1 z-10"
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '12px solid transparent',
                      borderRight: '12px solid transparent',
                      borderTop: `18px solid ${VOLT}`,
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
                    }}
                  />
                  <svg
                    viewBox="0 0 300 300"
                    className="w-full h-auto block"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transition: spinning ? 'transform 3.2s cubic-bezier(0.15, 0.85, 0.25, 1)' : 'none',
                      willChange: 'transform',
                    }}
                  >
                    <circle cx="150" cy="150" r="148" fill="#0B0E13" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
                    {wheelPrizes.map((p, i) => {
                      const start = i * seg - 90;
                      const end = (i + 1) * seg - 90;
                      const fill = SEGMENT_FILLS[i % SEGMENT_FILLS.length];
                      const mid = start + seg / 2;
                      const [tx, ty] = polar(150, 150, 92, mid);
                      const midNorm = ((mid % 360) + 360) % 360;
                      const flip = midNorm > 90 && midNorm < 270;
                      const textRot = flip ? mid + 180 : mid;
                      return (
                        <g key={p.key}>
                          {wheelPrizes.length === 1 ? (
                            <circle cx="150" cy="150" r="140" fill={fill} />
                          ) : (
                            <path
                              d={segmentPath(150, 150, 140, start, end)}
                              fill={fill}
                              stroke="#0B0E13"
                              strokeWidth="2"
                            />
                          )}
                          <text
                            x={tx}
                            y={ty}
                            fill={fill === VOLT ? '#0B0E13' : VOLT}
                            fontSize="10"
                            fontWeight="800"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(${textRot}, ${tx}, ${ty})`}
                            style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                          >
                            {p.label.length > 16 ? `${p.label.slice(0, 15)}.` : p.label}
                          </text>
                        </g>
                      );
                    })}
                    <circle cx="150" cy="150" r="26" fill="#0B0E13" stroke={VOLT} strokeWidth="3" />
                  </svg>
                  {/* Non-rotating hub icon */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Ic.Bolt size={22} className="text-[#CBFE1C]" />
                  </div>
                </div>

                <button
                  onClick={handleSpin}
                  disabled={!selected || spinning}
                  className="touch-btn focus-ring pz-btn min-h-[52px] px-10 py-3 text-sm mt-4 disabled:opacity-40 inline-flex items-center gap-2"
                >
                  <Ic.Bolt size={16} />
                  {spinning ? 'Spinning' : selected ? 'SPIN' : 'Pick a player first'}
                </button>
              </>
            )}

            {result && !spinning && (
              <div
                className="jp-result relative overflow-hidden w-full mt-4 p-5 rounded-2xl border text-center"
                style={{ borderColor: 'rgba(203,254,28,0.6)', background: 'rgba(203,254,28,0.07)' }}
              >
                <div className="absolute inset-x-0 top-0 h-0 pointer-events-none">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <span
                      key={i}
                      className="jp-bit"
                      style={{
                        left: `${(i * 100) / 18 + 2}%`,
                        background: ['#CBFE1C', '#FFFFFF', '#34D399'][i % 3],
                        animationDelay: `${(i % 6) * 0.22}s`,
                      }}
                    />
                  ))}
                </div>
                <div className="relative">
                  <div className="flex justify-center mb-2 text-[#CBFE1C]"><Ic.Confetti size={30} /></div>
                  <div className="pz-eyebrow mb-1">Jackpot</div>
                  <div className="text-lg font-black text-white break-words">
                    {result.kidName} won <span className="text-[#CBFE1C]">{result.label}</span>!
                  </div>
                  <div className="text-[10px] text-[#ABABAB] mt-1">Already delivered to their account</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Recent spins */}
      <section className="pz-card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm text-white uppercase tracking-wide inline-flex items-center gap-2">
            <Ic.History size={16} className="text-[#CBFE1C]" /> Recent spins
          </h3>
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#ABABAB]">No spins yet. Warm up that wheel!</div>
        ) : (
          <div className="space-y-1.5">
            {recent.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-2.5 p-2.5 rounded-xl"
                style={{ background: 'var(--pz-panel-2)' }}
              >
                {row.avatarUrl ? (
                  <img src={row.avatarUrl} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Ic.User size={14} className="text-[#ABABAB]" />
                  </div>
                )}
                <div className="min-w-0 flex-grow">
                  <span className="text-xs font-black text-white break-words">{row.studentName}</span>
                  <span className="text-xs text-[#ABABAB]"> won </span>
                  <span className="text-xs font-black text-[#CBFE1C] break-words">{row.label}</span>
                </div>
                <div className="text-[10px] text-[#ABABAB] flex-shrink-0 text-right">
                  <div>{timeAgo(row.createdAt)}</div>
                  <div>by {row.byAdmin}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Prize pool editor */}
      <section className="pz-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-sm text-white uppercase tracking-wide inline-flex items-center gap-2">
            <Ic.Settings size={16} className="text-[#CBFE1C]" /> Prize pool
          </h3>
          <button
            onClick={addRow}
            className="touch-btn focus-ring pz-btn min-h-[40px] px-4 py-2 text-[10px] inline-flex items-center gap-1.5"
          >
            <Ic.Plus size={14} /> Add prize
          </button>
        </div>
        <p className="text-[10px] text-[#ABABAB] mb-4">
          Weights are relative chances, not percentages. A weight 40 prize lands 40 times more often than a weight 1 prize.
        </p>

        {editorRows.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#ABABAB]">No prizes yet. Add the first one!</div>
        ) : (
          <div className="space-y-2">
            {editorRows.map((row) => {
              const busy = savingKey === row.key;
              const pct =
                row.active && activeWeightTotal > 0
                  ? `${Math.round(((Number(row.weight) || 0) / activeWeightTotal) * 1000) / 10}%`
                  : null;
              return (
                <div key={row.key} className="pz-card-sm p-3" style={{ background: 'var(--pz-panel-2)' }}>
                  <div className="grid grid-cols-2 sm:grid-cols-[1fr_130px_110px_80px] gap-2 mb-2">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[9px] font-black text-[#ABABAB] uppercase tracking-widest block mb-1">Label</label>
                      <input
                        type="text"
                        value={row.label}
                        onChange={(e) => updateRow(row.key, { label: e.target.value })}
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-white/10 bg-[#171C27] text-xs font-bold text-white outline-none focus:border-[#CBFE1C]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-[#ABABAB] uppercase tracking-widest block mb-1">Kind</label>
                      <select
                        value={row.kind}
                        onChange={(e) => {
                          const kind = e.target.value as JackpotPrizeKind;
                          updateRow(row.key, {
                            kind,
                            value: kind === 'AVATAR_ITEM' ? 'uncommon' : row.kind === 'AVATAR_ITEM' ? '25' : row.value,
                          });
                        }}
                        className="w-full min-h-[40px] px-2 py-2 rounded-lg border border-white/10 bg-[#171C27] text-xs font-bold text-white outline-none focus:border-[#CBFE1C]"
                      >
                        {(Object.keys(KIND_LABELS) as JackpotPrizeKind[]).map((k) => (
                          <option key={k} value={k}>{KIND_LABELS[k]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-[#ABABAB] uppercase tracking-widest block mb-1">
                        {row.kind === 'AVATAR_ITEM' ? 'Rarity' : 'Amount'}
                      </label>
                      {row.kind === 'AVATAR_ITEM' ? (
                        <select
                          value={row.value}
                          onChange={(e) => updateRow(row.key, { value: e.target.value })}
                          className="w-full min-h-[40px] px-2 py-2 rounded-lg border border-white/10 bg-[#171C27] text-xs font-bold text-white outline-none focus:border-[#CBFE1C]"
                        >
                          <option value="common">Common</option>
                          <option value="uncommon">Uncommon</option>
                          <option value="legendary">Legendary</option>
                        </select>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          value={row.value}
                          onChange={(e) => updateRow(row.key, { value: e.target.value })}
                          className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-white/10 bg-[#171C27] text-xs font-bold text-white outline-none focus:border-[#CBFE1C]"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-[#ABABAB] uppercase tracking-widest block mb-1">Weight</label>
                      <input
                        type="number"
                        min={0}
                        value={row.weight}
                        onChange={(e) => updateRow(row.key, { weight: Number(e.target.value) })}
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-white/10 bg-[#171C27] text-xs font-bold text-white outline-none focus:border-[#CBFE1C]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => toggleRow(row)}
                      disabled={busy}
                      className={`touch-btn focus-ring px-3 py-1.5 rounded-lg text-[9px] font-black uppercase disabled:opacity-50 ${
                        row.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-[#ABABAB]'
                      }`}
                    >
                      {row.active ? 'On the wheel' : 'Off'}
                    </button>
                    {pct && (
                      <span className="text-[9px] font-black text-[#CBFE1C] uppercase tracking-wide">{pct} chance</span>
                    )}
                    <div className="ml-auto flex gap-2">
                      {row.dirty && (
                        <button
                          onClick={() => saveRow(row)}
                          disabled={busy}
                          className="touch-btn focus-ring pz-btn px-3 py-1.5 text-[9px] disabled:opacity-50"
                        >
                          {busy ? 'Saving' : 'Save'}
                        </button>
                      )}
                      <button
                        onClick={() => deleteRow(row)}
                        disabled={busy}
                        className="touch-btn focus-ring px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[9px] font-black uppercase border border-red-500/30 disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <Ic.Trash size={12} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default JackpotPanel;
