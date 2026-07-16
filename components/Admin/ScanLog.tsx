// Check-In & Scan Log: unified, exportable feed of every check-in (QR / NFC /
// manual), check-out, and NFC game/award tap for a picked date range. Reads
// from gameCenter.scanLog (convex/scanlog.ts) — server returns newest first.
import React, { useEffect, useMemo, useState } from 'react';
import { HOUSES } from '../../constants';
import { HouseId } from '../../types';
import { gameCenter } from '../../services/gameCenter';
import { Ic } from '../icons';

interface LogRow {
  ts: number;
  type: string; // CHECKIN_QR | CHECKIN_NFC | CHECKIN_MANUAL | CHECKOUT | NFC_GAME | NFC_AWARD
  studentName: string;
  houseId?: string | null;
  detail: string;
  actor: string;
}

const TYPE_META: Record<string, { icon: React.FC<{ size?: number | string }>; label: string; color: string }> = {
  CHECKIN_QR: { icon: Ic.QrCode, label: 'QR check-in', color: '#CBFE1C' },
  CHECKIN_NFC: { icon: Ic.Nfc, label: 'NFC check-in', color: '#CBFE1C' },
  CHECKIN_MANUAL: { icon: Ic.Edit, label: 'Manual check-in', color: '#CBFE1C' },
  CHECKOUT: { icon: Ic.Logout, label: 'Check-out', color: 'rgba(255,255,255,0.45)' },
  NFC_GAME: { icon: Ic.Timer, label: 'Game tap', color: '#38BDF8' },
  NFC_AWARD: { icon: Ic.Bolt, label: 'Award tap', color: '#FBBF24' },
};

// Local-date helpers (yyyy-mm-dd, device timezone)
const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysAgoStr = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
};

const startOfDayMs = (dateStr: string): number => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
};

const endOfDayMs = (dateStr: string): number => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
};

const fmtTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });

const fmtDayLabel = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

// CSV field: quote when it contains commas, quotes, or newlines
const csvField = (s: string): string => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

const ScanLog: React.FC = () => {
  const [fromDate, setFromDate] = useState<string>(() => toDateStr(new Date()));
  const [toDate, setToDate] = useState<string>(() => toDateStr(new Date()));
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await gameCenter.scanLog(startOfDayMs(from), endOfDayMs(to));
      setRows(data as LogRow[]);
    } catch (e: any) {
      setError(String(e?.message ?? e).split('\n')[0]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-reload whenever the range changes (covers the picker and the chips)
  useEffect(() => {
    load(fromDate, toDate);
  }, [fromDate, toDate]);

  const todayStr = toDateStr(new Date());
  const yesterdayStr = daysAgoStr(1);
  const week7Str = daysAgoStr(6);
  const isToday = fromDate === todayStr && toDate === todayStr;
  const isYesterday = fromDate === yesterdayStr && toDate === yesterdayStr;
  const isLast7 = fromDate === week7Str && toDate === todayStr;

  const setSingleDay = (dateStr: string) => {
    setFromDate(dateStr);
    setToDate(dateStr);
  };

  const stats = useMemo(() => {
    let qr = 0, nfc = 0, manual = 0, game = 0, award = 0;
    for (const r of rows) {
      if (r.type === 'CHECKIN_QR') qr++;
      else if (r.type === 'CHECKIN_NFC') nfc++;
      else if (r.type === 'CHECKIN_MANUAL') manual++;
      else if (r.type === 'NFC_GAME') game++;
      else if (r.type === 'NFC_AWARD') award++;
    }
    return { checkins: qr + nfc + manual, qr, nfc, manual, game, award };
  }, [rows]);

  const exportCsv = () => {
    if (rows.length === 0) return;
    const header = 'Time,Type,Student,House,Detail,By';
    const lines = rows.map((r) => {
      const house = r.houseId ? HOUSES[r.houseId as HouseId]?.name ?? r.houseId : '';
      return [new Date(r.ts).toLocaleString(), r.type, r.studentName, house, r.detail, r.actor]
        .map(csvField)
        .join(',');
    });
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fnf-scan-log-${fromDate}-${toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const rangeLabel =
    fromDate === toDate ? fmtDayLabel(fromDate) : `${fmtDayLabel(fromDate)} – ${fmtDayLabel(toDate)}`;

  const tiles: Array<{ label: string; value: number; color?: string }> = [
    { label: 'Check-ins', value: stats.checkins, color: '#CBFE1C' },
    { label: 'QR', value: stats.qr },
    { label: 'NFC', value: stats.nfc },
    { label: 'Manual', value: stats.manual },
    { label: 'Game taps', value: stats.game, color: '#38BDF8' },
    { label: 'Award taps', value: stats.award, color: '#FBBF24' },
  ];

  return (
    <div className="pz-scope space-y-4">
      {/* Range picker + actions */}
      <div className="pz-card p-4 sm:p-5 text-white">
        <div className="pz-eyebrow mb-2">Range</div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={toDate}
            max={todayStr}
            onChange={(e) => e.target.value && setSingleDay(e.target.value)}
            className="min-h-[48px] px-3 text-sm font-bold border border-white/10 bg-[#171C27] text-white focus:outline-none focus:border-[#CBFE1C]"
            style={{ colorScheme: 'dark' }}
            aria-label="Pick a day"
          />
          {[
            { label: 'Today', active: isToday, onClick: () => setSingleDay(todayStr) },
            { label: 'Yesterday', active: isYesterday, onClick: () => setSingleDay(yesterdayStr) },
            { label: 'Last 7 days', active: isLast7, onClick: () => { setFromDate(week7Str); setToDate(todayStr); } },
          ].map((chip) => (
            <button
              key={chip.label}
              onClick={chip.onClick}
              className={`touch-btn min-h-[48px] px-4 text-[11px] font-black uppercase tracking-wider ${
                chip.active ? 'bg-[#CBFE1C] text-[#0B0E13]' : 'bg-white/5 text-white/60 border border-white/10'
              }`}
            >
              {chip.label}
            </button>
          ))}
          <div className="flex-grow" />
          <button
            onClick={() => load(fromDate, toDate)}
            disabled={loading}
            className="touch-btn pz-btn-ghost min-h-[48px] px-4 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Ic.Refresh size={16} /> Refresh
          </button>
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="touch-btn pz-btn min-h-[48px] px-4 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-2 disabled:opacity-40"
          >
            <Ic.Printer size={16} /> Export CSV
          </button>
        </div>
        <div className="text-[11px] mt-2" style={{ color: 'var(--pz-text)' }}>
          Showing <span className="text-white font-bold">{rangeLabel}</span>
          {rows.length > 0 && <> · {rows.length} entr{rows.length === 1 ? 'y' : 'ies'}</>}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="pz-card-sm p-3 text-center" style={{ background: 'var(--pz-panel-2)' }}>
            <div className="pz-display text-xl sm:text-2xl" style={{ color: t.color ?? '#FFFFFF' }}>
              {t.value}
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest mt-0.5" style={{ color: 'var(--pz-text)' }}>
              {t.label}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="pz-card-sm p-3 flex items-center gap-2 border-red-400/40" style={{ background: 'rgba(239,68,68,0.08)' }}>
          <span className="text-red-400 flex-shrink-0"><Ic.Warning size={18} /></span>
          <span className="text-xs font-bold text-red-300">{error}</span>
        </div>
      )}

      {/* Log list */}
      <div className="border border-white/10 divide-y divide-white/5" style={{ background: 'var(--pz-panel)' }}>
        {loading ? (
          <div className="p-10 text-center text-sm italic" style={{ color: 'var(--pz-text)' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center" style={{ color: 'var(--pz-text)' }}>
            <Ic.History size={40} className="mx-auto mb-2 opacity-40" />
            <div className="text-sm italic">No scans in this range yet.</div>
          </div>
        ) : (
          rows.map((r, i) => {
            const meta = TYPE_META[r.type] ?? { icon: Ic.History, label: r.type, color: 'rgba(255,255,255,0.45)' };
            const house = r.houseId ? HOUSES[r.houseId as HouseId] : undefined;
            return (
              <div key={`${r.ts}-${i}`} className="flex items-start gap-3 p-3">
                <span className="flex-shrink-0 mt-0.5" style={{ color: meta.color }} title={meta.label}>
                  <meta.icon size={18} />
                </span>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-white truncate">{r.studentName}</span>
                    {house && (
                      <span
                        className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 border flex-shrink-0"
                        style={{ color: house.colorHex, borderColor: `${house.colorHex}66`, background: `${house.colorHex}1A` }}
                      >
                        {house.name}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--pz-text)' }}>
                    {fmtTime(r.ts)}
                    {fromDate !== toDate && <> · {new Date(r.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>}
                    {' · '}{r.detail}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right text-[10px] max-w-[28%] truncate self-center" style={{ color: 'var(--pz-text)' }}>
                  {r.actor}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ScanLog;
