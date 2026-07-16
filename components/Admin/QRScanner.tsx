import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { supabaseService } from '../../services/supabaseService';
import { Student } from '../../types';

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
        await supabaseService.markPresent(student.id, true);
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
    <div className="fixed inset-0 z-[300] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6">
      <div className="bg-white rounded-5xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-8 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-3xl font-display font-black tracking-tight uppercase">QR Check-In</h2>
          <button
            onClick={onClose}
            className="w-12 h-12 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 text-2xl font-black"
          >
            ✕
          </button>
        </div>

        <div className="p-8 space-y-6">
          {!isScanning ? (
            <div className="text-center space-y-6">
              <div className="text-8xl">📱</div>
              <h3 className="text-2xl font-black text-slate-900">Ready to Scan</h3>
              <p className="text-slate-500 font-medium">Students can scan their QR codes to check in instantly</p>
              <button
                onClick={startScanner}
                className="bg-brand-green text-white px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-emerald-600 transition-all active:scale-95"
              >
                📷 Start Camera Scanner
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative bg-black rounded-3xl overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-4 border-brand-green/50 rounded-3xl pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-brand-green rounded-2xl pointer-events-none" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <button
                onClick={stopScanner}
                className="w-full bg-red-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-600 transition-all"
              >
                Stop Scanner
              </button>
            </div>
          )}

          {lastScanned && (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-3xl p-6 text-center animate-bounce-in">
              <div className="text-5xl mb-3">✅</div>
              <h3 className="text-2xl font-black text-emerald-900">{lastScanned.fullName}</h3>
              <p className="text-emerald-600 font-bold text-sm uppercase">Checked In Successfully!</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-red-500 rounded-3xl p-6 text-center">
              <div className="text-5xl mb-3">❌</div>
              <p className="text-red-600 font-bold">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
