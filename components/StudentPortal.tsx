import React, { useState, useEffect, useRef } from 'react';
import { Student, Rank, Trophy, HouseId, BlogPost } from '../types';
import { HOUSES } from '../constants';
import { supabaseService } from '../services/supabaseService';
import { gameCenter } from '../services/gameCenter';
import AvatarStudio from './avatar/AvatarStudio';
import AvatarRig from './avatar/AvatarRig';
import LootCrates from './avatar/LootCrates';
import GearShop from './avatar/GearShop';
import PerkShop from './Student/PerkShop';
import GameCenterStats from './Student/GameCenterStats';
import TrophyCase from './TrophyCase';
import LevelPath from './LevelPath';
import { getStudentDisplayName, getInitials } from '../utils/studentDisplay';
import { Ic, IconProps } from './icons';

interface StudentPortalProps {
  student: Student;
  onClose: () => void;
  onRefresh?: () => void;
}

// Pubzi theme: small notched cut-corner shape for inline elements
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

const StudentPortal: React.FC<StudentPortalProps> = ({ student, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'PROGRESS' | 'AWARDS' | 'SHOP' | 'FRIENDS' | 'TEAM' | 'STORE' | 'NEWS'>('PROFILE');
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [friends, setFriends] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [teamStats, setTeamStats] = useState<{ totalPoints: number; memberCount: number; presentCount: number; topScorer: Student | null } | null>(null);

  // New V2 Data
  const [news, setNews] = useState<BlogPost[]>([]);

  // Edit states
  const [gamerTag, setGamerTag] = useState(student.gamerTag || '');
  const [bio, setBio] = useState(student.bio || '');
  // Default: gamer tag leads when one exists (real name shows small below);
  // kids can still deliberately switch to real-name-first or initials.
  const [displayPreference, setDisplayPreference] = useState<'FULL_NAME' | 'GAMER_TAG' | 'INITIALS'>(
    student.displayPreference || (student.gamerTag ? 'GAMER_TAG' : 'FULL_NAME')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setGamerTag(student.gamerTag || '');
    setBio(student.bio || '');
    setDisplayPreference(student.displayPreference || (student.gamerTag ? 'GAMER_TAG' : 'FULL_NAME'));
    loadData();
  }, [student]);

  const loadData = async () => {
    const [ranksData, trophiesData, friendsData, studentsData, statsData, newsData] = await Promise.all([
      supabaseService.getRanks(),
      supabaseService.getTrophies(),
      supabaseService.getFriends(student.id),
      supabaseService.getStudents(),
      supabaseService.getTeamStats(student.houseId),
      supabaseService.getBlogPosts()
    ]);
    setRanks(ranksData);
    setTrophies(trophiesData.filter(t => t.isActive));
    setFriends(friendsData);
    setAllStudents(studentsData.filter(s => s.id !== student.id));
    setTeamStats(statsData);
    setNews(newsData);
  };

  const currentRankIndex = ranks.findIndex(r => r.id === student.rankId);
  const currentRank = ranks[currentRankIndex] || ranks[0];
  const nextRank = ranks[currentRankIndex + 1] || null;
  const progressPercent = (nextRank && currentRank)
    ? Math.min(100, Math.max(0, ((student.points - currentRank.threshold) / (nextRank.threshold - currentRank.threshold)) * 100))
    : 100;

  // Live preview of how the name will read on the leaderboard —
  // honors the (possibly unsaved) display preference and gamer tag.
  const getProfileDisplayName = (): { primary: string; secondary?: string } => {
    const tag = gamerTag.trim();
    if (displayPreference === 'FULL_NAME') return { primary: student.fullName, secondary: tag || undefined };
    if (displayPreference === 'INITIALS') return { primary: getInitials(student.fullName) };
    if (tag) return { primary: tag, secondary: student.fullName };
    return { primary: student.fullName };
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

  const handleSetAvatarMode = async (mode: 'PHOTO' | 'AVATAR') => {
    try {
      await gameCenter.setAvatarMode(student.id, mode);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to switch avatar mode');
    }
  };

  if (showAvatarCreator) {
    return (
      <div className="fixed inset-0 z-[250] animate-fade-in" style={{ background: 'var(--pz-bg)' }}>
        <AvatarStudio
          student={student}
          onClose={() => setShowAvatarCreator(false)}
          onSaved={() => {
            if (onRefresh) onRefresh();
          }}
        />
      </div>
    );
  }

  // Tab Components
  const renderProfileTab = () => (
    <div className="space-y-5">
      {/* Avatar & Name Display — player-profile card */}
      <div className="pz-card relative grid grid-cols-2 gap-4 p-4">
        <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: HOUSES[student.houseId].colorHex }} />
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            {student.avatarMode === 'AVATAR' ? (
              <div
                className="w-32 h-32 rounded-full border-4 overflow-hidden flex items-end justify-center"
                style={{ borderColor: HOUSES[student.houseId].colorHex, background: 'radial-gradient(circle at 50% 30%, #232B3B 0%, #14171E 80%)' }}
              >
                <AvatarRig look={student.avatarLook} size="100%" />
              </div>
            ) : (
              <img
                src={student.avatarUrl}
                onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.id}`; }}
                className="w-32 h-32 rounded-full border-4 object-cover"
                style={{ borderColor: HOUSES[student.houseId].colorHex }}
                alt=""
              />
            )}
            <button
              onClick={() => setShowAvatarCreator(true)}
              className="touch-btn pz-btn px-3 py-1.5 text-[10px] inline-flex items-center gap-1.5"
            >
              <Ic.Shirt size={14} /> Avatar Studio
            </button>
            <div className="flex gap-1">
              {([['PHOTO', 'Photo'], ['AVATAR', 'Avatar']] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => handleSetAvatarMode(mode)}
                  className="touch-btn px-2.5 py-1 text-[9px] font-black uppercase tracking-wide transition-all"
                  style={{
                    clipPath: NOTCH_SM,
                    background: (student.avatarMode ?? 'PHOTO') === mode ? 'var(--pz-volt)' : 'var(--pz-panel-2)',
                    color: (student.avatarMode ?? 'PHOTO') === mode ? '#0B0E13' : 'var(--pz-text)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0 flex flex-col justify-center h-full">
            {(() => {
              const displayName = getProfileDisplayName();
              return (
                <>
                  <div className="pz-display text-2xl text-white truncate">{displayName.primary}</div>
                  {displayName.secondary && (
                    <div className="text-base truncate" style={{ color: 'var(--pz-text)' }}>{displayName.secondary}</div>
                  )}
                </>
              );
            })()}
            <div className="mt-2">
              <div
                className="text-sm font-black uppercase px-3 py-1.5 inline-block"
                style={{ backgroundColor: HOUSES[student.houseId].colorHex + '20', color: HOUSES[student.houseId].colorHex, clipPath: NOTCH_SM }}
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
        <label className="pz-eyebrow mb-2 block">
          Gamer Tag
        </label>
        <input
          type="text"
          value={gamerTag}
          onChange={(e) => setGamerTag(e.target.value)}
          placeholder="Enter your gamer tag..."
          maxLength={20}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 text-sm font-bold text-white placeholder-white/40 outline-none focus:border-[#CBFE1C] focus:bg-white/10 transition-all"
          style={{ clipPath: NOTCH_SM }}
        />
        <p className="text-[10px] mt-1" style={{ color: 'var(--pz-text)' }}>This name can be shown on leaderboards</p>
      </div>

      {/* Display Preference */}
      <div>
        <label className="pz-eyebrow mb-2 block">
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
              className={`touch-btn p-3 border-2 text-center transition-all ${displayPreference === opt.id
                ? 'border-[#CBFE1C] bg-[#CBFE1C]/10 text-[#CBFE1C]'
                : 'border-white/10 text-slate-400'
                } ${opt.id === 'GAMER_TAG' && !gamerTag ? 'opacity-40' : ''}`}
              style={{ clipPath: NOTCH_SM, background: displayPreference === opt.id ? undefined : 'var(--pz-panel)' }}
            >
              <div className="text-[10px] font-black uppercase tracking-wide">{opt.label}</div>
              <div className="text-sm font-bold truncate mt-2">{opt.preview}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Bio */}
      <div>
        <label className="pz-eyebrow mb-2 block">
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell us about yourself..."
          maxLength={150}
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 text-sm font-medium text-white placeholder-white/40 outline-none focus:border-[#CBFE1C] focus:bg-white/10 transition-all resize-none"
          style={{ clipPath: NOTCH_SM }}
        />
        <div className="text-right text-[10px]" style={{ color: 'var(--pz-text)' }}>{bio.length}/150</div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSaveProfile}
        disabled={isSaving}
        className={`touch-btn min-h-[52px] w-full py-4 font-black text-sm uppercase tracking-widest transition-all ${isSaving ? 'bg-white/10 text-slate-500' : 'pz-btn'
          }`}
        style={isSaving ? { clipPath: NOTCH_SM } : undefined}
      >
        {isSaving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  );

  const renderProgressTab = () => (
    <div className="space-y-5">
      {/* Points & Rank Card */}
      <div className="pz-card p-6 text-white">
        <div className="flex items-center gap-4 mb-4">
          {currentRank?.icon && (
            <img src={currentRank.icon} className="w-16 h-16 object-contain" alt="" />
          )}
          <div>
            <div className="pz-eyebrow">Current Rank</div>
            <div className="pz-display text-2xl">{currentRank?.name || 'Rookie'}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="pz-card-sm p-4 text-center" style={{ background: 'var(--pz-panel-2)' }}>
            <div className="pz-display text-3xl" style={{ color: 'var(--pz-volt)' }}>{student.points.toLocaleString()}</div>
            <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>Total Points</div>
          </div>
          <div className="pz-card-sm p-4 text-center" style={{ background: 'var(--pz-panel-2)' }}>
            <div className="pz-display text-3xl" style={{ color: 'var(--pz-volt)' }}>{student.totalXp || 0}</div>
            <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>Total XP</div>
          </div>
        </div>

        {nextRank && (
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>
              <span>{currentRank?.name}</span>
              <span>{nextRank.name}</span>
            </div>
            <div className="h-3 bg-white/10 overflow-hidden" style={{ clipPath: NOTCH_SM }}>
              <div
                className="h-full transition-all duration-1000"
                style={{ width: `${progressPercent}%`, background: 'var(--pz-volt)' }}
              />
            </div>
            <div className="text-center text-xs font-bold" style={{ color: 'var(--pz-text)' }}>
              {nextRank.threshold - student.points} pts to level up
            </div>
          </div>
        )}
      </div>

      {/* The whole level ladder — see every rank ahead */}
      <LevelPath points={student.points} rankId={student.rankId} ranks={ranks} />

      {/* Game Center stats */}
      <GameCenterStats studentId={student.id} />

      {/* Badges */}
      <div>
        <h3 className="text-sm text-white uppercase tracking-wide mb-3">Badges Earned</h3>
        {student.badges?.length ? (
          <div className="grid grid-cols-4 gap-2">
            {student.badges.map(badgeId => (
              <div key={badgeId} className="pz-card-sm p-3 text-center">
                <div className="mb-1 flex justify-center text-amber-300"><Ic.Medal size={24} /></div>
                <div className="text-[9px] font-black uppercase truncate" style={{ color: 'var(--pz-text)' }}>{badgeId}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--pz-text)' }}>No badges yet. Keep training!</div>
        )}
      </div>

      {/* Available Trophies */}
      <div>
        <h3 className="text-sm text-white uppercase tracking-wide mb-3">Trophies To Earn</h3>
        {trophies.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--pz-text)' }}>No trophies available</div>
        ) : (
          <div className="space-y-2">
            {trophies.map(trophy => {
              const progress = Math.min(100, (student.points / trophy.pointsRequired) * 100);
              return (
                <div key={trophy.id} className="pz-card-sm p-4">
                  <div className="flex items-center gap-3 mb-2">
                    {trophy.icon ? (
                      <img src={trophy.icon} className="w-10 h-10 object-contain" alt="" />
                    ) : (
                      <div className="w-10 h-10 bg-amber-400/15 flex items-center justify-center text-amber-300" style={{ clipPath: NOTCH_SM }}><Ic.Trophy size={20} /></div>
                    )}
                    <div className="flex-grow min-w-0">
                      <div className="font-black text-sm text-white">{trophy.name}</div>
                      <div className="text-[10px]" style={{ color: 'var(--pz-text)' }}>{trophy.pointsRequired.toLocaleString()} pts • {trophy.xpReward} XP</div>
                    </div>
                    <div className="text-xs font-black" style={{ color: 'var(--pz-volt)' }}>{Math.round(progress)}%</div>
                  </div>
                  <div className="h-2 bg-white/10 overflow-hidden" style={{ clipPath: NOTCH_SM }}>
                    <div className="h-full" style={{ width: `${progress}%`, background: 'var(--pz-volt)' }} />
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
        className="touch-btn min-h-[52px] pz-btn w-full py-3 text-xs"
      >
        + Add Friend
      </button>

      {/* Friends List */}
      <div>
        <h3 className="text-sm text-white uppercase tracking-wide mb-3">
          My Friends ({friends.length})
        </h3>
        {friends.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--pz-text)' }}>
            <div className="mb-2 flex justify-center"><Ic.Users size={40} /></div>
            <div className="text-sm font-medium">No friends yet</div>
            <div className="text-xs">Add friends to see their progress!</div>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map(friend => {
              const friendDisplayName = getStudentDisplayName(friend);
              return (
                <div key={friend.id} className="pz-card-sm p-4 flex items-center gap-3" style={{ background: 'var(--pz-panel-2)' }}>
                  <img
                    src={friend.avatarUrl}
                    className="w-12 h-12 rounded-full border-2 object-cover flex-shrink-0"
                    style={{ borderColor: HOUSES[friend.houseId].colorHex }}
                    alt=""
                  />
                  <div className="flex-grow min-w-0">
                    <div className="font-black text-sm text-white truncate">
                      {friendDisplayName.primary}
                    </div>
                    {friendDisplayName.secondary && (
                      <div className="text-[10px] truncate" style={{ color: 'var(--pz-text)' }}>{friendDisplayName.secondary}</div>
                    )}
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] font-black uppercase px-1.5 py-0.5"
                        style={{ backgroundColor: HOUSES[friend.houseId].colorHex + '20', color: HOUSES[friend.houseId].colorHex, clipPath: NOTCH_SM }}
                      >
                        {HOUSES[friend.houseId].name}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--pz-text)' }}>{friend.points.toLocaleString()} pts</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFriend(friend.id)}
                    className="touch-btn w-8 h-8 bg-red-500/10 border border-red-500/40 text-red-400 flex items-center justify-center"
                    style={{ clipPath: NOTCH_SM }}
                  >
                    <Ic.XMark size={16} />
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
          <div className="pz-card w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--pz-border)' }}>
              <h3 className="text-sm text-white uppercase">Add Friend</h3>
              <button onClick={() => setShowAddFriend(false)} className="touch-btn" style={{ color: 'var(--pz-text)' }}><Ic.XMark size={18} /></button>
            </div>
            <div className="p-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 text-sm font-medium text-white placeholder-white/40 outline-none focus:border-[#CBFE1C] focus:bg-white/10 transition-all"
                style={{ clipPath: NOTCH_SM }}
              />
            </div>
            <div className="flex-grow overflow-y-auto p-4 pt-0 max-h-[50vh]">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--pz-text)' }}>No students found</div>
              ) : (
                <div className="space-y-2">
                  {filteredStudents.slice(0, 20).map(s => {
                    const sDisplayName = getStudentDisplayName(s);
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleAddFriend(s.id)}
                        className="touch-btn pz-card-sm w-full p-3 flex items-center gap-3 hover:border-[#CBFE1C] transition-all active:scale-[0.98]"
                        style={{ background: 'var(--pz-panel-2)' }}
                      >
                        <img
                          src={s.avatarUrl}
                          className="w-10 h-10 rounded-full border-2 object-cover"
                          style={{ borderColor: HOUSES[s.houseId].colorHex }}
                          alt=""
                        />
                        <div className="flex-grow text-left min-w-0">
                          <div className="font-bold text-sm text-white truncate">{sDisplayName.primary}</div>
                          {sDisplayName.secondary && (
                            <div className="text-[9px] truncate" style={{ color: 'var(--pz-text)' }}>{sDisplayName.secondary}</div>
                          )}
                          <div className="text-[10px]" style={{ color: HOUSES[s.houseId].colorHex }}>{HOUSES[s.houseId].name}</div>
                        </div>
                        <span className="font-black text-xs" style={{ color: 'var(--pz-volt)' }}>+ Add</span>
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
      {/* Team Card — house color as the personal accent */}
      <div
        className="pz-card relative p-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${HOUSES[student.houseId].colorHex}33, transparent 55%), var(--pz-panel)`,
          borderColor: `${HOUSES[student.houseId].colorHex}66`
        }}
      >
        <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: HOUSES[student.houseId].colorHex }} />
        <div className="flex items-center gap-4 mb-4">
          {HOUSES[student.houseId].customIcon && (
            <img src={HOUSES[student.houseId].customIcon} className="w-16 h-16 object-contain" alt="" />
          )}
          <div>
            <div className="pz-eyebrow">Your House</div>
            <div className="pz-display text-3xl" style={{ color: HOUSES[student.houseId].colorHex }}>{HOUSES[student.houseId].name}</div>
            <div className="text-sm" style={{ color: 'var(--pz-text)' }}>{HOUSES[student.houseId].mascot}</div>
          </div>
        </div>

        {teamStats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="pz-card-sm p-3 text-center" style={{ background: 'var(--pz-panel-2)' }}>
              <div className="pz-display text-2xl" style={{ color: HOUSES[student.houseId].colorHex }}>{teamStats.totalPoints.toLocaleString()}</div>
              <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>Total Points</div>
            </div>
            <div className="pz-card-sm p-3 text-center" style={{ background: 'var(--pz-panel-2)' }}>
              <div className="pz-display text-2xl text-white">{teamStats.memberCount}</div>
              <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>Members</div>
            </div>
            <div className="pz-card-sm p-3 text-center" style={{ background: 'var(--pz-panel-2)' }}>
              <div className="pz-display text-2xl text-white">{teamStats.presentCount}</div>
              <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--pz-text)' }}>Present</div>
            </div>
          </div>
        )}
      </div>

      {/* Top Scorer */}
      {teamStats?.topScorer && (() => {
        const topScorerDisplay = getStudentDisplayName(teamStats.topScorer);
        return (
          <div>
            <h3 className="text-sm text-white uppercase tracking-wide mb-3">Top Scorer</h3>
            <div className="pz-card-sm p-4 flex items-center gap-4" style={{ background: 'var(--pz-panel-2)' }}>
              <div style={{ color: 'var(--pz-volt)' }}><Ic.Trophy size={28} /></div>
              <img
                src={teamStats.topScorer.avatarUrl}
                className="w-12 h-12 rounded-full border-2 object-cover"
                style={{ borderColor: HOUSES[teamStats.topScorer.houseId].colorHex }}
                alt=""
              />
              <div className="flex-grow min-w-0">
                <div className="font-black text-sm text-white">{topScorerDisplay.primary}</div>
                {topScorerDisplay.secondary && (
                  <div className="text-[10px]" style={{ color: 'var(--pz-text)' }}>{topScorerDisplay.secondary}</div>
                )}
                <div className="text-xs" style={{ color: 'var(--pz-volt)' }}>{teamStats.topScorer.points.toLocaleString()} points</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* House Comparison */}
      <div>
        <h3 className="text-sm text-white uppercase tracking-wide mb-3">All Houses</h3>
        <div className="space-y-2">
          {Object.values(HOUSES)
            .map(house => {
              const isMyHouse = house.id === student.houseId;
              return (
                <div
                  key={house.id}
                  className="pz-card-sm p-4 flex items-center gap-3 transition-all"
                  style={{
                    borderColor: isMyHouse ? house.colorHex : undefined,
                    background: isMyHouse ? `${house.colorHex}14` : 'var(--pz-panel-2)'
                  }}
                >
                  {house.customIcon && (
                    <img src={house.customIcon} className="w-10 h-10 object-contain flex-shrink-0" alt="" />
                  )}
                  <div className="flex-grow min-w-0">
                    <div className="font-black text-sm" style={{ color: house.colorHex }}>{house.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--pz-text)' }}>{house.mascot}</div>
                  </div>
                  {isMyHouse && (
                    <span className="text-[9px] font-black uppercase px-2 py-1" style={{ background: 'var(--pz-volt)', color: '#0B0E13', clipPath: NOTCH_SM }}>You</span>
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
      <div className="pz-card text-white p-4 flex justify-between items-center">
        <div>
          <div className="pz-eyebrow">Your Balance</div>
          <div className="pz-display text-2xl" style={{ color: 'var(--pz-volt)' }}>{student.points.toLocaleString()} PTS</div>
        </div>
        <div style={{ color: 'var(--pz-volt)' }}><Ic.Store size={28} /></div>
      </div>

      {/* Power gear — perks, downsides, live multipliers */}
      <GearShop student={student} onRefresh={onRefresh} />

      {/* Loot crates — random drops for the avatar */}
      <LootCrates student={student} onRefresh={onRefresh} />

      {/* Direct route: browse + buy exact items in the studio */}
      <button
        onClick={() => setShowAvatarCreator(true)}
        className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
        style={{ borderColor: 'rgba(203,254,28,0.35)' }}
      >
        <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Shirt size={24} /></span>
        <div className="text-left flex-grow">
          <div className="font-black text-white uppercase tracking-wide text-[15px]">Avatar Studio</div>
          <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Equip your drops, unlock exact items, change your look</div>
        </div>
        <Ic.ChevronRight size={18} className="shrink-0" style={{ color: 'var(--pz-text)' }} />
      </button>
    </div>
  );

  const renderNewsTab = () => (
    <div className="space-y-4">
      <h3 className="text-sm text-white uppercase tracking-wide">Academy News</h3>
      {news.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--pz-text)' }}>
          <div className="mb-2 flex justify-center"><Ic.Note size={40} /></div>
          <div className="text-sm font-medium">No news yet</div>
        </div>
      ) : (
        <div className="space-y-4">
          {news.map(post => (
            <div key={post.id} className="pz-card p-5">
              <div className="flex items-center gap-2 mb-2">
                {post.priority === 'HIGH' && (
                  <span className="bg-red-500/15 text-red-400 text-[9px] font-black uppercase px-2 py-0.5" style={{ clipPath: NOTCH_SM }}>
                    Important
                  </span>
                )}
                <span className="text-[10px] font-bold" style={{ color: 'var(--pz-text)' }}>
                  {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h4 className="text-lg text-white mb-2">{post.title}</h4>
              <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--pz-text)' }}>{post.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mobile-modal pz-scope animate-fade-in" style={{ zIndex: 'var(--z-modal, 200)', background: 'var(--pz-bg)' }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col w-full h-full animate-slide-up overflow-hidden" style={{ background: 'var(--pz-bg)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: 'var(--pz-panel)', borderBottom: '1px solid var(--pz-border)' }}>
          <button onClick={onClose} className="touch-btn pz-btn-ghost font-bold text-xs px-3 py-1">
            Close
          </button>
          <h2 className="text-sm text-white uppercase tracking-wide">My Profile</h2>
          <div className="w-16" /> {/* Spacer */}
        </div>

        {/* Tab Navigation */}
        <div className="px-2 py-2 flex-shrink-0 overflow-x-auto" style={{ background: 'var(--pz-panel)', borderBottom: '1px solid var(--pz-border)' }}>
          <div className="flex gap-1 min-w-max">
            {([
              { id: 'PROFILE', label: 'Profile', icon: Ic.User },
              { id: 'PROGRESS', label: 'Stats', icon: Ic.Chart },
              { id: 'AWARDS', label: 'Awards', icon: Ic.Medal },
              { id: 'SHOP', label: 'Perk Shop', icon: Ic.Cart },
              { id: 'STORE', label: 'Store', icon: Ic.Store },
              { id: 'NEWS', label: 'News', icon: Ic.Note },
              { id: 'FRIENDS', label: 'Friends', icon: Ic.Users },
              { id: 'TEAM', label: 'Team', icon: Ic.Home }
            ] as Array<{ id: string; label: string; icon: React.FC<IconProps> }>).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`touch-btn min-h-[48px] px-4 py-2 text-[10px] font-black uppercase tracking-wide transition-all inline-flex items-center gap-2 ${activeTab === tab.id
                  ? 'text-[#0B0E13]'
                  : 'text-slate-400 border border-white/10'
                  }`}
                style={activeTab === tab.id
                  ? { background: 'var(--pz-volt)', clipPath: NOTCH_SM }
                  : { background: 'var(--pz-panel-2)', clipPath: NOTCH_SM }}
              >
                <tab.icon size={20} /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'PROFILE' && renderProfileTab()}
          {activeTab === 'PROGRESS' && renderProgressTab()}
          {activeTab === 'AWARDS' && <TrophyCase student={student} />}
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
