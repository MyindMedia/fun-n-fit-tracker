// Full-screen camera QR scanner for the parent portal (getUserMedia + jsQR,
// same capture/cleanup pattern as components/Admin/QRScanner.tsx). Fires
// onScan with the raw decoded text on the first successful read.
// Pubzi skin: dark notched sheet + volt HUD targeting reticle over the camera.
import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { PZ, PzPortalCss, pStyles } from './shared';
import { Ic } from '../icons';

interface QRScanSheetProps {
    title: string;
    hint: string;
    onScan: (text: string) => void;
    onClose: () => void;
}

/* Volt corner brackets — the HUD targeting reticle over the camera feed */
const bracket = (pos: React.CSSProperties, borderWidth: string): React.CSSProperties => ({
    position: 'absolute', width: '34px', height: '34px',
    borderColor: PZ.volt, borderStyle: 'solid', borderWidth,
    pointerEvents: 'none', ...pos,
});

const Reticle: React.FC = () => (
    <div aria-hidden="true">
        <div style={bracket({ top: '12%', left: '12%' }, '3px 0 0 3px')} />
        <div style={bracket({ top: '12%', right: '12%' }, '3px 3px 0 0')} />
        <div style={bracket({ bottom: '12%', left: '12%' }, '0 0 3px 3px')} />
        <div style={bracket({ bottom: '12%', right: '12%' }, '0 3px 3px 0')} />
        <div className="pzp-scanline" />
    </div>
);

const QRScanSheet: React.FC<QRScanSheetProps> = ({ title, hint, onScan, onClose }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scanIntervalRef = useRef<number | null>(null);
    const firedRef = useRef(false);

    const stopScanner = () => {
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }
        setIsScanning(false);
    };

    const captureAndScan = () => {
        if (firedRef.current || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx || !video.videoWidth || !video.videoHeight) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
            firedRef.current = true;
            stopScanner();
            onScan(code.data);
        }
    };

    const startScanner = async () => {
        try {
            setError(null);
            setIsScanning(true);

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported on this device/browser');
            }

            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' }, // Prefer back camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play().then(() => {
                        scanIntervalRef.current = window.setInterval(captureAndScan, 500);
                    }).catch(() => {
                        setError('Failed to start video. Please try again.');
                        if (videoRef.current?.srcObject) {
                            const s = videoRef.current.srcObject as MediaStream;
                            s.getTracks().forEach(t => t.stop());
                            videoRef.current.srcObject = null;
                        }
                        setIsScanning(false);
                    });
                };
            }
        } catch (err: any) {
            setIsScanning(false);

            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('Camera permission denied. Please allow camera access in your browser settings.');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setError('No camera found on this device.');
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                setError('Camera is in use by another app. Please close other apps and try again.');
            } else if (err.name === 'OverconstrainedError') {
                // Retry with simpler constraints
                try {
                    const simpleStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    if (videoRef.current) {
                        videoRef.current.srcObject = simpleStream;
                        videoRef.current.onloadedmetadata = () => {
                            videoRef.current?.play().then(() => {
                                setError(null);
                                setIsScanning(true);
                                scanIntervalRef.current = window.setInterval(captureAndScan, 500);
                            }).catch(() => {
                                setError('Failed to start video. Please try again.');
                                simpleStream.getTracks().forEach(track => track.stop());
                                setIsScanning(false);
                            });
                        };
                    }
                } catch {
                    setError('Camera access failed. Please try again.');
                }
            } else {
                setError(`Camera error: ${err.message || 'Please check permissions and try again.'}`);
            }
        }
    };

    useEffect(() => {
        startScanner();
        return () => stopScanner();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="pz-scope" style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(6, 8, 12, 0.94)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
        }}>
            <PzPortalCss />
            <div style={{
                background: PZ.panel, width: '100%', maxWidth: '480px',
                border: `1px solid ${PZ.border}`, clipPath: PZ.notch,
            }}>
                <div style={{
                    padding: '1rem 1.25rem', borderBottom: `1px solid ${PZ.border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: '0.75rem',
                }}>
                    <h2 className="pz-display" style={{ margin: 0, fontSize: '1rem', color: PZ.white }}>{title}</h2>
                    <button
                        onClick={() => { stopScanner(); onClose(); }}
                        aria-label="Close scanner"
                        style={{
                            width: '44px', height: '44px', flexShrink: 0,
                            border: `1px solid ${PZ.borderStrong}`, borderRadius: '4px',
                            background: 'transparent', color: PZ.white,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'inherit',
                        }}
                    >
                        <Ic.XMark size={20} />
                    </button>
                </div>

                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <div style={{
                        position: 'relative', background: '#000',
                        overflow: 'hidden', aspectRatio: '4 / 3',
                        border: `1px solid ${PZ.border}`,
                    }}>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        {/* HUD targeting reticle */}
                        <Reticle />
                        {!isScanning && !error && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                color: PZ.white, fontWeight: 700, fontSize: '0.9375rem',
                            }}>
                                Starting camera…
                            </div>
                        )}
                    </div>
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    <p style={{ margin: 0, textAlign: 'center', color: PZ.muted, fontSize: '0.875rem', fontWeight: 600 }}>
                        {hint}
                    </p>

                    {error && (
                        <div style={{ ...pStyles.errorBox, textAlign: 'center' }}>
                            {error}
                            <button
                                onClick={startScanner}
                                className="pz-btn"
                                style={{
                                    display: 'block', margin: '0.75rem auto 0',
                                    border: 'none', cursor: 'pointer',
                                    padding: '0.65rem 1.5rem', minHeight: '44px',
                                    fontSize: '0.875rem',
                                }}
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => { stopScanner(); onClose(); }}
                        className="pz-btn-ghost"
                        style={{ ...pStyles.btnSecondary, width: '100%' }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QRScanSheet;
