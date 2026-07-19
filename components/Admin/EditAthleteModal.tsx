
import React, { useState, useRef } from 'react';
import { Student, HouseId } from '../../types';
import { HOUSES } from '../../constants';
import { supabaseService } from '../../services/supabaseService';
import { AudioService } from '../../utils/audio';
import { Ic } from '../icons';
import { writeNfcBand, canWriteNfc } from '../useNfcWedge';

interface EditAthleteModalProps {
  student: Student;
  adminName: string;
  onClose: () => void;
  onRefresh: () => void;
}

// Quick-pick reasons for manual coach adjustments; the pick (or free text)
// becomes the transaction description shown in the Activity Log.
const REASON_CHIPS = ['Hustle', 'Teamwork', 'Effort', 'Listening', 'Leadership', 'Helping out', 'Game winner'];

const EditAthleteModal: React.FC<EditAthleteModalProps> = ({ student, adminName, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'INFO' | 'POINTS'>('INFO');
  const [name, setName] = useState(student.fullName);
  const [house, setHouse] = useState<HouseId>(student.houseId);
  const [gender, setGender] = useState<'Male' | 'Female'>(student.gender);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reasonChip, setReasonChip] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [nfcWriting, setNfcWriting] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<string>('');

  // Write this student's unique marker onto their NFC band so mobile readers
  // resolve them on check-in / timing taps. (Android Chrome only.)
  const writeBand = async () => {
    if (nfcWriting) return;
    setNfcStatus('');
    if (!canWriteNfc()) {
      setNfcStatus('This device can’t write NFC — use Android Chrome with NFC on.');
      return;
    }
    setNfcWriting(true);
    try {
      await writeNfcBand(`fnf:${student.id}`);
      setNfcStatus(`Band written for ${student.fullName.split(' ')[0]}. Tap it on a reader to check in.`);
      try { AudioService.playRandomAward(); } catch (e) { /* audio optional */ }
    } catch (e: any) {
      setNfcStatus(e?.message || 'Could not write the band. Hold the tag steady and retry.');
    } finally {
      setNfcWriting(false);
    }
  };

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdjustPoints = async (amount: number) => {
    // Untouched reason falls back to the default so a fast coach is never blocked.
    const reason = reasonText.trim() || reasonChip || '';
    const prefix = amount > 0 ? 'Coach award' : 'Coach deduction';
    const desc = reason ? `${prefix}: ${reason}` : prefix;
    await supabaseService.addPoints(student.id, amount, 'MANUAL', desc, adminName);
    onRefresh();
    try {
      if (amount > 0) AudioService.playRandomAward();
      else if (amount < 0) AudioService.playPointLost();
    } catch {}
    try {
      const msg = `${amount > 0 ? '+' + amount : amount} pts for ${student.fullName}`;
      window.dispatchEvent(new CustomEvent('coach-toast', { detail: { message: msg, amount } }));
    } catch {}
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await supabaseService.deleteStudent(student.id, adminName);
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to delete athlete:', err);
      alert('Failed to delete athlete. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pz-scope fixed inset-0 z-[300] bg-black/70 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-fade-in">
      <div className="pz-card w-full max-w-5xl h-full max-h-[85vh] overflow-hidden flex flex-col md:flex-row">

        <div className="w-full md:w-2/5 p-10 flex flex-col items-center shrink-0 overflow-y-auto custom-scrollbar" style={{ background: 'var(--pz-panel-2)', borderRight: '1px solid var(--pz-border)' }}>
           <div className="relative mb-10 group">
              <div className="w-48 h-48 md:w-64 md:h-64 rounded-full border-8 border-white/10 overflow-hidden relative bg-[#171C27]" style={{ boxShadow: 'inset 0 0 24px rgba(0, 0, 0, 0.5)' }}>
                 {capturedImage ? (
                   <img src={capturedImage} className="w-full h-full object-cover" />
                 ) : isCameraOpen ? (
                   <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                 ) : (
                   <img src={student.avatarUrl} className="w-full h-full object-cover" />
                 )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              {!isCameraOpen && !capturedImage && (
                <button
                  onClick={startCamera}
                  aria-label="Take new photo"
                  className="absolute bottom-4 right-4 pz-btn w-14 h-14 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                >
                  <Ic.Camera size={24} />
                </button>
              )}
           </div>

           <div className="w-full space-y-4">
              {isCameraOpen ? (
                <div className="flex gap-4">
                   <button onClick={capturePhoto} className="pz-btn flex-grow py-4 text-xs">Capture</button>
                   <button onClick={stopCamera} className="pz-btn-ghost px-6 py-4 text-xs">Cancel</button>
                </div>
              ) : capturedImage ? (
                <div className="flex gap-4">
                   <button onClick={() => setCapturedImage(null)} className="flex-grow bg-red-500 text-white py-4 font-black uppercase text-xs">Clear Photo</button>
                </div>
              ) : (
                <div className="text-center">
                   <h3 className="text-2xl text-white mb-1">{student.fullName}</h3>
                   <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>Athlete ID: {student.id.split('-')[0]}</p>
                </div>
              )}
           </div>

           <div className="mt-12 w-full pt-10 border-t border-white/10">
              <div className="p-6 border border-white/10 text-center" style={{ background: 'var(--pz-bg)' }}>
                 <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--pz-text)' }}>Current Points</div>
                 <div className="pz-display text-5xl text-[#CBFE1C]">{student.points.toLocaleString()}</div>
              </div>
           </div>
        </div>

        <div className="flex-grow flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--pz-panel)' }}>
           <div className="p-8 pb-0 flex justify-between items-center z-10" style={{ borderBottom: '1px solid var(--pz-border)' }}>
              <div className="flex gap-8">
                 <button onClick={() => setActiveTab('INFO')} className={`pb-6 px-2 font-black text-[10px] uppercase tracking-widest relative ${activeTab === 'INFO' ? 'text-[#CBFE1C]' : 'text-white/40'}`}>
                   Account Info
                   {activeTab === 'INFO' && <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'var(--pz-volt)' }} />}
                 </button>
                 <button onClick={() => setActiveTab('POINTS')} className={`pb-6 px-2 font-black text-[10px] uppercase tracking-widest relative ${activeTab === 'POINTS' ? 'text-[#CBFE1C]' : 'text-white/40'}`}>
                   Manual Points
                   {activeTab === 'POINTS' && <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'var(--pz-volt)' }} />}
                 </button>
              </div>
              <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 mb-4 shrink-0"><Ic.XMark size={22} /></button>
           </div>

           <div className="flex-grow overflow-y-auto p-10 custom-scrollbar min-h-0">
              {activeTab === 'INFO' && (
                <div className="space-y-10 animate-fade-in">
                   <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 block" style={{ color: 'var(--pz-text)' }}>Full Name</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-6 py-4 border border-white/10 bg-[#171C27] text-white font-black focus:border-[#CBFE1C] outline-none transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                         <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 block" style={{ color: 'var(--pz-text)' }}>House Assignment</label>
                            <select
                              value={house}
                              onChange={(e) => setHouse(e.target.value as HouseId)}
                              className="w-full px-6 py-4 border border-white/10 bg-[#171C27] text-white font-black outline-none cursor-pointer focus:border-[#CBFE1C]"
                            >
                               {Object.values(HOUSES).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                            </select>
                         </div>
                         <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 block" style={{ color: 'var(--pz-text)' }}>Gender</label>
                            <div className="flex gap-2">
                               <button onClick={() => setGender('Male')} className={`flex-grow py-4 border font-black text-[10px] uppercase transition-all ${gender === 'Male' ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:border-blue-400/50'}`}>Male</button>
                               <button onClick={() => setGender('Female')} className={`flex-grow py-4 border font-black text-[10px] uppercase transition-all ${gender === 'Female' ? 'bg-pink-500 border-pink-500 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:border-pink-400/50'}`}>Female</button>
                            </div>
                         </div>
                      </div>

                      <div>
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 block" style={{ color: 'var(--pz-text)' }}>NFC Band</label>
                         <div className="flex flex-wrap items-center gap-3">
                            <button
                              onClick={writeBand}
                              disabled={nfcWriting}
                              className="px-6 py-4 border border-white/10 bg-white/5 text-white font-black text-[10px] uppercase tracking-widest inline-flex items-center gap-2 hover:border-[#CBFE1C] disabled:opacity-50 transition-all"
                            >
                               <Ic.Nfc size={14} /> {nfcWriting ? 'Tap the band…' : 'Write to Band'}
                            </button>
                            <span className="text-[11px] flex-1 min-w-[10rem]" style={{ color: 'var(--pz-text)' }}>
                               Writes {name.split(' ')[0] || 'this athlete'}’s marker to their tag for check-ins &amp; timing on mobile readers.
                            </span>
                         </div>
                         {nfcStatus && <div className="mt-2 text-[11px] font-bold text-[#CBFE1C]">{nfcStatus}</div>}
                      </div>
                   </div>

                   <div className="pt-10 border-t border-white/10 flex justify-between gap-4 items-center">
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-6 py-4 font-black uppercase text-[10px] tracking-widest bg-red-500/10 text-red-400 border border-red-500/40 hover:bg-red-500 hover:text-white transition-all"
                      >
                        Delete Athlete
                      </button>
                      <button onClick={onClose} className="px-8 py-4 font-black uppercase text-[10px] tracking-widest text-white/40 hover:text-white transition-all">Discard</button>
                      <button
                        onClick={handleSaveInfo}
                        disabled={isSaving}
                        className="pz-btn px-10 py-4 text-[10px] disabled:opacity-50 transition-all"
                      >
                        {isSaving ? 'Syncing...' : 'Save Profile Updates'}
                      </button>
                   </div>
                </div>
              )}

              {activeTab === 'POINTS' && (
                <div className="space-y-12 animate-fade-in">
                   <div className="p-8 border border-white/10" style={{ background: 'var(--pz-panel-2)' }}>
                      <h4 className="text-xl text-[#CBFE1C] mb-2">Manual Point Override</h4>
                      <p className="text-xs font-medium" style={{ color: 'var(--pz-text)' }}>Use these presets to quickly adjust the athlete's point total outside of regular sessions.</p>
                   </div>

                   {/* Reason: quick chips + free text; optional, defaults to Coach award / Coach deduction */}
                   <div className="space-y-3">
                      <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>What is this for?</div>
                      <div className="flex gap-2 flex-wrap">
                         {REASON_CHIPS.map(chip => (
                           <button
                             key={chip}
                             onClick={() => setReasonChip(prev => (prev === chip ? null : chip))}
                             className={`px-3 py-2 text-[10px] font-black uppercase tracking-wide transition-all ${
                               reasonChip === chip
                                 ? 'bg-[#CBFE1C] text-[#0B0E13]'
                                 : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                             }`}
                           >
                             {chip}
                           </button>
                         ))}
                      </div>
                      <input
                        type="text"
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                        placeholder="Or type your own reason (optional)"
                        className="w-full px-4 py-3 border border-white/10 bg-[#171C27] text-white placeholder-white/40 font-bold focus:outline-none focus:border-[#CBFE1C]"
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-4">
                         <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Add Points</div>
                         <div className="grid grid-cols-2 gap-4">
                            {[10, 50, 100, 500].map(val => (
                              <button key={val} onClick={() => handleAdjustPoints(val)} className="py-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-lg hover:border-emerald-500 hover:bg-emerald-500/20 transition-all">+{val}</button>
                            ))}
                         </div>
                      </div>
                      <div className="space-y-4">
                         <div className="text-[10px] font-black text-red-400 uppercase tracking-widest">Deduct Points</div>
                         <div className="grid grid-cols-2 gap-4">
                            {[10, 50, 100, 500].map(val => (
                              <button key={val} onClick={() => handleAdjustPoints(-val)} className="py-6 bg-red-500/10 border border-red-500/30 text-red-400 font-black text-lg hover:border-red-500 hover:bg-red-500/20 transition-all">-{val}</button>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
              )}
           </div>
        </div>
      </div>
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="pz-card max-w-md w-full p-8">
            <div className="text-center mb-6">
              <Ic.Warning size={56} className="mx-auto mb-4 text-red-400" />
              <h3 className="text-2xl text-white mb-2">Delete Athlete</h3>
              <p className="text-sm" style={{ color: 'var(--pz-text)' }}>This cannot be undone. Remove {student.fullName} from the roster?</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="pz-btn-ghost flex-1 px-6 py-3 text-xs">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-6 py-3 bg-red-600 text-white font-black uppercase text-xs tracking-widest hover:bg-red-500 transition-all">Permanently Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditAthleteModal;
