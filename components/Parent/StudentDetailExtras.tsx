// Per-kid game-center detail sections shown inside ParentDashboard's
// StudentDetailView: check-in history, business visits, and redemptions.
import React, { useState, useEffect } from 'react';
import { CheckIn, Redemption } from '../../types';
import { gameCenter } from '../../services/gameCenter';
import { fmtTime, fmtDateTime, pStyles, StatusChip } from './shared';

interface StudentDetailExtrasProps {
    studentId: string;
}

type VisitRow = { visit: any; businessName: string };

const MAX_ROWS = 10;

const StudentDetailExtras: React.FC<StudentDetailExtrasProps> = ({ studentId }) => {
    const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
    const [visits, setVisits] = useState<VisitRow[]>([]);
    const [redemptions, setRedemptions] = useState<Redemption[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [c, v, r] = await Promise.all([
                gameCenter.checkinHistoryForStudent(studentId).catch(() => [] as CheckIn[]),
                gameCenter.visitsForStudent(studentId).catch(() => [] as VisitRow[]),
                gameCenter.redemptionsForStudent(studentId).catch(() => [] as Redemption[]),
            ]);
            if (cancelled) return;
            setCheckIns(c);
            setVisits(v);
            setRedemptions(r);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [studentId]);

    if (loading) {
        return (
            <div style={{ ...pStyles.card, marginBottom: '1.25rem', textAlign: 'center' }}>
                <p style={pStyles.mutedText}>⏳ Loading activity…</p>
            </div>
        );
    }

    return (
        <>
            {/* Check-in history */}
            <div style={{ ...pStyles.card, marginBottom: '1.25rem' }}>
                <h3 style={pStyles.subTitle}>🕐 Check-In History</h3>
                {checkIns.length === 0 ? (
                    <p style={pStyles.mutedText}>No check-ins yet.</p>
                ) : (
                    checkIns.slice(0, MAX_ROWS).map(c => (
                        <div key={c.id} style={pStyles.listRow}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.875rem' }}>{c.date}</div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                                    in {fmtTime(c.checkedInAt)}
                                    {c.checkedOutAt ? ` · out ${fmtTime(c.checkedOutAt)}` : ''}
                                </div>
                            </div>
                            <span style={{ fontSize: '1.1rem' }}>
                                {c.method === 'NFC' ? '📶' : c.method === 'MANUAL' ? '🖐️' : '📷'}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {/* Business visits */}
            <div style={{ ...pStyles.card, marginBottom: '1.25rem' }}>
                <h3 style={pStyles.subTitle}>🏙️ Business Visits</h3>
                {visits.length === 0 ? (
                    <p style={pStyles.mutedText}>No partner-business visits yet.</p>
                ) : (
                    visits.slice(0, MAX_ROWS).map((row, i) => (
                        <div key={row.visit?._id ?? i} style={pStyles.listRow}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.875rem' }}>{row.businessName}</div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>{row.visit?.date}</div>
                            </div>
                            <span style={pStyles.pointsPill}>+{row.visit?.points ?? 0} pts</span>
                        </div>
                    ))
                )}
            </div>

            {/* Redemptions */}
            <div style={{ ...pStyles.card, marginBottom: '1.25rem' }}>
                <h3 style={pStyles.subTitle}>🎁 Perk Redemptions</h3>
                {redemptions.length === 0 ? (
                    <p style={pStyles.mutedText}>No perks redeemed yet.</p>
                ) : (
                    redemptions.slice(0, MAX_ROWS).map(r => (
                        <div key={r.id} style={pStyles.listRow}>
                            <div style={{ fontSize: '1.35rem', flexShrink: 0 }}>{r.rewardIcon || '🎁'}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.875rem' }}>{r.rewardName}</div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                                    {fmtDateTime(r.createdAt)} · ⭐ {r.cost.toLocaleString()} pts
                                </div>
                            </div>
                            <StatusChip status={r.status} />
                        </div>
                    ))
                )}
            </div>
        </>
    );
};

export default StudentDetailExtras;
