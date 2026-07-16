import React, { useState, useEffect, useRef } from 'react';
import { Student, Rank, Trophy, HouseId, BlogPost, Wearable } from '../types';
import { HOUSES } from '../constants';
import { supabaseService } from '../services/supabaseService';
import AvatarCreator from './v2/AvatarCreator';
import PerkShop from './Student/PerkShop';
import GameCenterStats from './Student/GameCenterStats';
import { getStudentDisplayName } from '../utils/studentDisplay';

interface StudentPortalProps {
  student: Student;
  onClose: () => void;
  onRefresh?: () => void;
}

const StudentPortal: React.FC<StudentPortalProps> = ({ student, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'PROGRESS' | 'SHOP' | 'FRIENDS' | 'TEAM' | 'STORE' | 'NEWS'>('PROFILE');
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [friends, setFriends] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [teamStats, setTeamStats] = useState<{ totalPoints: number; memberCount: number; presentCount: number; topScorer: Student | null } | null>(null);

  // New V2 Data
  const [news, setNews] = useState<BlogPost[]>([]);
  const [wearables, setWearables] = useState<Wearable[]>([]);
  const [inventory, setInventory] = useState<string[]>([]);

  // Edit states
  const [gamerTag, setGamerTag] = useState(student.gamerTag || '');
  const [bio, setBio] = useState(student.bio || '');
  const [displayPreference, setDisplayPreference] = useState<'FULL_NAME' | 'GAMER_TAG' | 'INITIALS'>(student.displayPreference || 'FULL_NAME');
  const [isSaving, setIsSaving] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setGamerTag(student.gamerTag || '');
    setBio(student.bio || '');
    setDisplayPreference(student.displayPreference || 'FULL_NAME');
    loadData();
  }, [student]);

  const loadData = async () => {
    const [ranksData, trophiesData, friendsData, studentsData, statsData, newsData, wearablesData, inventoryData] = await Promise.all([
      supabaseService.getRanks(),
      supabaseService.getTrophies(),
      supabaseService.getFriends(student.id),
      supabaseService.getStudents(),
      supabaseService.getTeamStats(student.houseId),
      supabaseService.getBlogPosts(),
      supabaseService.getWearables(),
      supabaseService.getStudentInventory(student.id)
    ]);
    setRanks(ranksData);
    setTrophies(trophiesData.filter(t => t.isActive));
    setFriends(friendsData);
    setAllStudents(studentsData.filter(s => s.id !== student.id));
    setTeamStats(statsData);
    setNews(newsData);
    setWearables(wearablesData);
    setInventory(inventoryData);
  };

  const currentRankIndex = ranks.findIndex(r => r.id === student.rankId);
  const currentRank = ranks[currentRankIndex] || ranks[0];
  const nextRank = ranks[currentRankIndex + 1] || null;
  const progressPercent = (nextRank && currentRank)
    ? Math.min(100, Math.max(0, ((student.points - currentRank.threshold) / (nextRank.threshold - currentRank.threshold)) * 100))
    : 100;

  // Get display name - gamerTag is always primary if it exists
  const getProfileDisplayName = () => {
    // Use local state for gamerTag (reflects unsaved edits)
    if (gamerTag && gamerTag.trim()) {
      return { primary: gamerTag, secondary: student.fullName };
    }
    return { primary: student.fullName, secondary: undefined };
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    console.log('🎮 Saving profile for student:', student.id);
    console.log('🎮 GamerTag value:', gamerTag);
    console.log('🎮 Bio value:', bio);
    console.log('🎮 DisplayPreference:', displayPreference);
    try {
      await supabaseService.updateStudent(student.id, {
        gamerTag,
        bio,
        displayPreference
      });
      console.log('🎮 Save completed, calling onRefresh');
      if (onRefresh) onRefresh();
      alert('Profile saved!');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFriend = async (friendId: string) => {
    try {
      await supabaseService.addFriend(student.id, friendId);
      await loadData();
      setShowAddFriend(false);
      setSearchQuery('');
    } catch (err) {
      console.error('Add friend failed:', err);
      alert('Failed to add friend');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!window.confirm('Remove this friend?')) return;
    try {
      await supabaseService.removeFriend(student.id, friendId);
      await loadData();
    } catch (err) {
      console.error('Remove friend failed:', err);
    }
  };

  const filteredStudents = allStudents.filter(s =>
    !friends.some(f => f.id === s.id) &&
    (s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.gamerTag && s.gamerTag.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const handlePurchase = async (item: Wearable) => {
    if (!window.confirm(`Purchase ${item.name} for ${item.xpCost} points?`)) return;
    try {
      await supabaseService.purchaseWearable(student.id, item.id, item.xpCost);
      await loadData();
      if (onRefresh) onRefresh();
      alert('Purchased successfully!');
    } catch (err: any) {
      alert(err.userMessage || 'Purchase failed');
    }
  };

  if (showAvatarCreator) {
    return (
      <div className="fixed inset-0 z-[250] bg-white animate-fade-in">
        <AvatarCreator
          studentId={student.id}
          onClose={() => setShowAvatarCreator(false)}
          onSave={() => {
            if (onRefresh) onRefresh();
          }}
        />
      </div>
    );
  }

  // Tab Components
  const renderProfileTab = () => (
    <div className="space-y-5">
      {/* Avatar & Name Display */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-2xl border border-slate-100">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <img
            src={student.avatarUrl}
            onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.id}`; }}
            className="w-32 h-32 rounded-full border-4 object-cover flex-shrink-0"
            style={{ borderColor: HOUSES[student.houseId].colorHex }}
            alt=""
          />
          <div className="min-w-0 flex flex-col justify-center h-full">
            {(() => {
              const displayName = getProfileDisplayName();
              return (
                <>
                  <div className="font-black text-2xl text-slate-900 truncate">{displayName.primary}</div>
                  {displayName.secondary && (
                    <div className="text-slate-400 text-base truncate">{displayName.secondary}</div>
                  )}
                </>
              );
            })()}
            <div className="mt-2">
              <div
                className="text-sm font-black uppercase px-3 py-1.5 rounded inline-block"
                style={{ backgroundColor: HOUSES[student.houseId].colorHex + '20', color: HOUSES[student.houseId].colorHex }}
              >
                {HOUSES[student.houseId].name}
              </div>
            </div>
          </div>
        </div>

        {/* Large Team Logo on the right */}
        <div className="flex items-center justify-end">
          {HOUSES[student.houseId].customIcon ? (
            <img src={HOUSES[student.houseId].customIcon} className="w-64 h-64 object-contain" alt={HOUSES[student.houseId].name} />
          ) : (
            <span className="text-9xl leading-none">{HOUSES[student.houseId].mascot}</span>
          )}
        </div>
      </div>

      {/* Gamer Tag */}
      <div>
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
          Gamer Tag
        </label>
        <input
          type="text"
          value={gamerTag}
          onChange={(e) => setGamerTag(e.target.value)}
          placeholder="Enter your gamer tag..."
          maxLength={20}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-brand-blue"
        />
        <p className="text-[10px] text-slate-400 mt-1">This name can be shown on leaderboards</p>
      </div>

      {/* Display Preference */}
      <div>
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
          Display Name On Leaderboard
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'FULL_NAME', label: 'Full Name', preview: student.fullName },
            { id: 'GAMER_TAG', label: 'Gamer Tag', preview: gamerTag || 'Set tag first' },
            { id: 'INITIALS', label: 'Initials', preview: student.fullName.split(' ').map(n => n[0]).join('').toUpperCase() }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setDisplayPreference(opt.id as any)}
              disabled={opt.id === 'GAMER_TAG' && !gamerTag}
              className={`touch-btn p-3 rounded-xl border-2 text-center transition-all ${displayPreference === opt.id
                ? 'border-brand-blue bg-blue-50 text-brand-blue'
                : 'border-slate-100 bg-white text-slate-600'
                } ${opt.id === 'GAMER_TAG' && !gamerTag ? 'opacity-40' : ''}`}
            >
              <div className="text-[10px] font-black uppercase tracking-wide">{opt.label}</div>
              <div className="text-sm font-bold truncate mt-2">{opt.preview}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Bio */}
      <div>
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell us about yourself..."
          maxLength={150}
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:border-brand-blue resize-none"
        />
        <div className="text-right text-[10px] text-slate-400">{bio.length}/150</div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSaveProfile}
        disabled={isSaving}
        className={`touch-btn w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${isSaving ? 'bg-slate-300 text-slate-500' : 'bg-brand-blue text-white active:bg-blue-600'
          }`}
      >
        {isSaving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  );

  const renderProgressTab = () => (
    <div className="space-y-5">
      {/* Points & Rank Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4 mb-4">
          {currentRank?.icon && (
            <img src={currentRank.icon} className="w-16 h-16 object-contain" alt="" />
          )}
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Current Rank</div>
            <div className="text-2xl font-black">{currentRank?.name || 'Rookie'}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-black">{student.points.toLocaleString()}</div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Total Points</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-black">{student.totalXp || 0}</div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Total XP</div>
          </div>
        </div>

        {nextRank && (
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
              <span>{currentRank?.name}</span>
              <span>{nextRank.name}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-center text-xs font-bold text-slate-400">
              {nextRank.threshold - student.points} pts to level up
            </div>
          </div>
        )}
      </div>

      {/* Game Center stats */}
      <GameCenterStats studentId={student.id} />

      {/* Badges */}
      <div>
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3">Badges Earned</h3>
        {student.badges?.length ? (
          <div className="grid grid-cols-4 gap-2">
            {student.badges.map(badgeId => (
              <div key={badgeId} className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                <div className="text-2xl mb-1">🏅</div>
                <div className="text-[9px] font-black text-slate-500 uppercase truncate">{badgeId}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm">No badges yet. Keep training!</div>
        )}
      </div>

      {/* Available Trophies */}
      <div>
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3">Trophies To Earn</h3>
        {trophies.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No trophies available</div>
        ) : (
          <div className="space-y-2">
            {trophies.map(trophy => {
              const progress = Math.min(100, (student.points / trophy.pointsRequired) * 100);
              return (
                <div key={trophy.id} className="bg-white rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-3 mb-2">
                    {trophy.icon ? (
                      <img src={trophy.icon} className="w-10 h-10 object-contain" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-xl">🏆</div>
                    )}
                    <div className="flex-grow min-w-0">
                      <div className="font-black text-sm text-slate-900">{trophy.name}</div>
                      <div className="text-[10px] text-slate-500">{trophy.pointsRequired.toLocaleString()} pts • {trophy.xpReward} XP</div>
                    </div>
                    <div className="text-xs font-black text-slate-400">{Math.round(progress)}%</div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderFriendsTab = () => (
    <div className="space-y-4">
      {/* Add Friend Button */}
      <button
        onClick={() => setShowAddFriend(true)}
        className="touch-btn w-full py-3 rounded-xl bg-brand-blue text-white font-black text-xs uppercase tracking-widest"
      >
        + Add Friend
      </button>

      {/* Friends List */}
      <div>
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3">
          My Friends ({friends.length})
        </h3>
        {friends.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">👥</div>
            <div className="text-sm font-medium">No friends yet</div>
            <div className="text-xs">Add friends to see their progress!</div>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map(friend => {
              const friendDisplayName = getStudentDisplayName(friend);
              return (
                <div key={friend.id} className="bg-white rounded-xl p-4 border border-slate-100 flex items-center gap-3">
                  <img
                    src={friend.avatarUrl}
                    className="w-12 h-12 rounded-full border-2 object-cover flex-shrink-0"
                    style={{ borderColor: HOUSES[friend.houseId].colorHex }}
                    alt=""
                  />
                  <div className="flex-grow min-w-0">
                    <div className="font-black text-sm text-slate-900 truncate">
                      {friendDisplayName.primary}
                    </div>
                    {friendDisplayName.secondary && (
                      <div className="text-[10px] text-slate-400 truncate">{friendDisplayName.secondary}</div>
                    )}
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: HOUSES[friend.houseId].colorHex + '20', color: HOUSES[friend.houseId].colorHex }}
                      >
                        {HOUSES[friend.houseId].name}
                      </span>
                      <span className="text-[10px] text-slate-400">{friend.points.toLocaleString()} pts</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFriend(friend.id)}
                    className="touch-btn w-8 h-8 rounded-lg bg-red-50 text-red-500 text-sm flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase">Add Friend</h3>
              <button onClick={() => setShowAddFriend(false)} className="text-slate-400 text-xl">×</button>
            </div>
            <div className="p-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium outline-none focus:border-brand-blue"
              />
            </div>
            <div className="flex-grow overflow-y-auto p-4 pt-0 max-h-[50vh]">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No students found</div>
              ) : (
                <div className="space-y-2">
                  {filteredStudents.slice(0, 20).map(s => {
                    const sDisplayName = getStudentDisplayName(s);
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleAddFriend(s.id)}
                        className="touch-btn w-full p-3 rounded-xl bg-slate-50 flex items-center gap-3 active:bg-slate-100"
                      >
                        <img
                          src={s.avatarUrl}
                          className="w-10 h-10 rounded-full border-2 object-cover"
                          style={{ borderColor: HOUSES[s.houseId].colorHex }}
                          alt=""
                        />
                        <div className="flex-grow text-left min-w-0">
                          <div className="font-bold text-sm text-slate-900 truncate">{sDisplayName.primary}</div>
                          {sDisplayName.secondary && (
                            <div className="text-[9px] text-slate-400 truncate">{sDisplayName.secondary}</div>
                          )}
                          <div className="text-[10px] text-slate-500">{HOUSES[s.houseId].name}</div>
                        </div>
                        <span className="text-brand-blue font-black text-xs">+ Add</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderTeamTab = () => (
    <div className="space-y-5">
      {/* Team Card */}
      <div
        className="rounded-2xl p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${HOUSES[student.houseId].colorHex}, ${HOUSES[student.houseId].colorHex}dd)` }}
      >
        <div className="flex items-center gap-4 mb-4">
          {HOUSES[student.houseId].customIcon && (
            <img src={HOUSES[student.houseId].customIcon} className="w-16 h-16 object-contain" alt="" />
          )}
          <div>
            <div className="text-[10px] font-black uppercase text-white/70 tracking-widest">Your House</div>
            <div className="text-3xl font-black">{HOUSES[student.houseId].name}</div>
            <div className="text-sm opacity-80">{HOUSES[student.houseId].mascot}</div>
          </div>
        </div>

        {teamStats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/20 rounded-xl p-3 text-center">
              <div className="text-2xl font-black">{teamStats.totalPoints.toLocaleString()}</div>
              <div className="text-[9px] font-bold uppercase text-white/70">Total Points</div>
            </div>
            <div className="bg-white/20 rounded-xl p-3 text-center">
              <div className="text-2xl font-black">{teamStats.memberCount}</div>
              <div className="text-[9px] font-bold uppercase text-white/70">Members</div>
            </div>
            <div className="bg-white/20 rounded-xl p-3 text-center">
              <div className="text-2xl font-black">{teamStats.presentCount}</div>
              <div className="text-[9px] font-bold uppercase text-white/70">Present</div>
            </div>
          </div>
        )}
      </div>

      {/* Top Scorer */}
      {teamStats?.topScorer && (() => {
        const topScorerDisplay = getStudentDisplayName(teamStats.topScorer);
        return (
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3">Top Scorer</h3>
            <div className="bg-white rounded-xl p-4 border border-slate-100 flex items-center gap-4">
              <div className="text-3xl">👑</div>
              <img
                src={teamStats.topScorer.avatarUrl}
                className="w-12 h-12 rounded-full border-2 object-cover"
                style={{ borderColor: HOUSES[teamStats.topScorer.houseId].colorHex }}
                alt=""
              />
              <div className="flex-grow min-w-0">
                <div className="font-black text-sm text-slate-900">{topScorerDisplay.primary}</div>
                {topScorerDisplay.secondary && (
                  <div className="text-[10px] text-slate-400">{topScorerDisplay.secondary}</div>
                )}
                <div className="text-xs text-slate-500">{teamStats.topScorer.points.toLocaleString()} points</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* House Comparison */}
      <div>
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3">All Houses</h3>
        <div className="space-y-2">
          {Object.values(HOUSES)
            .map(house => {
              const isMyHouse = house.id === student.houseId;
              return (
                <div
                  key={house.id}
                  className={`rounded-xl p-4 border-2 flex items-center gap-3 transition-all ${isMyHouse ? 'border-current bg-current/5' : 'border-slate-100 bg-white'
                    }`}
                  style={{ borderColor: isMyHouse ? house.colorHex : undefined }}
                >
                  {house.customIcon && (
                    <img src={house.customIcon} className="w-10 h-10 object-contain flex-shrink-0" alt="" />
                  )}
                  <div className="flex-grow min-w-0">
                    <div className="font-black text-sm" style={{ color: house.colorHex }}>{house.name}</div>
                    <div className="text-[10px] text-slate-500">{house.mascot}</div>
                  </div>
                  {isMyHouse && (
                    <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-slate-900 text-white">You</span>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );

  const renderStoreTab = () => (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white p-4 rounded-2xl flex justify-between items-center">
        <div>
          <div className="text-[10px] font-bold uppercase text-slate-400">Your Balance</div>
          <div className="text-2xl font-black">{student.points.toLocaleString()} PTS</div>
        </div>
        <div className="text-3xl">🛍️</div>
      </div>

      {['HAIRSTYLE', 'TOP', 'ACCESSORY', 'BASE_FACE'].map(slot => {
        const items = wearables.filter(w => w.slot === slot);
        if (items.length === 0) return null;

        return (
          <div key={slot}>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-3">{slot.replace('_', ' ')}</h3>
            <div className="grid grid-cols-2 gap-3">
              {items.map(item => {
                const isOwned = inventory.includes(item.id) || item.isDefault;
                const canAfford = student.points >= item.xpCost;

                return (
                  <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col">
                    <div className="bg-slate-50 rounded-lg p-2 mb-2 h-24 flex items-center justify-center">
                      <img src={item.filePath} alt={item.name} className="h-full object-contain" />
                    </div>
                    <div className="font-bold text-xs text-slate-900 mb-1">{item.name}</div>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-[10px] font-bold text-slate-500">{item.xpCost} pts</span>
                      {isOwned ? (
                        <span className="text-[10px] font-black text-emerald-500 uppercase">Owned</span>
                      ) : (
                        <button
                          onClick={() => handlePurchase(item)}
                          disabled={!canAfford}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${canAfford ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-400'
                            }`}
                        >
                          Buy
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderNewsTab = () => (
    <div className="space-y-4">
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Academy News</h3>
      {news.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-4xl mb-2">📰</div>
          <div className="text-sm font-medium">No news yet</div>
        </div>
      ) : (
        <div className="space-y-4">
          {news.map(post => (
            <div key={post.id} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                {post.priority === 'HIGH' && (
                  <span className="bg-red-100 text-red-600 text-[9px] font-black uppercase px-2 py-0.5 rounded">
                    Important
                  </span>
                )}
                <span className="text-[10px] text-slate-400 font-bold">
                  {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h4 className="font-black text-lg text-slate-900 mb-2">{post.title}</h4>
              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{post.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mobile-modal animate-fade-in" style={{ zIndex: 'var(--z-modal, 200)' }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col bg-slate-50 w-full h-full animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="touch-btn text-slate-500 font-bold text-sm px-2 py-1">
            Close
          </button>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">My Profile</h2>
          <div className="w-16" /> {/* Spacer */}
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-slate-100 px-2 py-2 flex-shrink-0 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {[
              { id: 'PROFILE', label: 'Profile', icon: '👤' },
              { id: 'PROGRESS', label: 'Stats', icon: '📊' },
              { id: 'SHOP', label: 'Perk Shop', icon: '🛒' },
              { id: 'STORE', label: 'Store', icon: '🛍️' },
              { id: 'NEWS', label: 'News', icon: '📰' },
              { id: 'FRIENDS', label: 'Friends', icon: '👥' },
              { id: 'TEAM', label: 'Team', icon: '🏠' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`touch-btn px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-500'
                  }`}
              >
                <span className="mr-1">{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'PROFILE' && renderProfileTab()}
          {activeTab === 'PROGRESS' && renderProgressTab()}
          {activeTab === 'SHOP' && <PerkShop student={student} onRefresh={onRefresh} />}
          {activeTab === 'STORE' && renderStoreTab()}
          {activeTab === 'NEWS' && renderNewsTab()}
          {activeTab === 'FRIENDS' && renderFriendsTab()}
          {activeTab === 'TEAM' && renderTeamTab()}
        </div>
      </div>
    </div>
  );
};

export default StudentPortal;
