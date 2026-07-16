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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Season Management</h2>
        <button 
          onClick={() => setShowCreate(true)}
          className="bg-brand-blue text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-blue-200"
        >
          + New Season
        </button>
      </div>

      {showCreate && (
        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm animate-fade-in">
          <h3 className="font-bold mb-3">Start New Season</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Season Name</label>
              <input 
                type="text" 
                value={newSeasonName}
                onChange={e => setNewSeasonName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50"
                placeholder="e.g. Winter 2024"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Start Date</label>
              <input 
                type="date" 
                value={newSeasonDate}
                onChange={e => setNewSeasonDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-slate-500 font-bold">Cancel</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-brand-green text-white rounded-xl font-bold">Launch Season</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {seasons.map(season => (
          <div key={season.id} className={`p-4 rounded-2xl border-2 flex items-center justify-between ${
            season.isActive ? 'border-brand-green bg-green-50/50' : 'border-slate-100 bg-white opacity-75'
          }`}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-black text-lg">{season.name}</h3>
                {season.isActive && <span className="bg-brand-green text-white text-[10px] px-2 py-0.5 rounded-full uppercase font-black">Active</span>}
                {!season.isActive && <span className="bg-slate-200 text-slate-500 text-[10px] px-2 py-0.5 rounded-full uppercase font-black">{season.status}</span>}
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Started: {new Date(season.startDate).toLocaleDateString()} 
                {season.endDate && ` • Ended: ${new Date(season.endDate).toLocaleDateString()}`}
              </div>
            </div>
            
            {season.isActive && (
              <button 
                onClick={() => handleEndSeason(season.id)}
                className="text-red-500 bg-red-50 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wide hover:bg-red-100"
              >
                End Season
              </button>
            )}
          </div>
        ))}
        {seasons.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-400">No seasons found. Create one to start tracking!</div>
        )}
      </div>
    </div>
  );
};

export default SeasonManager;
