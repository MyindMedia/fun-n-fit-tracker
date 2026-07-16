
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { AppSettings, Student } from '../types';
import { APP_LOGO_URL, HOUSES } from '../constants';
import StudentProfileModal from './StudentProfileModal';
import CelebrationOverlay, { Celebration } from './CelebrationOverlay';
import { AudioService } from '../utils/audio';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
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
          bg-brand-blue text-white shadow-xl z-[201] transition-all duration-500 ease-in-out
          ${isProjectorMode ? 'fixed top-0 left-0 w-full' : 'relative h-16'}
          ${isProjectorMode && !isHoveringNav ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}
        `}
        onMouseEnter={() => isProjectorMode && setIsHoveringNav(true)}
        onMouseLeave={() => isProjectorMode && setIsHoveringNav(false)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <Link to="/live" className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md overflow-hidden transition-transform group-hover:scale-105">
                  <img src={settings.app_logo || APP_LOGO_URL} alt="Logo" className="w-full h-full object-contain p-1" />
                </div>
                <span className="font-display font-bold text-lg md:text-xl tracking-wide truncate hidden sm:block">Fun N' Fit</span>
              </Link>
            </div>

            <div className="flex-grow max-w-md relative group">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Find Athlete..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/20 hover:bg-white/30 border border-white/20 rounded-2xl px-5 py-2.5 font-black text-xs uppercase tracking-widest placeholder-white/70 focus:bg-white focus:text-slate-900 focus:placeholder-slate-400 outline-none transition-all shadow-inner"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none opacity-60 group-focus-within:opacity-100 group-focus-within:text-brand-blue">🔍</span>
              </div>

              {filteredStudents.length > 0 && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-slide-up text-slate-900 z-[300]">
                  {filteredStudents.map(s => (
                    <div
                      key={s.id}
                      onClick={() => { setSelectedProfile(s); setSearchQuery(''); }}
                      className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer border-b last:border-0 transition-colors"
                    >
                      <img src={s.avatarUrl} className="w-10 h-10 rounded-full border-2 border-slate-100 object-cover" />
                      <div className="flex-grow">
                        <div className="text-xs font-black text-slate-800">{s.fullName}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <span style={{ color: HOUSES[s.houseId].colorHex }}>{HOUSES[s.houseId].name}</span> • {s.points} pts
                        </div>
                      </div>
                      <span className="text-brand-blue font-black text-xs">VIEW</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 md:space-x-4 shrink-0">
              {!isProjectorMode && (
                <button
                  onClick={toggleProjectorMode}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-white/10"
                >
                  <span className="text-lg">🗖</span>
                  <span className="hidden lg:inline">Projector</span>
                </button>
              )}

              <Link to="/live" className={`px-4 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${isLive ? 'bg-white/20' : ''}`}>Live</Link>
              <Link to="/admin" className={`px-4 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${!isLive ? 'bg-white/20' : ''}`}>Admin</Link>
              <a href="/#/parent-login" className="px-4 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-300/30">👨‍👩‍👧 Parents</a>
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
          <div className="fixed inset-0 z-[800] pointer-events-none overflow-hidden">
            {pointBubbles.map((b, index) => (
              <div
                key={b.id}
                className={`absolute ${b.amount >= 0 ? 'animate-points-float-up' : 'animate-points-break-fall'}`}
                style={{
                  top: b.amount >= 0 ? '60%' : '20%',
                  left: `${50 + (index - 2) * 15}%`,
                  transform: 'translateX(-50%)'
                }}
              >
                <div className={`
                  backdrop-blur-md shadow-2xl rounded-3xl px-6 py-4 border-4
                  ${b.amount >= 0
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-300 animate-sparkle-burst'
                    : 'bg-gradient-to-br from-red-500 to-red-700 border-red-400 animate-red-pulse'
                  }
                `}>
                  {/* Sparkles for positive points */}
                  {b.amount >= 0 && (
                    <>
                      <div className="absolute -top-2 -left-2 text-2xl animate-ping">✨</div>
                      <div className="absolute -top-1 -right-2 text-xl animate-ping" style={{ animationDelay: '0.1s' }}>⭐</div>
                      <div className="absolute -bottom-1 -left-1 text-lg animate-ping" style={{ animationDelay: '0.2s' }}>💫</div>
                    </>
                  )}
                  {/* Crack lines for negative points */}
                  {b.amount < 0 && (
                    <div className="absolute inset-0 opacity-30">
                      <div className="absolute top-1/4 left-1/3 w-8 h-0.5 bg-white rotate-45"></div>
                      <div className="absolute top-1/2 right-1/4 w-6 h-0.5 bg-white -rotate-12"></div>
                      <div className="absolute bottom-1/3 left-1/2 w-4 h-0.5 bg-white rotate-90"></div>
                    </div>
                  )}
                  <div className="flex items-center gap-4 relative">
                    <div className="text-white text-lg font-black uppercase tracking-wider drop-shadow-lg">{b.name}</div>
                    <div className={`
                      px-4 py-1.5 rounded-full text-base font-black border-2
                      ${b.amount >= 0
                        ? 'bg-white/30 border-white/50 text-white'
                        : 'bg-black/20 border-white/30 text-white'
                      }
                    `}>
                      {b.amount >= 0 ? '+' : ''}{b.amount} pts
                    </div>
                  </div>
                  <div className="text-white/90 text-sm font-bold mt-2 text-center drop-shadow">{b.message}</div>
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
