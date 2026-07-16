// Full-screen kid check-in pass — the parent shows this QR at the front desk
// and staff scan it with the admin scanner. Payload matches what the admin
// scanner already reads: JSON.stringify({ id, name, type: 'CHECKIN' })
// (same contract as components/StudentProfileModal.tsx).
// The QR sits on a WHITE card for scan contrast against the dark portal.
import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Student } from '../../types';
import { HOUSES } from '../../constants';
import { PZ, PzPortalCss, pStyles } from './shared';
import { Ic } from '../icons';

interface KidPassSheetProps {
    student: Student;
    onClose: () => void;
}

const KidPassSheet: React.FC<KidPassSheetProps> = ({ student, onClose }) => {
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const house = HOUSES[student.houseId];

    useEffect(() => {
        let cancelled = false;
        // EXACT payload the admin check-in scanner expects — do not reshape.
        const payload = JSON.stringify({ id: student.id, name: student.fullName, type: 'CHECKIN' });
        QRCode.toDataURL(payload, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' },
        })
            .then(url => { if (!cancelled) setQrUrl(url); })
            .catch(() => { if (!cancelled) setError('Could not draw the pass — close and try again.'); });
        return () => { cancelled = true; };
    }, [student.id, student.fullName]);

    return (
        <div
            className="pz-scope"
            role="dialog"
            aria-modal="true"
            aria-label={`${student.fullName}'s check-in pass`}
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 400,
                background: 'rgba(6, 8, 12, 0.97)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '1rem',
                padding: 'calc(1rem + var(--safe-area-top, 0px)) 1rem calc(1rem + var(--safe-area-bottom, 0px))',
                overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            }}
        >
            <PzPortalCss />

            {/* White pass card — QR needs the contrast */}
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#FFFFFF',
                    width: 'min(80vw, 340px)',
                    clipPath: PZ.notch,
                    padding: '1.5rem 1.25rem 1.25rem',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                }}
            >
                {error ? (
                    <div style={{
                        color: '#b91c1c', fontWeight: 700, fontSize: '0.9375rem',
                        padding: '2.5rem 0.5rem',
                    }}>
                        {error}
                    </div>
                ) : qrUrl ? (
                    <img
                        src={qrUrl}
                        alt={`Check-in QR code for ${student.fullName}`}
                        style={{ width: '100%', maxWidth: '280px', height: 'auto', display: 'block', margin: '0 auto' }}
                    />
                ) : (
                    <div style={{
                        width: '100%', aspectRatio: '1 / 1', maxWidth: '280px', margin: '0 auto',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#667085', fontWeight: 700, fontSize: '0.875rem',
                    }}>
                        Drawing pass…
                    </div>
                )}

                {/* Kid name — Days One, dark on white */}
                <div className="pz-display" style={{
                    color: '#0B0E13', fontSize: '1.375rem', lineHeight: 1.15,
                    margin: '0.875rem 0 0.5rem', wordBreak: 'break-word',
                }}>
                    {student.fullName}
                </div>

                {/* House chip */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                    background: `${house.colorHex}18`, border: `1.5px solid ${house.colorHex}`,
                    color: house.colorHex, borderRadius: '3px',
                    padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                    {house.customIcon && (
                        <img src={house.customIcon} alt="" style={{ width: '15px', height: '15px', objectFit: 'contain' }} />
                    )}
                    {house.name} House
                </div>
            </div>

            {/* Hint */}
            <p
                onClick={e => e.stopPropagation()}
                style={{
                    margin: 0, color: PZ.muted, fontSize: '0.9375rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '0.45rem', textAlign: 'center',
                }}
            >
                <Ic.Scan size={18} style={{ flexShrink: 0 }} />
                Show this at the front desk
            </p>

            {/* Big close */}
            <button
                onClick={e => { e.stopPropagation(); onClose(); }}
                className="pz-btn"
                style={{
                    ...pStyles.btnPrimary,
                    width: 'min(80vw, 340px)', minHeight: '56px', fontSize: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
            >
                <Ic.XMark size={20} />
                Close
            </button>
        </div>
    );
};

export default KidPassSheet;
