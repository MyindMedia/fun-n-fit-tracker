import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { supabaseService } from '../../services/supabaseService';
import { gameCenter } from '../../services/gameCenter';
import { Student } from '../../types';
import { Ic } from '../icons';

interface QRScannerProps {
  onClose: () => void;
  onStudentCheckedIn: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onClose, onStudentCheckedIn }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<Student | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<number | null>(null);

  const startScanner = async () => {
    try {
      setError(null);
      setIsScanning(true);

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device/browser');
      }

      console.log('📷 Requesting camera access...');

      // Request camera with mobile-optimized constraints
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Prefer back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Camera access granted!');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready before starting scan
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            console.log('▶️ Video playing, starting QR scan...');
            // Start scanning after video is ready
            scanIntervalRef.current = window.setInterval(() => {
              captureAndScan();
            }, 500);
          }).catch(err => {
            console.error('Video play error:', err);
            setError('Failed to start video. Please try again.');
            // Stop and release stream if play fails
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
      console.error('❌ Camera error:', err);
      setIsScanning(false);

      // Provide specific error messages
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is in use by another app. Please close other apps and try again.');
      } else if (err.name === 'OverconstrainedError') {
        setError('Camera does not support the required settings. Trying again...');
        // Try again with simpler constraints
        try {
          const simpleStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
          if (videoRef.current) {
            videoRef.current.srcObject = simpleStream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().then(() => {
                setError(null);
                setIsScanning(true);
                scanIntervalRef.current = window.setInterval(captureAndScan, 500);
              }).catch(playErr => {
                console.error('Fallback video play error:', playErr);
                setError('Failed to start video. Please try again.');
                simpleStream.getTracks().forEach(track => track.stop());
                setIsScanning(false);
              });
            };
          }
        } catch (fallbackErr) {
          setError('Camera access failed. Please try again.');
        }
      } else {
        setError(`Camera error: ${err.message || 'Please check permissions and try again.'}`);
      }
    }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for QR scanning
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Use jsQR to decode
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code) {
      try {
        const qrData = JSON.parse(code.data);
        if (qrData.type === 'CHECKIN' && qrData.id) {
          await handleManualCheckIn(qrData.id);
        } else {
          setError('Invalid QR code format');
        }
      } catch (err) {
        setError('Failed to read QR code');
      }
    }
  };

  const stopScanner = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    setIsScanning(false);
  };

  const handleManualCheckIn = async (studentId: string) => {
    try {
      const students = await supabaseService.getStudents();
      const student = students.find(s => s.id === studentId);

      if (student) {
        // Full check-in ledger flow (board, Roll Call, scan log, daily bonus),
        // not a raw presence flag — a pass scan is a real QR check-in. Absent
        // kids (including checked-out-earlier) flip back to present.
        await gameCenter.manualCheckIn(student.id, 'QR Scanner', 'QR');
        setLastScanned(student);
        setError(null);
        onStudentCheckedIn();

        // Clear after 2 seconds
        setTimeout(() => setLastScanned(null), 2000);
      } else {
        setError('Student not found');
      }
    } catch (err: any) {
      setError(err.message || 'Check-in failed');
    }
  };

  useEffect(() => {
    return () => stopScanner();
  }, []);

  return (
    <div className="pz-scope fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
      <div className="pz-card w-full max-w-2xl overflow-hidden">
        <div className="p-8 flex justify-between items-center" style={{ background: 'var(--pz-panel-2)', borderBottom: '1px solid var(--pz-border)' }}>
          <div>
            <div className="pz-eyebrow mb-1">Scanner Online</div>
            <h2 className="text-3xl text-white tracking-tight">QR Check-In</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-12 h-12 rounded-full bg-white/5 border border-white/10 hover:bg-[#CBFE1C] hover:text-[#0B0E13] flex items-center justify-center text-white/60 transition-all"
          >
            <Ic.XMark size={22} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {!isScanning ? (
            <div className="text-center space-y-6">
              <Ic.QrCode size={80} className="mx-auto text-[#CBFE1C] opacity-70" />
              <h3 className="text-2xl text-white">Ready to Scan</h3>
              <p className="font-medium" style={{ color: 'var(--pz-text)' }}>Students can scan their QR codes to check in instantly</p>
              <button
                onClick={startScanner}
                className="pz-btn min-h-[52px] px-12 py-5 text-xs transition-all active:scale-95 inline-flex items-center justify-center gap-2"
              >
                <Ic.Camera size={16} /> Start Camera Scanner
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative bg-black overflow-hidden aspect-video" style={{ border: '1px solid rgba(203, 254, 28, 0.25)' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Volt HUD targeting reticle */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 pointer-events-none"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(203, 254, 28, 0.55))' }}
                >
                  <span className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4" style={{ borderColor: 'var(--pz-volt)' }} />
                  <span className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4" style={{ borderColor: 'var(--pz-volt)' }} />
                  <span className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4" style={{ borderColor: 'var(--pz-volt)' }} />
                  <span className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4" style={{ borderColor: 'var(--pz-volt)' }} />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-0.5" style={{ background: 'var(--pz-volt)' }} />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3" style={{ background: 'var(--pz-volt)' }} />
                </div>
                <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                  <span className="pz-live w-2 h-2 rounded-full" style={{ background: 'var(--pz-volt)' }} />
                  <span className="text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: 'var(--pz-volt)' }}>Scanning</span>
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <button
                onClick={stopScanner}
                className="w-full min-h-[52px] bg-red-500 text-white px-8 py-4 font-black uppercase text-xs tracking-widest hover:bg-red-600 transition-all"
              >
                Stop Scanner
              </button>
            </div>
          )}

          {lastScanned && (
            <div className="bg-emerald-500/10 border-2 border-emerald-500 p-6 text-center animate-bounce-in">
              <Ic.CheckCircle size={44} className="mx-auto mb-3 text-emerald-400" />
              <h3 className="text-2xl text-white">{lastScanned.fullName}</h3>
              <p className="text-emerald-400 font-bold text-sm uppercase">Checked In Successfully!</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border-2 border-red-500 p-6 text-center">
              <Ic.XCircle size={44} className="mx-auto mb-3 text-red-400" />
              <p className="text-red-400 font-bold">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
