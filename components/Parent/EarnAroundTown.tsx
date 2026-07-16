// Earn tab — points around town (partner businesses via QR scan) and
// off-site special tasks (submit for staff review). Includes the parent's
// recent visits and task submissions with status chips.
import React, { useState, useEffect } from 'react';
import { Student, PartnerBusiness, SpecialTask, TaskSubmission } from '../../types';
import { gameCenter, CheckInResult } from '../../services/gameCenter';
import QRScanSheet from './QRScanSheet';
import { extractScanParam, cleanErr, fmtDateTime, pStyles, KidSelect, StatusChip } from './shared';

interface EarnAroundTownProps {
    students: Student[];
    /** Secret arriving via deep link (#/parent-dashboard?visit=<secret>) */
    initialVisitSecret?: string | null;
    onVisitConsumed?: () => void;
    /** Called after points were awarded so the dashboard can refresh */
    onRefresh?: () => void;
}

type VisitPreview = { secret: string; name: string; description?: string; pointsReward: number };
type VisitOutcome = { businessName: string; results: Array<CheckInResult & { points?: number }> };
type SubmissionRow = { submission: TaskSubmission; taskTitle: string; points: number; studentName: string };
type VisitRow = { visit: any; studentName: string; businessName: string };

const EarnAroundTown: React.FC<EarnAroundTownProps> = ({
    students,
    initialVisitSecret,
    onVisitConsumed,
    onRefresh,
}) => {
    const [partners, setPartners] = useState<PartnerBusiness[]>([]);
    const [tasks, setTasks] = useState<SpecialTask[]>([]);
    const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
    const [visits, setVisits] = useState<VisitRow[]>([]);
    const [loading, setLoading] = useState(true);

    // Visit-confirm flow
    const [scannerOpen, setScannerOpen] = useState(false);
    const [visitPreview, setVisitPreview] = useState<VisitPreview | null>(null);
    const [visitSelected, setVisitSelected] = useState<string[]>([]);
    const [visitSubmitting, setVisitSubmitting] = useState(false);
    const [visitOutcome, setVisitOutcome] = useState<VisitOutcome | null>(null);
    const [visitError, setVisitError] = useState<string | null>(null);
    const [resolving, setResolving] = useState(false);

    // Task-submit flow
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);
    const [taskKid, setTaskKid] = useState<string[]>([]);
    const [taskNote, setTaskNote] = useState('');
    const [taskSubmitting, setTaskSubmitting] = useState(false);
    const [taskError, setTaskError] = useState<string | null>(null);
    const [taskSuccess, setTaskSuccess] = useState<string | null>(null);

    const loadAll = async () => {
        const [p, t, s, v] = await Promise.all([
            gameCenter.listPartners().catch(() => [] as PartnerBusiness[]),
            gameCenter.listActiveTasks().catch(() => [] as SpecialTask[]),
            gameCenter.taskSubmissionsForParent().catch(() => [] as SubmissionRow[]),
            gameCenter.visitsForParent().catch(() => [] as VisitRow[]),
        ]);
        setPartners(p);
        setTasks(t);
        setSubmissions(s);
        setVisits(v);
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSecret = async (raw: string) => {
        const secret = extractScanParam(raw, 'visit');
        if (!secret) return;
        setResolving(true);
        setVisitError(null);
        setVisitOutcome(null);
        try {
            const preview = await gameCenter.resolveVisitSecret(secret);
            if (!preview) {
                setVisitError("That QR isn't one of our partner businesses — ask the staff for a fresh code");
            } else {
                setVisitPreview({
                    secret,
                    name: preview.name,
                    description: preview.description,
                    pointsReward: preview.pointsReward,
                });
                setVisitSelected(students.map(s => s.id));
            }
        } catch (e: any) {
            setVisitError(cleanErr(e));
        } finally {
            setResolving(false);
        }
    };

    // Deep-link visit secret (native camera scanned a business QR)
    useEffect(() => {
        if (initialVisitSecret) {
            handleSecret(initialVisitSecret);
            onVisitConsumed?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialVisitSecret]);

    const confirmVisit = async () => {
        if (!visitPreview || visitSelected.length === 0) return;
        setVisitSubmitting(true);
        setVisitError(null);
        try {
            const res = await gameCenter.recordVisit(visitPreview.secret, visitSelected);
            setVisitOutcome({ businessName: res.business.name, results: res.results });
            setVisitPreview(null);
            loadAll();
            onRefresh?.();
        } catch (e: any) {
            setVisitError(cleanErr(e));
        } finally {
            setVisitSubmitting(false);
        }
    };

    const openTaskForm = (taskId: string) => {
        setOpenTaskId(openTaskId === taskId ? null : taskId);
        setTaskKid(students.length === 1 ? [students[0].id] : []);
        setTaskNote('');
        setTaskError(null);
        setTaskSuccess(null);
    };

    const submitTask = async (task: SpecialTask) => {
        if (taskKid.length === 0) {
            setTaskError('Pick which kid completed it');
            return;
        }
        if (task.requiresProof && !taskNote.trim()) {
            setTaskError('This task needs proof — describe what they did in the note');
            return;
        }
        setTaskSubmitting(true);
        setTaskError(null);
        try {
            await gameCenter.submitTask({
                taskId: task.id,
                studentId: taskKid[0],
                note: taskNote.trim() || undefined,
            });
            setTaskSuccess(`Sent! The team will review "${task.title}" soon. 🎉`);
            setOpenTaskId(null);
            loadAll();
        } catch (e: any) {
            setTaskError(cleanErr(e));
        } finally {
            setTaskSubmitting(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* ── Visit outcome (per-kid results) ─────────────────────────────── */}
            {visitOutcome && (
                <div style={{ ...pStyles.card, background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #bbf7d0' }}>
                    <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '2.5rem' }}>🌟</div>
                        <h3 style={{ margin: 0, fontWeight: 900, color: '#0f172a', fontSize: '1.125rem' }}>
                            Visit to {visitOutcome.businessName} logged!
                        </h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {visitOutcome.results.map(r => (
                            <div key={r.studentId} style={{
                                display: 'flex', alignItems: 'center', gap: '0.6rem',
                                background: '#ffffff', border: '1px solid #e2e8f0',
                                borderRadius: '12px', padding: '0.6rem 0.875rem',
                            }}>
                                <span style={{ fontSize: '1.25rem' }}>{r.status === 'OK' ? '🎉' : '✅'}</span>
                                <span style={{ flex: 1, fontWeight: 800, color: '#0f172a', fontSize: '0.875rem' }}>{r.fullName}</span>
                                <span style={{
                                    fontWeight: 800, fontSize: '0.8125rem',
                                    color: r.status === 'OK' ? '#15803d' : '#64748b',
                                }}>
                                    {r.status === 'OK' ? `+${r.points ?? 0} pts` : 'already visited today'}
                                </span>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setVisitOutcome(null)} style={{ ...pStyles.btnPrimary, width: '100%', marginTop: '0.875rem' }}>
                        Done
                    </button>
                </div>
            )}

            {/* ── Visit confirm (after scan/deep link) ────────────────────────── */}
            {visitPreview && (
                <div style={{ ...pStyles.card, border: '2px solid #c7d2fe' }}>
                    <h3 style={{ ...pStyles.subTitle, fontSize: '1.125rem' }}>
                        🏙️ Confirm visit to {visitPreview.name}
                    </h3>
                    {visitPreview.description && (
                        <p style={{ ...pStyles.mutedText, marginBottom: '0.75rem' }}>{visitPreview.description}</p>
                    )}
                    <div style={{ marginBottom: '1rem' }}>
                        <span style={pStyles.pointsPill}>⭐ +{visitPreview.pointsReward} pts each</span>
                    </div>
                    <KidSelect students={students} selected={visitSelected} onChange={setVisitSelected} />
                    {visitError && <div style={{ ...pStyles.errorBox, marginTop: '0.875rem' }}>⚠️ {visitError}</div>}
                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                        <button
                            onClick={() => { setVisitPreview(null); setVisitError(null); }}
                            style={{ ...pStyles.btnSecondary, flex: 1 }}
                            disabled={visitSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmVisit}
                            disabled={visitSubmitting || visitSelected.length === 0}
                            style={{
                                ...pStyles.btnPrimary, flex: 2,
                                opacity: visitSubmitting || visitSelected.length === 0 ? 0.6 : 1,
                            }}
                        >
                            {visitSubmitting ? 'Recording…' : `⭐ Confirm Visit (${visitSelected.length})`}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Earn Around Town ────────────────────────────────────────────── */}
            <div style={pStyles.card}>
                <h2 style={{ ...pStyles.sectionTitle, marginBottom: '0.35rem' }}>🏙️ Earn Around Town</h2>
                <p style={{ ...pStyles.mutedText, marginBottom: '1rem' }}>
                    Visit our partner businesses, scan the QR at their counter, and your kids earn points!
                </p>

                <button onClick={() => setScannerOpen(true)} style={pStyles.bigActionBtn} disabled={resolving}>
                    {resolving ? '⏳ Checking that QR…' : '📷 Scan Business QR'}
                </button>

                {visitError && !visitPreview && (
                    <div style={{ ...pStyles.errorBox, marginTop: '0.875rem' }}>⚠️ {visitError}</div>
                )}

                <div style={{ marginTop: '1.125rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {loading ? (
                        <p style={pStyles.mutedText}>Loading partners…</p>
                    ) : partners.length === 0 ? (
                        <p style={pStyles.mutedText}>Partner businesses are coming soon — check back!</p>
                    ) : (
                        partners.map(p => (
                            <div key={p.id} style={{
                                border: '1px solid #e2e8f0', borderRadius: '14px', padding: '0.875rem 1rem',
                                background: '#f8fafc',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9375rem' }}>{p.name}</div>
                                        {p.category && (
                                            <div style={{ color: '#4f46e5', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.1rem' }}>
                                                {p.category}
                                            </div>
                                        )}
                                    </div>
                                    <span style={pStyles.pointsPill}>+{p.pointsReward} pts / visit</span>
                                </div>
                                {p.description && (
                                    <p style={{ margin: '0.4rem 0 0', color: '#64748b', fontSize: '0.8125rem', fontWeight: 500 }}>{p.description}</p>
                                )}
                                {p.address && (
                                    <p style={{ margin: '0.35rem 0 0', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>📍 {p.address}</p>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ── Special Tasks ───────────────────────────────────────────────── */}
            <div style={pStyles.card}>
                <h2 style={{ ...pStyles.sectionTitle, marginBottom: '0.35rem' }}>🏅 Special Tasks</h2>
                <p style={{ ...pStyles.mutedText, marginBottom: '1rem' }}>
                    Off-site challenges — mark them complete and the team awards points after review.
                </p>

                {taskSuccess && <div style={{ ...pStyles.successBox, marginBottom: '0.875rem' }}>✅ {taskSuccess}</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {loading ? (
                        <p style={pStyles.mutedText}>Loading tasks…</p>
                    ) : tasks.length === 0 ? (
                        <p style={pStyles.mutedText}>No active tasks right now — new ones drop soon!</p>
                    ) : (
                        tasks.map(task => (
                            <div key={task.id} style={{
                                border: openTaskId === task.id ? '2px solid #c7d2fe' : '1px solid #e2e8f0',
                                borderRadius: '14px', padding: '0.875rem 1rem', background: '#ffffff',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9375rem' }}>{task.title}</div>
                                        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.8125rem', fontWeight: 500 }}>{task.description}</p>
                                        {task.requiresProof && (
                                            <span style={{
                                                display: 'inline-block', marginTop: '0.4rem',
                                                background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4f46e5',
                                                borderRadius: '999px', padding: '0.15rem 0.6rem',
                                                fontSize: '0.6875rem', fontWeight: 800,
                                            }}>
                                                📸 needs proof
                                            </span>
                                        )}
                                    </div>
                                    <span style={pStyles.pointsPill}>+{task.points} pts</span>
                                </div>

                                {openTaskId === task.id ? (
                                    <div style={{ marginTop: '0.875rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.875rem' }}>
                                        <label style={pStyles.label}>Who completed it?</label>
                                        <KidSelect students={students} selected={taskKid} onChange={setTaskKid} single />
                                        <label style={{ ...pStyles.label, marginTop: '0.75rem' }}>
                                            {task.requiresProof ? 'Proof note (required)' : 'Note (optional)'}
                                        </label>
                                        <textarea
                                            value={taskNote}
                                            onChange={e => setTaskNote(e.target.value)}
                                            placeholder={task.requiresProof
                                                ? 'Tell us what they did — the team reviews this'
                                                : 'Anything the team should know?'}
                                            rows={3}
                                            style={{ ...pStyles.input, resize: 'vertical' }}
                                        />
                                        {taskError && <div style={{ ...pStyles.errorBox, marginTop: '0.6rem' }}>⚠️ {taskError}</div>}
                                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem' }}>
                                            <button onClick={() => setOpenTaskId(null)} style={{ ...pStyles.btnSecondary, flex: 1 }} disabled={taskSubmitting}>
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => submitTask(task)}
                                                disabled={taskSubmitting}
                                                style={{ ...pStyles.btnPrimary, flex: 2, opacity: taskSubmitting ? 0.6 : 1 }}
                                            >
                                                {taskSubmitting ? 'Submitting…' : '📨 Submit for Review'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => openTaskForm(task.id)}
                                        style={{ ...pStyles.btnSecondary, width: '100%', marginTop: '0.75rem', padding: '0.65rem' }}
                                    >
                                        ✅ Mark Complete
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* My submissions */}
                {submissions.length > 0 && (
                    <div style={{ marginTop: '1.25rem' }}>
                        <h3 style={pStyles.subTitle}>📨 My Submissions</h3>
                        {submissions.map(row => (
                            <div key={row.submission.id} style={pStyles.listRow}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.875rem' }}>
                                        {row.taskTitle} <span style={{ color: '#94a3b8', fontWeight: 600 }}>· {row.studentName}</span>
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                                        {fmtDateTime(row.submission.createdAt)} · +{row.points} pts
                                    </div>
                                </div>
                                <StatusChip status={row.submission.status} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Recent visits ───────────────────────────────────────────────── */}
            <div style={pStyles.card}>
                <h3 style={pStyles.subTitle}>🗺️ Recent Visits</h3>
                {loading ? (
                    <p style={pStyles.mutedText}>Loading…</p>
                ) : visits.length === 0 ? (
                    <p style={pStyles.mutedText}>No business visits yet — scan a partner QR to start earning!</p>
                ) : (
                    visits.map((row, i) => (
                        <div key={row.visit?._id ?? i} style={pStyles.listRow}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.875rem' }}>
                                    {row.businessName} <span style={{ color: '#94a3b8', fontWeight: 600 }}>· {row.studentName}</span>
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>{row.visit?.date}</div>
                            </div>
                            <span style={pStyles.pointsPill}>+{row.visit?.points ?? 0} pts</span>
                        </div>
                    ))
                )}
            </div>

            {scannerOpen && (
                <QRScanSheet
                    title="Scan Business QR"
                    hint="Point your camera at the partner's QR code"
                    onScan={(text) => {
                        setScannerOpen(false);
                        handleSecret(text);
                    }}
                    onClose={() => setScannerOpen(false)}
                />
            )}
        </div>
    );
};

export default EarnAroundTown;
