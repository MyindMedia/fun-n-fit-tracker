
import React, { useRef, useState } from 'react';
import { HouseId } from '../../types';
import { HOUSES } from '../../constants';
import { supabaseService } from '../../services/supabaseService';

interface EnrollAthleteFormProps {
  onSuccess: () => void;
}

const EnrollAthleteForm: React.FC<EnrollAthleteFormProps> = ({ onSuccess }) => {
  const [name, setName] = useState('');
  const [house, setHouse] = useState<HouseId>(HouseId.UNITY);
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    setIsCameraOpen(true);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 1280 }
        }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error(err);
      alert("Camera failed to start. Please check permissions.");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const TARGET_SIZE = 512;
      canvasRef.current.width = TARGET_SIZE;
      canvasRef.current.height = TARGET_SIZE;

      const video = videoRef.current;
      const minDim = Math.min(video.videoWidth, video.videoHeight);
      const sx = (video.videoWidth - minDim) / 2;
      const sy = (video.videoHeight - minDim) / 2;

      ctx.drawImage(
        video,
        sx, sy, minDim, minDim,
        0, 0, TARGET_SIZE, TARGET_SIZE
      );

      setCapturedImage(canvasRef.current.toDataURL('image/jpeg', 0.7));
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    setIsCameraOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEnroll = async () => {
    if (!name.trim()) {
      alert("Please enter athlete's full name.");
      return;
    }

    setUploading(true);
    try {
      let avatarUrl = undefined;

      if (capturedImage) {
        console.log('📸 Starting avatar upload...');
        try {
          const response = await fetch(capturedImage);
          const blob = await response.blob();
          console.log('📦 Blob created, size:', blob.size);

          avatarUrl = await supabaseService.uploadAsset(blob, 'avatars');

          if (avatarUrl) {
            console.log('✅ Avatar uploaded successfully:', avatarUrl);
          } else {
            console.error('❌ Upload returned null');
            alert('Warning: Photo upload failed. Student will be created with default avatar.');
          }
        } catch (photoErr) {
          console.error("❌ Storage upload failed:", photoErr);
          alert('Warning: Photo upload failed. Student will be created with default avatar.');
        }
      }

      console.log('👤 Creating student with avatarUrl:', avatarUrl);
      await supabaseService.addStudent({
        fullName: name.trim(),
        houseId: house,
        gender,
        avatarUrl: avatarUrl || '',
        isPresent: true,
      });
      console.log('✅ Student created successfully');

      setName('');
      setCapturedImage(null);
      setGender('Male');
      onSuccess();
      alert("Athlete enrolled successfully!" + (avatarUrl ? "" : "\n(Using default avatar)"));
    } catch (err: any) {
      console.error("❌ Enrollment Error:", err);
      alert(`Enrollment Failed: ${err.message || "Unknown database error"}.`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Avatar Section */}
      <div className="flex flex-col items-center">
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#171C27] border-4 border-white/10 mb-4 overflow-hidden relative">
          {capturedImage ? (
            <img src={capturedImage} className="w-full h-full object-cover" alt="Profile" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl sm:text-5xl bg-[#171C27] text-white/30">
              👤
            </div>
          )}
          {isCameraOpen && (
            <div className="absolute inset-0 z-10 bg-black">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {/* Photo Buttons */}
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {!isCameraOpen && !capturedImage && (
            <>
              <button
                onClick={startCamera}
                className="touch-btn w-full text-[10px] sm:text-xs font-black text-[#CBFE1C] bg-[#CBFE1C]/10 px-4 py-3 uppercase tracking-widest border border-[#CBFE1C]/30 active:bg-[#CBFE1C] active:text-[#0B0E13] transition-all"
              >
                📷 Take Profile Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="touch-btn w-full text-[10px] sm:text-xs font-black text-emerald-400 bg-emerald-500/10 px-4 py-3 uppercase tracking-widest border border-emerald-500/30 active:bg-emerald-500 active:text-white transition-all"
              >
                📁 Upload From Gallery
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </>
          )}
          {isCameraOpen && (
            <button
              onClick={capturePhoto}
              className="touch-btn pz-btn w-full py-4 text-xs active:scale-95 transition-all"
            >
              📸 Capture Photo
            </button>
          )}
          {capturedImage && (
            <button
              onClick={() => setCapturedImage(null)}
              className="touch-btn w-full text-[10px] sm:text-xs font-black text-red-400 bg-red-500/10 py-3 uppercase border border-red-500/30 active:bg-red-500 active:text-white transition-all"
            >
              🔄 Retake Photo
            </button>
          )}
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: 'var(--pz-text)' }}>
            Full Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Leo Smith"
            className="w-full px-4 py-4 border border-white/10 bg-[#171C27] text-sm font-bold text-white placeholder-white/40 outline-none focus:border-[#CBFE1C] transition-all"
          />
        </div>

        {/* Gender Selection */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: 'var(--pz-text)' }}>
            Gender
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setGender('Male')}
              className={`touch-btn py-4 border font-black text-xs uppercase transition-all flex items-center justify-center gap-2 ${
                gender === 'Male'
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-white/5 border-white/10 text-white/50 active:border-blue-400/50'
              }`}
            >
              <span className="text-lg">♂</span> Male
            </button>
            <button
              onClick={() => setGender('Female')}
              className={`touch-btn py-4 border font-black text-xs uppercase transition-all flex items-center justify-center gap-2 ${
                gender === 'Female'
                  ? 'bg-pink-500 border-pink-500 text-white'
                  : 'bg-white/5 border-white/10 text-white/50 active:border-pink-400/50'
              }`}
            >
              <span className="text-lg">♀</span> Female
            </button>
          </div>
        </div>

        {/* House Selection */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: 'var(--pz-text)' }}>
            House Assignment
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(HOUSES).map(h => (
              <button
                key={h.id}
                onClick={() => setHouse(h.id)}
                className={`touch-btn p-3 border-2 transition-all text-left ${
                  house === h.id
                    ? 'border-current'
                    : 'border-white/10 bg-white/5'
                }`}
                style={{
                  backgroundColor: house === h.id ? h.colorHex + '20' : undefined,
                  borderColor: house === h.id ? h.colorHex : undefined,
                  color: house === h.id ? h.colorHex : '#ABABAB'
                }}
              >
                <div className="flex items-center gap-2">
                  {h.customIcon && (
                    <img src={h.customIcon} className="w-6 h-6 object-contain" alt="" />
                  )}
                  <div>
                    <div className="text-xs font-black uppercase">{h.name}</div>
                    <div className="text-[9px] opacity-70">{h.mascot}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleEnroll}
          disabled={!name.trim() || uploading}
          className={`touch-btn w-full font-black py-4 uppercase tracking-widest transition-all text-sm ${
            uploading
              ? 'bg-white/20 text-white/60 cursor-not-allowed'
              : !name.trim()
              ? 'bg-white/10 text-white/30'
              : 'pz-btn active:scale-[0.98]'
          }`}
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Processing...
            </span>
          ) : (
            '✓ Complete Enrollment'
          )}
        </button>
      </div>
    </div>
  );
};

export default EnrollAthleteForm;
