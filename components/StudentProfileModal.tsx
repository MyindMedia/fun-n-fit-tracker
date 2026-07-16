
import React, { useState, useEffect, useRef } from 'react';
import { Student, Rank, Badge, Reward, HouseId } from '../types';
import { HOUSES } from '../constants';
import { GoogleGenAI } from "@google/genai";
import { supabaseService } from '../services/supabaseService';
import CelebrationOverlay, { Celebration } from './CelebrationOverlay';
import { AudioService } from '../utils/audio';
import QRCode from 'qrcode';
import { getStudentDisplayName } from '../utils/studentDisplay';

interface StudentProfileModalProps {
  student: Student;
  onClose: () => void;
  adminName?: string;
  onRefresh?: () => void;
  isAdminMode?: boolean;
}

const StudentProfileModal: React.FC<StudentProfileModalProps> = ({ student, onClose, adminName, onRefresh, isAdminMode = false }) => {
  const [activeTab, setActiveTab] = useState<'TROPHY' | 'SHOP' | 'PEPTALK' | 'QRCODE' | 'EDIT' | 'POINTS'>('TROPHY');
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Edit mode states
  const [name, setName] = useState(student.fullName);
  const [house, setHouse] = useState<HouseId>(student.houseId);
  const [gender, setGender] = useState<'Male' | 'Female'>(student.gender);
  const [selectedRankId, setSelectedRankId] = useState(student.rankId);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showRankConfirm, setShowRankConfirm] = useState(false);
  const [pendingRankId, setPendingRankId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentCelebration, setCurrentCelebration] = useState<Celebration | null>(null);
  const [customPoints, setCustomPoints] = useState<string>('');

  // Dynamic Data State
  const [availableBadges, setAvailableBadges] = useState<Badge[]>([]);
  const [availableRewards, setAvailableRewards] = useState<Reward[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);

  useEffect(() => {
    supabaseService.getBadges().then(setAvailableBadges);
    supabaseService.getRewards().then(setAvailableRewards);
    supabaseService.getRanks().then(setRanks);

    // Generate QR code for student check-in
    const generateQR = async () => {
      try {
        console.log('🔄 Generating QR code for student:', student.fullName, student.id);
        // Create QR code data with student ID
        const qrData = JSON.stringify({
          id: student.id,
          name: student.fullName,
          type: 'CHECKIN'
        });
        console.log('📊 QR Data:', qrData);
        const url = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        console.log('✅ QR Code generated successfully!');
        setQrCodeUrl(url);
      } catch (err) {
        console.error('❌ QR generation failed:', err);
        alert('Failed to generate QR code. Please refresh and try again.');
      }
    };

    generateQR();
  }, [student.id, student.fullName]);

  const currentRankIndex = ranks.findIndex(r => r.id === student.rankId);
  const currentRank = ranks[currentRankIndex] || ranks[0];
  const nextRank = ranks[currentRankIndex + 1] || null;
  
  const pointsToNext = nextRank ? nextRank.threshold - student.points : 0;
  // Fallback to 0 if ranks not loaded yet
  const progressPercent = (nextRank && currentRank)
    ? Math.min(100, Math.max(0, ((student.points - currentRank.threshold) / (nextRank.threshold - currentRank.threshold)) * 100))
    : 100;

  const earnedBadges = availableBadges.filter(b => student.badges?.includes(b.id));

  const getAiCoachFeedback = async () => {
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const prompt = `You are a high-energy youth fitness coach. 
      Analyze this athlete's stats and give them a short, 2-sentence pep talk:
      Name: ${student.fullName}
      Current Rank: ${currentRank?.name || 'Rookie'}
      Total Points: ${student.points}
      Points to next level: ${pointsToNext}
      Badges: ${earnedBadges.map(b => b.name).join(', ')}
      Keep it encouraging and very specific to their progress.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      setAiFeedback(response.text || "Keep pushing! You are doing great!");
    } catch (err) {
      setAiFeedback("Coach is currently unavailable, but he says: You're doing amazing! Keep at it!");
    }
    setIsAiLoading(false);
  };

  const handleRedeem = async (reward: Reward) => {
    setRedeemError(null);
    try {
      await supabaseService.redeemReward(student.id, reward.id);
      alert(`Redeemed ${reward.name}!`);
    } catch (err: any) {
      setRedeemError(err.message || "Failed to redeem reward.");
      setTimeout(() => setRedeemError(null), 3000);
    }
  };

  // Edit mode functions
  const startCamera = async () => {
    setIsCameraOpen(true);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 512, height: 512 }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error(err);
      alert("Camera failed to start.");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      canvasRef.current.width = 512;
      canvasRef.current.height = 512;
      ctx.drawImage(videoRef.current, 0, 0, 512, 512);
      setCapturedImage(canvasRef.current.toDataURL('image/jpeg', 0.8));
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
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

  const handleSaveInfo = async () => {
    setIsSaving(true);
    try {
      let finalAvatar = student.avatarUrl;
      if (capturedImage) {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        const uploadedUrl = await supabaseService.uploadAsset(blob, 'avatars');
        if (uploadedUrl) finalAvatar = uploadedUrl;
      }

      await supabaseService.updateStudent(student.id, {
        fullName: name,
        houseId: house,
        gender: gender,
        avatarUrl: finalAvatar
      });

      // If rank selection changed, trigger promotion via points and show celebration
      if (selectedRankId !== student.rankId) {
        const newRank = ranks.find(r => r.id === selectedRankId);
        if (newRank) {
          const pointsNeeded = Math.max(0, newRank.threshold - student.points);
          await supabaseService.addPoints(
            student.id,
            pointsNeeded,
            'MANUAL',
            `Promoted to ${newRank.name} rank`,
            adminName || 'System'
          );
          supabaseService.broadcastRankUp({
            type: 'RANK_UP',
            studentName: name,
            achievement: newRank.name,
            studentAvatar: finalAvatar,
            rankIcon: newRank.icon
          });
          try {
            const payload = {
              type: 'RANK_UP',
              studentName: name,
              achievement: newRank.name,
              studentAvatar: finalAvatar,
              rankIcon: newRank.icon,
              ts: Date.now()
            };
            localStorage.setItem('rank_up_event', JSON.stringify(payload));
            window.dispatchEvent(new CustomEvent('rank-up', { detail: payload }));
          } catch (err) {
            console.warn('Failed to broadcast rank-up event:', err);
          }
          setCurrentCelebration({
            type: 'RANK_UP',
            studentName: name,
            achievement: newRank.name,
            studentAvatar: finalAvatar,
            rankIcon: newRank.icon
          });
          AudioService.playCongratulations();
          // Allow overlay to play before closing
          setTimeout(() => { onClose(); }, 5500);
        } else {
          onClose();
        }
      } else {
        onClose();
      }

      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!adminName) return;
    try {
      await supabaseService.deleteStudent(student.id, adminName);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to delete athlete:', err);
      alert('Failed to delete athlete. Please try again.');
    }
  };

  const handleAdjustPoints = async (amount: number) => {
    if (!adminName) return;
    const desc = amount > 0 ? "Manual Coach Award" : "Manual Adjustment";
    await supabaseService.addPoints(student.id, amount, 'MANUAL', desc, adminName);
    if (onRefresh) onRefresh();
    try {
      if (amount > 0) AudioService.playRandomAward();
      else if (amount < 0) AudioService.playPointLost();
    } catch (err) {
      console.warn('Audio playback failed:', err);
    }
    try {
      const msg = `${amount > 0 ? '+' + amount : amount} pts for ${student.fullName}`;
      window.dispatchEvent(new CustomEvent('coach-toast', { detail: { message: msg, amount } }));
    } catch (err) {
      console.warn('Failed to dispatch toast event:', err);
    }
  };

  const handleRankChange = (newRankId: string) => {
    if (newRankId === student.rankId) return;
    setPendingRankId(newRankId);
    setShowRankConfirm(true);
  };

  const confirmRankChange = async () => {
    if (!pendingRankId || !adminName) return;

    setIsSaving(true);
    setShowRankConfirm(false);

    try {
      const newRank = ranks.find(r => r.id === pendingRankId);
      if (!newRank) {
        alert('Invalid rank selected');
        return;
      }

      const pointsNeeded = Math.max(0, newRank.threshold - student.points);
      await supabaseService.addPoints(
        student.id,
        pointsNeeded,
        'MANUAL',
        `Promoted to ${newRank.name} rank`,
        adminName
      );

      setSelectedRankId(newRank.id);
      if (onRefresh) onRefresh();
      alert(`Successfully promoted ${student.fullName} to ${newRank.name}!`);
    } catch (err) {
      console.error(err);
      alert('Failed to change rank. Please try again.');
    } finally {
      setIsSaving(false);
      setPendingRankId(null);
    }
  };

  if (ranks.length === 0) return null; // Wait for ranks to load

  const pendingRank = ranks.find(r => r.id === pendingRankId);
  const pointsToAward = pendingRank ? Math.max(0, pendingRank.threshold - student.points) : 0;

  return (
    <>
      <CelebrationOverlay celebration={currentCelebration} onDismiss={() => setCurrentCelebration(null)} />
      {/* Rank Change Confirmation Dialog */}
      {showRankConfirm && pendingRank && (
        <div className="fixed inset-0 z-[400] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 animate-bounce-in">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Confirm Rank Change</h3>
              <p className="text-slate-600 text-sm">
                Are you sure you want to promote <span className="font-black text-brand-blue">{student.fullName}</span> to <span className="font-black text-brand-blue">{pendingRank.name}</span>?
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Current Points:</span>
                <span className="font-black text-slate-900">{student.points}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">New Rank Threshold:</span>
                <span className="font-black text-slate-900">{pendingRank.threshold}</span>
              </div>
              {pointsToAward > 0 && (
                <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                  <span className="text-emerald-600 font-bold">Points to Award:</span>
                  <span className="font-black text-emerald-600">+{pointsToAward}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRankConfirm(false);
                  setPendingRankId(null);
                }}
                className="flex-1 px-6 py-4 rounded-2xl font-black uppercase text-xs text-slate-600 hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmRankChange}
                disabled={isSaving}
                className="flex-1 px-6 py-4 rounded-2xl font-black uppercase text-xs bg-brand-blue text-white hover:bg-blue-600 disabled:opacity-50 transition-all shadow-lg"
              >
                {isSaving ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-fade-in">
        <div className="bg-white rounded-4xl md:rounded-5xl w-full max-w-6xl h-full max-h-[90vh] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
        
        <div className="w-full md:w-1/3 bg-slate-50 p-6 md:p-12 flex flex-col items-center border-b md:border-b-0 md:border-r border-slate-200 shrink-0">
          <div className="relative mb-6 md:mb-10 group">
            <div className={`w-32 h-32 md:w-48 md:h-48 rounded-full border-4 md:border-8 border-white shadow-xl overflow-hidden relative bg-slate-200 ${student.inventory?.includes('r_aura') ? 'ring-4 md:ring-8 ring-yellow-400 animate-pulse' : ''}`}>
              {capturedImage ? (
                <img src={capturedImage} className="w-full h-full object-cover" />
              ) : isCameraOpen ? (
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
              ) : (
                <img src={student.avatarUrl} className="w-full h-full object-cover" />
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            {isAdminMode && !isCameraOpen && !capturedImage && (
              <>
                <button
                  onClick={startCamera}
                  className="absolute bottom-0 right-0 bg-brand-blue text-white w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
                >
                  📸
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 left-0 bg-emerald-500 text-white w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
                >
                  📁
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
          </div>

          {isAdminMode && isCameraOpen && (
            <div className="flex gap-2 mb-4 w-full">
              <button onClick={capturePhoto} className="flex-grow bg-brand-green text-white py-3 rounded-xl font-black uppercase text-[10px] shadow-lg">Capture</button>
              <button onClick={stopCamera} className="bg-white text-slate-500 px-4 py-3 rounded-xl font-black uppercase text-[10px] border border-slate-200">Cancel</button>
            </div>
          )}

          {isAdminMode && capturedImage && (
            <button onClick={() => setCapturedImage(null)} className="mb-4 bg-red-500 text-white py-3 px-6 rounded-xl font-black uppercase text-[10px] shadow-lg">Clear Photo</button>
          )}
          {(() => {
            const displayName = getStudentDisplayName(student);
            return (
              <>
                <h2 className="text-xl md:text-3xl font-display font-black text-slate-900 text-center leading-tight mb-1">
                  {displayName.primary} {student.inventory?.includes('r_shades') && '😎'}
                </h2>
                {displayName.secondary && (
                  <div className="text-slate-400 text-sm text-center mb-2 md:mb-3">{displayName.secondary}</div>
                )}
              </>
            );
          })()}
          <div className={`px-4 md:px-6 py-1 md:py-2 rounded-full font-black text-[10px] md:text-xs uppercase tracking-widest text-white shadow-md mb-6 md:mb-10`} style={{ backgroundColor: HOUSES[student.houseId].colorHex }}>
            {HOUSES[student.houseId].name} House
          </div>
          
          <div className="w-full space-y-4 md:space-y-6 hidden md:block">
             <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-4xl border border-slate-200 shadow-sm text-center">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Points</div>
                <div className="text-3xl md:text-5xl font-display font-black text-slate-900">{student.points.toLocaleString()}</div>
             </div>
             {nextRank && (
                <div className="space-y-2">
                   <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      <span>{currentRank.name}</span>
                      <span>{nextRank.name}</span>
                   </div>
                   <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-green transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                   </div>
                   <div className="text-center text-[10px] font-bold text-slate-400">{pointsToNext} pts to level up</div>
                </div>
             )}
          </div>
        </div>

        <div className="flex-grow flex flex-col min-h-0 overflow-hidden bg-white">
           <div className="p-4 md:p-8 pb-0 border-b flex justify-between items-center bg-white z-10">
              <div className="flex gap-2 md:gap-4 overflow-x-auto no-scrollbar pb-1">
                 <button onClick={() => setActiveTab('TROPHY')} className={`pb-3 md:pb-4 px-3 md:px-4 font-black text-[9px] md:text-[10px] uppercase tracking-widest relative whitespace-nowrap ${activeTab === 'TROPHY' ? 'text-brand-blue' : 'text-slate-400'}`}>Trophy Case</button>
                 <button onClick={() => setActiveTab('SHOP')} className={`pb-3 md:pb-4 px-3 md:px-4 font-black text-[9px] md:text-[10px] uppercase tracking-widest relative whitespace-nowrap ${activeTab === 'SHOP' ? 'text-brand-blue' : 'text-slate-400'}`}>Rewards Shop</button>
                 <button onClick={() => setActiveTab('PEPTALK')} className={`pb-3 md:pb-4 px-3 md:px-4 font-black text-[9px] md:text-[10px] uppercase tracking-widest relative whitespace-nowrap ${activeTab === 'PEPTALK' ? 'text-brand-blue' : 'text-slate-400'}`}>Coach Pep Talk</button>
                 <button onClick={() => setActiveTab('QRCODE')} className={`pb-3 md:pb-4 px-3 md:px-4 font-black text-[9px] md:text-[10px] uppercase tracking-widest relative whitespace-nowrap ${activeTab === 'QRCODE' ? 'text-brand-blue' : 'text-slate-400'}`}>📱 QR Code</button>
                 {isAdminMode && (
                   <>
                     <button onClick={() => setActiveTab('EDIT')} className={`pb-3 md:pb-4 px-3 md:px-4 font-black text-[9px] md:text-[10px] uppercase tracking-widest relative whitespace-nowrap ${activeTab === 'EDIT' ? 'text-brand-blue' : 'text-slate-400'}`}>✏️ Edit Info</button>
                     <button onClick={() => setActiveTab('POINTS')} className={`pb-3 md:pb-4 px-3 md:px-4 font-black text-[9px] md:text-[10px] uppercase tracking-widest relative whitespace-nowrap ${activeTab === 'POINTS' ? 'text-brand-blue' : 'text-slate-400'}`}>Manual Points</button>
                   </>
                 )}
              </div>
              <button onClick={onClose} className="text-slate-400 text-2xl md:text-3xl shrink-0 ml-4">✕</button>
           </div>
           
           <div className="flex-grow overflow-y-auto p-6 md:p-12 custom-scrollbar min-h-0">
              {activeTab === 'TROPHY' && (
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {earnedBadges.length === 0 ? (
                       <div className="col-span-3 text-center py-10 text-slate-400 italic">No badges earned yet. Keep training!</div>
                    ) : (
                       earnedBadges.map(b => (
                          <div key={b.id} className="p-4 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center gap-3">
                             <div className="text-4xl">{b.icon}</div>
                             <div>
                                <div className="font-black text-slate-800 text-xs uppercase mb-1">{b.name}</div>
                                <div className="text-[10px] text-slate-500 leading-tight">{b.description}</div>
                             </div>
                          </div>
                       ))
                    )}
                 </div>
              )}

              {activeTab === 'SHOP' && (
                 <div className="space-y-4">
                    {redeemError && <div className="bg-red-50 text-red-500 p-4 rounded-xl text-xs font-black uppercase text-center">{redeemError}</div>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {availableRewards.map(r => {
                          const canAfford = student.points >= r.cost;
                          const isOwned = student.inventory?.includes(r.id);
                          return (
                             <div key={r.id} className={`p-6 rounded-3xl border-2 flex items-center justify-between gap-4 transition-all ${isOwned ? 'bg-slate-100 border-slate-200 opacity-70' : 'bg-white border-slate-100'}`}>
                                <div className="flex items-center gap-4">
                                   <div className="text-3xl">{r.icon}</div>
                                   <div>
                                      <div className="font-black text-slate-900 text-sm">{r.name}</div>
                                      <div className="text-[10px] font-black text-brand-blue">{r.cost} PTS</div>
                                   </div>
                                </div>
                                {isOwned ? (
                                   <span className="text-[10px] font-black uppercase text-slate-400">Owned</span>
                                ) : (
                                   <button 
                                     onClick={() => handleRedeem(r)}
                                     disabled={!canAfford}
                                     className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${canAfford ? 'bg-brand-green text-white hover:bg-emerald-600' : 'bg-slate-200 text-slate-400'}`}
                                   >
                                     Buy
                                   </button>
                                )}
                             </div>
                          );
                       })}
                    </div>
                 </div>
              )}

              {activeTab === 'PEPTALK' && (
                 <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
                    <div className="text-6xl">🤖</div>
                    {isAiLoading ? (
                       <div className="text-slate-400 font-black uppercase tracking-widest animate-pulse">Consulting AI Coach...</div>
                    ) : aiFeedback ? (
                       <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 text-blue-900 text-lg font-medium leading-relaxed max-w-lg">
                          "{aiFeedback}"
                       </div>
                    ) : (
                       <div className="space-y-4">
                          <h3 className="text-2xl font-black text-slate-900">Need a boost?</h3>
                          <p className="text-slate-500">Get a personalized pep talk based on your recent performance.</p>
                          <button onClick={getAiCoachFeedback} className="bg-brand-blue text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-600 transition-all">
                             Generate Pep Talk
                          </button>
                       </div>
                    )}
                 </div>
              )}

              {activeTab === 'QRCODE' && (
                 <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                    <div className="text-6xl mb-4">📱</div>
                    <h3 className="text-3xl font-black text-slate-900 uppercase">Check-In QR Code</h3>
                    <p className="text-slate-500 font-medium max-w-md">Scan this code at the door to mark your attendance instantly!</p>

                    {qrCodeUrl ? (
                       <div className="bg-white p-8 rounded-3xl border-4 border-slate-200 shadow-xl">
                          <img src={qrCodeUrl} alt="Student QR Code" className="w-64 h-64" />
                       </div>
                    ) : (
                       <div className="bg-slate-100 p-8 rounded-3xl border-4 border-slate-200 shadow-xl">
                          <div className="w-64 h-64 flex items-center justify-center">
                             <div className="text-slate-400 font-black animate-pulse">Generating QR Code...</div>
                          </div>
                       </div>
                    )}

                    <div className="space-y-3 w-full max-w-sm">
                       <button
                          onClick={() => {
                            const printWindow = window.open('', '_blank');
                            if (printWindow) {
                              printWindow.document.write(`
                                <html>
                                  <head>
                                    <title>QR Code - ${student.fullName}</title>
                                    <style>
                                      body {
                                        display: flex;
                                        flex-direction: column;
                                        align-items: center;
                                        justify-content: center;
                                        height: 100vh;
                                        margin: 0;
                                        font-family: Arial, sans-serif;
                                        background: white;
                                      }
                                      .card {
                                        border: 4px solid #000;
                                        padding: 40px;
                                        text-align: center;
                                        background: white;
                                        border-radius: 20px;
                                      }
                                      h1 {
                                        font-size: 32px;
                                        margin: 0 0 10px 0;
                                        font-weight: 900;
                                        text-transform: uppercase;
                                      }
                                      .house {
                                        font-size: 18px;
                                        font-weight: bold;
                                        color: ${HOUSES[student.houseId].colorHex};
                                        margin-bottom: 20px;
                                      }
                                      img {
                                        width: 300px;
                                        height: 300px;
                                        margin: 20px 0;
                                      }
                                      .id {
                                        font-size: 14px;
                                        color: #666;
                                        margin-top: 10px;
                                      }
                                      @media print {
                                        body { background: white; }
                                      }
                                    </style>
                                  </head>
                                  <body>
                                    <div class="card">
                                      <h1>${student.fullName}</h1>
                                      <div class="house">${HOUSES[student.houseId].name} House</div>
                                      <img src="${qrCodeUrl}" alt="QR Code" />
                                      <div class="id">Student ID: ${student.id.slice(0, 8)}</div>
                                    </div>
                                  </body>
                                </html>
                              `);
                              printWindow.document.close();
                              setTimeout(() => printWindow.print(), 250);
                            }
                          }}
                          className="w-full bg-brand-blue text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-600 transition-all active:scale-95"
                       >
                          🖨️ Print QR Card
                       </button>

                       <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.download = `${student.fullName.replace(/\s+/g, '_')}_QR.png`;
                            link.href = qrCodeUrl;
                            link.click();
                          }}
                          className="w-full bg-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-300 transition-all active:scale-95"
                       >
                          💾 Download QR Code
                       </button>
                    </div>
                 </div>
              )}

              {activeTab === 'EDIT' && (
                <div className="space-y-10 animate-fade-in">
                   <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Full Name</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 bg-white !text-slate-900 font-black focus:border-brand-blue outline-none transition-all shadow-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">House Assignment</label>
                            <select
                              value={house}
                              onChange={(e) => setHouse(e.target.value as HouseId)}
                              className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 bg-white !text-slate-900 font-black outline-none cursor-pointer focus:border-brand-blue shadow-sm"
                            >
                               {Object.values(HOUSES).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                            </select>
                         </div>
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Gender</label>
                            <div className="flex gap-2">
                               <button onClick={() => setGender('Male')} className={`flex-grow py-4 rounded-xl border-2 font-black text-[10px] uppercase transition-all shadow-sm ${gender === 'Male' ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-200'}`}>Male</button>
                               <button onClick={() => setGender('Female')} className={`flex-grow py-4 rounded-xl border-2 font-black text-[10px] uppercase transition-all shadow-sm ${gender === 'Female' ? 'bg-pink-500 border-pink-500 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-pink-200'}`}>Female</button>
                            </div>
                         </div>
                      </div>

                      <div>
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Rank / Level</label>
                         <select
                           value={selectedRankId}
                           onChange={(e) => handleRankChange(e.target.value)}
                           className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 bg-white !text-slate-900 font-black outline-none cursor-pointer focus:border-brand-blue shadow-sm"
                         >
                            {ranks.map(r => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.threshold} pts)
                              </option>
                            ))}
                         </select>
                         <p className="text-[9px] text-slate-400 mt-2 font-medium">
                           Changing rank will automatically award points to reach the rank threshold
                         </p>
                      </div>
                   </div>

                   <div className="pt-10 border-t flex justify-between gap-4 items-center">
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100"
                      >
                        Delete Athlete
                      </button>
                      <div className="flex gap-4">
                        <button onClick={onClose} className="px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-600 transition-all">Discard</button>
                        <button
                          onClick={handleSaveInfo}
                          disabled={isSaving}
                          className="bg-brand-blue text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl hover:bg-blue-600 disabled:opacity-50 transition-all"
                        >
                          {isSaving ? 'Syncing...' : 'Save Profile Updates'}
                        </button>
                      </div>
                   </div>
                </div>
              )}

              {activeTab === 'POINTS' && (
                <div className="space-y-12 animate-fade-in">
                   <div className="bg-blue-50 p-8 rounded-4xl border border-blue-100">
                      <h4 className="text-xl font-display font-black text-brand-blue mb-2 uppercase">Manual Point Override</h4>
                      <p className="text-xs text-blue-600 font-medium">Use these presets to quickly adjust the athlete's point total outside of regular sessions.</p>
                   </div>

                  <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-4">
                         <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Add Points</div>
                         <div className="grid grid-cols-2 gap-4">
                            {[10, 50, 100, 500].map(val => (
                              <button key={val} onClick={() => handleAdjustPoints(val)} className="py-6 rounded-3xl bg-white border-2 border-emerald-100 text-emerald-600 font-black text-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all shadow-sm">+{val}</button>
                            ))}
                         </div>
                      </div>
                      <div className="space-y-4">
                         <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">Deduct Points</div>
                         <div className="grid grid-cols-2 gap-4">
                            {[10, 50, 100, 500].map(val => (
                              <button key={val} onClick={() => handleAdjustPoints(-val)} className="py-6 rounded-3xl bg-white border-2 border-red-100 text-red-600 font-black text-lg hover:border-red-500 hover:bg-red-50 transition-all shadow-sm">-{val}</button>
                            ))}
                         </div>
                     </div>
                  </div>
                  <div className="bg-white rounded-3xl border-2 border-slate-200 p-6">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Custom Amount</div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={customPoints}
                        onChange={(e) => setCustomPoints(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Points"
                        className="w-28 px-3 py-2 rounded-xl border-2 border-slate-300 font-black"
                      />
                      <button
                        onClick={() => { const v = parseInt(customPoints || '0', 10); if (v > 0) { handleAdjustPoints(v); setCustomPoints(''); } }}
                        disabled={!parseInt(customPoints || '0', 10)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black disabled:opacity-50"
                      >
                        Apply +
                      </button>
                      <button
                        onClick={() => { const v = parseInt(customPoints || '0', 10); if (v > 0) { handleAdjustPoints(-v); setCustomPoints(''); } }}
                        disabled={!parseInt(customPoints || '0', 10)}
                        className="px-4 py-2 rounded-xl bg-red-600 text-white font-black disabled:opacity-50"
                      >
                        Apply −
                      </button>
                    </div>
                  </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
    {showDeleteConfirm && (
      <div className="fixed inset-0 z-[400] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Delete Athlete</h3>
            <p className="text-slate-600 text-sm">This cannot be undone. Remove {student.fullName} from the roster?</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-black">Cancel</button>
            <button onClick={handleDelete} className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white font-black">Permanently Delete</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default StudentProfileModal;
