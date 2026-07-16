import React, { useMemo, useState } from 'react';
import { Student, HouseId } from '../../types';
import { HOUSES } from '../../constants';
import { supabaseService } from '../../services/supabaseService';
import { Ic } from '../icons';

interface RollCallPanelProps {
  students: Student[];
  adminName: string;
  onRefresh: () => void;
}

const RollCallPanel: React.FC<RollCallPanelProps> = ({ students, adminName, onRefresh }) => {
  const [houseFilter, setHouseFilter] = useState<HouseId | 'ALL'>('ALL');
  const [isBusy, setIsBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let result = students;
    if (houseFilter !== 'ALL') {
      result = result.filter(s => s.houseId === houseFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.fullName.toLowerCase().includes(q));
    }
    return result;
  }, [students, houseFilter, searchQuery]);

  const presentCount = filtered.filter(s => s.isPresent).length;
  const totalPresent = students.filter(s => s.isPresent).length;

  const setPresent = async (id: string, present: boolean) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await supabaseService.markPresent(id, present, adminName);
      onRefresh();
    } finally {
      setIsBusy(false);
    }
  };

  const markAll = async (present: boolean) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      for (const s of filtered) {
        await supabaseService.markPresent(s.id, present, adminName);
      }
      onRefresh();
    } finally {
      setIsBusy(false);
    }
  };

  const resetDay = async () => {
    if (isBusy) return;
    if (!window.confirm('Reset all athletes to inactive for a new day?')) return;
    setIsBusy(true);
    try {
      await supabaseService.resetDailyPresence(adminName);
      onRefresh();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="pz-card p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="pz-display text-2xl sm:text-3xl text-[#CBFE1C]">{totalPresent}/{students.length}</div>
            <div className="text-xs sm:text-sm font-bold" style={{ color: 'var(--pz-text)' }}>Athletes Present Today</div>
          </div>
          <Ic.ClipboardCheck size={44} className="text-[#CBFE1C] opacity-80" />
        </div>
      </div>

      {/* Search & Filter */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search athletes..."
            className="w-full min-h-[48px] px-4 py-3 pl-10 text-sm font-medium border border-white/10 bg-[#171C27] text-white placeholder-white/40 focus:outline-none focus:border-[#CBFE1C]"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"><Ic.Search size={16} /></span>
        </div>

        {/* House Filter Tabs */}
        <div className="mobile-scroll-x -mx-1 px-1">
          <button
            onClick={() => setHouseFilter('ALL')}
            className={`touch-btn px-3 py-2 text-[10px] font-black uppercase transition-all ${
              houseFilter === 'ALL' ? 'bg-[#CBFE1C] text-[#0B0E13]' : 'bg-white/5 text-white/60 border border-white/10'
            }`}
          >
            All ({students.length})
          </button>
          {Object.values(HOUSES).map(house => {
            const count = students.filter(s => s.houseId === house.id).length;
            return (
              <button
                key={house.id}
                onClick={() => setHouseFilter(house.id)}
                className={`touch-btn px-3 py-2 text-[10px] font-black uppercase transition-all ${
                  houseFilter === house.id ? 'text-white' : 'text-white/60 border border-white/10'
                }`}
                style={{
                  backgroundColor: houseFilter === house.id ? house.colorHex : '#171C27'
                }}
              >
                {house.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => markAll(true)}
          disabled={isBusy || filtered.length === 0}
          className={`touch-btn min-h-[48px] p-3 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
            isBusy ? 'bg-white/10 text-white/30' : 'bg-emerald-500 text-white active:bg-emerald-600'
          }`}
        >
          <Ic.Check size={14} /> All Present
        </button>
        <button
          onClick={() => markAll(false)}
          disabled={isBusy || filtered.length === 0}
          className={`touch-btn min-h-[48px] p-3 text-xs font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-1.5 ${
            isBusy ? 'bg-white/10 text-white/30 border-transparent' : 'bg-white/5 text-white border-white/10 active:bg-white/10'
          }`}
        >
          <Ic.XMark size={14} /> All Absent
        </button>
      </div>

      {/* Filtered Count */}
      <div className="text-xs font-bold px-1" style={{ color: 'var(--pz-text)' }}>
        Showing: {presentCount} present / {filtered.length} filtered
      </div>

      {/* Athletes List */}
      <div className="h-[45vh] sm:h-64 overflow-y-auto border border-white/10 custom-scrollbar" style={{ background: 'var(--pz-panel)' }}>
        {filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--pz-text)' }}>
            {searchQuery ? 'No athletes match your search' : 'No athletes found'}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(s => (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-3 transition-all ${
                  s.isPresent ? 'bg-emerald-500/10' : ''
                }`}
              >
                <img
                  src={s.avatarUrl}
                  className={`w-10 h-10 rounded-full border-2 object-cover flex-shrink-0 ${
                    s.isPresent ? 'border-emerald-400' : 'border-white/10 opacity-60'
                  }`}
                  alt=""
                />
                <div className="flex-grow min-w-0">
                  <div className={`font-bold text-sm truncate ${!s.isPresent ? 'text-white/40' : 'text-white'}`}>
                    {s.fullName}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: HOUSES[s.houseId].colorHex + '20',
                        color: HOUSES[s.houseId].colorHex
                      }}
                    >
                      {HOUSES[s.houseId].name}
                    </span>
                    <span className="text-[9px]" style={{ color: 'var(--pz-text)' }}>{s.points} pts</span>
                  </div>
                </div>
                <button
                  onClick={() => setPresent(s.id, !s.isPresent)}
                  disabled={isBusy}
                  className={`touch-btn px-4 py-2 text-[10px] font-black uppercase tracking-wide transition-all flex-shrink-0 inline-flex items-center gap-1 ${
                    s.isPresent
                      ? 'bg-emerald-500 text-white active:bg-emerald-600'
                      : 'bg-white/10 text-white/60 border border-white/10 active:bg-white/20'
                  } ${isBusy ? 'opacity-50' : ''}`}
                >
                  {s.isPresent ? <><Ic.Check size={12} /> Here</> : 'Absent'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset Button */}
      <button
        onClick={resetDay}
        disabled={isBusy}
        className={`touch-btn w-full min-h-[52px] px-6 py-4 text-xs font-black uppercase tracking-widest transition-all ${
          isBusy ? 'bg-white/10 text-white/30' : 'pz-btn'
        }`}
      >
        {isBusy ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Processing...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Ic.Refresh size={16} /> Reset For New Day
          </span>
        )}
      </button>
    </div>
  );
};

export default RollCallPanel;
