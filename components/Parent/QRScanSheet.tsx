// Full-screen camera QR scanner for the parent portal (getUserMedia + jsQR,
// same capture/cleanup pattern as components/Admin/QRScanner.tsx). Fires
// onScan with the raw decoded text on the first successful read.
import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';

interface QRScanSheetProps {
    title: string;
    hint: string;
    onScan: (text: string) => void;
    onClose: () => void;
}

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
        <div style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(15,23,42,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
        }}>
            <div style={{
                background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '480px',
                overflow: 'hidden', border: '1px solid #e2e8f0',
                boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
            }}>
                <div style={{
                    padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#f8fafc',
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 900, color: '#0f172a' }}>{title}</h2>
                    <button
                        onClick={() => { stopScanner(); onClose(); }}
                        style={{
                            width: '38px', height: '38px', borderRadius: '50%',
                            border: 'none', background: '#e2e8f0', color: '#475569',
                            fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <div style={{
                        position: 'relative', background: '#000', borderRadius: '16px',
                        overflow: 'hidden', aspectRatio: '4 / 3',
                    }}>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        {/* Scan target frame */}
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '60%', aspectRatio: '1 / 1',
                            border: '4px solid rgba(99,102,241,0.9)', borderRadius: '16px',
                            pointerEvents: 'none',
                        }} />
                        {!isScanning && !error && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                color: '#e2e8f0', fontWeight: 700, fontSize: '0.9375rem',
                            }}>
                                📷 Starting camera…
                            </div>
                        )}
                    </div>
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    <p style={{ margin: 0, textAlign: 'center', color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>
                        {hint}
                    </p>

                    {error && (
                        <div style={{
                            background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
                            borderRadius: '12px', padding: '0.875rem 1rem',
                            fontSize: '0.875rem', fontWeight: 600, textAlign: 'center',
                        }}>
                            ❌ {error}
                            <button
                                onClick={startScanner}
                                style={{
                                    display: 'block', margin: '0.6rem auto 0',
                                    background: '#4f46e5', color: '#fff', border: 'none',
                                    borderRadius: '10px', padding: '0.5rem 1.25rem',
                                    fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit',
                                }}
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => { stopScanner(); onClose(); }}
                        style={{
                            width: '100%', background: '#f1f5f9', border: '1px solid #e2e8f0',
                            color: '#0f172a', borderRadius: '12px', padding: '0.875rem',
                            fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QRScanSheet;
