
import React, { useState } from 'react';
import { Student } from '../../types';
import { HOUSES } from '../../constants';
import { supabaseService } from '../../services/supabaseService';

interface BatchAwardFormProps {
  students: Student[];
  adminName: string;
  onSuccess: () => void;
}

const BatchAwardForm: React.FC<BatchAwardFormProps> = ({ students, adminName, onSuccess }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [points, setPoints] = useState<string>('10');
  const [loading, setLoading] = useState(false);
  const [filterHouse, setFilterHouse] = useState<string>('all');

  const toggle = (id: string) => {
    if (loading) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const filteredStudents = filterHouse === 'all'
    ? students
    : students.filter(s => s.houseId === filterHouse);

  const selectAll = () => {
    if (loading) return;
    const activeIds = filteredStudents.filter(s => s.isPresent).map(s => s.id);
    const allActiveSelected = activeIds.every(id => selected.has(id));

    if (allActiveSelected) {
      // Deselect filtered students only
      const next = new Set(selected);
      activeIds.forEach(id => next.delete(id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      activeIds.forEach(id => next.add(id));
      setSelected(next);
    }
  };

  const handleAward = async () => {
    if (selected.size === 0 || loading) return;
    const pts = parseInt(points || '0', 10);
    if (!pts || pts <= 0) {
      alert('Please enter a valid amount (> 0).');
      return;
    }
    const confirmMsg = `Award ${pts} points to ${selected.size} athletes?`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      await supabaseService.addBatchPoints(Array.from(selected), pts, 'Batch Reward', adminName);
      setSelected(new Set());
      onSuccess();
    } catch (error) {
      console.error("Batch Award Failed:", error);
      alert("Database award failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Quick select presets
  const pointPresets = [5, 10, 25, 50];

  return (
    <div className="space-y-4">
      {/* Header with Select All */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
            Select Athletes
          </h3>
          <p className="text-[10px] sm:text-xs text-slate-500">
            {selected.size} of {students.length} selected
          </p>
        </div>
        <button
          onClick={selectAll}
          disabled={loading || filteredStudents.length === 0}
          className="touch-btn text-[10px] sm:text-xs font-black text-brand-blue uppercase tracking-widest hover:underline disabled:opacity-30 px-3 py-2 bg-blue-50 rounded-lg"
        >
          {filteredStudents.filter(s => s.isPresent).every(s => selected.has(s.id)) ? 'Deselect All' : 'Select Active'}
        </button>
      </div>

      {/* House Filter Tabs */}
      <div className="mobile-scroll-x -mx-1 px-1">
        <button
          onClick={() => setFilterHouse('all')}
          className={`touch-btn px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
            filterHouse === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          All ({students.length})
        </button>
        {Object.values(HOUSES).map(house => {
          const count = students.filter(s => s.houseId === house.id).length;
          return (
            <button
              key={house.id}
              onClick={() => setFilterHouse(house.id)}
              className={`touch-btn px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                filterHouse === house.id ? 'text-white' : 'text-slate-600'
              }`}
              style={{
                backgroundColor: filterHouse === house.id ? house.colorHex : '#f1f5f9'
              }}
            >
              {house.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Athletes List - Mobile optimized */}
      <div className="h-[40vh] sm:h-56 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 custom-scrollbar space-y-1.5">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm italic">
            {students.length === 0 ? 'No athletes enrolled yet.' : 'No athletes in this house.'}
          </div>
        ) : (
          filteredStudents.map(s => (
            <div
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`
                touch-btn p-3 rounded-xl text-sm font-bold cursor-pointer transition-all flex justify-between items-center
                ${selected.has(s.id)
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'bg-white border border-slate-100 text-slate-700 active:bg-blue-50'}
                ${loading ? 'opacity-50 pointer-events-none' : ''}
                ${!s.isPresent ? 'opacity-60' : ''}
              `}
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  selected.has(s.id) ? 'bg-brand-blue border-white' : 'bg-white border-slate-300'
                }`}>
                  {selected.has(s.id) && <span className="text-white text-[10px]">✓</span>}
                </div>
                <img src={s.avatarUrl} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0" alt="" />
                <div className="min-w-0">
                  <span className="block truncate text-xs sm:text-sm">{s.fullName}</span>
                  {!s.isPresent && (
                    <span className="text-[8px] font-black text-slate-400">ABSENT</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`
                  text-[8px] sm:text-[9px] uppercase font-black px-2 py-1 rounded
                  ${selected.has(s.id) ? 'bg-white/20 text-white' : ''}
                `} style={{
                  backgroundColor: selected.has(s.id) ? 'transparent' : HOUSES[s.houseId].colorHex + '20',
                  color: selected.has(s.id) ? 'white' : HOUSES[s.houseId].colorHex
                }}>
                  {HOUSES[s.houseId].name}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Points Input Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
          Points to Award
        </label>

        {/* Quick Presets */}
        <div className="flex gap-2 flex-wrap">
          {pointPresets.map(preset => (
            <button
              key={preset}
              onClick={() => setPoints(String(preset))}
              disabled={loading}
              className={`touch-btn px-4 py-2 rounded-lg text-sm font-black transition-all ${
                points === String(preset)
                  ? 'bg-brand-blue text-white'
                  : 'bg-slate-100 text-slate-600 active:bg-slate-200'
              }`}
            >
              +{preset}
            </button>
          ))}
          <div className="flex items-center gap-2 flex-grow min-w-[100px] bg-slate-100 rounded-lg px-3">
            <input
              type="text"
              inputMode="numeric"
              value={points}
              disabled={loading}
              onChange={(e) => setPoints(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Custom"
              className="flex-grow bg-transparent font-black text-lg text-brand-blue outline-none text-center w-full py-2 disabled:opacity-50"
            />
            <span className="font-black text-slate-400 text-xs flex-shrink-0">PTS</span>
          </div>
        </div>
      </div>

      {/* Award Button */}
      <button
        onClick={handleAward}
        disabled={selected.size === 0 || loading || !parseInt(points || '0', 10)}
        className={`
          touch-btn w-full text-white font-black py-4 rounded-xl shadow-lg transition-all uppercase tracking-widest text-sm
          ${loading ? 'bg-slate-700 cursor-wait' : 'bg-slate-900 hover:bg-black active:scale-[0.98]'}
          ${(selected.size === 0 || !parseInt(points || '0', 10)) ? 'opacity-30' : ''}
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Awarding...
          </span>
        ) : selected.size > 0 ? (
          `⭐ Award ${points} pts to ${selected.size} Athlete${selected.size > 1 ? 's' : ''}`
        ) : (
          'Select Athletes to Award'
        )}
      </button>
    </div>
  );
};

export default BatchAwardForm;
