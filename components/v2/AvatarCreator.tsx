import React, { useState, useEffect } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { Wearable, AvatarConfig } from '../../types';

interface AvatarCreatorProps {
  studentId: string;
  onClose: () => void;
  onSave?: () => void;
}

const AvatarCreator: React.FC<AvatarCreatorProps> = ({ studentId, onClose, onSave }) => {
  const [wearables, setWearables] = useState<Wearable[]>([]);
  const [config, setConfig] = useState<AvatarConfig>({});
  const [activeSlot, setActiveSlot] = useState<'BASE_FACE' | 'HAIRSTYLE' | 'TOP' | 'ACCESSORY'>('BASE_FACE');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [studentId]);

  const loadData = async () => {
    setLoading(true);
    const [allWearables, currentConfig] = await Promise.all([
      supabaseService.getWearables(),
      supabaseService.getStudentAvatar(studentId)
    ]);
    setWearables(allWearables);
    setConfig(currentConfig);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabaseService.saveStudentAvatar(studentId, config);
      if (onSave) onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save avatar:', error);
      alert('Failed to save avatar');
    } finally {
      setSaving(false);
    }
  };

  const getFilteredWearables = () => wearables.filter(w => w.slot === activeSlot);

  const updateConfig = (wearableId: string) => {
    const wearable = wearables.find(w => w.id === wearableId);
    if (!wearable) return;

    setConfig(prev => ({
      ...prev,
      [getSlotKey(wearable.slot)]: wearableId
    }));
  };

  const getSlotKey = (slot: string): keyof AvatarConfig => {
    switch (slot) {
      case 'BASE_FACE': return 'baseFaceId';
      case 'HAIRSTYLE': return 'hairstyleId';
      case 'TOP': return 'topId';
      case 'ACCESSORY': return 'accessoryId';
      default: return 'baseFaceId';
    }
  };

  // Helper to get the file path for a configured item
  const getAssetUrl = (wearableId?: string) => {
    if (!wearableId) return null;
    const w = wearables.find(x => x.id === wearableId);
    return w ? w.filePath : null;
  };

  if (loading) return <div className="pz-scope p-8 text-center text-[#ABABAB]">Loading Wardrobe...</div>;

  return (
    <div className="pz-scope flex flex-col h-full" style={{ background: 'var(--pz-bg)' }}>
      {/* Preview Area */}
      <div className="flex-grow relative flex items-center justify-center bg-gradient-to-b from-[#171C27] to-[#0B0E13] p-4 overflow-hidden">
        <div className="relative w-64 h-64 md:w-80 md:h-80">
          {/* Layers - Render order matters! Face -> Top -> Hair -> Accessory */}
          {getAssetUrl(config.baseFaceId) && (
            <img src={getAssetUrl(config.baseFaceId)!} className="absolute inset-0 w-full h-full object-contain z-10" alt="Face" />
          )}
          {getAssetUrl(config.topId) && (
            <img src={getAssetUrl(config.topId)!} className="absolute inset-0 w-full h-full object-contain z-20" alt="Top" />
          )}
          {getAssetUrl(config.hairstyleId) && (
            <img src={getAssetUrl(config.hairstyleId)!} className="absolute inset-0 w-full h-full object-contain z-30" alt="Hair" />
          )}
          {getAssetUrl(config.accessoryId) && (
            <img src={getAssetUrl(config.accessoryId)!} className="absolute inset-0 w-full h-full object-contain z-40" alt="Accessory" />
          )}

          {/* Fallback if no face selected */}
          {!config.baseFaceId && (
            <div className="absolute inset-0 flex items-center justify-center text-white/20 font-black text-2xl uppercase tracking-widest border-4 border-dashed border-white/15 rounded-full">
              No Face
            </div>
          )}
        </div>
      </div>

      {/* Controls Area */}
      <div className="border-t border-white/10 flex-shrink-0" style={{ background: 'var(--pz-panel)' }}>
        {/* Category Tabs */}
        <div className="flex overflow-x-auto border-b border-white/10 hide-scrollbar">
          {(['BASE_FACE', 'HAIRSTYLE', 'TOP', 'ACCESSORY'] as const).map(slot => (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={`flex-1 min-w-[80px] py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${
                activeSlot === slot ? 'text-[#CBFE1C] border-b-2 border-[#CBFE1C] bg-[#CBFE1C]/5' : 'text-[#ABABAB]'
              }`}
            >
              {slot.replace('BASE_', '').replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Item Grid */}
        <div className="p-4 h-48 overflow-y-auto grid grid-cols-4 gap-3">
          {getFilteredWearables().map(item => {
            const isSelected = Object.values(config).includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => updateConfig(item.id)}
                className={`aspect-square rounded-xl border-2 p-1 relative overflow-hidden transition-all bg-[#171C27] ${
                  isSelected ? 'border-[#CBFE1C] ring-2 ring-[#CBFE1C]/20' : 'border-white/10 hover:border-white/30'
                }`}
              >
                <img src={item.filePath} className="w-full h-full object-contain" alt={item.name} />
                {isSelected && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-[#CBFE1C] rounded-full" />
                )}
                {/* Rarity Indicator */}
                <div className={`absolute bottom-0 inset-x-0 h-1 ${
                  item.rarity === 'legendary' ? 'bg-yellow-400' :
                  item.rarity === 'epic' ? 'bg-purple-500' :
                  item.rarity === 'rare' ? 'bg-blue-400' :
                  item.rarity === 'uncommon' ? 'bg-green-400' : 'bg-white/20'
                }`} />
              </button>
            );
          })}
          {getFilteredWearables().length === 0 && (
            <div className="col-span-4 text-center py-8 text-[#ABABAB] text-xs">
              No items in this category yet.
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="p-4 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 pz-btn-ghost py-3 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 pz-btn py-3 text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Avatar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarCreator;
