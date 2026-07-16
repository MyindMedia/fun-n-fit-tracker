import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HOUSES } from '../../constants';
import { GameSession, HouseId } from '../../types';
import { gameCenter } from '../../services/gameCenter';
import { supabaseService } from '../../services/supabaseService';
import { useNfcWedge, useWebNfc, WedgeScan } from '../useNfcWedge';
import { Ic } from '../icons';
import { haptic } from '../../utils/haptics';

interface NfcManagerProps {
  adminName: string;
}

type Mode = 'ASSIGN' | 'CHECKIN' | 'POINTS' | 'TIMING';

interface RosterRow {
  studentId: string;
  fullName: string;
  houseId: string;
  avatarUrl?: string;
  tagUid: string | null;
}

interface Flash {
  tone: 'ok' | 'warn' | 'info';
  title: string;
  sub?: string;
  avatarUrl?: string;
  houseId?: string;
  ts: number;
}

// One row from the live per-session scan feed (convex nfcScans docs)
interface SessionScan {
  studentId?: string | null;
  studentName?: string | null;
  houseId?: string | null;
  splitMs?: number | null;
  ts: number;
  kind: string;
}

// Aggregated splits-board row (Timing mode with a game session attached)
interface SplitRow {
  name: string;
  laps: number;
  best: number | null; // min splitMs
  last: number | null; // splitMs of the most recent tap
  lastTs: number;
}

const fmtSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

const MODES: Array<{ id: Mode; label: string; icon: React.FC<{ size?: number | string }>; blurb: string }> = [
  { id: 'ASSIGN', label: 'Assign', icon: Ic.Tag, blurb: 'Tap a band to assign it to a student' },
  { id: 'CHECKIN', label: 'Check-In', icon: Ic.CheckCircle, blurb: 'Every tap checks that student in' },
  { id: 'POINTS', label: 'Points', icon: Ic.Bolt, blurb: 'Every tap awards the preset points' },
  { id: 'TIMING', label: 'Timing', icon: Ic.Timer, blurb: 'Every tap records a timing scan' },
];

const POINT_PRESETS = [5, 10, 25, 50];

const NfcManager: React.FC<NfcManagerProps> = ({ adminName }) => {
  const [mode, setMode] = useState<Mode>('ASSIGN');
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [lastUid, setLastUid] = useState<string | null>(null);
  const [pendingStudent, setPendingStudent] = useState<RosterRow | null>(null); // student-first assign
  const [pendingUid, setPendingUid] = useState<string | null>(null); // scan-first assign
  const [search, setSearch] = useState('');
  const [pointPreset, setPointPreset] = useState(10);
  const [pointReason, setPointReason] = useState('Game score');
  const [busy, setBusy] = useState(false);
  const [scanLog, setScanLog] = useState<Array<{ name: string; detail: string; ts: number }>>([]);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // ── Game-session attachment (TIMING / POINTS record against a live game) ──
  const [activeGames, setActiveGames] = useState<GameSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const pickedFreeScan = useRef(false); // explicit "No game" choice survives refreshes
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;
  const [sessionScans, setSessionScans] = useState<SessionScan[]>([]);

  const loadRoster = async () => setRoster(await gameCenter.nfcTagRoster());
  useEffect(() => { loadRoster(); }, []);

  const loadActiveGames = async () => setActiveGames(await supabaseService.getActiveGames());
  useEffect(() => {
    loadActiveGames();
    // Stay in sync as games launch/finish elsewhere in the dashboard
    return supabaseService.on('active_games_update', (games) => setActiveGames(games as GameSession[]));
  }, []);

  // Keep the selection valid: drop finished sessions; auto-select when exactly
  // one game is live (unless the coach explicitly picked free scan).
  useEffect(() => {
    setSessionId((cur) => {
      if (cur && activeGames.some((g) => g.id === cur)) return cur;
      if (pickedFreeScan.current) return null;
      return activeGames.length === 1 ? activeGames[0].id : null;
    });
  }, [activeGames]);

  // Live splits feed for the attached session (Timing mode board)
  useEffect(() => {
    if (mode !== 'TIMING' || !sessionId) {
      setSessionScans([]);
      return;
    }
    setSessionScans([]);
    return gameCenter.subscribeSessionScans(sessionId, setSessionScans);
  }, [mode, sessionId]);

  const showFlash = (f: Omit<Flash, 'ts'>) => {
    // Physical feedback on devices that support it (Android phones/tablets)
    haptic(f.tone === 'ok' ? 'success' : f.tone === 'warn' ? 'warning' : 'tap');
    setFlash({ ...f, ts: Date.now() });
  };
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  const pushLog = (name: string, detail: string) =>
    setScanLog((log) => [{ name, detail, ts: Date.now() }, ...log].slice(0, 12));

  const handleScan = async (scan: WedgeScan) => {
    if (busy) return;
    setLastUid(scan.uid);
    setBusy(true);
    try {
      const m = modeRef.current;
      if (m === 'ASSIGN') {
        if (pendingStudent) {
          const res = await gameCenter.nfcAssignTag(pendingStudent.studentId, scan.uid, adminName);
          showFlash({ tone: 'ok', title: `${res.fullName} → band …${scan.uid.slice(-6)}`, sub: 'Wristband assigned', avatarUrl: pendingStudent.avatarUrl, houseId: pendingStudent.houseId });
          pushLog(res.fullName, `assigned …${scan.uid.slice(-6)}`);
          setPendingStudent(null);
          await loadRoster();
        } else {
          const owner = await gameCenter.nfcResolveTag(scan.uid);
          if (owner) {
            showFlash({ tone: 'info', title: owner.fullName, sub: `Already owns this band (…${scan.uid.slice(-6)})`, avatarUrl: owner.avatarUrl, houseId: owner.houseId });
          } else {
            setPendingUid(scan.uid);
            showFlash({ tone: 'warn', title: `New band …${scan.uid.slice(-6)}`, sub: 'Pick a student below to assign it' });
          }
        }
      } else if (m === 'CHECKIN') {
        const res = await gameCenter.nfcCheckInByTag(scan.uid, adminName);
        if (res.status === 'UNKNOWN_TAG') {
          showFlash({ tone: 'warn', title: 'Unknown band', sub: 'Switch to Assign mode to register it' });
        } else if (res.status === 'ALREADY') {
          showFlash({ tone: 'info', title: res.fullName!, sub: 'Already checked in today', avatarUrl: res.avatarUrl, houseId: res.houseId });
          pushLog(res.fullName!, 'already in');
        } else {
          showFlash({ tone: 'ok', title: res.fullName!, sub: "Checked in — they're on the board! +10 pts", avatarUrl: res.avatarUrl, houseId: res.houseId });
          pushLog(res.fullName!, 'checked in +10');
        }
      } else if (m === 'POINTS') {
        const res = await gameCenter.nfcAwardByTag(scan.uid, pointPreset, pointReason || 'NFC scan award', adminName, sessionIdRef.current ?? undefined);
        if (res.status === 'UNKNOWN_TAG') {
          showFlash({ tone: 'warn', title: 'Unknown band', sub: 'Switch to Assign mode to register it' });
        } else {
          showFlash({ tone: 'ok', title: res.fullName!, sub: `+${pointPreset} pts${res.didRankUp ? ' — RANK UP!' : ''} (${res.finalPoints} total)${res.checkedIn ? ' · auto checked in +10' : ''}`, avatarUrl: res.avatarUrl, houseId: res.houseId });
          pushLog(res.fullName!, `+${pointPreset} pts`);
        }
      } else if (m === 'TIMING') {
        const res = await gameCenter.nfcGameScanByTag(scan.uid, adminName, sessionIdRef.current ?? undefined);
        if (res.status === 'UNKNOWN_TAG') {
          showFlash({ tone: 'warn', title: 'Unknown band', sub: 'Switch to Assign mode to register it' });
        } else {
          // Prefer the server's lap/split (session-scoped); fall back to the
          // local recent-scans gap for free scans on older data.
          let split: string;
          if (res.splitMs != null) {
            split = typeof res.lap === 'number' ? `Lap ${res.lap} — ${fmtSeconds(res.splitMs)}` : `${fmtSeconds(res.splitMs)} split`;
          } else if (sessionIdRef.current) {
            split = 'on the clock';
          } else {
            const prev = scanLog.find((l) => l.name === res.fullName);
            split = prev ? ((res.ts - prev.ts) / 1000).toFixed(1) + 's split' : 'first scan';
          }
          showFlash({ tone: 'ok', title: res.fullName!, sub: `Timing scan — ${split}`, avatarUrl: res.avatarUrl, houseId: res.houseId });
          pushLog(res.fullName!, split);
        }
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e).replace(/^[\s\S]*Uncaught Error:\s*/, '').split('\n')[0];
      showFlash({ tone: 'warn', title: 'Scan failed', sub: msg });
    } finally {
      setBusy(false);
    }
  };

  // USB keyboard-wedge reader: always listening while this screen is open.
  useNfcWedge(handleScan, true);
  // Phone/tablet NFC (Android Chrome): opt-in reader on this device.
  const webNfc = useWebNfc(handleScan);
  // PC/SC USB readers (ACR1252U etc.) via the local agent (npm run nfc-agent):
  // taps stream through Convex and land here like any other scan.
  const [agentReader, setAgentReader] = useState<string | null>(null);
  useEffect(() => {
    return gameCenter.subscribeNfcAgentScans((scan) => {
      setAgentReader(scan.readerId);
      handleScan({ uid: scan.uid, ts: scan.ts });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active reader presence from agent heartbeats; goes stale after 45s.
  const [readerStatus, setReaderStatus] = useState<{ readerId: string; ts: number; online: boolean } | null>(null);
  const [, forceTick] = useState(0);
  useEffect(() => gameCenter.subscribeNfcReaderStatus(setReaderStatus), []);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const readerOnline = !!readerStatus && readerStatus.online && Date.now() - readerStatus.ts < 45_000;
  const readerName = readerStatus?.readerId?.replace(/\s*\(.*\)$/, '').replace(/\s*(PICC|SAM)\s*$/i, '').trim();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q ? roster.filter((r) => r.fullName.toLowerCase().includes(q)) : roster;
    return [...rows].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [roster, search]);

  const assigned = roster.filter((r) => r.tagUid);

  const houseColor = (id?: string) => (id && HOUSES[id as HouseId]?.colorHex) || 'var(--pz-volt)';

  const selectedGame = sessionId ? activeGames.find((g) => g.id === sessionId) ?? null : null;

  // Splits board: group session GAME scans by student → laps / best / last,
  // fastest best split first, no-split-yet students at the bottom.
  const splitRows = useMemo<SplitRow[]>(() => {
    const byName = new Map<string, SplitRow>();
    for (const s of sessionScans) {
      if (s.kind !== 'GAME') continue;
      const name = s.studentName || 'Unknown band';
      let row = byName.get(name);
      if (!row) {
        row = { name, laps: 0, best: null, last: null, lastTs: 0 };
        byName.set(name, row);
      }
      row.laps += 1;
      if (s.splitMs != null && (row.best === null || s.splitMs < row.best)) row.best = s.splitMs;
      if (s.ts >= row.lastTs) {
        row.lastTs = s.ts;
        row.last = s.splitMs ?? null;
      }
    }
    return [...byName.values()].sort((a, b) => {
      if (a.best === null && b.best === null) return b.lastTs - a.lastTs;
      if (a.best === null) return 1;
      if (b.best === null) return -1;
      return a.best - b.best;
    });
  }, [sessionScans]);

  const overallBest = useMemo(
    () => splitRows.reduce<number | null>((m, r) => (r.best !== null && (m === null || r.best < m) ? r.best : m), null),
    [splitRows]
  );

  const assignFromList = async (row: RosterRow) => {
    if (!pendingUid) return;
    setBusy(true);
    try {
      await gameCenter.nfcAssignTag(row.studentId, pendingUid, adminName);
      showFlash({ tone: 'ok', title: `${row.fullName} → band …${pendingUid.slice(-6)}`, sub: 'Wristband assigned', avatarUrl: row.avatarUrl, houseId: row.houseId });
      pushLog(row.fullName, `assigned …${pendingUid.slice(-6)}`);
      setPendingUid(null);
      await loadRoster();
    } catch (e: any) {
      const msg = String(e?.message ?? e).replace(/^[\s\S]*Uncaught Error:\s*/, '').split('\n')[0];
      showFlash({ tone: 'warn', title: 'Could not assign', sub: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pz-scope">
      {/* Reader status + big scan flash */}
      <div className="pz-card p-4 sm:p-6 text-white relative overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="pz-eyebrow">NFC Reader</div>
            <div className="pz-display text-lg sm:text-xl mt-1 flex items-center gap-2">
              <Ic.Nfc size={22} className="text-[#CBFE1C]" /> Tap a band to test
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--pz-text)' }}>
              {readerOnline
                ? <>Ready to scan on <span className="text-[#CBFE1C] font-bold">{readerName}</span></>
                : <>No USB reader detected — start the desk agent: <span className="text-white font-bold">npm run nfc-agent</span> (keyboard-mode readers work without it)</>}
              {lastUid && <> · Last scan: <span className="text-white font-bold">…{lastUid.slice(-8)}</span></>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {webNfc.supported && (
              <button
                onClick={() => (webNfc.reading ? webNfc.stop() : webNfc.start())}
                className={`touch-btn min-h-[48px] px-4 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-2 ${webNfc.reading ? 'pz-btn' : 'pz-btn-ghost'}`}
              >
                <Ic.Phone size={16} /> {webNfc.reading ? 'Phone NFC On' : 'Use Phone NFC'}
              </button>
            )}
            {readerOnline ? (
              <span className="pz-live inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-[#CBFE1C]/10 border border-[#CBFE1C]/40 text-[#CBFE1C]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#CBFE1C]" /> Reader Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-white/5 border border-white/15 text-white/50">
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" /> No Reader
              </span>
            )}
          </div>
        </div>

        {flash && (
          <div
            className="mt-4 p-4 flex items-center gap-4 border"
            style={{
              background: flash.tone === 'ok' ? 'rgba(203,254,28,0.08)' : flash.tone === 'warn' ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.05)',
              borderColor: flash.tone === 'ok' ? 'rgba(203,254,28,0.45)' : flash.tone === 'warn' ? 'rgba(245,158,11,0.45)' : 'var(--pz-border)',
            }}
          >
            {flash.avatarUrl ? (
              <img src={flash.avatarUrl} className="w-14 h-14 rounded-full border-2 object-cover" style={{ borderColor: houseColor(flash.houseId) }} alt="" />
            ) : (
              <span className={flash.tone === 'warn' ? 'text-amber-400' : 'text-[#CBFE1C]'}>
                {flash.tone === 'warn' ? <Ic.Warning size={36} /> : <Ic.CheckCircle size={36} />}
              </span>
            )}
            <div className="min-w-0">
              <div className="pz-display text-lg sm:text-2xl text-white truncate">{flash.title}</div>
              {flash.sub && <div className="text-xs sm:text-sm" style={{ color: 'var(--pz-text)' }}>{flash.sub}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Mode switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setPendingStudent(null); setPendingUid(null); }}
            className={`touch-btn min-h-[64px] p-3 flex flex-col items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider transition-all border ${
              mode === m.id ? 'bg-[#CBFE1C] text-[#0B0E13] border-[#CBFE1C]' : 'bg-white/5 text-white/70 border-white/10'
            }`}
          >
            <m.icon size={22} />
            {m.label}
          </button>
        ))}
      </div>
      <div className="text-[11px] px-1 -mt-2" style={{ color: 'var(--pz-text)' }}>
        {MODES.find((m) => m.id === mode)?.blurb}
        {mode === 'POINTS' && ` — ${pointPreset} pts per tap`}
      </div>

      {/* Game-session attachment: TIMING & POINTS taps can record for a live game */}
      {(mode === 'TIMING' || mode === 'POINTS') && activeGames.length > 0 && (
        <div className="pz-card-sm p-4 space-y-2" style={{ background: 'var(--pz-panel-2)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>
              Recording for
            </div>
            <button
              onClick={loadActiveGames}
              className="touch-btn w-11 h-11 text-white/50 flex items-center justify-center"
              aria-label="Refresh active games"
            >
              <Ic.Refresh size={16} />
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {activeGames.map((g) => (
              <button
                key={g.id}
                onClick={() => { pickedFreeScan.current = false; setSessionId(g.id); }}
                className={`touch-btn min-h-[44px] px-4 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${
                  sessionId === g.id ? 'bg-[#CBFE1C] text-[#0B0E13]' : 'bg-white/5 text-white/60 border border-white/10'
                }`}
              >
                <Ic.Controller size={14} /> {g.title}
              </button>
            ))}
            <button
              onClick={() => { pickedFreeScan.current = true; setSessionId(null); }}
              className={`touch-btn min-h-[44px] px-4 text-[11px] font-black uppercase tracking-wider ${
                sessionId === null ? 'bg-[#CBFE1C] text-[#0B0E13]' : 'bg-white/5 text-white/60 border border-white/10'
              }`}
            >
              No game (free scan)
            </button>
          </div>
          {selectedGame && (
            <div className="text-[11px]" style={{ color: 'var(--pz-text)' }}>
              {mode === 'TIMING'
                ? <>Taps record splits for <span className="text-[#CBFE1C] font-bold">{selectedGame.title}</span></>
                : <>Awards land in the ledger under <span className="text-[#CBFE1C] font-bold">{selectedGame.title}</span></>}
            </div>
          )}
        </div>
      )}

      {/* POINTS mode config */}
      {mode === 'POINTS' && (
        <div className="pz-card-sm p-4 space-y-3" style={{ background: 'var(--pz-panel-2)' }}>
          <div className="flex gap-2 flex-wrap">
            {POINT_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setPointPreset(p)}
                className={`touch-btn min-h-[48px] px-5 text-sm font-black ${pointPreset === p ? 'bg-[#CBFE1C] text-[#0B0E13]' : 'bg-white/5 text-white/60 border border-white/10'}`}
              >
                +{p}
              </button>
            ))}
          </div>
          <input
            value={pointReason}
            onChange={(e) => setPointReason(e.target.value)}
            placeholder="Reason (shows in the ledger)"
            className="w-full min-h-[48px] px-4 text-sm font-medium border border-white/10 bg-[#171C27] text-white placeholder-white/40 focus:outline-none focus:border-[#CBFE1C]"
          />
        </div>
      )}

      {/* ASSIGN mode: student list (for scan-first and student-first flows) */}
      {mode === 'ASSIGN' && (
        <div className="space-y-3">
          {(pendingStudent || pendingUid) && (
            <div className="pz-card-sm p-3 flex items-center justify-between gap-3 border-[#CBFE1C]/50" style={{ background: 'rgba(203,254,28,0.06)' }}>
              <div className="text-xs text-white font-bold">
                {pendingStudent
                  ? <>Tap a band now to assign it to <span className="text-[#CBFE1C]">{pendingStudent.fullName}</span></>
                  : <>Band <span className="text-[#CBFE1C]">…{pendingUid!.slice(-6)}</span> scanned — pick its student below</>}
              </div>
              <button onClick={() => { setPendingStudent(null); setPendingUid(null); }} className="touch-btn w-10 h-10 text-white/50"><Ic.XMark size={16} /></button>
            </div>
          )}

          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students..."
              className="w-full min-h-[48px] px-4 pl-10 text-sm font-medium border border-white/10 bg-[#171C27] text-white placeholder-white/40 focus:outline-none focus:border-[#CBFE1C]"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"><Ic.Search size={16} /></span>
          </div>

          <div className="max-h-[45vh] overflow-y-auto border border-white/10 custom-scrollbar divide-y divide-white/5" style={{ background: 'var(--pz-panel)' }}>
            {filtered.map((row) => (
              <div key={row.studentId} className="flex items-center gap-3 p-3">
                <img src={row.avatarUrl} className="w-10 h-10 rounded-full border-2 object-cover flex-shrink-0" style={{ borderColor: houseColor(row.houseId) }} alt="" />
                <div className="flex-grow min-w-0">
                  <div className="font-bold text-sm text-white truncate">{row.fullName}</div>
                  <div className="text-[10px]" style={{ color: 'var(--pz-text)' }}>
                    {row.tagUid ? `Band …${row.tagUid.slice(-6)}` : 'No band yet'}
                  </div>
                </div>
                {pendingUid ? (
                  <button onClick={() => assignFromList(row)} disabled={busy} className="touch-btn pz-btn min-h-[44px] px-4 text-[10px]">
                    Assign
                  </button>
                ) : row.tagUid ? (
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Remove ${row.fullName}'s band?`)) return;
                      await gameCenter.nfcUnassignTag(row.studentId, adminName);
                      await loadRoster();
                    }}
                    className="touch-btn min-h-[44px] px-4 text-[10px] font-black uppercase text-red-400 border border-red-400/30 bg-red-400/10"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={() => { setPendingStudent(row); setPendingUid(null); }}
                    className="touch-btn pz-btn-ghost min-h-[44px] px-4 text-[10px] inline-flex items-center gap-1.5"
                  >
                    <Ic.Tag size={14} /> Assign Band
                  </button>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm italic" style={{ color: 'var(--pz-text)' }}>No students found</div>
            )}
          </div>

          <div className="text-[11px] px-1" style={{ color: 'var(--pz-text)' }}>
            {assigned.length} of {roster.length} students have bands
          </div>
        </div>
      )}

      {/* Live splits board (Timing mode recording for a game session) */}
      {mode === 'TIMING' && sessionId ? (
        <div className="pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5" style={{ color: 'var(--pz-text)' }}>
              <Ic.Timer size={14} /> Live splits — {selectedGame?.title ?? 'Game'}
            </div>
            <span className="pz-live inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-[#CBFE1C]/10 border border-[#CBFE1C]/40 text-[#CBFE1C]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#CBFE1C]" /> Live
            </span>
          </div>
          {splitRows.length === 0 ? (
            <div className="text-xs italic py-4 text-center" style={{ color: 'var(--pz-text)' }}>Waiting for the first tap…</div>
          ) : (
            <div>
              <div className="grid grid-cols-[minmax(0,1fr)_3rem_4.5rem_4.5rem] gap-2 pb-1.5 border-b border-white/10 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>
                <span>Student</span>
                <span className="text-right">Laps</span>
                <span className="text-right">Best</span>
                <span className="text-right">Last</span>
              </div>
              <div className="divide-y divide-white/5">
                {splitRows.map((r) => (
                  <div key={r.name} className="grid grid-cols-[minmax(0,1fr)_3rem_4.5rem_4.5rem] gap-2 items-center py-2">
                    <span className="text-sm font-bold text-white truncate">{r.name}</span>
                    <span className="pz-display text-sm text-white text-right">{r.laps}</span>
                    <span
                      className="pz-display text-sm text-right"
                      style={{ color: r.best !== null && r.best === overallBest ? '#CBFE1C' : r.best !== null ? '#FFFFFF' : 'var(--pz-text)' }}
                    >
                      {r.best !== null ? fmtSeconds(r.best) : '—'}
                    </span>
                    {r.last !== null ? (
                      <span className="pz-display text-sm text-white text-right">{fmtSeconds(r.last)}</span>
                    ) : (
                      <span className="text-[9px] italic text-right" style={{ color: 'var(--pz-text)' }}>on the clock</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : mode !== 'ASSIGN' ? (
        /* Recent scans for the other action modes (and free-scan timing) */
        <div className="pz-card-sm p-4" style={{ background: 'var(--pz-panel-2)' }}>
          <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--pz-text)' }}>Recent scans</div>
          {scanLog.length === 0 ? (
            <div className="text-xs italic py-4 text-center" style={{ color: 'var(--pz-text)' }}>Waiting for taps…</div>
          ) : (
            <div className="space-y-1.5">
              {scanLog.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-white font-bold">{l.name}</span>
                  <span style={{ color: 'var(--pz-text)' }}>{l.detail} · {new Date(l.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default NfcManager;
