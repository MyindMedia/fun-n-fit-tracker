// Perks tab — per-kid redemption history plus an optional parent-driven
// "redeem a perk" flow (kids normally redeem from the student portal).
import React, { useState, useEffect } from 'react';
import { Student, Reward, Redemption, Rarity } from '../../types';
import { gameCenter } from '../../services/gameCenter';
import { supabaseService } from '../../services/supabaseService';
import { cleanErr, fmtDateTime, pStyles, KidSelect, StatusChip, PZ } from './shared';
import { Ic, DataIcon } from '../icons';

interface PerksHistoryProps {
    students: Student[];
    /** Called after a redemption so the dashboard can refresh points */
    onRefresh?: () => void;
}

type RedemptionRow = { redemption: Redemption; studentName: string };

/* Rarity accents tuned for AA contrast on --pz-panel-2 */
const RARITY_COLORS: Record<Rarity, string> = {
    common: '#94a3b8',
    uncommon: '#34d399',
    rare: '#60a5fa',
    epic: '#c084fc',
    legendary: '#fbbf24',
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
            setSuccess(`${chosen.name} redeemed for ${kid.gamerTag || kid.fullName} — enjoy!`);
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
                <div className="pz-eyebrow" style={pStyles.eyebrow}>Perks</div>
                <p style={{ ...pStyles.mutedText, marginBottom: '1rem' }}>
                    Kids redeem perks themselves from the Student Portal — or you can redeem one for them here.
                </p>

                {success && (
                    <div style={{ ...pStyles.successBox, marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Ic.Confetti size={20} style={{ flexShrink: 0 }} /> {success}
                    </div>
                )}

                {!redeemOpen ? (
                    <button onClick={openRedeem} className="pz-btn" style={{ ...pStyles.bigActionBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Ic.Gift size={24} /> Redeem a Perk
                    </button>
                ) : (
                    <div style={{ border: `2px solid ${PZ.voltDim}`, clipPath: PZ.notchSm, padding: '1rem', background: PZ.panel2 }}>
                        <label style={pStyles.label}>Who's it for?</label>
                        <KidSelect students={students} selected={kidSel} onChange={(ids) => { setKidSel(ids); setError(null); }} single />

                        {kid && (
                            <>
                                <label style={{ ...pStyles.label, marginTop: '1rem' }}>
                                    Pick a perk <span style={{ color: PZ.volt, fontWeight: 700 }}>({kid.points.toLocaleString()} pts available)</span>
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
                                            const rarityColor = r.rarity ? RARITY_COLORS[r.rarity] : PZ.muted;
                                            return (
                                                <button
                                                    key={r.id}
                                                    type="button"
                                                    className="pzp-clip"
                                                    onClick={() => { setChosen(r); setError(null); }}
                                                    aria-pressed={isChosen}
                                                    style={{
                                                        textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit',
                                                        background: isChosen ? PZ.panel2 : '#10141C',
                                                        border: isChosen ? `2px solid ${PZ.volt}` : `2px solid ${r.rarity ? `${rarityColor}44` : PZ.border}`,
                                                        boxShadow: isChosen ? 'inset 0 0 24px rgba(203, 254, 28, 0.10)' : 'none',
                                                        clipPath: PZ.notchSm, padding: '0.875rem 0.5rem',
                                                        opacity: affordable ? 1 : 0.45,
                                                        minHeight: '44px',
                                                    }}
                                                >
                                                    <div style={{ marginBottom: '0.25rem', color: rarityColor, display: 'flex', justifyContent: 'center' }}>
                                                        <DataIcon glyph={r.icon} size={28} />
                                                    </div>
                                                    <div style={{ fontWeight: 700, color: PZ.white, fontSize: '0.8125rem', lineHeight: 1.2 }}>{r.name}</div>
                                                    {r.rarity && (
                                                        <div style={{
                                                            fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase',
                                                            letterSpacing: '0.1em', color: rarityColor, marginTop: '0.15rem',
                                                        }}>
                                                            {r.rarity}
                                                        </div>
                                                    )}
                                                    <div style={{
                                                        marginTop: '0.35rem', fontWeight: 700, fontSize: '0.75rem',
                                                        color: affordable ? PZ.volt : PZ.muted,
                                                    }}>
                                                        {r.cost.toLocaleString()} pts
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {error && <div style={{ ...pStyles.errorBox, marginTop: '0.875rem' }}>{error}</div>}

                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                            <button
                                onClick={() => { setRedeemOpen(false); setError(null); }}
                                className="pz-btn-ghost"
                                style={{ ...pStyles.btnSecondary, flex: 1 }}
                                disabled={confirming}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmRedeem}
                                disabled={confirming || !kid || !chosen}
                                className="pz-btn"
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
                <div className="pz-eyebrow" style={pStyles.eyebrow}>Redemption History</div>
                {loading ? (
                    <p style={pStyles.mutedText}>Loading…</p>
                ) : rows.length === 0 ? (
                    <p style={pStyles.mutedText}>No perks redeemed yet — points are burning a hole in those pockets!</p>
                ) : (
                    rows.map(row => (
                        <div key={row.redemption.id} style={pStyles.listRow}>
                            <div style={{ flexShrink: 0, color: PZ.volt, display: 'flex' }}>
                                {row.redemption.rewardIcon
                                    ? <DataIcon glyph={row.redemption.rewardIcon} size={24} />
                                    : <Ic.Gift size={24} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: PZ.white, fontSize: '0.875rem' }}>
                                    {row.redemption.rewardName} <span style={{ color: PZ.faint, fontWeight: 600 }}>· {row.studentName}</span>
                                </div>
                                <div style={{ color: PZ.muted, fontSize: '0.75rem', fontWeight: 600 }}>
                                    {fmtDateTime(row.redemption.createdAt)} · <span style={{ color: PZ.volt }}>{row.redemption.cost.toLocaleString()} pts</span>
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
