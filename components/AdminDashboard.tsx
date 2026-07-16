
import React, { useEffect, useState } from 'react';
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

// Sub-pages that swap the tab switcher for a back button + page title
const SUB_PAGES: string[] = ['INSIGHTS', 'BRANDING', 'SEASONS', 'TOURNAMENTS', 'BLOG', 'PARENTS', 'CHECKIN', 'MESSAGES', 'PARTNERS', 'TASKS', 'REDEMPTIONS'];

// Reusable Modal Wrapper for mobile-friendly modals
const MobileModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  children: React.ReactNode;
  fullHeight?: boolean;
}> = ({ isOpen, onClose, title, icon, children, fullHeight = true }) => {
  if (!isOpen) return null;

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="mobile-modal animate-fade-in" style={{ zIndex: 'var(--z-modal)' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className={`relative flex flex-col bg-slate-50 w-full ${fullHeight ? 'h-full' : 'max-h-[90vh] mt-auto rounded-t-3xl'} animate-slide-up`}>
        {/* Header - always sticky */}
        <div className="mobile-modal-header shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl sm:text-2xl flex-shrink-0">{icon}</span>
            <h2 className="text-sm sm:text-lg font-display font-black text-slate-900 uppercase tracking-tight truncate">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="touch-btn w-10 h-10 rounded-full bg-slate-100 text-slate-500 text-lg font-bold active:scale-95 transition-transform flex-shrink-0 focus-ring"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="mobile-modal-content">
          {children}
        </div>
      </div>
    </div>
  );
};

// Activity Log Component
const ActivityLog: React.FC<{ events: NotificationEvent[] }> = ({ events }) => (
  <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
    <div className="space-y-2 max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
      {events.length === 0 ? (
        <div className="text-center py-12 text-slate-400 italic text-sm">No activity recorded for this session.</div>
      ) : (
        events.map((e, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex-grow min-w-0">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(e.timestamp).toLocaleTimeString()}</div>
              <div className="text-sm font-bold text-slate-800 leading-tight mt-0.5">{e.message}</div>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

// Quick Action Button for bottom bar - touch-optimized
const QuickActionButton: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
}> = ({ icon, label, onClick, active, badge }) => (
  <button
    onClick={onClick}
    className={`touch-btn flex flex-col items-center justify-center py-2 px-2 sm:px-3 min-w-[56px] sm:min-w-[64px] relative transition-all active:scale-95 focus-ring rounded-xl ${active ? 'text-brand-blue bg-blue-50' : 'text-slate-500 hover:bg-slate-50'
      }`}
  >
    <span className="text-lg sm:text-xl mb-0.5">{icon}</span>
    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wide whitespace-nowrap">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[7px] sm:text-[8px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

const AdminDashboard: React.FC = () => {
  const [adminName, setAdminName] = useState<string>('');
  const [showLoginModal, setShowLoginModal] = useState(true);
  const [activeTab, setActiveTab] = useState<'GAMES' | 'ATHLETES' | 'INSIGHTS' | 'BRANDING' | 'SEASONS' | 'TOURNAMENTS' | 'BLOG' | 'PARENTS' | 'CHECKIN' | 'MESSAGES' | 'PARTNERS' | 'TASKS' | 'REDEMPTIONS'>('GAMES');
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

  const [toasts, setToasts] = useState<Array<{ id: string; message: string; amount?: number }>>([]);

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
      <div className="fixed inset-0 z-[200] bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={(e) => {
          e.preventDefault();
          const v = (document.getElementById('adminNameInput') as HTMLInputElement).value;
          handleCoachLogin(v);
        }} className="bg-white rounded-3xl p-8 md:p-12 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl md:text-3xl font-display font-black mb-6 uppercase tracking-tight text-slate-900">Coach Login</h2>
          <p className="text-slate-500 text-sm mb-6">Sign in once per day</p>
          <input
            id="adminNameInput"
            type="text"
            placeholder="Your Name"
            className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 text-center text-lg focus:border-brand-blue outline-none mb-6"
            required
          />
          <button type="submit" className="w-full bg-brand-blue text-white font-black py-4 rounded-2xl text-lg uppercase tracking-widest shadow-xl transition-all active:scale-95">
            Launch Dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
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
          onClose={() => setShowQRScanner(false)}
          onStudentCheckedIn={refreshData}
        />
      )}

      {showStatsDashboard && (
        <GameStatsDashboard onClose={() => setShowStatsDashboard(false)} />
      )}

      {/* Roll Call Modal */}
      <MobileModal isOpen={showRollCall} onClose={() => setShowRollCall(false)} title="Roll Call" icon="📋">
        <RollCallPanel students={students} adminName={adminName} onRefresh={refreshData} />
      </MobileModal>

      {/* Batch Award Modal */}
      <MobileModal isOpen={showBatchAward} onClose={() => setShowBatchAward(false)} title="Batch Award" icon="⭐">
        <BatchAwardForm students={students} adminName={adminName} onSuccess={() => { refreshData(); setShowBatchAward(false); }} />
      </MobileModal>

      {/* Enroll Athlete Modal */}
      <MobileModal isOpen={showEnrollAthlete} onClose={() => setShowEnrollAthlete(false)} title="Enroll Athlete" icon="🆕">
        <EnrollAthleteForm onSuccess={() => { refreshData(); setShowEnrollAthlete(false); }} />
      </MobileModal>

      {/* Game History Modal */}
      <MobileModal isOpen={showGameHistory} onClose={() => setShowGameHistory(false)} title="Game History" icon="📜">
        <GameHistoryList history={gameHistory} />
      </MobileModal>

      {/* Activity Log Modal */}
      <MobileModal isOpen={showActivityLog} onClose={() => setShowActivityLog(false)} title="Activity Log" icon="📜">
        <ActivityLog events={globalActivity} />
      </MobileModal>

      {/* More Menu Modal */}
      <MobileModal isOpen={showMoreMenu} onClose={() => setShowMoreMenu(false)} title="Quick Actions" icon="⚡">
        <div className="space-y-3">
          <button
            onClick={() => { setShowMoreMenu(false); setActiveTab('CHECKIN'); }}
            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl shadow-lg active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">🎮</span>
            <div className="text-left">
              <div className="font-black">Check-In Board</div>
              <div className="text-xs opacity-80">Today's board, rotating QR & NFC kiosk</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setActiveTab('MESSAGES'); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">💬</span>
            <div className="text-left">
              <div className="font-black text-slate-900">Messages</div>
              <div className="text-xs text-slate-500">Chat with parents in real time</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setActiveTab('PARTNERS'); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">🏪</span>
            <div className="text-left">
              <div className="font-black text-slate-900">Partners</div>
              <div className="text-xs text-slate-500">Local businesses & printable QR codes</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setActiveTab('TASKS'); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">⭐</span>
            <div className="text-left">
              <div className="font-black text-slate-900">Special Tasks</div>
              <div className="text-xs text-slate-500">Off-site challenges & approval queue</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setActiveTab('REDEMPTIONS'); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">🎁</span>
            <div className="text-left">
              <div className="font-black text-slate-900">Redemptions</div>
              <div className="text-xs text-slate-500">Fulfill perks kids have claimed</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setShowGameHistory(true); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">📜</span>
            <div className="text-left">
              <div className="font-black text-slate-900">Game History</div>
              <div className="text-xs text-slate-500">View past games and results</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setShowActivityLog(true); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">📊</span>
            <div className="text-left">
              <div className="font-black text-slate-900">Activity Log</div>
              <div className="text-xs text-slate-500">Recent point changes and events</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setShowQRScanner(true); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">📷</span>
            <div className="text-left">
              <div className="font-black text-slate-900">QR Scanner</div>
              <div className="text-xs text-slate-500">Scan athlete QR codes</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setActiveTab('SEASONS'); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">📅</span>
            <div className="text-left">
              <div className="font-black text-slate-900">Seasons</div>
              <div className="text-xs text-slate-500">Manage competitive seasons</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setActiveTab('TOURNAMENTS'); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">🏆</span>
            <div className="text-left">
              <div className="font-black text-slate-900">Tournaments</div>
              <div className="text-xs text-slate-500">Brackets and match management</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setActiveTab('BRANDING'); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">🎨</span>
            <div className="text-left">
              <div className="font-black text-slate-900">Branding</div>
              <div className="text-xs text-slate-500">Customize app appearance</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setActiveTab('PARENTS'); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">👨‍👩‍👧‍👦</span>
            <div className="text-left">
              <div className="font-black text-slate-900">Parent Accounts</div>
              <div className="text-xs text-slate-500">Manage parents & link athletes</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setActiveTab('BLOG'); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">📝</span>
            <div className="text-left">
              <div className="font-black text-slate-900">Blog & Alerts</div>
              <div className="text-xs text-slate-500">Post announcements and alerts</div>
            </div>
          </button>

          <button
            onClick={() => { setShowMoreMenu(false); setActiveTab('INSIGHTS'); }}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">📊</span>
            <div className="text-left">
              <div className="font-black text-slate-900">Insights & Reports</div>
              <div className="text-xs text-slate-500">View analytics and generate reports</div>
            </div>
          </button>

          <div className="pt-2 border-t border-slate-200 mt-4">
            <button
              onClick={handleChangeCoach}
              className="w-full flex items-center gap-4 p-4 bg-slate-100 rounded-2xl active:scale-[0.98] transition-transform"
            >
              <span className="text-2xl">🔄</span>
              <div className="text-left">
                <div className="font-black text-slate-700">Switch Coach</div>
                <div className="text-xs text-slate-500">Currently: {adminName}</div>
              </div>
            </button>
          </div>

          {students.length === 0 && (
            <button
              onClick={() => { setShowMoreMenu(false); handleSeed(); }}
              disabled={isSeeding}
              className="w-full flex items-center gap-4 p-4 bg-brand-green text-white rounded-2xl shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              <span className="text-2xl">🌱</span>
              <div className="text-left">
                <div className="font-black">{isSeeding ? 'Seeding...' : 'Seed Demo Data'}</div>
                <div className="text-xs opacity-80">Add sample athletes to test</div>
              </div>
            </button>
          )}
        </div>
      </MobileModal>

      {/* Top Header Bar - Mobile First */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3 shrink-0 shadow-sm" style={{ zIndex: 'var(--z-header)' }}>
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Back Button (shown on sub-pages) OR Coach Info */}
          {SUB_PAGES.includes(activeTab) ? (
            <button
              onClick={() => setActiveTab('GAMES')}
              className="touch-btn flex items-center gap-2 text-slate-600 font-black text-sm px-3 py-2 bg-slate-100 rounded-xl active:bg-slate-200 transition-all"
            >
              <span className="text-lg">←</span>
              <span className="hidden sm:inline">Back</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
              <div className="bg-brand-blue text-white w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-black">
                {adminName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 hidden xs:block sm:block">
                <div className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Coach</div>
                <div className="text-xs sm:text-sm font-black text-slate-900 truncate max-w-[80px] sm:max-w-[120px]">{adminName}</div>
              </div>
            </div>
          )}

          {/* Page Title (for sub-pages) OR Tab Switcher */}
          {SUB_PAGES.includes(activeTab) ? (
            <div className="flex-grow text-center">
              <h1 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                {activeTab === 'INSIGHTS' && '📊 Insights'}
                {activeTab === 'BRANDING' && '🎨 Branding'}
                {activeTab === 'SEASONS' && '📅 Seasons'}
                {activeTab === 'TOURNAMENTS' && '🏆 Tournaments'}
                {activeTab === 'BLOG' && '📝 Blog & Alerts'}
                {activeTab === 'PARENTS' && '👨‍👩‍👧‍👦 Parent Accounts'}
                {activeTab === 'CHECKIN' && '🎮 Check-In Board'}
                {activeTab === 'MESSAGES' && '💬 Messages'}
                {activeTab === 'PARTNERS' && '🏪 Partners'}
                {activeTab === 'TASKS' && '⭐ Special Tasks'}
                {activeTab === 'REDEMPTIONS' && '🎁 Redemptions'}
              </h1>
            </div>
          ) : (
            <div className="flex bg-slate-100 rounded-xl p-0.5 sm:p-1 flex-grow max-w-[200px] sm:max-w-[250px]">
              {(['GAMES', 'ATHLETES'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 touch-btn px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all focus-ring ${activeTab === tab
                    ? 'bg-white text-brand-blue shadow-sm'
                    : 'text-slate-500'
                    }`}
                >
                  {tab === 'GAMES' ? '🎮' : '👥'} <span className="hidden sm:inline ml-1">{tab}</span>
                  <span className="sm:hidden ml-0.5">{tab.slice(0, 4)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Attendance Quick View (hidden on sub-pages for cleaner UI) */}
          {!SUB_PAGES.includes(activeTab) && (
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
          <div key={t.id} className={`animate-slide-in-right bg-white rounded-xl sm:rounded-2xl shadow-2xl border-2 ${t.amount && t.amount < 0 ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'} px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-black`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Main Content Area - Mobile optimized with proper bottom padding */}
      <main className="flex-grow overflow-y-auto mobile-content-with-bar custom-scrollbar">
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
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
              <div className="bg-gradient-to-r from-purple-600 via-brand-blue to-brand-green rounded-2xl p-5 text-white">
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-xl font-display font-black uppercase tracking-tight mb-1">
                      Season Awards
                    </h2>
                    <p className="text-white/80 text-sm">
                      Generate MVP awards, standings, and printable reports
                    </p>
                  </div>
                  <button
                    onClick={() => setShowStatsDashboard(true)}
                    className="w-full bg-white text-slate-900 py-3 rounded-xl font-black uppercase text-sm tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>🏆</span>
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
            <ParentManager students={students} />
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
        </div>
      </main>

      {/* Bottom Quick Action Bar - Mobile First */}
      <nav className="mobile-action-bar" role="navigation" aria-label="Quick actions">
        <div className="flex items-center justify-around px-1 sm:px-2 py-1.5 sm:py-2 max-w-lg mx-auto">
          <QuickActionButton
            icon="📋"
            label="Roll Call"
            onClick={() => setShowRollCall(true)}
            badge={students.length - presentCount}
          />
          <QuickActionButton
            icon="⭐"
            label="Award"
            onClick={() => setShowBatchAward(true)}
          />
          <QuickActionButton
            icon="🆕"
            label="Enroll"
            onClick={() => setShowEnrollAthlete(true)}
          />
          <QuickActionButton
            icon="📜"
            label="History"
            onClick={() => setShowGameHistory(true)}
          />
          <QuickActionButton
            icon="⚙️"
            label="More"
            onClick={() => setShowMoreMenu(true)}
          />
        </div>
      </nav>
    </div>
  );
};

export default AdminDashboard;
