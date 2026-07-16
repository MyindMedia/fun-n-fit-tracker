
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { supabaseService } from '../services/supabaseService';
import { isAdminUser } from '../services/adminAccess';
import { AppSettings, Student } from '../types';
import { APP_LOGO_URL, HOUSES } from '../constants';
import StudentProfileModal from './StudentProfileModal';
import CelebrationOverlay, { Celebration } from './CelebrationOverlay';
import { AudioService } from '../utils/audio';

interface LayoutProps {
  children: React.ReactNode;
}

// Pubzi theme: small notched cut-corner shape for inline elements
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user } = useUser();
  const isAdmin = isAdminUser(user);
  // HashRouter puts route in hash, not pathname. Check both for compatibility.
  const isLive = location.pathname === '/live' || location.hash === '#/live' || window.location.hash.includes('/live');
  const isLogin = location.pathname === '/login' || location.hash === '#/login' || window.location.hash.includes('/login');
  const [settings, setSettings] = useState<AppSettings>({});
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [isHoveringNav, setIsHoveringNav] = useState(false);

  // Search State
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Student | null>(null);
  const [globalCelebration, setGlobalCelebration] = useState<Celebration | null>(null);
  const [pointBubbles, setPointBubbles] = useState<Array<{ id: string; amount: number; name: string; message: string }>>([]);
  const lastLevelUpSoundTs = useRef<number>(0);

  // Deduplicated level-up sound - only plays if not played in last 3 seconds
  const playLevelUpOnce = () => {
    const now = Date.now();
    if (now - lastLevelUpSoundTs.current > 3000) {
      lastLevelUpSoundTs.current = now;
      AudioService.playLevelUp();
    }
  };

  const refreshData = async () => {
    try {
      const [s, stu] = await Promise.all([
        supabaseService.getSettings(),
        supabaseService.getStudents()
      ]);
      setSettings(s);
      setAllStudents(stu);
    } catch (e: any) {
      console.error(`Layout refresh failed: ${e?.message || e}`);
    }
  };

  useEffect(() => {
    // Preload audio assets and unlock audio context on first interaction
    const unlockAudio = () => {
      AudioService.unlock();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
    // Also try to preload immediately
    AudioService.preload();

    refreshData();
    const unsubPoints = supabaseService.on('points_update', async (updatedStudent: Student) => {
      refreshData();
      console.log('🔔 points_update event received, isLive:', isLive, 'student:', updatedStudent.fullName);
      if (!isLive) return;
      try {
        const lastTx = await supabaseService.getLastTransaction(updatedStudent.id);
        console.log('📝 Last transaction:', lastTx);
        if (lastTx && typeof lastTx.amount === 'number') {
          const id = String(updatedStudent.id + '-' + Date.now());
          const amount = lastTx.amount;
          console.log('💰 Creating point bubble:', { name: updatedStudent.fullName, amount });
          if (amount > 0) AudioService.playRandomAward(); else AudioService.playPointLost();
          setPointBubbles(prev => [{ id, amount, name: updatedStudent.fullName, message: lastTx.description || 'Points updated' }, ...prev].slice(0, 5));
          setTimeout(() => { setPointBubbles(prev => prev.filter(b => b.id !== id)); }, 2600);
        }
      } catch (err) {
        console.warn('Failed to process points update:', err);
      }
    });
    const unsubNotif = supabaseService.on('notification', async (e: any) => {
      if (!isLive) return;
      if (e.type === 'POINTS' && typeof e.amount === 'number') {
        try { if (e.amount > 0) AudioService.playRandomAward(); else AudioService.playPointLost(); } catch (err) { console.warn('Audio playback failed:', err); }
        const id = String(e.id || `${Date.now()}-${Math.random()}`);
        setPointBubbles(prev => [{ id, amount: e.amount, name: e.studentName || 'Athlete', message: e.message }, ...prev].slice(0, 5));
        setTimeout(() => { setPointBubbles(prev => prev.filter(b => b.id !== id)); }, 2600);
      }
      if (e.type === 'RANK_UP') {
        playLevelUpOnce();
        try {
          const [students, ranksData] = await Promise.all([
            supabaseService.getStudents(),
            supabaseService.getRanks()
          ]);
          const stu = students.find(s => s.id === e.studentId);
          const rank = ranksData.find(r => r.id === stu?.rankId);
          const rankMatch = (e.message || '').match(/Promoted to (.+?)!/);
          const rankName = rankMatch ? rankMatch[1] : (rank?.name || 'New Rank');
          setGlobalCelebration({
            type: 'RANK_UP',
            studentName: stu?.fullName || e.studentName || 'Student',
            achievement: rankName,
            studentAvatar: stu?.avatarUrl,
            rankIcon: rank?.icon
          });
        } catch (err) {
          console.warn('Failed to load student/rank data:', err);
          const rankMatch = (e.message || '').match(/Promoted to (.+?)!/);
          const rankName = rankMatch ? rankMatch[1] : 'New Rank';
          setGlobalCelebration({
            type: 'RANK_UP',
            studentName: e.studentName || 'Student',
            achievement: rankName
          });
        }
      }
    });
    const unsubTx = supabaseService.on('transaction', async (t: { studentId: string; amount: number; description: string }) => {
      if (!isLive) return;
      try {
        const stu = allStudents.find(s => s.id === t.studentId) || (await supabaseService.getStudents()).find(s => s.id === t.studentId);
        const name = stu?.fullName || 'Athlete';
        if (t.amount > 0) AudioService.playRandomAward(); else AudioService.playPointLost();
        const id = `${t.studentId}-${Date.now()}`;
        setPointBubbles(prev => [{ id, amount: t.amount, name, message: t.description || 'Points updated' }, ...prev].slice(0, 5));
        setTimeout(() => { setPointBubbles(prev => prev.filter(b => b.id !== id)); }, 2600);
      } catch (err) {
        console.warn('Transaction processing failed:', err);
      }
    });
    const unsubBroadcast = supabaseService.on('rank_up_broadcast', (cele: Celebration) => {
      if (!isLive) return;
      playLevelUpOnce();
      setGlobalCelebration(cele);
    });
    const onLocalRankUp = (ev: any) => {
      if (!isLive) return;
      const cele = ev?.detail as Celebration;
      if (!cele) return;
      playLevelUpOnce();
      setGlobalCelebration(cele);
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'rank_up_event' && ev.newValue) {
        try {
          const cele = JSON.parse(ev.newValue);
          if (isLive) {
            AudioService.playCongratulations();
            setGlobalCelebration(cele);
          }
        } catch (err) {
          console.warn('Failed to parse rank-up storage event:', err);
        }
      }
    };
    window.addEventListener('rank-up', onLocalRankUp as any);
    window.addEventListener('storage', onStorage);

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsProjectorMode(isFull);
      window.dispatchEvent(new CustomEvent('toggle-projector-state', { detail: isFull }));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // If we just navigated to Live, immediately show any queued rank-up within last 15s
    try {
      if (isLive) {
        AudioService.unlock();
        const raw = localStorage.getItem('rank_up_event');
        if (raw) {
          const cele = JSON.parse(raw);
          if (cele && Date.now() - (cele.ts || 0) < 15000) {
            playLevelUpOnce();
            setGlobalCelebration(cele);
            localStorage.removeItem('rank_up_event');
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load rank-up event from localStorage:', err);
    }

    return () => {
      unsubPoints();
      unsubNotif();
      unsubBroadcast();
      unsubTx();
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('rank-up', onLocalRankUp as any);
      window.removeEventListener('storage', onStorage);
    };
  }, [isLive]);

  const toggleProjectorMode = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return allStudents.filter(s =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);
  }, [searchQuery, allStudents]);

  return (
    <div className="h-screen bg-neutral-50 flex flex-col overflow-hidden">
      {selectedProfile && (
        <StudentProfileModal
          student={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}

      {isProjectorMode && (
        <div
          className="fixed top-0 left-0 w-full h-4 z-[200]"
          onMouseEnter={() => setIsHoveringNav(true)}
        />
      )}

      <nav
        className={`
          pz-scope text-white z-[201] transition-all duration-500 ease-in-out
          ${isProjectorMode ? 'fixed top-0 left-0 w-full' : 'relative h-16'}
          ${isProjectorMode && !isHoveringNav ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}
        `}
        style={{ background: 'var(--pz-bg)', borderBottom: '1px solid var(--pz-border)' }}
        onMouseEnter={() => isProjectorMode && setIsHoveringNav(true)}
        onMouseLeave={() => isProjectorMode && setIsHoveringNav(false)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full gap-4 py-2">
            <div className="flex items-center gap-2 shrink-0">
              <Link to="/live" className="flex items-center gap-3 group">
                <div
                  className="w-10 h-10 bg-white flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105"
                  style={{ clipPath: NOTCH_SM }}
                >
                  <img src={settings.app_logo || APP_LOGO_URL} alt="Logo" className="w-full h-full object-contain p-1" />
                </div>
                <span className="pz-display text-base md:text-lg tracking-wide truncate hidden sm:block">Fun N' Fit</span>
              </Link>
            </div>

            <div className="flex-grow max-w-md relative group">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Find a player..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 font-bold text-xs uppercase tracking-widest text-white placeholder-white/40 focus:border-[#CBFE1C] outline-none transition-all"
                  style={{ clipPath: NOTCH_SM }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none opacity-50 group-focus-within:opacity-100">🔍</span>
              </div>

              {filteredStudents.length > 0 && (
                <div className="pz-card absolute top-full mt-2 left-0 right-0 overflow-hidden animate-slide-up z-[300]">
                  {filteredStudents.map(s => (
                    <div
                      key={s.id}
                      onClick={() => { setSelectedProfile(s); setSearchQuery(''); }}
                      className="flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--pz-border)' }}
                    >
                      <img src={s.avatarUrl} className="w-10 h-10 rounded-full border-2 object-cover" style={{ borderColor: HOUSES[s.houseId].colorHex }} />
                      <div className="flex-grow">
                        <div className="text-xs font-black text-white">{s.fullName}</div>
                        <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>
                          <span style={{ color: HOUSES[s.houseId].colorHex }}>{HOUSES[s.houseId].name}</span> • {s.points} pts
                        </div>
                      </div>
                      <span className="font-black text-xs" style={{ color: 'var(--pz-volt)' }}>VIEW</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 md:space-x-4 shrink-0">
              {!isProjectorMode && (
                <button
                  onClick={toggleProjectorMode}
                  className="pz-btn-ghost flex items-center gap-2 px-4 py-2 text-xs"
                >
                  <span className="text-lg leading-none">🗖</span>
                  <span className="hidden lg:inline">Projector</span>
                </button>
              )}

              <Link to="/" className="relative px-3 md:px-4 py-2 text-xs font-bold transition-colors uppercase tracking-widest text-white/60 hover:text-white">
                Home
              </Link>
              <Link to="/live" className={`relative px-3 md:px-4 py-2 text-xs font-bold transition-colors uppercase tracking-widest ${isLive ? 'text-white' : 'text-white/60 hover:text-white'}`}>
                Live
                {isLive && <span className="absolute left-3 right-3 md:left-4 md:right-4 bottom-0 h-0.5" style={{ background: 'var(--pz-volt)' }} />}
              </Link>
              {isAdmin && (
                <Link to="/admin" className={`relative px-3 md:px-4 py-2 text-xs font-bold transition-colors uppercase tracking-widest ${!isLive ? 'text-white' : 'text-white/60 hover:text-white'}`}>
                  Admin
                  {!isLive && <span className="absolute left-3 right-3 md:left-4 md:right-4 bottom-0 h-0.5" style={{ background: 'var(--pz-volt)' }} />}
                </Link>
              )}
              <a href="/#/parent-login" className="pz-btn-ghost px-3 md:px-4 py-2 text-xs">Portal</a>
            </div>
          </div>
        </div>
      </nav>

      <main className={`flex-1 relative overflow-y-auto flex flex-col transition-all duration-500 min-h-0 ${isProjectorMode ? 'h-screen w-screen' : ''}`}>
        {children}
        {isLive && (
          <CelebrationOverlay celebration={globalCelebration} onDismiss={() => setGlobalCelebration(null)} />
        )}

        {isLive && pointBubbles.length > 0 && (
          <div className="fixed inset-0 z-[800] pointer-events-none overflow-hidden pz-scope">
            {pointBubbles.map((b, index) => (
              <div
                key={b.id}
                className={`absolute ${b.amount >= 0 ? 'animate-points-float-up' : 'animate-points-break-fall'}`}
                style={{
                  top: b.amount >= 0 ? '60%' : '20%',
                  left: `${50 + (index - 2) * 15}%`,
                  transform: 'translateX(-50%)',
                  filter: b.amount >= 0
                    ? 'drop-shadow(0 0 18px rgba(16, 185, 129, 0.45))'
                    : 'drop-shadow(0 0 18px rgba(239, 68, 68, 0.45))'
                }}
              >
                <div
                  className="pz-card relative px-6 py-4"
                  style={{ borderColor: b.amount >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)' }}
                >
                  <span
                    className="absolute left-0 top-0 bottom-0 w-1.5"
                    style={{ background: b.amount >= 0 ? '#10b981' : '#ef4444' }}
                  />
                  <div className="flex items-center gap-4 relative">
                    <div className="pz-display text-white text-lg tracking-wider">{b.name}</div>
                    <div className={`pz-display text-2xl ${b.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {b.amount >= 0 ? '+' : ''}{b.amount} pts
                    </div>
                  </div>
                  <div className="text-sm font-bold mt-1.5 text-center" style={{ color: 'var(--pz-text)' }}>{b.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Layout;
