import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { gameCenter } from '../../services/gameCenter';
import { supabaseService } from '../../services/supabaseService';
import { BoardEntry, Student } from '../../types';
import { HOUSES } from '../../constants';

const QR_ROTATE_MS = 60_000;

const portalLink = (param: string, value: string) =>
  `${window.location.origin}${window.location.pathname}#/parent-dashboard?${param}=${value}`;

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const METHOD_STYLES: Record<string, string> = {
  QR: 'bg-blue-100 text-blue-600',
  NFC: 'bg-purple-100 text-purple-600',
  MANUAL: 'bg-amber-100 text-amber-600',
};

const HouseChip: React.FC<{ student: Student }> = ({ student }) => {
  const house = HOUSES[student.houseId];
  if (!house) return null;
  return (
    <span
      className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
      style={{ backgroundColor: house.colorHex + '20', color: house.colorHex }}
    >
      {house.name}
    </span>
  );
};

interface CheckInBoardProps {
  adminName: string;
}

const CheckInBoard: React.FC<CheckInBoardProps> = ({ adminName }) => {
  const coach = adminName || 'Coach';

  // ── Live board ──────────────────────────────────────────────────────────
  const [board, setBoard] = useState<BoardEntry[]>([]);
  useEffect(() => {
    const unsub = gameCenter.subscribeBoard(setBoard);
    return unsub;
  }, []);

  // ── Rotating QR ─────────────────────────────────────────────────────────
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number>(Date.now() + QR_ROTATE_MS);
  const [now, setNow] = useState<number>(Date.now());

  const refreshQr = async () => {
    try {
      setQrError(null);
      const { token } = await gameCenter.issueCheckinToken();
      const url = await QRCode.toDataURL(portalLink('checkin', token), {
        width: 640,
        margin: 2,
        color: { dark: '#0f172a', light: '#FFFFFF' },
      });
      setQrUrl(url);
      setNextRefreshAt(Date.now() + QR_ROTATE_MS);
    } catch (err: any) {
      console.error('QR token refresh failed:', err);
      setQrError(err?.message || 'Could not load check-in code');
    }
  };

  useEffect(() => {
    refreshQr();
    const rotate = window.setInterval(refreshQr, QR_ROTATE_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(rotate);
      clearInterval(tick);
    };
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((nextRefreshAt - now) / 1000));
  const ringPct = Math.min(100, (secondsLeft / (QR_ROTATE_MS / 1000)) * 100);

  // ── Students (manual check-in picker) ───────────────────────────────────
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    supabaseService
      .getStudents()
      .then(setStudents)
      .catch((err: any) => console.error('Failed to load students:', err));
  }, []);

  const here = useMemo(
    () =>
      board
        .filter((b) => !b.checkIn.checkedOutAt)
        .sort((a, b) => b.checkIn.checkedInAt - a.checkIn.checkedInAt),
    [board]
  );
  const checkedOut = useMemo(
    () =>
      board
        .filter((b) => !!b.checkIn.checkedOutAt)
        .sort((a, b) => (b.checkIn.checkedOutAt || 0) - (a.checkIn.checkedOutAt || 0)),
    [board]
  );
  const hereIds = useMemo(() => new Set(here.map((b) => b.student.id)), [here]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return students.filter((s) => s.fullName.toLowerCase().includes(q)).slice(0, 8);
  }, [students, search]);

  const handleCheckIn = async (studentId: string) => {
    if (busyId) return;
    setBusyId(studentId);
    try {
      await gameCenter.manualCheckIn(studentId, coach);
      setSearch('');
    } catch (err: any) {
      alert(err?.message || 'Check-in failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleCheckOut = async (studentId: string) => {
    if (busyId) return;
    setBusyId(studentId);
    try {
      await gameCenter.checkOut(studentId, coach);
    } catch (err: any) {
      alert(err?.message || 'Check-out failed');
    } finally {
      setBusyId(null);
    }
  };

  // ── NFC kiosk setup ─────────────────────────────────────────────────────
  const [nfcOpen, setNfcOpen] = useState(false);
  const [nfc, setNfc] = useState<{ token: string; createdAt: number } | null>(null);
  const [nfcBusy, setNfcBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!nfcOpen || nfc) return;
    gameCenter
      .getNfcSecret()
      .then(setNfc)
      .catch((err: any) => console.error('Failed to load NFC secret:', err));
  }, [nfcOpen, nfc]);

  const rotateNfc = async () => {
    if (nfcBusy) return;
    if (!window.confirm('Rotate the NFC secret? Existing NFC tags will stop working until re-written.')) return;
    setNfcBusy(true);
    try {
      const { token } = await gameCenter.rotateNfcSecret();
      setNfc({ token, createdAt: Date.now() });
    } catch (err: any) {
      alert(err?.message || 'Failed to rotate NFC secret');
    } finally {
      setNfcBusy(false);
    }
  };

  const nfcUrl = nfc ? portalLink('checkin', nfc.token) : '';

  const copyNfcUrl = async () => {
    try {
      await navigator.clipboard.writeText(nfcUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the URL is selectable in the input
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 text-center border border-slate-100 shadow-sm">
          <div className="text-2xl font-black text-slate-900">{board.length}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Checked In Today</div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100 shadow-sm">
          <div className="text-2xl font-black text-emerald-600">{here.length}</div>
          <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Currently Here</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100 shadow-sm">
          <div className="text-2xl font-black text-blue-600">+{board.length * 10}</div>
          <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">Check-In Points</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Rotating QR panel — front-desk display */}
        <section className="bg-slate-900 rounded-2xl p-6 sm:p-8 text-center shadow-lg">
          <h2 className="text-xl sm:text-2xl font-display font-black text-white uppercase tracking-tight">
            📱 Scan to Check In
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm font-bold mt-1 mb-5">
            Point your phone camera here to open the parent portal
          </p>

          {qrUrl ? (
            <div className="bg-white rounded-2xl p-4 sm:p-5 inline-block shadow-2xl">
              <img
                src={qrUrl}
                alt="Check-in QR code"
                className="w-56 h-56 sm:w-72 sm:h-72 lg:w-80 lg:h-80 max-w-full"
              />
            </div>
          ) : (
            <div className="w-56 h-56 sm:w-72 sm:h-72 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center">
              <span className="text-slate-500 font-bold text-sm">
                {qrError ? '⚠️ ' + qrError : 'Loading code…'}
              </span>
            </div>
          )}

          {/* Countdown ring */}
          <div className="flex items-center justify-center gap-3 mt-5">
            <div className="relative w-12 h-12">
              <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#334155" strokeWidth="3.5" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray={`${ringPct} 100`}
                  style={{ transition: 'stroke-dasharray 1s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-black">
                {secondsLeft}
              </span>
            </div>
            <div className="text-left">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Code refreshes in</div>
              <div className="text-sm font-black text-emerald-400">{secondsLeft}s</div>
            </div>
            <button
              onClick={refreshQr}
              className="touch-btn focus-ring ml-2 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-wider active:bg-slate-700"
            >
              🔄 New Code
            </button>
          </div>
        </section>

        {/* Today's board */}
        <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-100">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-3">
            🎮 Today's Game Center
          </h2>

          {board.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-2">🕹️</div>
              <div className="text-sm font-medium">Nobody on the board yet</div>
              <div className="text-xs">Kids appear here the moment they check in</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
              {here.map(({ checkIn, student }) => (
                <div
                  key={checkIn.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100"
                >
                  <img
                    src={student.avatarUrl}
                    alt=""
                    className="w-10 h-10 rounded-full border-2 border-emerald-400 object-cover flex-shrink-0"
                  />
                  <div className="flex-grow min-w-0">
                    <div className="font-black text-sm text-slate-900 truncate">{student.fullName}</div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <HouseChip student={student} />
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${METHOD_STYLES[checkIn.method] || 'bg-slate-100 text-slate-500'}`}>
                        {checkIn.method}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400">in {fmtTime(checkIn.checkedInAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCheckOut(student.id)}
                    disabled={busyId === student.id}
                    className="touch-btn focus-ring px-3 py-2 rounded-xl bg-slate-700 text-white text-[10px] font-black uppercase tracking-wide active:bg-slate-800 disabled:opacity-50 flex-shrink-0"
                  >
                    Check Out
                  </button>
                </div>
              ))}

              {checkedOut.map(({ checkIn, student }) => (
                <div
                  key={checkIn.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 opacity-60"
                >
                  <img
                    src={student.avatarUrl}
                    alt=""
                    className="w-10 h-10 rounded-full border-2 border-slate-200 object-cover flex-shrink-0"
                  />
                  <div className="flex-grow min-w-0">
                    <div className="font-black text-sm text-slate-500 truncate">{student.fullName}</div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <HouseChip student={student} />
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${METHOD_STYLES[checkIn.method] || 'bg-slate-100 text-slate-500'}`}>
                        {checkIn.method}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400">
                        out {checkIn.checkedOutAt ? fmtTime(checkIn.checkedOutAt) : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCheckIn(student.id)}
                    disabled={busyId === student.id}
                    className="touch-btn focus-ring px-3 py-2 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wide active:bg-emerald-600 disabled:opacity-50 flex-shrink-0"
                  >
                    Check Back In
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Manual check-in */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-100">
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1">✍️ Manual Check-In</h2>
        <p className="text-xs text-slate-500 mb-3">Search an athlete to check them in without a scan</p>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search athletes..."
            className="w-full px-4 py-3 pl-10 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:border-brand-blue bg-white"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </div>

        {search.trim() && (
          <div className="mt-3 border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 overflow-hidden">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">No athletes match your search</div>
            ) : (
              filteredStudents.map((s) => {
                const isHere = hereIds.has(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3">
                    <img
                      src={s.avatarUrl}
                      alt=""
                      className="w-9 h-9 rounded-full border-2 border-slate-200 object-cover flex-shrink-0"
                    />
                    <div className="flex-grow min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate">{s.fullName}</div>
                      <HouseChip student={s} />
                    </div>
                    {isHere ? (
                      <span className="text-[10px] font-black uppercase text-emerald-600 px-3 py-2 flex-shrink-0">
                        ✓ Here
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCheckIn(s.id)}
                        disabled={busyId === s.id}
                        className="touch-btn focus-ring px-4 py-2 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wide active:bg-emerald-600 disabled:opacity-50 flex-shrink-0"
                      >
                        {busyId === s.id ? '...' : 'Check In'}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* NFC kiosk setup */}
      <section className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        <button
          onClick={() => setNfcOpen((o) => !o)}
          className="touch-btn focus-ring w-full flex items-center justify-between p-4 sm:p-5"
        >
          <span className="text-lg font-black text-slate-900 uppercase tracking-tight">📳 NFC Kiosk Setup</span>
          <span className="text-slate-400 text-lg">{nfcOpen ? '▾' : '▸'}</span>
        </button>

        {nfcOpen && (
          <div className="px-4 sm:px-5 pb-5 space-y-4">
            <p className="text-xs text-slate-500">
              Write the URL below to a physical NFC tag and stick it at the front desk. Parents tap it
              with their phone to open the check-in flow. NFC tap works on Android Chrome; iPhones
              should use the QR code.
            </p>

            {nfc ? (
              <>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    Current NFC Tag URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={nfcUrl}
                      onFocus={(e) => e.target.select()}
                      className="flex-grow px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-700 outline-none min-w-0"
                    />
                    <button
                      onClick={copyNfcUrl}
                      className="touch-btn focus-ring px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wide active:bg-slate-200 flex-shrink-0"
                    >
                      {copied ? '✓ Copied' : '📋 Copy'}
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Secret created {new Date(nfc.createdAt).toLocaleDateString()}{' '}
                    {new Date(nfc.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>

                <button
                  onClick={rotateNfc}
                  disabled={nfcBusy}
                  className="touch-btn focus-ring w-full py-3 rounded-xl bg-red-50 text-red-500 font-black text-xs uppercase tracking-widest border border-red-100 active:bg-red-100 disabled:opacity-50"
                >
                  {nfcBusy ? 'Rotating…' : '🔁 Rotate Secret'}
                </button>
              </>
            ) : (
              <div className="text-center py-6 text-slate-400 text-sm">Loading NFC secret…</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default CheckInBoard;
