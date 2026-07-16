import React, { useMemo, useState } from 'react';
import { Student, HouseId } from '../../types';
import { HOUSES } from '../../constants';
import { supabaseService } from '../../services/supabaseService';

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
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl sm:text-3xl font-black">{totalPresent}/{students.length}</div>
            <div className="text-xs sm:text-sm font-bold opacity-80">Athletes Present Today</div>
          </div>
          <div className="text-4xl sm:text-5xl">📋</div>
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
            className="w-full px-4 py-3 pl-10 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:border-brand-blue bg-white"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </div>

        {/* House Filter Tabs */}
        <div className="mobile-scroll-x -mx-1 px-1">
          <button
            onClick={() => setHouseFilter('ALL')}
            className={`touch-btn px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
              houseFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
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
                className={`touch-btn px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                  houseFilter === house.id ? 'text-white' : 'text-slate-600'
                }`}
                style={{
                  backgroundColor: houseFilter === house.id ? house.colorHex : '#f1f5f9'
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
          className={`touch-btn p-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            isBusy ? 'bg-slate-200 text-slate-400' : 'bg-emerald-500 text-white active:bg-emerald-600'
          }`}
        >
          ✓ All Present
        </button>
        <button
          onClick={() => markAll(false)}
          disabled={isBusy || filtered.length === 0}
          className={`touch-btn p-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            isBusy ? 'bg-slate-200 text-slate-400' : 'bg-slate-700 text-white active:bg-slate-800'
          }`}
        >
          ✗ All Absent
        </button>
      </div>

      {/* Filtered Count */}
      <div className="text-xs font-bold text-slate-500 px-1">
        Showing: {presentCount} present / {filtered.length} filtered
      </div>

      {/* Athletes List */}
      <div className="h-[45vh] sm:h-64 overflow-y-auto border border-slate-200 rounded-xl bg-white custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            {searchQuery ? 'No athletes match your search' : 'No athletes found'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(s => (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-3 transition-all ${
                  s.isPresent ? 'bg-emerald-50/50' : ''
                }`}
              >
                <img
                  src={s.avatarUrl}
                  className={`w-10 h-10 rounded-full border-2 object-cover flex-shrink-0 ${
                    s.isPresent ? 'border-emerald-400' : 'border-slate-200 opacity-60'
                  }`}
                  alt=""
                />
                <div className="flex-grow min-w-0">
                  <div className={`font-bold text-sm truncate ${!s.isPresent ? 'text-slate-400' : ''}`}>
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
                    <span className="text-[9px] text-slate-400">{s.points} pts</span>
                  </div>
                </div>
                <button
                  onClick={() => setPresent(s.id, !s.isPresent)}
                  disabled={isBusy}
                  className={`touch-btn px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all flex-shrink-0 ${
                    s.isPresent
                      ? 'bg-emerald-500 text-white active:bg-emerald-600'
                      : 'bg-slate-200 text-slate-600 active:bg-slate-300'
                  } ${isBusy ? 'opacity-50' : ''}`}
                >
                  {s.isPresent ? '✓ Here' : 'Absent'}
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
        className={`touch-btn w-full px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
          isBusy ? 'bg-slate-200 text-slate-400' : 'bg-blue-500 text-white active:bg-blue-600'
        }`}
      >
        {isBusy ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Processing...
          </span>
        ) : (
          '🔄 Reset For New Day'
        )}
      </button>
    </div>
  );
};

export default RollCallPanel;
