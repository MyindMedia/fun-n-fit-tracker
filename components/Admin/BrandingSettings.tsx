
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabaseService } from '../../services/supabaseService';
import { AppSettings, Rank, Trophy } from '../../types';
import { AudioService } from '../../utils/audio';

type EditingItem = (Partial<Rank> & { itemType: 'RANK' }) | (Partial<Trophy> & { itemType: 'TROPHY' }) | null;

const BrandingSettings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({});
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'logo' | 'sounds' | 'ranks' | 'trophies'>('logo');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [settingsData, ranksData, trophiesData] = await Promise.all([
      supabaseService.getSettings(),
      supabaseService.getRanks(),
      supabaseService.getTrophies()
    ]);
    setSettings(settingsData);
    setRanks(ranksData);
    setTrophies(trophiesData);
  };

  const handleUpload = async (file: File, key: string, rankId?: string) => {
    setLoading(true);
    try {
      const url = await supabaseService.uploadAsset(file, 'branding');
      if (url) {
        if (rankId) {
          await supabaseService.updateRankIcon(rankId, url);
          setRanks(prev => prev.map(r => r.id === rankId ? { ...r, icon: url } : r));
          alert("Rank icon updated!");
        } else {
          await supabaseService.updateSetting(key, url);
          setSettings(prev => ({ ...prev, [key]: url }));
          alert("Logo updated!");
        }
      }
    } catch (err) {
      console.error("Branding upload error:", err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = (type: 'RANK' | 'TROPHY') => {
    if (type === 'RANK') {
      setEditingItem({
        itemType: 'RANK',
        id: '',
        name: '',
        threshold: 0,
        icon: '',
        color: '#3b82f6',
        description: '',
        xpReward: 0,
        pointsRequired: 0,
        criteriaTasks: []
      });
    } else {
      setEditingItem({
        itemType: 'TROPHY',
        id: '',
        name: '',
        description: '',
        icon: '',
        xpReward: 100,
        pointsRequired: 500,
        criteriaTasks: [],
        color: '#fbbf24',
        isActive: true
      });
    }
    setShowForm(true);
  };

  const openEditForm = (item: Rank | Trophy, type: 'RANK' | 'TROPHY') => {
    if (type === 'RANK') {
      setEditingItem({ ...item, itemType: 'RANK' } as Partial<Rank> & { itemType: 'RANK' });
    } else {
      setEditingItem({ ...item, itemType: 'TROPHY' } as Partial<Trophy> & { itemType: 'TROPHY' });
    }
    setShowForm(true);
  };

  const handleSaveItem = async () => {
    if (!editingItem) return;
    setLoading(true);
    try {
      if (editingItem.itemType === 'RANK') {
        const rankData = {
          name: editingItem.name || '',
          threshold: editingItem.threshold || 0,
          icon: editingItem.icon || '',
          color: editingItem.color || '#3b82f6',
          description: editingItem.description || '',
          xpReward: editingItem.xpReward || 0,
          pointsRequired: editingItem.pointsRequired || editingItem.threshold || 0,
          criteriaTasks: editingItem.criteriaTasks || []
        };
        if (editingItem.id) {
          await supabaseService.updateRank(editingItem.id, rankData);
        } else {
          await supabaseService.createRank(rankData);
        }
      } else {
        const trophyData = {
          name: editingItem.name || '',
          description: editingItem.description || '',
          icon: editingItem.icon || '',
          xpReward: editingItem.xpReward || 0,
          pointsRequired: editingItem.pointsRequired || 0,
          criteriaTasks: editingItem.criteriaTasks || [],
          color: editingItem.color || '#fbbf24',
          isActive: editingItem.isActive ?? true
        };
        if (editingItem.id) {
          await supabaseService.updateTrophy(editingItem.id, trophyData);
        } else {
          await supabaseService.createTrophy(trophyData);
        }
      }
      await loadData();
      setShowForm(false);
      setEditingItem(null);
      alert(`${editingItem.itemType === 'RANK' ? 'Rank' : 'Trophy'} saved successfully!`);
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!editingItem || !editingItem.id) return;
    if (!window.confirm(`Delete this ${editingItem.itemType.toLowerCase()}? This cannot be undone.`)) return;

    setLoading(true);
    try {
      if (editingItem.itemType === 'RANK') {
        await supabaseService.deleteRank(editingItem.id);
      } else {
        await supabaseService.deleteTrophy(editingItem.id);
      }
      await loadData();
      setShowForm(false);
      setEditingItem(null);
      alert('Deleted successfully!');
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingItem) return;

    setLoading(true);
    try {
      const folder = editingItem.itemType === 'RANK' ? 'levels' : 'trophies';
      const url = await supabaseService.uploadAsset(file, folder);
      if (url) {
        setEditingItem({ ...editingItem, icon: url });
      }
    } catch (err) {
      console.error('Icon upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateCriteria = (index: number, value: string) => {
    if (!editingItem) return;
    const tasks = [...(editingItem.criteriaTasks || [])];
    tasks[index] = value;
    setEditingItem({ ...editingItem, criteriaTasks: tasks });
  };

  const addCriteria = () => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      criteriaTasks: [...(editingItem.criteriaTasks || []), '']
    });
  };

  const removeCriteria = (index: number) => {
    if (!editingItem) return;
    const tasks = [...(editingItem.criteriaTasks || [])];
    tasks.splice(index, 1);
    setEditingItem({ ...editingItem, criteriaTasks: tasks });
  };

  // Tab content components
  const LogoTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
        <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white rounded-2xl shadow-lg flex items-center justify-center p-4 border border-slate-200 overflow-hidden flex-shrink-0">
          <img
            src={settings.app_logo || 'https://odsyoxopcvtgxylmnapk.supabase.co/storage/v1/object/public/Assets/FNFLogo.png'}
            className="w-full h-full object-contain"
            alt="Academy Logo"
          />
        </div>
        <div className="flex-grow text-center sm:text-left">
          <h3 className="text-lg sm:text-xl font-black text-slate-800 mb-1">Primary Academy Logo</h3>
          <p className="text-xs sm:text-sm text-slate-500 mb-4">Appears on leaderboard, admin header, and reports.</p>
          <label className="touch-btn inline-block bg-brand-blue text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest cursor-pointer active:bg-blue-600 transition-all shadow-lg">
            {loading ? 'Processing...' : 'Upload New Logo'}
            <input
              type="file"
              className="hidden"
              disabled={loading}
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'app_logo')}
            />
          </label>
        </div>
      </div>
    </div>
  );

  const SoundsTab = () => (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 font-medium">Tap to preview each sound from the system.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => AudioService.playRandomAward()} className="touch-btn px-4 py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-emerald-500 text-white shadow-md active:bg-emerald-600 active:scale-[0.98] transition-all">
          🎵 Award Pop
        </button>
        <button onClick={() => AudioService.playPointLost()} className="touch-btn px-4 py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-red-500 text-white shadow-md active:bg-red-600 active:scale-[0.98] transition-all">
          🔻 Points Lost
        </button>
        <button onClick={() => AudioService.playGameStartAssetOnly()} className="touch-btn px-4 py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-indigo-500 text-white shadow-md active:bg-indigo-600 active:scale-[0.98] transition-all">
          🚀 Game Start
        </button>
        <button onClick={() => AudioService.playTenSecondCountdown()} className="touch-btn px-4 py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-orange-500 text-white shadow-md active:bg-orange-600 active:scale-[0.98] transition-all">
          ⏱️ Countdown
        </button>
        <button onClick={() => AudioService.playGameOverLogo()} className="touch-btn px-4 py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-slate-700 text-white shadow-md active:bg-slate-800 active:scale-[0.98] transition-all">
          🛑 Game Over
        </button>
        <button onClick={() => AudioService.playGameWinner()} className="touch-btn px-4 py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-blue-500 text-white shadow-md active:bg-blue-600 active:scale-[0.98] transition-all">
          🏆 Winner
        </button>
        <button onClick={() => AudioService.playLevelUp()} className="touch-btn px-4 py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-yellow-500 text-white shadow-md active:bg-yellow-600 active:scale-[0.98] transition-all">
          ⬆️ Level Up
        </button>
      </div>
    </div>
  );

  const RanksTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500 font-medium">{ranks.length} ranks configured</p>
        <button
          onClick={() => openCreateForm('RANK')}
          className="touch-btn px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-black uppercase active:bg-blue-600"
        >
          + New Rank
        </button>
      </div>

      <div className="space-y-2">
        {ranks.map(rank => (
          <div
            key={rank.id}
            onClick={() => openEditForm(rank, 'RANK')}
            className="touch-btn p-4 bg-white rounded-xl border border-slate-100 flex items-center gap-4 cursor-pointer active:bg-slate-50 transition-all"
          >
            <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
              {rank.icon ? (
                <img src={rank.icon} className="w-full h-full object-contain" alt="" />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-black"
                  style={{ backgroundColor: rank.color }}
                >
                  {rank.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-grow min-w-0">
              <div className="font-black text-sm text-slate-900">{rank.name}</div>
              <div className="text-[10px] text-slate-500">
                {rank.threshold.toLocaleString()} pts threshold
                {rank.xpReward ? ` • ${rank.xpReward} XP` : ''}
              </div>
            </div>
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: rank.color }}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const TrophiesTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500 font-medium">{trophies.length} trophies available</p>
        <button
          onClick={() => openCreateForm('TROPHY')}
          className="touch-btn px-4 py-2 bg-yellow-500 text-white rounded-xl text-xs font-black uppercase active:bg-yellow-600"
        >
          + New Trophy
        </button>
      </div>

      {trophies.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-4xl mb-2">🏆</div>
          <div className="text-sm font-medium">No trophies yet</div>
          <div className="text-xs">Create your first trophy above</div>
        </div>
      ) : (
        <div className="space-y-2">
          {trophies.map(trophy => (
            <div
              key={trophy.id}
              onClick={() => openEditForm(trophy, 'TROPHY')}
              className="touch-btn p-4 bg-white rounded-xl border border-slate-100 flex items-center gap-4 cursor-pointer active:bg-slate-50 transition-all"
            >
              <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                {trophy.icon ? (
                  <img src={trophy.icon} className="w-full h-full object-contain" alt="" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                    style={{ backgroundColor: trophy.color + '20' }}
                  >
                    🏆
                  </div>
                )}
              </div>
              <div className="flex-grow min-w-0">
                <div className="font-black text-sm text-slate-900">{trophy.name}</div>
                <div className="text-[10px] text-slate-500">
                  {trophy.pointsRequired.toLocaleString()} pts • {trophy.xpReward} XP
                </div>
              </div>
              <div className={`px-2 py-1 rounded text-[9px] font-black uppercase ${trophy.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                {trophy.isActive ? 'Active' : 'Hidden'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Edit/Create Form Modal
  const FormModal = () => {
    if (!showForm || !editingItem) return null;

    const isRank = editingItem.itemType === 'RANK';
    const isNew = !editingItem.id;

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex flex-col bg-black/50 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col bg-slate-50 w-full h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 flex-shrink-0">
            <button
              onClick={() => setShowForm(false)}
              className="touch-btn text-slate-500 font-bold text-sm px-2 py-1"
            >
              Cancel
            </button>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              {isNew ? 'Create' : 'Edit'} {isRank ? 'Rank' : 'Trophy'}
            </h2>
            <button
              onClick={handleSaveItem}
              disabled={loading || !editingItem.name}
              className="touch-btn text-brand-blue font-black text-sm px-2 py-1 disabled:opacity-30"
            >
              {loading ? '...' : 'Save'}
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-grow overflow-y-auto p-4 space-y-5 custom-scrollbar">
            {/* Icon Preview & Upload */}
            <div className="flex flex-col items-center">
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center mb-3 border-2 border-dashed border-slate-200 bg-white overflow-hidden"
                style={{ borderColor: editingItem.color }}
              >
                {editingItem.icon ? (
                  <img src={editingItem.icon} className="w-full h-full object-contain" alt="" />
                ) : (
                  <span className="text-4xl">{isRank ? '⭐' : '🏆'}</span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleIconUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="touch-btn text-xs font-black text-brand-blue uppercase"
              >
                {editingItem.icon ? 'Change Icon' : 'Upload Icon'}
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                Name *
              </label>
              <input
                type="text"
                value={editingItem.name || ''}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                placeholder={isRank ? "e.g. Elite" : "e.g. Champion's Cup"}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-brand-blue"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                Description
              </label>
              <textarea
                value={editingItem.description || ''}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                placeholder="Short description of this achievement..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:border-brand-blue resize-none"
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                Theme Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={editingItem.color || '#3b82f6'}
                  onChange={(e) => setEditingItem({ ...editingItem, color: e.target.value })}
                  className="w-12 h-12 rounded-xl border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={editingItem.color || '#3b82f6'}
                  onChange={(e) => setEditingItem({ ...editingItem, color: e.target.value })}
                  className="flex-grow px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-700 outline-none focus:border-brand-blue"
                />
              </div>
            </div>

            {/* Points Threshold (for Ranks) */}
            {isRank && (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Points Threshold
                </label>
                <input
                  type="number"
                  value={editingItem.threshold || 0}
                  onChange={(e) => setEditingItem({ ...editingItem, threshold: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-brand-blue"
                />
                <p className="text-[10px] text-slate-400 mt-1">Points needed to reach this rank</p>
              </div>
            )}

            {/* Points Required (for Trophies) */}
            {!isRank && (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Points Required
                </label>
                <input
                  type="number"
                  value={editingItem.pointsRequired || 0}
                  onChange={(e) => setEditingItem({ ...editingItem, pointsRequired: parseInt(e.target.value) || 0 })}
                  placeholder="500"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-brand-blue"
                />
              </div>
            )}

            {/* XP Reward */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                XP Reward
              </label>
              <input
                type="number"
                value={editingItem.xpReward || 0}
                onChange={(e) => setEditingItem({ ...editingItem, xpReward: parseInt(e.target.value) || 0 })}
                placeholder="100"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-brand-blue"
              />
              <p className="text-[10px] text-slate-400 mt-1">XP awarded when this is achieved</p>
            </div>

            {/* Criteria Tasks */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                Criteria Tasks
              </label>
              <div className="space-y-2">
                {(editingItem.criteriaTasks || []).map((task, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={task}
                      onChange={(e) => updateCriteria(idx, e.target.value)}
                      placeholder={`Task ${idx + 1}...`}
                      className="flex-grow px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:border-brand-blue"
                    />
                    <button
                      onClick={() => removeCriteria(idx)}
                      className="touch-btn w-8 h-8 rounded-lg bg-red-100 text-red-500 text-sm font-black flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addCriteria}
                className="touch-btn mt-2 text-xs font-black text-brand-blue uppercase"
              >
                + Add Criteria
              </button>
              <p className="text-[10px] text-slate-400 mt-1">Tasks/milestones to display for this achievement</p>
            </div>

            {/* Active Toggle (for Trophies) */}
            {!isRank && (
              <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100">
                <div>
                  <div className="font-black text-sm text-slate-900">Active</div>
                  <div className="text-[10px] text-slate-500">Show this trophy in the student portal</div>
                </div>
                <button
                  onClick={() => setEditingItem({ ...editingItem, isActive: !editingItem.isActive })}
                  className={`w-14 h-8 rounded-full transition-all ${editingItem.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${editingItem.isActive ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            )}

            {/* Delete Button (only for existing items) */}
            {!isNew && (
              <button
                onClick={handleDeleteItem}
                disabled={loading}
                className="touch-btn w-full py-4 rounded-xl bg-red-50 text-red-500 font-black text-xs uppercase tracking-widest border border-red-100 active:bg-red-100"
              >
                Delete {isRank ? 'Rank' : 'Trophy'}
              </button>
            )}

            {/* Extra padding at bottom for safe scrolling */}
            <div className="h-8" />
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <section className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg border border-slate-100">
      <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-4 uppercase tracking-tight">
        Academy Branding
      </h2>

      {/* Tab Navigation */}
      <div className="mobile-scroll-x -mx-4 px-4 mb-4">
        {[
          { id: 'logo', label: 'Logo', icon: '🎨' },
          { id: 'sounds', label: 'Sounds', icon: '🔊' },
          { id: 'ranks', label: 'Ranks', icon: '⭐' },
          { id: 'trophies', label: 'Trophies', icon: '🏆' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`touch-btn px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'logo' && <LogoTab />}
        {activeTab === 'sounds' && <SoundsTab />}
        {activeTab === 'ranks' && <RanksTab />}
        {activeTab === 'trophies' && <TrophiesTab />}
      </div>

      {/* Form Modal */}
      <FormModal />
    </section>
  );
};

export default BrandingSettings;
