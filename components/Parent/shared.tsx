// Shared helpers + style fragments for the parent-portal game-center tabs.
// Mirrors the inline-style look of components/ParentDashboard.tsx.
import React from 'react';
import { Student } from '../../types';
import { HOUSES } from '../../constants';

/* ── Scanned-content parsing ────────────────────────────────────────────────
 * QR / NFC payloads are either a raw token/secret or a deep link like
 * "https://app/#/parent-dashboard?checkin=<token>". Extract the named query
 * param when present; otherwise treat the whole payload as the token. */
export const extractScanParam = (raw: string, key: string): string => {
    const text = (raw || '').trim();
    if (text.includes(`${key}=`)) {
        const qIndex = text.indexOf('?');
        const query = (qIndex >= 0 ? text.slice(qIndex + 1) : text).replace(/^#/, '');
        try {
            const value = new URLSearchParams(query).get(key);
            if (value) return value;
        } catch {
            // fall through to raw text
        }
    }
    return text;
};

/* Convex surfaces server errors as "... Uncaught Error: <message>\n at ...".
 * Strip the wrapper so parents see the friendly message. */
export const cleanErr = (e: any, fallback = 'Something went wrong — please try again'): string => {
    const raw = String(e?.message ?? e ?? '');
    const stripped = raw.replace(/^[\s\S]*Uncaught Error:\s*/, '').split('\n')[0].trim();
    return stripped || fallback;
};

/* ── Timestamp formatting (all timestamps are ms epochs) ───────────────────── */
export const fmtDate = (ms: number): string =>
    new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const fmtTime = (ms: number): string =>
    new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const fmtDateTime = (ms: number): string => `${fmtDate(ms)} · ${fmtTime(ms)}`;

/* ── Status chip (submissions + redemptions) ───────────────────────────────── */
const CHIP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    PENDING: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
    APPROVED: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    FULFILLED: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    REJECTED: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
    CANCELLED: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
};

export const StatusChip: React.FC<{ status: string }> = ({ status }) => {
    const c = CHIP_COLORS[status] || { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b' };
    return (
        <span style={{
            display: 'inline-block', background: c.bg, border: `1px solid ${c.border}`,
            color: c.text, borderRadius: '999px', padding: '0.15rem 0.6rem',
            fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.03em',
            textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
            {status}
        </span>
    );
};

/* ── Kid selector — big tappable cards, multi- or single-select ────────────── */
export const KidSelect: React.FC<{
    students: Student[];
    selected: string[];
    onChange: (ids: string[]) => void;
    single?: boolean;
}> = ({ students, selected, onChange, single }) => {
    const toggle = (id: string) => {
        if (single) {
            onChange([id]);
            return;
        }
        onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {students.map(s => {
                const house = HOUSES[s.houseId];
                const isSelected = selected.includes(s.id);
                return (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => toggle(s.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
                            textAlign: 'left', padding: '0.875rem 1rem', cursor: 'pointer',
                            background: isSelected ? '#eef2ff' : '#ffffff',
                            border: isSelected ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                            borderRadius: '14px', transition: 'all 0.15s', fontFamily: 'inherit',
                        }}
                    >
                        <img
                            src={s.avatarUrl}
                            alt=""
                            onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.id}`; }}
                            style={{
                                width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover',
                                border: `3px solid ${house.colorHex}`, flexShrink: 0,
                            }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                color: '#0f172a', fontWeight: 800, fontSize: '0.9375rem',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {s.gamerTag || s.fullName}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                                {house.mascot} {house.name} · ⭐ {s.points.toLocaleString()} pts
                            </div>
                        </div>
                        <div style={{
                            width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isSelected ? '#4f46e5' : '#f1f5f9',
                            border: isSelected ? '2px solid #4f46e5' : '2px solid #cbd5e1',
                            color: '#fff', fontSize: '0.8rem', fontWeight: 900,
                        }}>
                            {isSelected ? '✓' : ''}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

/* ── Style fragments shared by the game-center tabs ────────────────────────── */
export const pStyles: Record<string, React.CSSProperties> = {
    card: {
        background: '#ffffff',
        border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'relative', zIndex: 1,
    },
    sectionTitle: { margin: '0 0 1rem', color: '#0f172a', fontWeight: 800, fontSize: '1.25rem' },
    subTitle: { margin: '0 0 0.75rem', color: '#0f172a', fontWeight: 800, fontSize: '1rem' },
    btnPrimary: {
        background: '#4f46e5', color: '#fff',
        border: 'none', borderRadius: '12px',
        fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
        padding: '0.875rem 1.25rem', fontFamily: 'inherit',
    },
    btnSecondary: {
        background: '#f1f5f9', border: '1px solid #e2e8f0',
        color: '#0f172a', borderRadius: '12px',
        fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
        padding: '0.875rem 1.25rem', fontFamily: 'inherit',
    },
    bigActionBtn: {
        width: '100%',
        background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff',
        border: 'none', borderRadius: '16px', padding: '1.25rem',
        fontSize: '1.125rem', fontWeight: 800, cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(79,70,229,0.35)', fontFamily: 'inherit',
    },
    input: {
        width: '100%', padding: '0.875rem 1.25rem', boxSizing: 'border-box',
        background: '#ffffff', border: '1.5px solid #e2e8f0',
        borderRadius: '12px', color: '#0f172a', fontSize: '1rem', outline: 'none',
        fontFamily: 'inherit',
    },
    label: {
        display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#64748b', fontWeight: 600,
    },
    errorBox: {
        background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
        borderRadius: '12px', padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600,
    },
    successBox: {
        background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d',
        borderRadius: '12px', padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600,
    },
    mutedText: { color: '#94a3b8', fontSize: '0.875rem', fontWeight: 500, margin: 0 },
    listRow: {
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9',
    },
    pointsPill: {
        display: 'inline-block', background: '#fffbeb', border: '1px solid #fde68a',
        color: '#b45309', borderRadius: '999px', padding: '0.2rem 0.65rem',
        fontSize: '0.75rem', fontWeight: 800, whiteSpace: 'nowrap',
    },
};
