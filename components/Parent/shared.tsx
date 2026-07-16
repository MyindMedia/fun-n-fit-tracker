// Shared helpers + style fragments for the parent-portal game-center tabs.
//
// THEME CONVENTION (Pubzi esports layer — see index.html "Pubzi esports theme
// layer" for the tokens/classes):
//   • `.pz-*` classes handle typography + interactive chrome: `pz-scope`
//     (Chakra Petch body / Days One headings), `pz-display` (Days One —
//     MOMENTS only: screen titles, kids' names, point totals), `pz-eyebrow`
//     ("// LABEL" volt tags), `pz-banner` (header art), `pz-btn` /
//     `pz-btn-ghost` (volt / ghost cut-corner CTAs with hover states),
//     `pz-live` (volt pulse).
//   • Everything else stays on the inline `pStyles` fragment mechanism,
//     re-tokened dark, with the signature notched clip-path baked into the
//     card fragments so `{...pStyles.card, ...overrides}` spreads keep working.
//   • `pStyles.btnPrimary` / `btnSecondary` / `bigActionBtn` are SIZING-ONLY
//     fragments — always pair them with className="pz-btn" / "pz-btn-ghost".
//   • Render <PzPortalCss /> once per screen root for focus rings,
//     placeholder colors, and the scanner scanline (reduced-motion safe).
import React from 'react';
import { Student } from '../../types';
import { HOUSES } from '../../constants';
import { Ic } from '../icons';
import { haptic } from '../../utils/haptics';

/* ── Pubzi token palette (mirrors the CSS custom props in index.html) ─────── */
export const PZ = {
    bg: '#0B0E13',
    panel: '#12161F',
    panel2: '#171C27',
    volt: '#CBFE1C',
    voltDim: 'rgba(203, 254, 28, 0.35)',
    voltFaint: 'rgba(203, 254, 28, 0.10)',
    text: '#ABABAB',
    muted: '#98A2B3',
    faint: '#667085',
    white: '#F2F4F7',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.14)',
    /* Notched cut-corner panel shapes (the template's signature) */
    notch: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)',
    notchSm: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
    displayFont: "'Days One', 'Lexend Deca', sans-serif",
    bodyFont: "'Chakra Petch', 'Inter', sans-serif",
};

/* ── Portal-local CSS: focus visibility, form states, scanner scanline ──────
 * Rendered as a <style> tag per screen root (duplicates are harmless). Kept
 * here so the parent portal owns its own accessibility floor without touching
 * index.html. */
export const PzPortalCss: React.FC = () => (
    <style>{`
        /* Portal screens are full-bleed dark; the app body is light for admin */
        html, body { background: #0B0E13 !important; }
        .pz-scope :focus-visible { outline: 2px solid #CBFE1C; outline-offset: 2px; }
        .pz-scope .pz-btn:focus-visible,
        .pz-scope .pz-btn-ghost:focus-visible,
        .pz-scope .pzp-clip:focus-visible { outline-offset: -4px; }
        .pz-scope input::placeholder,
        .pz-scope textarea::placeholder { color: #667085; opacity: 1; }
        .pz-scope input:focus,
        .pz-scope textarea:focus,
        .pz-scope select:focus { border-color: rgba(203, 254, 28, 0.65) !important; }
        .pz-scope select option { background: #12161F; color: #F2F4F7; }
        @keyframes pzp-scanline {
            0% { top: 14%; }
            100% { top: 84%; }
        }
        .pzp-scanline {
            position: absolute; left: 14%; right: 14%; height: 2px;
            background: linear-gradient(90deg, transparent, rgba(203, 254, 28, 0.9), transparent);
            animation: pzp-scanline 2.2s ease-in-out infinite alternate;
            pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
            .pzp-scanline { animation: none; top: 50%; }
        }
        /* ── iOS-app shell: fixed bottom tab bar ────────────────────────────
         * The bar is fixed full-width; the inner rail centers + caps width on
         * desktop so the 5 tabs never stretch across a wide screen. */
        .pzp-tabbar {
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 220;
            background: #12161F;
            border-top: 1px solid rgba(255, 255, 255, 0.10);
            padding-bottom: var(--safe-area-bottom, env(safe-area-inset-bottom, 0px));
            box-shadow: 0 -10px 28px rgba(0, 0, 0, 0.45);
        }
        .pzp-tabbar-inner { display: flex; width: 100%; margin: 0 auto; }
        @media (min-width: 768px) {
            .pzp-tabbar-inner { max-width: 560px; }
        }
        /* Momentum scrolling for the portal content */
        .pz-scope { -webkit-overflow-scrolling: touch; }
    `}</style>
);

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

/* ── Status chip (submissions + redemptions) — AA on --pz-panel ────────────── */
const CHIP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    PENDING: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)', text: '#fbbf24' },
    APPROVED: { bg: 'rgba(203, 254, 28, 0.10)', border: 'rgba(203, 254, 28, 0.4)', text: '#CBFE1C' },
    FULFILLED: { bg: 'rgba(203, 254, 28, 0.10)', border: 'rgba(203, 254, 28, 0.4)', text: '#CBFE1C' },
    REJECTED: { bg: 'rgba(248, 113, 113, 0.10)', border: 'rgba(248, 113, 113, 0.35)', text: '#f87171' },
    CANCELLED: { bg: 'rgba(148, 163, 184, 0.10)', border: 'rgba(148, 163, 184, 0.3)', text: '#94a3b8' },
};

export const StatusChip: React.FC<{ status: string }> = ({ status }) => {
    const c = CHIP_COLORS[status] || { bg: 'rgba(148, 163, 184, 0.10)', border: 'rgba(148, 163, 184, 0.3)', text: '#94a3b8' };
    return (
        <span style={{
            display: 'inline-block', background: c.bg, border: `1px solid ${c.border}`,
            color: c.text, borderRadius: '3px', padding: '0.2rem 0.6rem',
            fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', whiteSpace: 'nowrap',
            fontFamily: PZ.bodyFont,
        }}>
            {status}
        </span>
    );
};

/* ── Kid selector — picking players for the match ───────────────────────────
 * Selected = volt border + subtle inner glow; unselected = dim panel.
 * Multi- or single-select, big 44px+ tap targets. */
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
                        className="pzp-clip"
                        onClick={() => { haptic('select'); toggle(s.id); }}
                        aria-pressed={isSelected}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
                            textAlign: 'left', padding: '0.875rem 1rem', cursor: 'pointer',
                            minHeight: '64px',
                            background: isSelected ? PZ.panel2 : '#10141C',
                            border: isSelected ? `2px solid ${PZ.volt}` : `2px solid ${PZ.border}`,
                            boxShadow: isSelected ? 'inset 0 0 24px rgba(203, 254, 28, 0.10)' : 'none',
                            clipPath: PZ.notchSm,
                            transition: 'border-color 0.15s, background 0.15s',
                            fontFamily: 'inherit',
                        }}
                    >
                        <img
                            src={s.avatarUrl}
                            alt=""
                            onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.id}`; }}
                            style={{
                                width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover',
                                border: `3px solid ${house.colorHex}`, flexShrink: 0,
                                opacity: isSelected ? 1 : 0.85,
                            }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                color: isSelected ? PZ.white : '#C6CBD4',
                                fontFamily: PZ.displayFont, textTransform: 'uppercase',
                                letterSpacing: '0.01em', fontSize: '0.9375rem',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {s.gamerTag || s.fullName}
                            </div>
                            <div style={{
                                color: PZ.muted, fontSize: '0.75rem', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '0.35rem',
                                whiteSpace: 'nowrap', overflow: 'hidden',
                            }}>
                                {house.customIcon && (
                                    <img src={house.customIcon} alt="" style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }} />
                                )}
                                <span style={{ color: house.colorHex }}>{house.name}</span>
                                <span>·</span>
                                <span style={{ color: isSelected ? PZ.volt : PZ.muted, fontWeight: 700 }}>
                                    {s.points.toLocaleString()} pts
                                </span>
                            </div>
                        </div>
                        <div
                            aria-hidden="true"
                            style={{
                                width: '26px', height: '26px', borderRadius: '3px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: isSelected ? PZ.volt : 'transparent',
                                border: isSelected ? `2px solid ${PZ.volt}` : `2px solid ${PZ.borderStrong}`,
                                color: PZ.bg,
                            }}
                        >
                            {isSelected ? <Ic.Check size={16} strokeWidth={3} /> : null}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

/* ── Style fragments shared by the game-center tabs (dark / Pubzi tokens) ──── */
export const pStyles: Record<string, React.CSSProperties> = {
    /* Notched panel — the signature cut-corner card */
    card: {
        background: PZ.panel,
        border: `1px solid ${PZ.border}`,
        clipPath: PZ.notch,
        padding: '1.25rem',
        position: 'relative', zIndex: 1,
    },
    /* "// LABEL" section tag — pair with className="pz-eyebrow" on a <div>.
     * (Kept as a fragment for margins; the class supplies the volt "// ".) */
    eyebrow: {
        margin: '0 0 0.875rem',
    },
    /* Days One screen/section title — pair with className="pz-display" */
    sectionTitle: {
        margin: '0 0 1rem', color: PZ.white, fontSize: '1.25rem', lineHeight: 1.2,
    },
    subTitle: {
        margin: '0 0 0.75rem', color: PZ.white, fontSize: '1rem', lineHeight: 1.2,
    },
    /* SIZING-ONLY — always pair with className="pz-btn" */
    btnPrimary: {
        border: 'none', cursor: 'pointer',
        fontSize: '0.875rem', padding: '0.875rem 1.25rem', minHeight: '52px',
    },
    /* SIZING-ONLY — always pair with className="pz-btn-ghost" */
    btnSecondary: {
        cursor: 'pointer',
        fontSize: '0.875rem', padding: '0.875rem 1.25rem', minHeight: '52px',
    },
    /* SIZING-ONLY — always pair with className="pz-btn" (hero CTA) */
    bigActionBtn: {
        width: '100%', border: 'none', cursor: 'pointer',
        fontSize: '1rem', padding: '1.125rem 1.25rem', minHeight: '56px',
    },
    input: {
        width: '100%', padding: '0.875rem 1rem', boxSizing: 'border-box',
        background: PZ.bg, border: `1.5px solid rgba(255, 255, 255, 0.12)`,
        borderRadius: '4px', color: PZ.white, fontSize: '1rem', outline: 'none',
        fontFamily: 'inherit',
    },
    label: {
        display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem',
        color: PZ.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em',
    },
    errorBox: {
        background: 'rgba(239, 68, 68, 0.10)', border: '1px solid rgba(248, 113, 113, 0.35)',
        borderLeft: '3px solid #ef4444',
        color: '#fca5a5', borderRadius: '4px',
        padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600,
    },
    /* Volt celebration box — success states */
    successBox: {
        background: PZ.voltFaint, border: `1px solid ${PZ.voltDim}`,
        borderLeft: `3px solid ${PZ.volt}`,
        color: PZ.volt, borderRadius: '4px',
        padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600,
    },
    mutedText: { color: PZ.muted, fontSize: '0.875rem', fontWeight: 500, margin: 0 },
    listRow: {
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.875rem 0', minHeight: '60px', boxSizing: 'border-box',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    },
    /* Volt points highlight */
    pointsPill: {
        display: 'inline-block', background: PZ.voltFaint, border: `1px solid ${PZ.voltDim}`,
        color: PZ.volt, borderRadius: '3px', padding: '0.2rem 0.6rem',
        fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
    },
    /* Dim inner panel (rows inside a card: partners, tasks, results) */
    innerPanel: {
        background: PZ.panel2, border: `1px solid ${PZ.border}`,
        clipPath: PZ.notchSm, padding: '0.875rem 1rem',
    },
};
