// Check In tab — parent scans the front-desk QR (or taps the NFC kiosk tag),
// picks which kids are here, and confirms. Shows per-kid results and the
// family's recent check-in history.
import React, { useState, useEffect, useRef } from 'react';
import { Student, CheckIn } from '../../types';
import { gameCenter, CheckInResult } from '../../services/gameCenter';
import QRScanSheet from './QRScanSheet';
import { extractScanParam, cleanErr, fmtTime, pStyles, KidSelect } from './shared';

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

    /* ── Step 3: per-kid results ─────────────────────────────────────────────── */
    if (results) {
        const okCount = results.filter(r => r.status === 'OK').length;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ ...pStyles.card, textAlign: 'center', background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', border: '1px solid #c7d2fe' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>{okCount > 0 ? '🎉' : '👍'}</div>
                    <h2 style={{ margin: '0 0 0.25rem', fontWeight: 900, color: '#0f172a', fontSize: '1.375rem' }}>
                        {okCount > 0 ? "They're on the board!" : 'All set!'}
                    </h2>
                    <p style={{ margin: 0, color: '#4f46e5', fontWeight: 700, fontSize: '0.9375rem' }}>
                        {okCount > 0 ? 'Checked in and ready to play 🎮' : 'Everyone was already checked in today'}
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {results.map(r => (
                        <div key={r.studentId} style={{
                            ...pStyles.card, padding: '0.875rem 1rem',
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            borderColor: r.status === 'OK' ? '#bbf7d0' : '#e2e8f0',
                            background: r.status === 'OK' ? '#f0fdf4' : '#ffffff',
                        }}>
                            <div style={{ fontSize: '1.5rem' }}>{r.status === 'OK' ? '🎮' : '✅'}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9375rem' }}>{r.fullName}</div>
                                <div style={{
                                    fontSize: '0.8125rem', fontWeight: 700,
                                    color: r.status === 'OK' ? '#15803d' : '#64748b',
                                }}>
                                    {r.status === 'OK' ? "They're on the board! 🎮 +10 pts" : 'Already checked in today — good to go!'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <button onClick={reset} style={{ ...pStyles.btnPrimary, width: '100%' }}>Done</button>
            </div>
        );
    }

    /* ── Step 2: pick kids + confirm ─────────────────────────────────────────── */
    if (token) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={pStyles.card}>
                    <h2 style={pStyles.sectionTitle}>Who's here today?</h2>
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
                            ⚠️ {error}
                            {tokenExpired && (
                                <button
                                    onClick={() => { reset(); setScannerOpen(true); }}
                                    style={{ ...pStyles.btnPrimary, display: 'block', width: '100%', marginTop: '0.75rem' }}
                                >
                                    📷 Rescan the QR
                                </button>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                        <button onClick={reset} style={{ ...pStyles.btnSecondary, flex: 1 }} disabled={submitting}>
                            Cancel
                        </button>
                        <button
                            onClick={confirmCheckIn}
                            disabled={submitting || selected.length === 0}
                            style={{
                                ...pStyles.btnPrimary, flex: 2,
                                opacity: submitting || selected.length === 0 ? 0.6 : 1,
                            }}
                        >
                            {submitting ? 'Checking in…' : `✅ Check In (${selected.length})`}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ── Step 1: scan ────────────────────────────────────────────────────────── */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ ...pStyles.card, textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📍</div>
                <h2 style={{ ...pStyles.sectionTitle, marginBottom: '0.35rem' }}>Check In at Fun 'N Fit</h2>
                <p style={{ ...pStyles.mutedText, marginBottom: '1.25rem' }}>
                    Scan the QR code on the front-desk screen to get your kids on the board.
                </p>

                <button onClick={() => setScannerOpen(true)} style={pStyles.bigActionBtn}>
                    📷 Scan to Check In
                </button>

                {nfcSupported && (
                    nfcListening ? (
                        <div style={{ marginTop: '0.75rem' }}>
                            <div style={{ ...pStyles.successBox, textAlign: 'center' }}>
                                📶 Hold your phone near the NFC tag…
                            </div>
                            <button onClick={stopNfc} style={{ ...pStyles.btnSecondary, width: '100%', marginTop: '0.6rem' }}>
                                Stop NFC
                            </button>
                        </div>
                    ) : (
                        <button onClick={startNfc} style={{ ...pStyles.btnSecondary, width: '100%', marginTop: '0.75rem' }}>
                            📶 Tap NFC
                        </button>
                    )
                )}

                {error && <div style={{ ...pStyles.errorBox, marginTop: '1rem', textAlign: 'left' }}>⚠️ {error}</div>}
            </div>

            {/* Recent check-in history */}
            <div style={pStyles.card}>
                <h3 style={pStyles.subTitle}>🕐 Recent Check-Ins</h3>
                {historyLoading ? (
                    <p style={pStyles.mutedText}>Loading…</p>
                ) : history.length === 0 ? (
                    <p style={pStyles.mutedText}>No check-ins yet — scan the front-desk QR on your next visit!</p>
                ) : (
                    <div>
                        {history.map(row => (
                            <div key={row.checkIn.id} style={pStyles.listRow}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.875rem' }}>{row.studentName}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                                        {row.checkIn.date} · in {fmtTime(row.checkIn.checkedInAt)}
                                        {row.checkIn.checkedOutAt ? ` · out ${fmtTime(row.checkIn.checkedOutAt)}` : ''}
                                    </div>
                                </div>
                                <span style={{ fontSize: '1.1rem' }}>
                                    {row.checkIn.method === 'NFC' ? '📶' : row.checkIn.method === 'MANUAL' ? '🖐️' : '📷'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {scannerOpen && (
                <QRScanSheet
                    title="Scan to Check In"
                    hint="Point your camera at the QR on the front-desk screen"
                    onScan={(text) => {
                        setScannerOpen(false);
                        adoptToken(text, 'QR');
                    }}
                    onClose={() => setScannerOpen(false)}
                />
            )}
        </div>
    );
};

export default CheckInScanner;
