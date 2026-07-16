import React, { useState, useEffect } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { Season } from '../../types';

const SeasonManager: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonDate, setNewSeasonDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSeasons();
  }, []);

  const loadSeasons = async () => {
    setLoading(true);
    const data = await supabaseService.getSeasons();
    setSeasons(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newSeasonName || !newSeasonDate) return;
    try {
      await supabaseService.createSeason(newSeasonName, newSeasonDate);
      setShowCreate(false);
      setNewSeasonName('');
      setNewSeasonDate('');
      loadSeasons();
    } catch (e) {
      console.error(e);
      alert('Failed to create season');
    }
  };

  const handleEndSeason = async (id: number) => {
    if (!window.confirm('Are you sure you want to END this season? This will archive current data.')) return;
    try {
      await supabaseService.endSeason(id);
      loadSeasons();
    } catch (e) {
      console.error(e);
      alert('Failed to end season');
    }
  };

  return (
    <div className="pz-scope space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl text-white uppercase tracking-tight">Season Management</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="pz-btn px-4 py-2 text-sm"
        >
          + New Season
        </button>
      </div>

      {showCreate && (
        <div className="pz-card p-4 animate-fade-in" style={{ borderColor: 'rgba(203, 254, 28, 0.35)' }}>
          <h3 className="text-white mb-3">Start New Season</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-[#ABABAB] uppercase mb-1">Season Name</label>
              <input
                type="text"
                value={newSeasonName}
                onChange={e => setNewSeasonName(e.target.value)}
                className="w-full p-3 rounded-xl border border-white/10 bg-[#171C27] text-white placeholder:text-white/30 outline-none focus:border-[#CBFE1C]"
                placeholder="e.g. Winter 2024"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#ABABAB] uppercase mb-1">Start Date</label>
              <input
                type="date"
                value={newSeasonDate}
                onChange={e => setNewSeasonDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-white/10 bg-[#171C27] text-white outline-none focus:border-[#CBFE1C]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-[#ABABAB] font-bold">Cancel</button>
            <button onClick={handleCreate} className="pz-btn px-4 py-2 text-sm">Launch Season</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {seasons.map(season => (
          <div key={season.id} className={`pz-card p-4 flex items-center justify-between ${
            season.isActive ? '' : 'opacity-60'
          }`} style={season.isActive ? { borderColor: 'rgba(203, 254, 28, 0.45)' } : undefined}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg text-white">{season.name}</h3>
                {season.isActive && <span className="bg-[#CBFE1C] text-[#0B0E13] text-[10px] px-2 py-0.5 rounded-full uppercase font-black">Active</span>}
                {!season.isActive && <span className="bg-white/10 text-[#ABABAB] text-[10px] px-2 py-0.5 rounded-full uppercase font-black">{season.status}</span>}
              </div>
              <div className="text-xs text-[#ABABAB] font-medium">
                Started: {new Date(season.startDate).toLocaleDateString()}
                {season.endDate && ` • Ended: ${new Date(season.endDate).toLocaleDateString()}`}
              </div>
            </div>

            {season.isActive && (
              <button
                onClick={() => handleEndSeason(season.id)}
                className="text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wide hover:bg-red-500/20"
              >
                End Season
              </button>
            )}
          </div>
        ))}
        {seasons.length === 0 && !loading && (
          <div className="text-center py-12 text-[#ABABAB]">No seasons found. Create one to start tracking!</div>
        )}
      </div>
    </div>
  );
};

export default SeasonManager;
