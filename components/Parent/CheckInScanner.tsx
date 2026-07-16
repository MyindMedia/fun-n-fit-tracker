// Check In tab — parent scans the front-desk QR (or taps the NFC kiosk tag),
// picks which kids are here, and confirms. Shows per-kid results and the
// family's recent check-in history.
import React, { useState, useEffect, useRef } from 'react';
import { Student, CheckIn } from '../../types';
import { HOUSES } from '../../constants';
import { gameCenter, CheckInResult } from '../../services/gameCenter';
import QRScanSheet from './QRScanSheet';
import KidPassSheet from './KidPassSheet';
import { extractScanParam, cleanErr, fmtTime, pStyles, KidSelect, PZ } from './shared';
import { Ic } from '../icons';

/* Check-in method glyph (history rows) */
const MethodIcon: React.FC<{ method?: string }> = ({ method }) => {
    const Icon = method === 'NFC' ? Ic.Nfc : method === 'MANUAL' ? Ic.ClipboardCheck : Ic.QrCode;
    return <Icon size={18} style={{ color: PZ.muted, flexShrink: 0 }} aria-hidden="true" />;
};

interface CheckInScannerProps {
    students: Student[];
    /** Token arriving via deep link (#/parent-dashboard?checkin=<token>) */
    initialToken?: string | null;
    onTokenConsumed?: () => void;
    /** Called after successful check-ins so the dashboard can refresh points */
    onRefresh?: () => void;
}

type HistoryRow = { checkIn: CheckIn; studentName: string; studentId: string };

const CheckInScanner: React.FC<CheckInScannerProps> = ({
    students,
    initialToken,
    onTokenConsumed,
    onRefresh,
}) => {
    const [token, setToken] = useState<string | null>(null);
    const [method, setMethod] = useState<'QR' | 'NFC'>('QR');
    const [scannerOpen, setScannerOpen] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [results, setResults] = useState<CheckInResult[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [nfcListening, setNfcListening] = useState(false);
    const [history, setHistory] = useState<HistoryRow[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [passStudent, setPassStudent] = useState<Student | null>(null);
    const nfcAbortRef = useRef<AbortController | null>(null);

    const nfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window;

    const adoptToken = (raw: string, via: 'QR' | 'NFC') => {
        const t = extractScanParam(raw, 'checkin');
        if (!t) return;
        setToken(t);
        setMethod(via);
        setSelected(students.map(s => s.id)); // preselect everyone — 1 tap for most families
        setResults(null);
        setError(null);
    };

    const loadHistory = async () => {
        try {
            const rows = await gameCenter.checkinHistoryForParent();
            setHistory(rows);
        } catch {
            // History is non-critical — leave the list empty
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
        return () => {
            nfcAbortRef.current?.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Deep-link token (native camera scanned the front-desk QR)
    useEffect(() => {
        if (initialToken) {
            adoptToken(initialToken, 'QR');
            onTokenConsumed?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialToken]);

    const startNfc = async () => {
        setError(null);
        try {
            const ctrl = new AbortController();
            nfcAbortRef.current = ctrl;
            const ndef = new (window as any).NDEFReader();
            await ndef.scan({ signal: ctrl.signal });
            setNfcListening(true);
            ndef.addEventListener('reading', (event: any) => {
                try {
                    for (const record of event.message.records) {
                        let text = '';
                        if (record.recordType === 'text') {
                            text = new TextDecoder(record.encoding || 'utf-8').decode(record.data);
                        } else if (record.recordType === 'url') {
                            text = new TextDecoder().decode(record.data);
                        }
                        if (text) {
                            adoptToken(text, 'NFC');
                            ctrl.abort();
                            setNfcListening(false);
                            break;
                        }
                    }
                } catch {
                    setError('Could not read that tag — try again or use the QR scanner');
                }
            });
        } catch {
            setNfcListening(false);
            setError('NFC scan failed — use the QR scanner instead');
        }
    };

    const stopNfc = () => {
        nfcAbortRef.current?.abort();
        setNfcListening(false);
    };

    const confirmCheckIn = async () => {
        if (!token || selected.length === 0) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await gameCenter.checkInWithToken(token, selected, method);
            setResults(res);
            setToken(null);
            loadHistory();
            onRefresh?.();
        } catch (e: any) {
            setError(cleanErr(e));
        } finally {
            setSubmitting(false);
        }
    };

    const reset = () => {
        setToken(null);
        setResults(null);
        setError(null);
        setSelected([]);
    };

    const tokenExpired = !!error && error.toLowerCase().includes('expired');

    /* ── Step 3: per-kid results — volt celebration ──────────────────────────── */
    if (results) {
        const okCount = results.filter(r => r.status === 'OK').length;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                    ...pStyles.card, textAlign: 'center',
                    background: `linear-gradient(180deg, rgba(203,254,28,0.12), ${PZ.panel})`,
                    border: `1px solid ${PZ.voltDim}`,
                }}>
                    <div style={{ marginBottom: '0.5rem', color: PZ.volt }}>
                        {okCount > 0 ? <Ic.Confetti size={44} /> : <Ic.CheckCircle size={44} />}
                    </div>
                    <h2 className="pz-display" style={{ margin: '0 0 0.35rem', color: PZ.white, fontSize: '1.375rem' }}>
                        {okCount > 0 ? "They're on the board!" : 'All set!'}
                    </h2>
                    <p style={{ margin: 0, color: PZ.volt, fontWeight: 700, fontSize: '0.9375rem' }}>
                        {okCount > 0 ? 'Checked in and ready to play' : 'Everyone was already checked in today'}
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {results.map(r => (
                        <div key={r.studentId} style={{
                            ...pStyles.innerPanel,
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            border: r.status === 'OK' ? `1px solid ${PZ.voltDim}` : `1px solid ${PZ.border}`,
                            background: r.status === 'OK' ? 'rgba(203,254,28,0.06)' : PZ.panel2,
                        }}>
                            <div style={{ color: r.status === 'OK' ? PZ.volt : PZ.muted, display: 'flex', flexShrink: 0 }}>
                                {r.status === 'OK' ? <Ic.Controller size={26} /> : <Ic.CheckCircle size={26} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="pz-display" style={{ color: PZ.white, fontSize: '0.9375rem' }}>{r.fullName}</div>
                                <div style={{
                                    fontSize: '0.8125rem', fontWeight: 700,
                                    color: r.status === 'OK' ? PZ.volt : PZ.muted,
                                }}>
                                    {r.status === 'OK' ? "They're on the board! +10 pts" : 'Already checked in today — good to go!'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <button onClick={reset} className="pz-btn" style={{ ...pStyles.btnPrimary, width: '100%' }}>Done</button>
            </div>
        );
    }

    /* ── Step 2: pick kids + confirm ─────────────────────────────────────────── */
    if (token) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={pStyles.card}>
                    <div className="pz-eyebrow" style={pStyles.eyebrow}>Check In</div>
                    <h2 className="pz-display" style={{ ...pStyles.sectionTitle, marginBottom: '0.35rem' }}>Who's here today?</h2>
                    <p style={{ ...pStyles.mutedText, marginBottom: '1rem' }}>
                        Tap to select the kids you're checking in.
                    </p>

                    {students.length === 0 ? (
                        <p style={pStyles.mutedText}>No linked kids yet — enroll a student from the My Kids tab first.</p>
                    ) : (
                        <KidSelect students={students} selected={selected} onChange={setSelected} />
                    )}

                    {error && (
                        <div style={{ ...pStyles.errorBox, marginTop: '1rem' }}>
                            {error}
                            {tokenExpired && (
                                <button
                                    onClick={() => { reset(); setScannerOpen(true); }}
                                    className="pz-btn"
                                    style={{ ...pStyles.btnPrimary, display: 'block', width: '100%', marginTop: '0.75rem' }}
                                >
                                    Rescan the QR
                                </button>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                        <button onClick={reset} className="pz-btn-ghost" style={{ ...pStyles.btnSecondary, flex: 1 }} disabled={submitting}>
                            Cancel
                        </button>
                        <button
                            onClick={confirmCheckIn}
                            disabled={submitting || selected.length === 0}
                            className="pz-btn"
                            style={{
                                ...pStyles.btnPrimary, flex: 2,
                                opacity: submitting || selected.length === 0 ? 0.6 : 1,
                            }}
                        >
                            {submitting ? 'Checking in…' : `Check In (${selected.length})`}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ── Step 1: passes + scan ───────────────────────────────────────────────── */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Show-a-pass strip — staff scan the kid's QR at the front desk */}
            {students.length > 0 && (
                <div style={pStyles.card}>
                    <div className="pz-eyebrow" style={{ margin: '0 0 0.5rem' }}>Show a Pass</div>
                    <p style={{ ...pStyles.mutedText, marginBottom: '0.875rem' }}>
                        Tap a kid to show their pass — staff scan it at the front desk.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {students.map(s => {
                            const house = HOUSES[s.houseId];
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    className="pzp-clip"
                                    onClick={() => setPassStudent(s)}
                                    aria-label={`Show ${s.fullName}'s check-in pass`}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
                                        textAlign: 'left', padding: '0.75rem 1rem', cursor: 'pointer',
                                        minHeight: '64px',
                                        background: '#10141C', border: `2px solid ${PZ.border}`,
                                        clipPath: PZ.notchSm, fontFamily: 'inherit',
                                        transition: 'border-color 0.15s',
                                    }}
                                >
                                    <img
                                        src={s.avatarUrl}
                                        alt=""
                                        onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.id}`; }}
                                        style={{
                                            width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover',
                                            border: `3px solid ${house.colorHex}`, flexShrink: 0,
                                        }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="pz-display" style={{
                                            color: PZ.white, fontSize: '0.9375rem',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>
                                            {s.gamerTag || s.fullName}
                                        </div>
                                        <div style={{ color: house.colorHex, fontSize: '0.75rem', fontWeight: 700 }}>
                                            {house.name}
                                        </div>
                                    </div>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0,
                                        background: PZ.voltFaint, border: `1px solid ${PZ.voltDim}`, color: PZ.volt,
                                        borderRadius: '3px', padding: '0.5rem 0.75rem',
                                        fontSize: '0.75rem', fontWeight: 700,
                                        textTransform: 'uppercase', letterSpacing: '0.06em',
                                    }}>
                                        <Ic.QrCode size={20} /> Pass
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div style={{ ...pStyles.card, textAlign: 'center' }}>
                <div className="pz-eyebrow" style={{ margin: '0 0 0.5rem' }}>Check In</div>
                <h2 className="pz-display" style={{ ...pStyles.sectionTitle, marginBottom: '0.35rem' }}>Check In at Fun 'N Fit</h2>
                <p style={{ ...pStyles.mutedText, marginBottom: '1.25rem' }}>
                    Scan the code at the front desk to get your kids on the board.
                </p>

                <button onClick={() => setScannerOpen(true)} className="pz-btn" style={{ ...pStyles.bigActionBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <Ic.Scan size={24} /> Scan to Check In
                </button>

                {nfcSupported && (
                    nfcListening ? (
                        <div style={{ marginTop: '0.75rem' }}>
                            <div className="pz-live" style={{ ...pStyles.successBox, textAlign: 'center' }}>
                                Hold your phone near the NFC tag…
                            </div>
                            <button onClick={stopNfc} className="pz-btn-ghost" style={{ ...pStyles.btnSecondary, width: '100%', marginTop: '0.6rem' }}>
                                Stop NFC
                            </button>
                        </div>
                    ) : (
                        <button onClick={startNfc} className="pz-btn-ghost" style={{ ...pStyles.btnSecondary, width: '100%', marginTop: '0.75rem' }}>
                            Tap NFC Instead
                        </button>
                    )
                )}

                {error && <div style={{ ...pStyles.errorBox, marginTop: '1rem', textAlign: 'left' }}>{error}</div>}
            </div>

            {/* Recent check-in history */}
            <div style={pStyles.card}>
                <div className="pz-eyebrow" style={pStyles.eyebrow}>Recent Check-Ins</div>
                {historyLoading ? (
                    <p style={pStyles.mutedText}>Loading…</p>
                ) : history.length === 0 ? (
                    <p style={pStyles.mutedText}>No check-ins yet — scan the front-desk QR on your next visit!</p>
                ) : (
                    <div>
                        {history.map(row => (
                            <div key={row.checkIn.id} style={pStyles.listRow}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, color: PZ.white, fontSize: '0.875rem' }}>{row.studentName}</div>
                                    <div style={{ color: PZ.muted, fontSize: '0.75rem', fontWeight: 600 }}>
                                        {row.checkIn.date} · in {fmtTime(row.checkIn.checkedInAt)}
                                        {row.checkIn.checkedOutAt ? ` · out ${fmtTime(row.checkIn.checkedOutAt)}` : ''}
                                    </div>
                                </div>
                                <MethodIcon method={row.checkIn.method} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {scannerOpen && (
                <QRScanSheet
                    title="Scan to Check In"
                    hint="Line up the code at the front desk inside the brackets"
                    onScan={(text) => {
                        setScannerOpen(false);
                        adoptToken(text, 'QR');
                    }}
                    onClose={() => setScannerOpen(false)}
                />
            )}

            {passStudent && (
                <KidPassSheet student={passStudent} onClose={() => setPassStudent(null)} />
            )}
        </div>
    );
};

export default CheckInScanner;
