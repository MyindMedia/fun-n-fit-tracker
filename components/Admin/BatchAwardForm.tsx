
import React, { useState } from 'react';
import { Student } from '../../types';
import { HOUSES } from '../../constants';
import { supabaseService } from '../../services/supabaseService';
import { Ic } from '../icons';

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
          <h3 className="text-sm sm:text-base text-white tracking-tight">
            Select Athletes
          </h3>
          <p className="text-[10px] sm:text-xs" style={{ color: 'var(--pz-text)' }}>
            {selected.size} of {students.length} selected
          </p>
        </div>
        <button
          onClick={selectAll}
          disabled={loading || filteredStudents.length === 0}
          className="touch-btn text-[10px] sm:text-xs font-black text-[#CBFE1C] uppercase tracking-widest hover:underline disabled:opacity-30 px-3 py-2 bg-[#CBFE1C]/10 border border-[#CBFE1C]/30 rounded-lg"
        >
          {filteredStudents.filter(s => s.isPresent).every(s => selected.has(s.id)) ? 'Deselect All' : 'Select Active'}
        </button>
      </div>

      {/* House Filter Tabs */}
      <div className="mobile-scroll-x -mx-1 px-1">
        <button
          onClick={() => setFilterHouse('all')}
          className={`touch-btn px-3 py-2 text-[10px] font-black uppercase transition-all ${
            filterHouse === 'all' ? 'bg-[#CBFE1C] text-[#0B0E13]' : 'bg-white/5 text-white/60 border border-white/10'
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
              className={`touch-btn px-3 py-2 text-[10px] font-black uppercase transition-all ${
                filterHouse === house.id ? 'text-white' : 'text-white/60 border border-white/10'
              }`}
              style={{
                backgroundColor: filterHouse === house.id ? house.colorHex : '#171C27'
              }}
            >
              {house.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Athletes List - Mobile optimized */}
      <div className="h-[40vh] sm:h-56 overflow-y-auto border border-white/10 p-2 custom-scrollbar space-y-1.5" style={{ background: 'var(--pz-panel)' }}>
        {filteredStudents.length === 0 ? (
          <div className="text-center py-10 text-sm italic" style={{ color: 'var(--pz-text)' }}>
            {students.length === 0 ? 'No athletes enrolled yet.' : 'No athletes in this house.'}
          </div>
        ) : (
          filteredStudents.map(s => (
            <div
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`
                touch-btn p-3 text-sm font-bold cursor-pointer transition-all flex justify-between items-center border
                ${selected.has(s.id)
                  ? 'bg-[#171C27] border-[#CBFE1C] text-white'
                  : 'bg-white/5 border-white/10 text-white/70 active:bg-white/10'}
                ${loading ? 'opacity-50 pointer-events-none' : ''}
                ${!s.isPresent ? 'opacity-60' : ''}
              `}
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  selected.has(s.id) ? 'bg-[#CBFE1C] border-[#CBFE1C]' : 'bg-transparent border-white/30'
                }`}>
                  {selected.has(s.id) && <Ic.Check size={12} className="text-[#0B0E13]" style={{ strokeWidth: 3 }} />}
                </div>
                <img src={s.avatarUrl} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0" alt="" />
                <div className="min-w-0">
                  <span className="block truncate text-xs sm:text-sm">{s.fullName}</span>
                  {!s.isPresent && (
                    <span className="text-[8px] font-black text-white/40">ABSENT</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[8px] sm:text-[9px] uppercase font-black px-2 py-1 rounded" style={{
                  backgroundColor: HOUSES[s.houseId].colorHex + '20',
                  color: HOUSES[s.houseId].colorHex
                }}>
                  {HOUSES[s.houseId].name}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Points Input Section */}
      <div className="pz-card-sm p-4 space-y-3">
        <label className="text-[10px] font-black uppercase tracking-widest block" style={{ color: 'var(--pz-text)' }}>
          Points to Award
        </label>

        {/* Quick Presets */}
        <div className="flex gap-2 flex-wrap">
          {pointPresets.map(preset => (
            <button
              key={preset}
              onClick={() => setPoints(String(preset))}
              disabled={loading}
              className={`touch-btn px-4 py-2 text-sm font-black transition-all ${
                points === String(preset)
                  ? 'bg-[#CBFE1C] text-[#0B0E13]'
                  : 'bg-white/5 text-white/60 border border-white/10 active:bg-white/10'
              }`}
            >
              +{preset}
            </button>
          ))}
          <div className="flex items-center gap-2 flex-grow min-w-[100px] bg-[#171C27] border border-white/10 px-3">
            <input
              type="text"
              inputMode="numeric"
              value={points}
              disabled={loading}
              onChange={(e) => setPoints(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Custom"
              className="flex-grow bg-transparent font-black text-lg text-[#CBFE1C] placeholder-white/30 outline-none text-center w-full py-2 disabled:opacity-50"
            />
            <span className="font-black text-white/40 text-xs flex-shrink-0">PTS</span>
          </div>
        </div>
      </div>

      {/* Award Button */}
      <button
        onClick={handleAward}
        disabled={selected.size === 0 || loading || !parseInt(points || '0', 10)}
        className={`
          touch-btn w-full min-h-[52px] font-black py-4 transition-all uppercase tracking-widest text-sm
          ${loading ? 'bg-white/10 text-white/50 cursor-wait' : 'pz-btn active:scale-[0.98]'}
          ${(selected.size === 0 || !parseInt(points || '0', 10)) ? 'opacity-30' : ''}
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Awarding...
          </span>
        ) : selected.size > 0 ? (
          <span className="flex items-center justify-center gap-2">
            <Ic.Star size={18} />
            {`Award ${points} pts to ${selected.size} Athlete${selected.size > 1 ? 's' : ''}`}
          </span>
        ) : (
          'Select Athletes to Award'
        )}
      </button>
    </div>
  );
};

export default BatchAwardForm;
