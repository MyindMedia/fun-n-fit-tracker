// Perks tab — per-kid redemption history plus an optional parent-driven
// "redeem a perk" flow (kids normally redeem from the student portal).
import React, { useState, useEffect } from 'react';
import { Student, Reward, Redemption, Rarity } from '../../types';
import { gameCenter } from '../../services/gameCenter';
import { supabaseService } from '../../services/supabaseService';
import { cleanErr, fmtDateTime, pStyles, KidSelect, StatusChip } from './shared';

interface PerksHistoryProps {
    students: Student[];
    /** Called after a redemption so the dashboard can refresh points */
    onRefresh?: () => void;
}

type RedemptionRow = { redemption: Redemption; studentName: string };

const RARITY_COLORS: Record<Rarity, string> = {
    common: '#94a3b8',
    uncommon: '#10b981',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f59e0b',
};

const PerksHistory: React.FC<PerksHistoryProps> = ({ students, onRefresh }) => {
    const [rows, setRows] = useState<RedemptionRow[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);

    // Redeem flow
    const [redeemOpen, setRedeemOpen] = useState(false);
    const [kidSel, setKidSel] = useState<string[]>([]);
    const [chosen, setChosen] = useState<Reward | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadAll = async () => {
        const [history, catalog] = await Promise.all([
            gameCenter.redemptionsForParent().catch(() => [] as RedemptionRow[]),
            supabaseService.getRewards().catch(() => [] as Reward[]),
        ]);
        setRows(history);
        setRewards(catalog);
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const kid = students.find(s => s.id === kidSel[0]);

    const openRedeem = () => {
        setRedeemOpen(true);
        setKidSel(students.length === 1 ? [students[0].id] : []);
        setChosen(null);
        setError(null);
        setSuccess(null);
    };

    const confirmRedeem = async () => {
        if (!kid || !chosen) return;
        setConfirming(true);
        setError(null);
        try {
            await gameCenter.redeem(kid.id, chosen.id, 'PARENT');
            setSuccess(`🎉 ${chosen.icon} ${chosen.name} redeemed for ${kid.gamerTag || kid.fullName}!`);
            setRedeemOpen(false);
            setChosen(null);
            loadAll();
            onRefresh?.();
        } catch (e: any) {
            setError(cleanErr(e));
        } finally {
            setConfirming(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <div style={pStyles.card}>
                <h2 style={{ ...pStyles.sectionTitle, marginBottom: '0.35rem' }}>🎁 Perks</h2>
                <p style={{ ...pStyles.mutedText, marginBottom: '1rem' }}>
                    Kids redeem perks themselves from the Student Portal — or you can redeem one for them here.
                </p>

                {success && <div style={{ ...pStyles.successBox, marginBottom: '0.875rem' }}>{success}</div>}

                {!redeemOpen ? (
                    <button onClick={openRedeem} style={pStyles.bigActionBtn}>
                        🎁 Redeem a Perk
                    </button>
                ) : (
                    <div style={{ border: '2px solid #c7d2fe', borderRadius: '14px', padding: '1rem' }}>
                        <label style={pStyles.label}>Who's it for?</label>
                        <KidSelect students={students} selected={kidSel} onChange={(ids) => { setKidSel(ids); setError(null); }} single />

                        {kid && (
                            <>
                                <label style={{ ...pStyles.label, marginTop: '1rem' }}>
                                    Pick a perk <span style={{ color: '#f59e0b', fontWeight: 800 }}>({kid.points.toLocaleString()} pts available)</span>
                                </label>
                                {rewards.length === 0 ? (
                                    <p style={pStyles.mutedText}>No perks in the catalog yet — check back soon!</p>
                                ) : (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                        gap: '0.6rem',
                                    }}>
                                        {rewards.map(r => {
                                            const affordable = kid.points >= r.cost;
                                            const isChosen = chosen?.id === r.id;
                                            const rarityColor = r.rarity ? RARITY_COLORS[r.rarity] : '#e2e8f0';
                                            return (
                                                <button
                                                    key={r.id}
                                                    type="button"
                                                    onClick={() => { setChosen(r); setError(null); }}
                                                    style={{
                                                        textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit',
                                                        background: isChosen ? '#eef2ff' : '#ffffff',
                                                        border: isChosen ? '2px solid #4f46e5' : `2px solid ${r.rarity ? `${rarityColor}66` : '#e2e8f0'}`,
                                                        borderRadius: '14px', padding: '0.875rem 0.5rem',
                                                        opacity: affordable ? 1 : 0.5,
                                                    }}
                                                >
                                                    <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{r.icon}</div>
                                                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.8125rem', lineHeight: 1.2 }}>{r.name}</div>
                                                    {r.rarity && (
                                                        <div style={{
                                                            fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase',
                                                            letterSpacing: '0.05em', color: rarityColor, marginTop: '0.15rem',
                                                        }}>
                                                            {r.rarity}
                                                        </div>
                                                    )}
                                                    <div style={{
                                                        marginTop: '0.35rem', fontWeight: 800, fontSize: '0.75rem',
                                                        color: affordable ? '#b45309' : '#94a3b8',
                                                    }}>
                                                        ⭐ {r.cost.toLocaleString()} pts
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {error && <div style={{ ...pStyles.errorBox, marginTop: '0.875rem' }}>⚠️ {error}</div>}

                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                            <button
                                onClick={() => { setRedeemOpen(false); setError(null); }}
                                style={{ ...pStyles.btnSecondary, flex: 1 }}
                                disabled={confirming}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmRedeem}
                                disabled={confirming || !kid || !chosen}
                                style={{
                                    ...pStyles.btnPrimary, flex: 2,
                                    opacity: confirming || !kid || !chosen ? 0.6 : 1,
                                }}
                            >
                                {confirming
                                    ? 'Redeeming…'
                                    : chosen && kid
                                        ? `Redeem for ${chosen.cost.toLocaleString()} pts`
                                        : 'Redeem'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Redemption history ──────────────────────────────────────────── */}
            <div style={pStyles.card}>
                <h3 style={pStyles.subTitle}>📜 Redemption History</h3>
                {loading ? (
                    <p style={pStyles.mutedText}>Loading…</p>
                ) : rows.length === 0 ? (
                    <p style={pStyles.mutedText}>No perks redeemed yet — points are burning a hole in those pockets!</p>
                ) : (
                    rows.map(row => (
                        <div key={row.redemption.id} style={pStyles.listRow}>
                            <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>{row.redemption.rewardIcon || '🎁'}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.875rem' }}>
                                    {row.redemption.rewardName} <span style={{ color: '#94a3b8', fontWeight: 600 }}>· {row.studentName}</span>
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                                    {fmtDateTime(row.redemption.createdAt)} · ⭐ {row.redemption.cost.toLocaleString()} pts
                                </div>
                            </div>
                            <StatusChip status={row.redemption.status} />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default PerksHistory;
