import React, { useEffect, useMemo, useState } from 'react';
import { Ic } from '../icons';
import { gameCenter } from '../../services/gameCenter';
import {
  VOLT_MAX_LEVEL,
  VOLT_PERKS,
  VOLT_SLOT_LABELS,
  VoltSlot,
  applyVoltConfig,
  isValidVoltLevels,
  voltDefaultConfig,
} from '../../voltCatalog';

// Admin editor for the Volt System ladder: the 40 XP level thresholds and the
// Volt Level at which each perk unlocks. Saves to appSettings["volt_config"]
// via gameCenter.setVoltConfig; the server validates the levels array. Level 1
// is fixed at 0 XP (you are always at least level 1). A missing/invalid config
// falls back to the code formula everywhere, so this page is safe to leave blank.

const INPUT =
  'w-full min-h-[40px] px-2 py-2 rounded-lg border border-white/10 bg-[#171C27] text-sm font-bold text-white text-center outline-none focus:border-[#CBFE1C] tabular-nums';

const VoltLevelsEditor: React.FC = () => {
  const defaults = useMemo(() => voltDefaultConfig(), []);
  const [levels, setLevels] = useState<number[]>(() => [...defaults.levels]);
  const [perkUnlocks, setPerkUnlocks] = useState<Record<string, number>>(() => ({
    ...defaults.perkUnlocks,
  }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await gameCenter.getVoltConfig();
        if (cancelled) return;
        if (raw) {
          const cfg = JSON.parse(raw) as { levels?: number[]; perkUnlocks?: Record<string, number> };
          if (isValidVoltLevels(cfg.levels)) setLevels([...(cfg.levels as number[])]);
          if (cfg.perkUnlocks && typeof cfg.perkUnlocks === 'object') {
            setPerkUnlocks((prev) => {
              const next = { ...prev };
              for (const p of VOLT_PERKS) {
                const o = cfg.perkUnlocks?.[p.key];
                if (typeof o === 'number' && Number.isFinite(o) && o >= 1 && o <= VOLT_MAX_LEVEL) {
                  next[p.key] = Math.round(o);
                }
              }
              return next;
            });
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(`Failed to load config: ${e?.message || e}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // First level whose threshold is not strictly greater than the one before it.
  const firstBadLevel = useMemo(() => {
    for (let i = 1; i < levels.length; i++) {
      const v = levels[i];
      if (!Number.isFinite(v) || v < 0 || v <= levels[i - 1]) return i + 1; // 1-based level
    }
    if (!Number.isFinite(levels[0]) || levels[0] < 0) return 1;
    return null;
  }, [levels]);

  const valid = firstBadLevel === null && levels.length === VOLT_MAX_LEVEL;

  const setLevel = (index: number, raw: string) => {
    const n = parseInt(raw, 10);
    setSavedAt(null);
    setLevels((prev) => {
      const next = [...prev];
      next[index] = Number.isFinite(n) ? n : 0;
      return next;
    });
  };

  const setPerk = (key: string, raw: string) => {
    const n = parseInt(raw, 10);
    setSavedAt(null);
    setPerkUnlocks((prev) => ({
      ...prev,
      [key]: Number.isFinite(n) ? Math.min(VOLT_MAX_LEVEL, Math.max(1, n)) : prev[key],
    }));
  };

  const resetToDefaults = () => {
    const d = voltDefaultConfig();
    setLevels([...d.levels]);
    setPerkUnlocks({ ...d.perkUnlocks });
    setSavedAt(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!valid) {
      setError('Fix the highlighted levels first — each must be higher than the one before it.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Level 1 is always 0 XP; enforce it before saving.
      const toSave = [...levels];
      toSave[0] = 0;
      await gameCenter.setVoltConfig(toSave, perkUnlocks);
      // Apply to the running client immediately so the change is live everywhere.
      applyVoltConfig({ levels: toSave, perkUnlocks });
      setLevels(toSave);
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="pz-scope pz-card p-6 flex items-center justify-center" style={{ color: 'var(--pz-text)' }}>
        Loading Volt levels…
      </section>
    );
  }

  return (
    <section className="pz-scope pz-card p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex-shrink-0" style={{ color: 'var(--pz-volt, #CBFE1C)' }}>
            <Ic.Bolt size={26} />
          </span>
          <div>
            <h2 className="pz-display text-lg text-white tracking-wide">Volt Levels</h2>
            <p className="text-xs" style={{ color: 'var(--pz-text)' }}>
              XP thresholds for all {VOLT_MAX_LEVEL} levels and each perk's unlock level.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefaults}
            className="touch-btn pz-btn-ghost px-3 py-2 text-xs inline-flex items-center gap-2"
            type="button"
          >
            <Ic.Refresh size={16} /> Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !valid}
            className="touch-btn pz-btn px-4 py-2 text-xs inline-flex items-center gap-2 disabled:opacity-50"
            type="button"
          >
            <Ic.Check size={16} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Status line */}
      {error && (
        <div
          className="pz-card-sm p-3 flex items-center gap-2 text-xs font-bold"
          style={{ borderColor: 'rgba(239,68,68,0.7)', color: '#fca5a5' }}
        >
          <Ic.Warning size={16} /> {error}
        </div>
      )}
      {savedAt && !error && (
        <div
          className="pz-card-sm p-3 flex items-center gap-2 text-xs font-bold"
          style={{ borderColor: 'rgba(16,185,129,0.7)', color: '#6ee7b7' }}
        >
          <Ic.CheckCircle size={16} /> Saved. New thresholds are live for every athlete.
        </div>
      )}

      {/* Level thresholds */}
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--pz-text)' }}>
          Level Thresholds (cumulative XP to reach)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {levels.map((xp, i) => {
            const level = i + 1;
            const locked = level === 1; // level 1 is always 0 XP
            const isBad = firstBadLevel === level;
            return (
              <label
                key={level}
                className="pz-card-sm p-2 flex items-center gap-2"
                style={{
                  background: 'var(--pz-panel-2)',
                  borderColor: isBad ? 'rgba(239,68,68,0.8)' : undefined,
                }}
              >
                <span
                  className="w-8 shrink-0 text-center text-[11px] font-black"
                  style={{ color: 'var(--pz-volt, #CBFE1C)' }}
                >
                  {level}
                </span>
                {locked ? (
                  <span
                    className="flex-grow min-h-[40px] flex items-center justify-center text-sm font-bold text-white/40 gap-1"
                    title="Level 1 is always 0 XP"
                  >
                    <Ic.Lock size={13} /> 0
                  </span>
                ) : (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={Number.isFinite(xp) ? xp : 0}
                    onChange={(e) => setLevel(i, e.target.value)}
                    className={INPUT}
                  />
                )}
              </label>
            );
          })}
        </div>
        <p className="text-[10px] mt-2" style={{ color: 'var(--pz-text)' }}>
          Each level must be higher than the one before it. Level 1 stays at 0.
        </p>
      </div>

      {/* Perk unlock levels */}
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--pz-text)' }}>
          Perk Unlock Levels
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VOLT_PERKS.map((p) => (
            <div
              key={p.key}
              className="pz-card-sm p-3 flex items-center gap-3"
              style={{ background: 'var(--pz-panel-2)' }}
            >
              <span className="flex-shrink-0 text-white/70">
                {(Ic as any)[p.icon] ? (
                  React.createElement((Ic as any)[p.icon], { size: 18 })
                ) : (
                  <Ic.Bolt size={18} />
                )}
              </span>
              <div className="flex-grow min-w-0">
                <div className="text-sm font-black text-white truncate">{p.name}</div>
                <div className="text-[10px]" style={{ color: 'var(--pz-text)' }}>
                  {VOLT_SLOT_LABELS[p.slot as VoltSlot]} • {p.blurb}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Ic.Lock size={13} className="text-white/40" />
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={VOLT_MAX_LEVEL}
                  value={perkUnlocks[p.key] ?? p.unlockLevel}
                  onChange={(e) => setPerk(p.key, e.target.value)}
                  className="w-16 min-h-[40px] px-2 py-2 rounded-lg border border-white/10 bg-[#171C27] text-sm font-bold text-white text-center outline-none focus:border-[#CBFE1C] tabular-nums"
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] mt-2" style={{ color: 'var(--pz-text)' }}>
          The Volt Level a kid must reach before the perk can be equipped (1–{VOLT_MAX_LEVEL}).
        </p>
      </div>
    </section>
  );
};

export default VoltLevelsEditor;
