
import React, { useState, useRef } from 'react';
import { Student, HouseId } from '../../types';
import { HOUSES } from '../../constants';
import { supabaseService } from '../../services/supabaseService';
import { AudioService } from '../../utils/audio';

interface EditAthleteModalProps {
  student: Student;
  adminName: string;
  onClose: () => void;
  onRefresh: () => void;
}

const EditAthleteModal: React.FC<EditAthleteModalProps> = ({ student, adminName, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'INFO' | 'POINTS'>('INFO');
  const [name, setName] = useState(student.fullName);
  const [house, setHouse] = useState<HouseId>(student.houseId);
  const [gender, setGender] = useState<'Male' | 'Female'>(student.gender);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
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
    const desc = amount > 0 ? "Manual Coach Award" : "Manual Adjustment";
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
    <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-fade-in">
      <div className="bg-white rounded-5xl w-full max-w-5xl h-full max-h-[85vh] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
        
        <div className="w-full md:w-2/5 bg-slate-50 p-10 flex flex-col items-center border-b md:border-b-0 md:border-r border-slate-200 shrink-0 overflow-y-auto custom-scrollbar">
           <div className="relative mb-10 group">
              <div className="w-48 h-48 md:w-64 md:h-64 rounded-full border-8 border-white shadow-2xl overflow-hidden relative bg-slate-200">
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
                  className="absolute bottom-4 right-4 bg-brand-blue text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
                >
                  📸
                </button>
              )}
           </div>

           <div className="w-full space-y-4">
              {isCameraOpen ? (
                <div className="flex gap-4">
                   <button onClick={capturePhoto} className="flex-grow bg-brand-green text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg">Capture</button>
                   <button onClick={stopCamera} className="bg-white text-slate-500 px-6 py-4 rounded-2xl font-black uppercase text-xs border border-slate-200">Cancel</button>
                </div>
              ) : capturedImage ? (
                <div className="flex gap-4">
                   <button onClick={() => setCapturedImage(null)} className="flex-grow bg-red-500 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg">Clear Photo</button>
                </div>
              ) : (
                <div className="text-center">
                   <h3 className="text-2xl font-display font-black text-slate-900 mb-1">{student.fullName}</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Athlete ID: {student.id.split('-')[0]}</p>
                </div>
              )}
           </div>

           <div className="mt-12 w-full pt-10 border-t border-slate-200">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center shadow-sm">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Points</div>
                 <div className="text-5xl font-display font-black text-brand-blue">{student.points.toLocaleString()}</div>
              </div>
           </div>
        </div>

        <div className="flex-grow flex flex-col min-h-0 overflow-hidden bg-white">
           <div className="p-8 pb-0 border-b flex justify-between items-center bg-white z-10">
              <div className="flex gap-8">
                 <button onClick={() => setActiveTab('INFO')} className={`pb-6 px-2 font-black text-[10px] uppercase tracking-widest relative ${activeTab === 'INFO' ? 'text-brand-blue' : 'text-slate-400'}`}>
                   Account Info
                   {activeTab === 'INFO' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-blue rounded-full" />}
                 </button>
                 <button onClick={() => setActiveTab('POINTS')} className={`pb-6 px-2 font-black text-[10px] uppercase tracking-widest relative ${activeTab === 'POINTS' ? 'text-brand-blue' : 'text-slate-400'}`}>
                   Manual Points
                   {activeTab === 'POINTS' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-blue rounded-full" />}
                 </button>
              </div>
              <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 text-2xl mb-4 shrink-0">✕</button>
           </div>

           <div className="flex-grow overflow-y-auto p-10 custom-scrollbar min-h-0">
              {activeTab === 'INFO' && (
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
                   </div>

                   <div className="pt-10 border-t flex justify-between gap-4 items-center">
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100"
                      >
                        Delete Athlete
                      </button>
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
                </div>
              )}
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
    </div>
  );
};

export default EditAthleteModal;
