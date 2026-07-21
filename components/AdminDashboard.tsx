
import React, { useEffect, useRef, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { GameSession, Student, NotificationEvent } from '../types';
import DrillLauncher from './Admin/DrillLauncher';
import GameHistoryList from './Admin/GameHistoryList';
import EnrollAthleteForm from './Admin/EnrollAthleteForm';
import BatchAwardForm from './Admin/BatchAwardForm';
import RollCallPanel from './Admin/RollCallPanel';
import { AudioService } from '../utils/audio';
import RosterList from './Admin/RosterList';
import InsightsDashboard from './Admin/InsightsDashboard';
import BrandingSettings from './Admin/BrandingSettings';
import AttendanceScanner from './Admin/AttendanceScanner';
import StudentProfileModal from './StudentProfileModal';
import QRScanner from './Admin/QRScanner';
import GameStatsDashboard from './GameStatsDashboard';
import SeasonManager from './v2/SeasonManager';
import TournamentManager from './v2/TournamentManager';
import BlogManager from './Admin/BlogManager';
import ParentManager from './Admin/ParentManager';
import CheckInBoard from './Admin/CheckInBoard';
import MessagesManager from './Admin/MessagesManager';
import PartnerManager from './Admin/PartnerManager';
import TaskManager from './Admin/TaskManager';
import RedemptionQueue from './Admin/RedemptionQueue';
import StaffManager from './Admin/StaffManager';
import NfcManager from './Admin/NfcManager';
import ScanLog from './Admin/ScanLog';
import MedalsPanel from './Admin/MedalsPanel';
import BoostControl from './Admin/BoostControl';
import TokenCenter from './Admin/TokenCenter';
import JackpotPanel from './Admin/JackpotPanel';
import MarketplaceManager from './Admin/MarketplaceManager';
import SeasonReset from './Admin/SeasonReset';
import HouseDraft from './Admin/HouseDraft';
import VoltLevelsEditor from './Admin/VoltLevelsEditor';
import EcosystemGuide from './Admin/EcosystemGuide';
import { Ic } from './icons';
import { gameCenter } from '../services/gameCenter';
import { useNfcWedge, useWebNfc, WedgeScan } from './useNfcWedge';
import { haptic } from '../utils/haptics';

// Sub-pages that swap the tab switcher for a back button + page title
const SUB_PAGES: string[] = ['INSIGHTS', 'BRANDING', 'RANKS', 'VOLT', 'GUIDE', 'SEASONS', 'TOURNAMENTS', 'BLOG', 'PARENTS', 'CHECKIN', 'MESSAGES', 'PARTNERS', 'TASKS', 'REDEMPTIONS', 'STAFF', 'NFC', 'SCANLOG', 'MEDALS', 'TOKENS', 'JACKPOT', 'MARKET', 'RESET', 'HOUSEDRAFT'];

// Pubzi theme: small notched cut-corner shape for inline elements
const NOTCH_SM = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

// Reusable Modal Wrapper for mobile-friendly modals
const MobileModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  fullHeight?: boolean;
}> = ({ isOpen, onClose, title, icon, children }) => {
  if (!isOpen) return null;

  // In-layout panel (absolute inside the admin root, which already sits
  // below the site header). No position:fixed anywhere — iOS Safari
  // misplaces fixed layers, which buried the title bar over the content
  // and lost the action bar on phones. Structure: opaque flex column,
  // title bar in flow on top, content scrolling below — overlap is
  // impossible, and closing reveals the untouched screen underneath.
  return (
    <div
      className="pz-scope animate-fade-in flex flex-col"
      style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'var(--pz-bg)' }}
      role="dialog"
      aria-label={title}
    >
      <div
        className="mobile-modal-header"
        style={{ position: 'static', flexShrink: 0, background: 'var(--pz-panel)', borderBottom: '1px solid var(--pz-border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 text-[#CBFE1C] flex items-center">{icon}</span>
          <h2 className="pz-display text-sm sm:text-lg text-white tracking-tight truncate">{title}</h2>
        </div>
        <button
          onClick={onClose}
          className="touch-btn w-11 h-11 rounded-full bg-white/5 border border-white/10 text-white/60 active:scale-95 transition-transform flex-shrink-0 focus-ring"
          aria-label="Close"
        >
          <Ic.XMark size={20} />
        </button>
      </div>

      <div className="mobile-modal-content" style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
};

// Activity Log Component — every entry shows which coach did it
const ActivityLog: React.FC<{ events: NotificationEvent[] }> = ({ events }) => (
  <div className="pz-card overflow-hidden">
    <div className="space-y-2 max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
      {events.length === 0 ? (
        <div className="text-center py-12 italic text-sm" style={{ color: 'var(--pz-text)' }}>No activity recorded for this session.</div>
      ) : (
        events.map((e, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10" style={{ clipPath: NOTCH_SM }}>
            <div className="flex-grow min-w-0">
              <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--pz-text)' }}>
                {new Date(e.timestamp).toLocaleTimeString()}
                {e.adminName && <span style={{ color: 'var(--pz-volt)' }}> · by {e.adminName}</span>}
              </div>
              <div className="text-sm font-bold text-white leading-tight mt-0.5">{e.message}</div>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

// Quick Action Button for bottom bar - touch-optimized
const QuickActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
}> = ({ icon, label, onClick, active, badge }) => (
  <button
    onClick={onClick}
    className={`touch-btn flex flex-col items-center justify-center gap-1 py-2 px-2 sm:px-3 min-w-[56px] min-h-[56px] sm:min-w-[64px] relative transition-all active:scale-95 focus-ring rounded-xl ${active ? 'text-[#CBFE1C] bg-[#CBFE1C]/10' : 'text-white/50 hover:bg-white/5'
      }`}
  >
    <span className="flex items-center justify-center">{icon}</span>
    <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap leading-none">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

const AdminDashboard: React.FC = () => {
  const [adminName, setAdminName] = useState<string>('');
  const [showLoginModal, setShowLoginModal] = useState(true);
  const [activeTab, setActiveTab] = useState<'GAMES' | 'ATHLETES' | 'INSIGHTS' | 'BRANDING' | 'SEASONS' | 'TOURNAMENTS' | 'BLOG' | 'PARENTS' | 'CHECKIN' | 'MESSAGES' | 'PARTNERS' | 'TASKS' | 'REDEMPTIONS' | 'STAFF' | 'NFC' | 'SCANLOG' | 'MEDALS' | 'TOKENS' | 'JACKPOT' | 'MARKET' | 'RESET' | 'HOUSEDRAFT' | 'RANKS' | 'VOLT' | 'GUIDE'>('GAMES');
  const [students, setStudents] = useState<Student[]>([]);
  const [gameHistory, setGameHistory] = useState<GameSession[]>([]);
  const [globalActivity, setGlobalActivity] = useState<NotificationEvent[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Modal states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showStatsDashboard, setShowStatsDashboard] = useState(false);
  const [showRollCall, setShowRollCall] = useState(false);
  const [showBatchAward, setShowBatchAward] = useState(false);
  const [showEnrollAthlete, setShowEnrollAthlete] = useState(false);
  const [showGameHistory, setShowGameHistory] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  // Main tab to restore when backing out of a More-menu sub-page
  const [returnTab, setReturnTab] = useState<'GAMES' | 'ATHLETES'>('GAMES');
  // True while a MobileModal was opened FROM the More menu, so closing it
  // reopens the menu list instead of dropping to the tab underneath.
  const [returnToMore, setReturnToMore] = useState(false);

  // Open a modal from the More menu and remember to come back to the menu.
  const openModalFromMore = (open: () => void) => {
    setShowMoreMenu(false);
    setReturnToMore(true);
    open();
  };
  // Close a modal; if it came from the More menu, reopen the menu list.
  const closeModalToMore = (close: () => void) => {
    close();
    if (returnToMore) {
      setReturnToMore(false);
      setShowMoreMenu(true);
    }
  };

  // Every sub-page is entered from the More menu, so Back reopens that menu
  // (and restores the main tab underneath) instead of dumping to Games.
  const openSubPage = (tab: typeof activeTab) => {
    if (activeTab === 'GAMES' || activeTab === 'ATHLETES') setReturnTab(activeTab);
    setShowMoreMenu(false);
    setActiveTab(tab);
  };

  const closeSubPage = () => {
    setActiveTab(returnTab);
    setShowMoreMenu(true);
  };

  const [toasts, setToasts] = useState<Array<{ id: string; message: string; amount?: number }>>([]);

  // Global point boost (2x Fridays etc.) — live-updates from settings
  const [boostMult, setBoostMult] = useState(1);
  useEffect(() => gameCenter.subscribePointMultiplier(setBoostMult), []);

  // ── Global band scans: every tap routes itself from ANY admin screen ──────
  // The NFC Bands page owns scans while it's open (assign flows); everywhere
  // else a tap is smart: live NFC-mode game → the game's rules decide (timed
  // games log splits, score games bank points); no game → door check-in.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const adminNameRef = useRef(adminName);
  adminNameRef.current = adminName;
  const scanBusyRef = useRef(false);

  const pushScanToast = (message: string, amount?: number) => {
    const id = `nfc-${Date.now()}`;
    setToasts(prev => [...prev, { id, message, amount }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const handleGlobalScan = async (scan: WedgeScan) => {
    if (activeTabRef.current === 'NFC') return; // NFC Bands page handles these
    if (!adminNameRef.current || scanBusyRef.current) return;
    scanBusyRef.current = true;
    try {
      const res = await gameCenter.nfcAutoScan(scan.uid, adminNameRef.current, scan.studentId);
      if (res.mode === 'UNKNOWN_TAG') {
        haptic('warning');
        pushScanToast('Unknown band — open NFC Bands to assign it');
      } else if (res.mode === 'GAME_TIME') {
        haptic('success');
        pushScanToast(
          res.splitMs
            ? `${res.fullName} — lap ${res.lap - 1} · ${(res.splitMs / 1000).toFixed(1)}s`
            : `${res.fullName} is on the clock — ${res.gameTitle}`
        );
        refreshData();
      } else if (res.mode === 'GAME_POINTS') {
        haptic('success');
        pushScanToast(`${res.fullName} banked +${res.amount} — ${res.gameTitle}`, res.amount);
        refreshData();
      } else if (res.mode === 'GAME_PAUSED') {
        haptic('warning');
        pushScanToast(res.message || 'Game is paused — tap not counted');
      } else if (res.status === 'ALREADY') {
        haptic('tap');
        pushScanToast(`${res.fullName} is already checked in`);
      } else {
        haptic('success');
        pushScanToast(`${res.fullName} checked in`, 10);
        refreshData();
      }
    } catch (e) {
      console.error('Global band scan failed:', e);
    } finally {
      scanBusyRef.current = false;
    }
  };
  const handleGlobalScanRef = useRef(handleGlobalScan);
  handleGlobalScanRef.current = handleGlobalScan;

  useNfcWedge((scan) => void handleGlobalScanRef.current(scan), true);
  // Mobile Web NFC (Android Chrome): tapping a band written with a student's
  // marker resolves them directly for check-in / scoring / timing.
  const webNfc = useWebNfc((scan) => void handleGlobalScanRef.current(scan));
  useEffect(
    () =>
      gameCenter.subscribeNfcAgentScans((scan) =>
        void handleGlobalScanRef.current({ uid: scan.uid, ts: scan.ts })
      ),
    []
  );

  // Check for existing coach session on mount
  useEffect(() => {
    try {
      const savedCoach = localStorage.getItem('coachName');
      const savedDate = localStorage.getItem('coachLoginDate');
      const today = new Date().toDateString();

      if (savedCoach && savedDate === today) {
        setAdminName(savedCoach);
        setShowLoginModal(false);
      } else {
        localStorage.removeItem('coachName');
        localStorage.removeItem('coachLoginDate');
      }
    } catch (err) {
      console.warn('localStorage access failed during session check:', err);
    }
  }, []);

  const handleCoachLogin = (name: string) => {
    const trimmedName = name.trim();
    if (trimmedName) {
      setAdminName(trimmedName);
      setShowLoginModal(false);
      try {
        localStorage.setItem('coachName', trimmedName);
        localStorage.setItem('coachLoginDate', new Date().toDateString());
      } catch (err) {
        console.warn('Failed to save coach session to localStorage:', err);
      }
      const today = new Date().toDateString();
      try {
        const lastPresenceReset = localStorage.getItem('presenceResetDate');
        if (lastPresenceReset !== today) {
          localStorage.setItem('presenceResetDate', today);
          supabaseService.resetDailyPresence(trimmedName).catch((err) => {
            console.warn('Failed to reset daily presence:', err);
            localStorage.removeItem('presenceResetDate');
          });
        }
      } catch (err) {
        console.warn('localStorage access failed:', err);
      }
    }
  };

  const handleChangeCoach = () => {
    try {
      localStorage.removeItem('coachName');
      localStorage.removeItem('coachLoginDate');
    } catch (err) {
      console.warn('Failed to clear localStorage:', err);
    }
    setAdminName('');
    setShowLoginModal(true);
  };

  const refreshData = async () => {
    try {
      const [s, h, act] = await Promise.all([
        supabaseService.getStudents(),
        supabaseService.getGameHistory(),
        supabaseService.getGlobalActivity()
      ]);
      setStudents(s);
      setGameHistory(h);
      setGlobalActivity(act);

      if (editingStudent) {
        const updated = s.find(stu => stu.id === editingStudent.id);
        if (updated) setEditingStudent(updated);
      }
    } catch (e: any) {
      console.error(`Dashboard refresh failed: ${e?.message || e}`);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await supabaseService.seedDatabase();
      await refreshData();
      alert("Demo data successfully seeded!");
    } catch (e: any) {
      alert(`Seeding failed: ${e?.message || e}`);
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (!showLoginModal) {
      refreshData();
      const u1 = supabaseService.on('notification', async (eventData) => {
        const e = eventData as NotificationEvent;
        refreshData();
        if (e.type === 'POINTS') {
          const msg = (e.message || '').toLowerCase();
          if (msg.includes('checked in') || msg.includes('marked absent') || msg.includes('roll call reset') || msg.includes('launch')) {
            return;
          }
          if (adminName && e.adminName && e.adminName !== adminName) return;
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          setToasts(prev => [...prev, { id, message: `${e.amount && e.amount > 0 ? '+' + e.amount : e.amount} pts ${e.studentName ? 'for ' + e.studentName : ''}`, amount: e.amount }]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
          }, 3000);
        }
      });
      const onCoachToast = (ev: any) => {
        const d = ev?.detail;
        if (!d?.message) return;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setToasts(prev => [...prev, { id, message: d.message, amount: d.amount }]);
        try {
          if (typeof d.amount === 'number') {
            if (d.amount > 0) AudioService.playRandomAward();
            else if (d.amount < 0) AudioService.playPointLost();
          }
        } catch (err) {
          console.warn('Audio playback failed:', err);
        }
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
      };
      window.addEventListener('coach-toast', onCoachToast as any);
      const u2 = supabaseService.on('points_update', refreshData);
      const u3 = supabaseService.on('game_start', refreshData);
      const u4 = supabaseService.on('game_end', refreshData);
      return () => { u1(); u2(); u3(); u4(); window.removeEventListener('coach-toast', onCoachToast as any); };
    }
  }, [showLoginModal]);

  const presentCount = students.filter(s => s.isPresent).length;

  // Login Modal
  if (showLoginModal) {
    return (
      <div className="fixed inset-0 z-[200] pz-scope flex items-center justify-center p-4" style={{ background: 'var(--pz-bg)' }}>
        <form onSubmit={(e) => {
          e.preventDefault();
          const v = (document.getElementById('adminNameInput') as HTMLInputElement).value;
          handleCoachLogin(v);
        }} className="pz-card p-8 md:p-12 max-w-md w-full text-center">
          <div className="pz-eyebrow mb-3">Admin Core</div>
          <h2 className="text-2xl md:text-3xl mb-6 tracking-tight text-white">Coach Login</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--pz-text)' }}>Sign in once per day</p>
          <input
            id="adminNameInput"
            type="text"
            placeholder="Your Name"
            className="w-full px-6 py-4 border border-white/10 bg-[#171C27] text-white placeholder-white/40 text-center text-lg font-bold focus:border-[#CBFE1C] outline-none mb-6"
            style={{ clipPath: NOTCH_SM }}
            required
          />
          <button type="submit" className="pz-btn w-full py-4 text-lg transition-all active:scale-95">
            Launch Dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col pz-scope overflow-hidden" style={{ background: 'var(--pz-bg)' }}>
      {/* Modals */}
      {editingStudent && (
        <StudentProfileModal
          student={editingStudent}
          adminName={adminName}
          onClose={() => setEditingStudent(null)}
          onRefresh={refreshData}
          isAdminMode={true}
        />
      )}

      {showQRScanner && (
        <QRScanner
          onClose={() => closeModalToMore(() => setShowQRScanner(false))}
          onStudentCheckedIn={refreshData}
        />
      )}

      {showStatsDashboard && (
        <GameStatsDashboard onClose={() => setShowStatsDashboard(false)} />
      )}

      {/* Roll Call Modal */}
      <MobileModal isOpen={showRollCall} onClose={() => setShowRollCall(false)} title="Roll Call" icon={<Ic.ClipboardCheck size={22} />}>
        <RollCallPanel students={students} adminName={adminName} onRefresh={refreshData} />
      </MobileModal>

      {/* Batch Award Modal */}
      <MobileModal isOpen={showBatchAward} onClose={() => setShowBatchAward(false)} title="Batch Award" icon={<Ic.Star size={22} />}>
        <BatchAwardForm students={students} adminName={adminName} onSuccess={() => { refreshData(); }} />
      </MobileModal>

      {/* Enroll Athlete Modal */}
      <MobileModal isOpen={showEnrollAthlete} onClose={() => setShowEnrollAthlete(false)} title="Enroll Athlete" icon={<Ic.UserPlus size={22} />}>
        <EnrollAthleteForm onSuccess={() => { refreshData(); setShowEnrollAthlete(false); }} />
      </MobileModal>

      {/* Game History Modal */}
      <MobileModal isOpen={showGameHistory} onClose={() => closeModalToMore(() => setShowGameHistory(false))} title="Game History" icon={<Ic.History size={22} />}>
        <GameHistoryList history={gameHistory} />
      </MobileModal>

      {/* Activity Log Modal */}
      <MobileModal isOpen={showActivityLog} onClose={() => closeModalToMore(() => setShowActivityLog(false))} title="Activity Log" icon={<Ic.Chart size={22} />}>
        <ActivityLog events={globalActivity} />
      </MobileModal>

      {/* More Menu Modal */}
      <MobileModal isOpen={showMoreMenu} onClose={() => setShowMoreMenu(false)} title="Quick Actions" icon={<Ic.Bolt size={22} />}>
        <div className="space-y-3">
          <BoostControl />

          <button
            onClick={() => openSubPage('MEDALS')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
            style={{ borderColor: 'rgba(203,254,28,0.35)' }}
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Medal size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Session Legends</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Crown today's legends with medals & bonus points</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('CHECKIN')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 text-[#0B0E13] active:scale-[0.98] transition-transform"
            style={{ background: 'var(--pz-volt)', borderColor: 'var(--pz-volt)' }}
          >
            <span className="flex-shrink-0"><Ic.Controller size={24} /></span>
            <div className="text-left">
              <div className="font-black uppercase tracking-wide text-[15px]">Check-In Board</div>
              <div className="text-xs opacity-70 font-bold">Today's board, rotating QR & NFC kiosk</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('MESSAGES')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Chat size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Messages</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Chat with parents in real time</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('STAFF')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Users size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Staff & Coaches</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Invite coaches & manage admin access</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('PARENTS')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Family size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Parent Accounts</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Invite parents, link athletes & manage accounts</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('NFC')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Nfc size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">NFC Bands</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Assign wristbands · tap to check in, score & time</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('SCANLOG')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.History size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Scan Log</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Every check-in & NFC tap, exportable</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('PARTNERS')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Store size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Partners</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Local businesses & printable QR codes</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('TASKS')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Star size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Special Tasks</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Off-site challenges & approval queue</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('REDEMPTIONS')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Gift size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Redemptions</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Fulfill perks kids have claimed</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('HOUSEDRAFT')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Home size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">House Draft</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Balanced randomizer, drag-and-drop, held reveal</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('MARKET')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Cart size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Marketplace</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Donated prizes, point prices & claim-code handovers</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('JACKPOT')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Confetti size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Jackpot</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Spin a random gift for a lucky athlete</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('TOKENS')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Coin size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Token Center</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>FitToken packs, purchases & balances</div>
            </div>
          </button>

          <button
            onClick={() => openModalFromMore(() => setShowGameHistory(true))}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.History size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Game History</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>View past games and results</div>
            </div>
          </button>

          <button
            onClick={() => openModalFromMore(() => setShowActivityLog(true))}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Chart size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Activity Log</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Recent point changes and events</div>
            </div>
          </button>

          <button
            onClick={() => openModalFromMore(() => setShowQRScanner(true))}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Camera size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">QR Scanner</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Scan athlete QR codes</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('SEASONS')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Calendar size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Seasons</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Manage competitive seasons</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('TOURNAMENTS')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Trophy size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Tournaments</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Brackets and match management</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('BRANDING')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Sparkle size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Branding</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Customize app appearance</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('RANKS')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Medal size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Ranks &amp; Levels</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Edit rank requirements — points, XP &amp; tasks</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('VOLT')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Bolt size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Volt Levels</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Edit Volt XP thresholds &amp; perk unlock levels</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('GUIDE')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Info size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">How It Works</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>New-coach guide to Points, XP, Ranks &amp; Volt Levels</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('BLOG')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Note size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Blog & Alerts</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Post announcements and alerts</div>
            </div>
          </button>

          <button
            onClick={() => openSubPage('INSIGHTS')}
            className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
          >
            <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Chart size={24} /></span>
            <div className="text-left">
              <div className="font-black text-white uppercase tracking-wide text-[15px]">Insights & Reports</div>
              <div className="text-xs" style={{ color: 'var(--pz-text)' }}>View analytics and generate reports</div>
            </div>
          </button>

          <div className="pt-2 border-t border-white/10 mt-4">
            <button
              onClick={() => { setShowMoreMenu(false); window.location.hash = '#/parent-login'; }}
              className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
            >
              <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Family size={24} /></span>
              <div className="text-left">
                <div className="font-black text-white uppercase tracking-wide text-[15px]">Parent Portal</div>
                <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Switch to your parent side (kids, check-in, tokens)</div>
              </div>
            </button>

            <button
              onClick={() => openSubPage('RESET')}
              className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
              style={{ borderColor: 'rgba(248,113,113,0.4)' }}
            >
              <span className="flex-shrink-0 text-red-400"><Ic.Warning size={24} /></span>
              <div className="text-left">
                <div className="font-black text-white uppercase tracking-wide text-[15px]">Season Reset</div>
                <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Zero out points, XP, or everything — two-step confirmed</div>
              </div>
            </button>

            <button
              onClick={handleChangeCoach}
              className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 active:scale-[0.98] transition-transform"
              style={{ background: 'var(--pz-panel-2)' }}
            >
              <span className="flex-shrink-0 text-[#CBFE1C]"><Ic.Refresh size={24} /></span>
              <div className="text-left">
                <div className="font-black text-white uppercase tracking-wide text-[15px]">Switch Coach</div>
                <div className="text-xs" style={{ color: 'var(--pz-text)' }}>Currently: {adminName}</div>
              </div>
            </button>
          </div>

          {students.length === 0 && (
            <button
              onClick={() => { setShowMoreMenu(false); handleSeed(); }}
              disabled={isSeeding}
              className="pz-card-sm w-full min-h-[64px] flex items-center gap-4 p-4 text-white active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ background: 'var(--pz-sage)', borderColor: 'var(--pz-sage)' }}
            >
              <span className="flex-shrink-0"><Ic.Dice size={24} /></span>
              <div className="text-left">
                <div className="font-black uppercase tracking-wide text-[15px]">{isSeeding ? 'Seeding...' : 'Seed Demo Data'}</div>
                <div className="text-xs opacity-80">Add sample athletes to test</div>
              </div>
            </button>
          )}
        </div>
      </MobileModal>

      {/* Top Header Bar - Mobile First */}
      <header className="px-3 sm:px-4 py-2.5 sm:py-3 shrink-0" style={{ zIndex: 'var(--z-header)', background: 'var(--pz-bg)', borderBottom: '1px solid var(--pz-border)' }}>
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Back Button (shown on sub-pages) OR Coach Info */}
          {SUB_PAGES.includes(activeTab) ? (
            <button
              onClick={closeSubPage}
              className="touch-btn flex items-center gap-2 text-white font-black text-sm px-3 py-2 min-h-[44px] bg-white/5 border border-white/10 active:bg-white/10 transition-all"
              style={{ clipPath: NOTCH_SM }}
            >
              <Ic.ArrowLeft size={18} />
              <span className="hidden sm:inline uppercase tracking-wider text-xs">Back</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-xs sm:text-sm font-black text-[#0B0E13]" style={{ background: 'var(--pz-volt)', clipPath: NOTCH_SM }}>
                {adminName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 hidden xs:block sm:block">
                <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--pz-text)' }}>Coach</div>
                <div className="text-xs sm:text-sm font-black text-white truncate max-w-[80px] sm:max-w-[120px]">{adminName}</div>
              </div>
              {boostMult > 1 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-black text-[#0B0E13] shrink-0"
                  style={{ background: 'var(--pz-volt)', clipPath: NOTCH_SM }}
                  title={`${boostMult}x point boost active`}
                >
                  <Ic.Bolt size={12} /> {boostMult}x
                </span>
              )}
            </div>
          )}

          {/* Page Title (for sub-pages) OR Tab Switcher */}
          {SUB_PAGES.includes(activeTab) ? (
            <div className="flex-grow flex justify-center">
              <h1 className="pz-display text-sm sm:text-base tracking-tight inline-flex items-center gap-2 text-[#CBFE1C]">
                {activeTab === 'INSIGHTS' && <><Ic.Chart size={20} /><span className="text-white">Insights</span></>}
                {activeTab === 'BRANDING' && <><Ic.Sparkle size={20} /><span className="text-white">Branding</span></>}
                {activeTab === 'RANKS' && <><Ic.Medal size={20} /><span className="text-white">Ranks &amp; Levels</span></>}
                {activeTab === 'VOLT' && <><Ic.Bolt size={20} /><span className="text-white">Volt Levels</span></>}
                {activeTab === 'GUIDE' && <><Ic.Info size={20} /><span className="text-white">How It Works</span></>}
                {activeTab === 'SEASONS' && <><Ic.Calendar size={20} /><span className="text-white">Seasons</span></>}
                {activeTab === 'TOURNAMENTS' && <><Ic.Trophy size={20} /><span className="text-white">Tournaments</span></>}
                {activeTab === 'BLOG' && <><Ic.Note size={20} /><span className="text-white">Blog & Alerts</span></>}
                {activeTab === 'PARENTS' && <><Ic.Family size={20} /><span className="text-white">Parent Accounts</span></>}
                {activeTab === 'CHECKIN' && <><Ic.Controller size={20} /><span className="text-white">Check-In Board</span></>}
                {activeTab === 'MESSAGES' && <><Ic.Chat size={20} /><span className="text-white">Messages</span></>}
                {activeTab === 'PARTNERS' && <><Ic.Store size={20} /><span className="text-white">Partners</span></>}
                {activeTab === 'TASKS' && <><Ic.Star size={20} /><span className="text-white">Special Tasks</span></>}
                {activeTab === 'REDEMPTIONS' && <><Ic.Gift size={20} /><span className="text-white">Redemptions</span></>}
                {activeTab === 'STAFF' && <><Ic.Users size={20} /><span className="text-white">Staff & Coaches</span></>}
                {activeTab === 'NFC' && <><Ic.Nfc size={20} /><span className="text-white">NFC Bands</span></>}
                {activeTab === 'SCANLOG' && <><Ic.History size={20} /><span className="text-white">Check-In & Scan Log</span></>}
                {activeTab === 'MEDALS' && <><Ic.Medal size={20} /><span className="text-white">Session Legends</span></>}
                {activeTab === 'TOKENS' && <><Ic.Coin size={20} /><span className="text-white">Token Center</span></>}
                {activeTab === 'JACKPOT' && <><Ic.Confetti size={20} /><span className="text-white">Jackpot</span></>}
                {activeTab === 'MARKET' && <><Ic.Cart size={20} /><span className="text-white">Marketplace</span></>}
                {activeTab === 'RESET' && <><Ic.Warning size={20} /><span className="text-white">Season Reset</span></>}
                {activeTab === 'HOUSEDRAFT' && <><Ic.Home size={20} /><span className="text-white">House Draft</span></>}
              </h1>
            </div>
          ) : (
            <div className="flex bg-white/5 border border-white/15 p-1 gap-1 flex-grow max-w-[260px] sm:max-w-[340px]" style={{ clipPath: NOTCH_SM }}>
              {(['GAMES', 'ATHLETES'] as const).map(tab => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    aria-pressed={isActive}
                    className={`flex-1 touch-btn relative px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm font-black uppercase tracking-wider transition-all focus-ring inline-flex items-center justify-center gap-1.5 ${isActive
                      ? 'text-[#0B0E13]'
                      : 'text-white/60 hover:text-white active:bg-white/10'
                      }`}
                    style={isActive ? { background: 'var(--pz-volt)', clipPath: NOTCH_SM, boxShadow: '0 0 14px rgba(203,254,28,0.45)' } : undefined}
                  >
                    {tab === 'GAMES' ? <Ic.Controller size={18} /> : <Ic.Users size={18} />}
                    <span>{tab === 'GAMES' ? 'Games' : 'Athletes'}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Attendance Quick View (hidden on sub-pages for cleaner UI) */}
          {!SUB_PAGES.includes(activeTab) && (
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {webNfc.supported && (
                <button
                  onClick={() => (webNfc.reading ? webNfc.stop() : webNfc.start())}
                  title="Tap NFC bands to check in, score, or time"
                  className={`touch-btn px-2 sm:px-3 py-1.5 rounded-lg text-[9px] font-black uppercase inline-flex items-center gap-1 border transition-all ${webNfc.reading ? 'bg-[#CBFE1C] text-[#0B0E13] border-[#CBFE1C]' : 'bg-white/5 text-white/60 border-white/10'}`}
                >
                  <Ic.Nfc size={14} /> <span className="hidden sm:inline">{webNfc.reading ? 'Reading' : 'Tap-in'}</span>
                </button>
              )}
              <AttendanceScanner
                students={students}
                adminName={adminName}
                onOpenQRScanner={() => setShowQRScanner(true)}
              />
            </div>
          )}

          {/* Placeholder for sub-pages to balance the header */}
          {SUB_PAGES.includes(activeTab) && (
            <div className="w-[60px] sm:w-[80px]"></div>
          )}
        </div>
      </header>

      {/* Toast Notifications - Responsive positioning */}
      <div className="fixed top-14 sm:top-16 right-2 sm:right-4 left-2 sm:left-auto space-y-2 pointer-events-none" style={{ zIndex: 'var(--z-toast)' }}>
        {toasts.map(t => (
          <div key={t.id} className={`animate-slide-in-right pz-card-sm ${t.amount && t.amount < 0 ? 'text-red-400' : 'text-emerald-400'} px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-black`} style={{ borderColor: t.amount && t.amount < 0 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.5)' }}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Main Content Area - Mobile optimized with proper bottom padding */}
      <main className="flex-grow min-h-0 overflow-y-auto custom-scrollbar" style={{ paddingBottom: '1rem' }}>
        {/* The Messages tab is a fixed-height app (list scrolls, composer pinned
            above the nav) so its wrapper fills the main area instead of flowing;
            every other tab keeps the normal padded, stacked layout. */}
        <div className={activeTab === 'MESSAGES' ? 'h-full min-h-0 p-3 sm:p-4' : 'p-3 sm:p-4 space-y-3 sm:space-y-4'}>
          {activeTab === 'GAMES' && (
            <DrillLauncher adminName={adminName} students={students} />
          )}

          {activeTab === 'ATHLETES' && (
            <RosterList
              students={students}
              adminName={adminName}
              onOpenEdit={setEditingStudent}
              onRefresh={refreshData}
            />
          )}

          {activeTab === 'INSIGHTS' && (
            <div className="space-y-4">
              {/* Awards Report Button */}
              <div className="pz-card p-5 text-white">
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="pz-eyebrow mb-1">Season Report</div>
                    <h2 className="text-xl tracking-tight mb-1 text-white">
                      Season Awards
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--pz-text)' }}>
                      Generate MVP awards, standings, and printable reports
                    </p>
                  </div>
                  <button
                    onClick={() => setShowStatsDashboard(true)}
                    className="pz-btn w-full min-h-[48px] py-3 text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Ic.Trophy size={18} />
                    Generate Report
                  </button>
                </div>
              </div>

              <InsightsDashboard students={students} />
            </div>
          )}

          {activeTab === 'BRANDING' && (
            <BrandingSettings />
          )}
          {activeTab === 'RANKS' && (
            <BrandingSettings initialTab="ranks" />
          )}
          {activeTab === 'VOLT' && (
            <VoltLevelsEditor />
          )}
          {activeTab === 'GUIDE' && (
            <EcosystemGuide />
          )}

          {activeTab === 'SEASONS' && (
            <SeasonManager />
          )}

          {activeTab === 'TOURNAMENTS' && (
            <TournamentManager />
          )}

          {activeTab === 'BLOG' && (
            <BlogManager />
          )}

          {activeTab === 'PARENTS' && (
            <ParentManager students={students} adminName={adminName} />
          )}

          {activeTab === 'CHECKIN' && (
            <CheckInBoard adminName={adminName} />
          )}

          {activeTab === 'MESSAGES' && (
            <MessagesManager adminName={adminName} />
          )}

          {activeTab === 'PARTNERS' && (
            <PartnerManager />
          )}

          {activeTab === 'TASKS' && (
            <TaskManager adminName={adminName} />
          )}

          {activeTab === 'REDEMPTIONS' && (
            <RedemptionQueue adminName={adminName} />
          )}

          {activeTab === 'NFC' && (
            <NfcManager adminName={adminName} />
          )}

          {activeTab === 'SCANLOG' && (
            <ScanLog />
          )}

          {activeTab === 'MEDALS' && (
            <MedalsPanel students={students} adminName={adminName} onRefresh={refreshData} />
          )}

          {activeTab === 'STAFF' && (
            <StaffManager adminName={adminName} />
          )}

          {activeTab === 'TOKENS' && (
            <TokenCenter students={students} adminName={adminName} onRefresh={refreshData} />
          )}

          {activeTab === 'JACKPOT' && (
            <JackpotPanel students={students} adminName={adminName} onRefresh={refreshData} />
          )}

          {activeTab === 'MARKET' && (
            <MarketplaceManager adminName={adminName} />
          )}

          {activeTab === 'RESET' && (
            <SeasonReset adminName={adminName} onRefresh={refreshData} />
          )}

          {activeTab === 'HOUSEDRAFT' && (
            <HouseDraft students={students} adminName={adminName} onRefresh={refreshData} />
          )}
        </div>
      </main>

      {/* Bottom Quick Action Bar - Mobile First */}
      {/* In-flow (not fixed): iOS Safari misplaces fixed bars. As the last
          flex row of the h-full column it's always glued to the bottom. */}
      <nav className="mobile-action-bar shrink-0" role="navigation" aria-label="Quick actions" style={{ position: 'static', background: 'var(--pz-panel)', borderTop: '1px solid var(--pz-border)', boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)' }}>
        <div className="flex items-center justify-around px-1 sm:px-2 py-1.5 sm:py-2 max-w-lg mx-auto">
          <QuickActionButton
            icon={<Ic.ClipboardCheck size={25} />}
            label="Roll Call"
            onClick={() => setShowRollCall(true)}
            badge={students.length - presentCount}
          />
          <QuickActionButton
            icon={<Ic.Star size={25} />}
            label="Award"
            onClick={() => setShowBatchAward(true)}
          />
          <QuickActionButton
            icon={<Ic.UserPlus size={25} />}
            label="Enroll"
            onClick={() => setShowEnrollAthlete(true)}
          />
          <QuickActionButton
            icon={<Ic.Medal size={25} />}
            label="Legends"
            onClick={() => openSubPage('MEDALS')}
          />
          <QuickActionButton
            icon={<Ic.Settings size={25} />}
            label="More"
            onClick={() => setShowMoreMenu(true)}
          />
        </div>
      </nav>
    </div>
  );
};

export default AdminDashboard;
