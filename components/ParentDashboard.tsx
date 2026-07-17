import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { supabaseService } from '../services/supabaseService';
import { parentAuth } from '../services/parentAuth';
import { gameCenter } from '../services/gameCenter';
import {
    fitTokensClient,
    FitTokenPack,
    FitTokenPurchase,
    StartPurchaseResult,
} from '../services/fitTokensClient';
import { Student, HouseId } from '../types';
import { HOUSES, RANKS } from '../constants';
import CheckInScanner from './Parent/CheckInScanner';
import ParentMessages from './Parent/ParentMessages';
import EarnAroundTown from './Parent/EarnAroundTown';
import PerksHistory from './Parent/PerksHistory';
import StudentDetailExtras from './Parent/StudentDetailExtras';
import KidPassSheet from './Parent/KidPassSheet';
import TrophyCase from './TrophyCase';
import LevelPath from './LevelPath';
import AvatarRig from './avatar/AvatarRig';
import { PZ, PzPortalCss, pStyles } from './Parent/shared';
import { getStudentDisplayName } from '../utils/studentDisplay';
import { Ic, DataIcon, IconProps } from './icons';
import { haptic } from '../utils/haptics';

type TabId = 'my-students' | 'add' | 'check-in' | 'messages' | 'earn' | 'perks';

const TABS: Array<{ id: Exclude<TabId, 'add'>; label: string; icon: React.FC<IconProps> }> = [
    { id: 'my-students', label: 'My Kids', icon: Ic.Family },
    { id: 'check-in', label: 'Check In', icon: Ic.QrCode },
    { id: 'messages', label: 'Messages', icon: Ic.Chat },
    { id: 'earn', label: 'Earn', icon: Ic.Coin },
    { id: 'perks', label: 'Perks', icon: Ic.Gift },
];

const ParentDashboard: React.FC = () => {
    const navigate = useNavigate();
    const clerk = useClerk();
    const [parentId, setParentId] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [parentName, setParentName] = useState('');
    const [myStudents, setMyStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>('my-students');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [passStudent, setPassStudent] = useState<Student | null>(null);
    const [unreadMessages, setUnreadMessages] = useState(0);
    // Deep-link payloads (#/parent-dashboard?checkin=<token> or ?visit=<secret>)
    const [pendingCheckinToken, setPendingCheckinToken] = useState<string | null>(null);
    const [pendingVisitSecret, setPendingVisitSecret] = useState<string | null>(null);

    // Form state for enrolling a student
    const [enrollForm, setEnrollForm] = useState({
        fullName: '',
        gamerTag: '',
        houseId: 'UNITY' as any,
        gender: 'Male'
    });
    const [enrollLoading, setEnrollLoading] = useState(false);

    useEffect(() => {
        init();
    }, []);

    // With HashRouter, native-camera deep links land as #/parent-dashboard?checkin=…
    // Consume the params once on mount, then strip them from the URL.
    useEffect(() => {
        const hash = window.location.hash || '';
        const qIndex = hash.indexOf('?');
        if (qIndex === -1) return;
        const params = new URLSearchParams(hash.slice(qIndex + 1));
        const checkin = params.get('checkin');
        const visit = params.get('visit');
        if (checkin) {
            setPendingCheckinToken(checkin);
            setActiveTab('check-in');
        } else if (visit) {
            setPendingVisitSecret(visit);
            setActiveTab('earn');
        }
        if (checkin || visit) {
            window.history.replaceState(
                null,
                '',
                window.location.pathname + window.location.search + hash.slice(0, qIndex)
            );
        }
    }, []);

    // Live unread badge for the Messages tab
    useEffect(() => {
        const unsubscribe = gameCenter.subscribeParentThread(({ conversation }) => {
            setUnreadMessages(conversation?.unreadForParent ?? 0);
        });
        return unsubscribe;
    }, []);

    const init = async () => {
        const parent = await parentAuth.getSession();
        if (!parent) { navigate('/parent-login'); return; }
        setParentId(parent.id);
        setParentEmail(parent.email);
        setParentName(parent.fullName || parent.email.split('@')[0] || 'Parent');

        // Load only linked students from DB
        const students = await supabaseService.getLinkedStudents(parent.id);
        setMyStudents(students);
        setLoading(false);
    };

    const handleSignOut = async () => {
        await parentAuth.signOut();
        // End the Clerk session too, or the Portal gate would instantly
        // sign the parent back in.
        try { await clerk.signOut(); } catch { /* not signed in via Clerk */ }
        navigate('/parent-login');
    };

    const handleEnrollStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setEnrollLoading(true);
        try {
            const newStudent = await supabaseService.enrollStudent(parentId, {
                fullName: enrollForm.fullName,
                gamerTag: enrollForm.gamerTag,
                houseId: enrollForm.houseId,
                gender: enrollForm.gender,
                deviceId: null, // Assuming parents don't assign devices here
                isPresent: false,
                avatarUrl: enrollForm.gender === 'Female' ? '/assets/avatars/default-girl.png' : '/assets/avatars/default-boy.png'
            });

            if (newStudent) {
                setMyStudents([...myStudents, newStudent]);
                setActiveTab('my-students');
                setEnrollForm({ fullName: '', gamerTag: '', houseId: 'UNITY', gender: 'Male' });
            } else {
                alert("Failed to enroll student. Please try again.");
            }
        } catch (error) {
            console.error(error);
            alert("Error enrolling student.");
        } finally {
            setEnrollLoading(false);
        }
    };

    if (loading) return <LoadingScreen />;

    if (selectedStudent) {
        return (
            <StudentDetailView
                student={selectedStudent}
                onBack={() => {
                    setSelectedStudent(null);
                    init(); // Refresh data in case avatar was changed
                }}
            />
        );
    }

    return (
        <div className="pz-scope" style={styles.page}>
            <PzPortalCss />

            {/* Header — banner art strip, tightened for mobile: logo + title + sign-out icon */}
            <div className="pz-banner" style={styles.banner}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <img src="/fnfa-logo.png" alt="Fun 'N Fit Academy" style={{ width: '44px', height: '44px', objectFit: 'contain', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="pz-eyebrow" style={{ fontSize: '0.6875rem' }}>Fun 'N Fit Academy</div>
                        <h1 className="pz-display" style={styles.heading}>Parent Portal</h1>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="pz-btn-ghost"
                        aria-label="Sign out"
                        title="Sign out"
                        style={styles.signOutBtn}
                    >
                        <Ic.Logout size={20} />
                    </button>
                </div>
                <p style={styles.subheading}>
                    Welcome, <span style={{ color: PZ.white, fontWeight: 700 }}>{parentName}</span>
                    <span style={{ color: PZ.faint }}> · {parentEmail}</span>
                </p>
            </div>

            {/* Stats strip */}
            <div style={styles.statsRow}>
                <StatCard label="Athletes" value={myStudents.length} color={PZ.white} />
                <StatCard label="Total Points" value={myStudents.reduce((a, s) => a + s.points, 0)} color={PZ.volt} />
                <StatCard label="Badges" value={myStudents.reduce((a, s) => a + (s.badges?.length || 0), 0)} color="#34d399" />
            </div>

            {/* Content */}
            {activeTab === 'my-students' && (
                myStudents.length === 0 ? (
                    <EmptyState onAdd={() => setActiveTab('add')} />
                ) : (
                    <>
                        <div style={styles.grid}>
                            {myStudents.map(s => (
                                <StudentCard
                                    key={s.id}
                                    student={s}
                                    onView={() => setSelectedStudent(s)}
                                    onShowPass={() => setPassStudent(s)}
                                />
                            ))}
                        </div>
                        <button
                            onClick={() => setActiveTab('add')}
                            style={{
                                width: '100%', marginTop: '1rem', padding: '0.875rem', minHeight: '52px',
                                background: 'transparent', border: `1px dashed ${PZ.voltDim}`,
                                clipPath: PZ.notchSm, color: PZ.volt, fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
                                position: 'relative', zIndex: 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            }}
                        >
                            <Ic.Plus size={18} /> Enroll Another Student
                        </button>
                    </>
                )
            )}

            {activeTab === 'check-in' && (
                <CheckInScanner
                    students={myStudents}
                    initialToken={pendingCheckinToken}
                    onTokenConsumed={() => setPendingCheckinToken(null)}
                    onRefresh={init}
                />
            )}

            {activeTab === 'messages' && <ParentMessages />}

            {activeTab === 'earn' && (
                <EarnAroundTown
                    students={myStudents}
                    initialVisitSecret={pendingVisitSecret}
                    onVisitConsumed={() => setPendingVisitSecret(null)}
                    onRefresh={init}
                />
            )}

            {activeTab === 'perks' && (
                <PerksHistory students={myStudents} onRefresh={init} />
            )}

            {activeTab === 'add' && (
                <div style={{ ...styles.card, maxWidth: '500px', margin: '0 auto' }}>
                    <button
                        onClick={() => setActiveTab('my-students')}
                        style={{
                            background: 'none', border: 'none', color: PZ.volt,
                            fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                            padding: '0.25rem 0', marginBottom: '0.75rem', fontFamily: 'inherit',
                            minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                        }}
                    >
                        <Ic.ArrowLeft size={16} /> Back to My Kids
                    </button>
                    <div className="pz-eyebrow" style={pStyles.eyebrow}>New Athlete</div>
                    <h2 className="pz-display" style={styles.sectionTitle}>Enroll a Student</h2>
                    <form onSubmit={handleEnrollStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={styles.label}>Full Name</label>
                            <input
                                required
                                value={enrollForm.fullName}
                                onChange={e => setEnrollForm({ ...enrollForm, fullName: e.target.value })}
                                placeholder="Student Full Name"
                                style={styles.input}
                            />
                        </div>
                        <div>
                            <label style={styles.label}>Gamer Tag (Optional)</label>
                            <input
                                value={enrollForm.gamerTag}
                                onChange={e => setEnrollForm({ ...enrollForm, gamerTag: e.target.value })}
                                placeholder="CoolNickname123"
                                style={styles.input}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={styles.label}>House</label>
                                <select
                                    value={enrollForm.houseId}
                                    onChange={e => setEnrollForm({ ...enrollForm, houseId: e.target.value as any })}
                                    style={styles.input}
                                >
                                    {Object.values(HOUSES).map(h => (
                                        <option key={h.id} value={h.id}>{h.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={styles.label}>Gender</label>
                                <select
                                    value={enrollForm.gender}
                                    onChange={e => setEnrollForm({ ...enrollForm, gender: e.target.value })}
                                    style={styles.input}
                                >
                                    <option value="Male">Boy</option>
                                    <option value="Female">Girl</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit" disabled={enrollLoading} className="pz-btn" style={{
                            ...pStyles.btnPrimary,
                            width: '100%', marginTop: '1rem',
                            fontSize: '1rem',
                            opacity: enrollLoading ? 0.7 : 1
                        }}>
                            {enrollLoading ? 'Enrolling…' : 'Enroll Student'}
                        </button>
                    </form>
                </div>
            )}

            {/* Kid QR pass sheet (opened from My Kids cards) */}
            {passStudent && (
                <KidPassSheet student={passStudent} onClose={() => setPassStudent(null)} />
            )}

            {/* ── Fixed bottom tab bar — native-app navigation ─────────────── */}
            <nav className="pzp-tabbar" aria-label="Parent portal sections">
                <div className="pzp-tabbar-inner" role="tablist">
                    {TABS.map(t => {
                        const isActive = activeTab === t.id || (t.id === 'my-students' && activeTab === 'add');
                        const Icon = t.icon;
                        return (
                            <button
                                key={t.id}
                                role="tab"
                                aria-selected={isActive}
                                aria-label={t.label}
                                onClick={() => { haptic('tap'); setActiveTab(t.id); }}
                                style={{
                                    ...styles.tabItem,
                                    color: isActive ? PZ.volt : PZ.text,
                                }}
                            >
                                {/* Volt tick above the active tab */}
                                <span aria-hidden="true" style={{
                                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                                    width: '28px', height: '3px', borderRadius: '0 0 2px 2px',
                                    background: isActive ? PZ.volt : 'transparent',
                                    transition: 'background 0.15s',
                                }} />
                                <span style={{ position: 'relative', display: 'inline-flex' }}>
                                    <Icon size={26} />
                                    {t.id === 'messages' && unreadMessages > 0 && (
                                        <span className="pz-live" style={styles.tabBadge}>
                                            {unreadMessages > 9 ? '9+' : unreadMessages}
                                        </span>
                                    )}
                                </span>
                                <span style={styles.tabLabel}>{t.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* Student Detail View (points + awards) */
/* -------------------------------------------------------------------------- */
const StudentDetailView: React.FC<{ student: Student; onBack: () => void }> = ({ student, onBack }) => {
    const house = HOUSES[student.houseId];
    const rank = RANKS.find(r => r.id === student.rankId) || RANKS[0];
    const nextRank = RANKS.find(r => r.threshold > student.points);
    const progress = nextRank ? Math.min((student.points / nextRank.threshold) * 100, 100) : 100;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [currentAvatarUrl, setCurrentAvatarUrl] = useState(student.avatarUrl);
    const [avatarMode, setAvatarMode] = useState<'PHOTO' | 'AVATAR'>(student.avatarMode ?? 'PHOTO');

    const handleModeSwitch = async (mode: 'PHOTO' | 'AVATAR') => {
        setAvatarMode(mode);
        try {
            await gameCenter.setAvatarMode(student.id, mode);
            (student as Student).avatarMode = mode;
        } catch (error) {
            console.error('Failed to switch avatar mode:', error);
            setAvatarMode(student.avatarMode ?? 'PHOTO');
        }
    };

    // Student self-login (kid picks their name + PIN on /#/login)
    const [portalEnabled, setPortalEnabled] = useState(false);
    const [portalPin, setPortalPin] = useState('');
    const [portalBusy, setPortalBusy] = useState(false);
    useEffect(() => {
        gameCenter.portalSettings(student.id)
            .then(s => { setPortalEnabled(s.enabled); setPortalPin(s.pin); })
            .catch(err => console.warn('Failed to load portal settings:', err));
    }, [student.id]);

    const savePortalAccess = async (enabled: boolean) => {
        if (enabled && !/^\d{4}$/.test(portalPin)) {
            alert('Set a 4-digit PIN first, then turn on Student Login.');
            return;
        }
        setPortalBusy(true);
        try {
            await gameCenter.setPortalAccess(student.id, enabled, portalPin || undefined);
            setPortalEnabled(enabled);
        } catch (error: any) {
            alert(error?.message || 'Failed to update Student Login');
        } finally {
            setPortalBusy(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);
        try {
            // Include student ID in folder for uniqueness
            const url = await supabaseService.uploadAsset(file, `avatars/${student.id}`);
            if (url) {
                // Update student profile with new avatar URL
                await supabaseService.updateStudent(student.id, { avatarUrl: url });
                setCurrentAvatarUrl(url);
                alert("Avatar updated successfully!");
            } else {
                throw new Error("Failed to get upload URL");
            }
        } catch (error) {
            console.error("Error uploading avatar:", error);
            alert("Failed to upload avatar. Please try again.");
        } finally {
            setUploadingAvatar(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
        }
    };

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editForm, setEditForm] = useState({
        fullName: student.fullName,
        gamerTag: student.gamerTag || '',
        houseId: student.houseId,
        gender: student.gender,
    });
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const handleSaveProfile = async () => {
        setIsSavingProfile(true);
        try {
            console.log("Saving profile for student:", student.id, editForm);
            await supabaseService.updateStudent(student.id, editForm);
            // After successful update, update the local student object to reflect instantly
            Object.assign(student, editForm);
            setIsEditingProfile(false);
            alert("Profile updated successfully!");
        } catch (error: any) {
            console.error("Error updating profile Details:", error);
            if (error?.message) {
                alert(`Failed to update profile: ${error.message}`);
            } else {
                alert("Failed to update profile. Check the console for more details.");
            }
        } finally {
            setIsSavingProfile(false);
        }
    };

    return (
        <div className="pz-scope" style={{ ...styles.page, maxWidth: '1280px' }}>
            <PzPortalCss />

            <button onClick={onBack} className="pz-btn-ghost" style={{ ...styles.backBtn, display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <Ic.ArrowLeft size={16} /> Back
            </button>

            {/* Hero card */}
            <div style={{ ...styles.card, padding: '1.25rem', marginBottom: '1.25rem', borderLeft: `3px solid ${house.colorHex}` }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>

                    {/* Left Column: Avatar and Info */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            {/* Clean picture on display; in edit mode tapping it opens the camera/photo picker */}
                            <div
                                role={isEditingProfile ? 'button' : undefined}
                                tabIndex={isEditingProfile ? 0 : undefined}
                                aria-label={isEditingProfile ? 'Change picture' : undefined}
                                onClick={() => { if (isEditingProfile && !uploadingAvatar) fileInputRef.current?.click(); }}
                                onKeyDown={e => { if (isEditingProfile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInputRef.current?.click(); } }}
                                style={{ position: 'relative', cursor: isEditingProfile ? 'pointer' : 'default', width: '80px' }}
                            >
                                {avatarMode === 'AVATAR' ? (
                                    <div style={{
                                        width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden',
                                        border: `4px solid ${house.colorHex}`,
                                        boxShadow: `0 0 16px ${house.colorHex}50`,
                                        background: 'radial-gradient(circle at 50% 30%, #232B3B 0%, #14171E 80%)',
                                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                                    }}>
                                        <AvatarRig look={student.avatarLook} size="100%" />
                                    </div>
                                ) : (
                                    <img src={currentAvatarUrl} alt="" onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.id}`; }} style={{
                                        width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover',
                                        border: `4px solid ${house.colorHex}`,
                                        boxShadow: `0 0 16px ${house.colorHex}50`,
                                        opacity: uploadingAvatar ? 0.5 : 1
                                    }} />
                                )}
                                {isEditingProfile && (
                                    <span style={{
                                        position: 'absolute', bottom: -4, right: -4,
                                        background: PZ.volt, border: `2px solid ${PZ.bg}`,
                                        color: PZ.bg, borderRadius: '50%', width: '28px', height: '28px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        pointerEvents: 'none',
                                    }}>
                                        <Ic.Camera size={14} />
                                    </span>
                                )}
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleAvatarUpload}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                        </div>

                        <div style={{ flexGrow: 1, textAlign: 'left', minWidth: 0 }}>
                            {isEditingProfile ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={styles.label}>Full Name</label>
                                        <input
                                            type="text"
                                            value={editForm.fullName}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                                            style={styles.input}
                                            placeholder="Student's Name"
                                        />
                                    </div>
                                    <div>
                                        <label style={styles.label}>Gamer Tag</label>
                                        <input
                                            type="text"
                                            value={editForm.gamerTag}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, gamerTag: e.target.value }))}
                                            style={styles.input}
                                            placeholder="Cool Gamer Tag"
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={styles.label}>House</label>
                                            <select
                                                value={editForm.houseId}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, houseId: e.target.value as HouseId }))}
                                                style={styles.input}
                                            >
                                                {Object.values(HOUSES).map(h => (
                                                    <option key={h.id} value={h.id}>{h.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={styles.label}>Gender</label>
                                            <select
                                                value={editForm.gender}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, gender: e.target.value as 'Male' | 'Female' }))}
                                                style={styles.input}
                                            >
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={styles.label}>Picture Shown On Boards</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {(['PHOTO', 'AVATAR'] as const).map(mode => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => handleModeSwitch(mode)}
                                                    style={{
                                                        flex: 1, padding: '0.6rem', fontSize: '0.7rem', fontWeight: 900,
                                                        textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                                                        clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                                                        background: avatarMode === mode ? PZ.volt : PZ.panel2,
                                                        color: avatarMode === mode ? PZ.bg : PZ.muted,
                                                        border: 'none',
                                                    }}
                                                >
                                                    {mode === 'PHOTO' ? 'Photo' : 'Game Avatar'}
                                                </button>
                                            ))}
                                        </div>
                                        <p style={{ margin: '0.4rem 0 0', color: PZ.faint, fontSize: '0.7rem', fontWeight: 600 }}>
                                            Tap the picture to take or choose a new photo.
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <button
                                            onClick={() => setIsEditingProfile(false)}
                                            className="pz-btn-ghost"
                                            style={{ ...pStyles.btnSecondary, flex: 1 }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={isSavingProfile || !editForm.fullName || !editForm.gamerTag}
                                            className="pz-btn"
                                            style={{ ...pStyles.btnPrimary, flex: 1, opacity: isSavingProfile || !editForm.fullName || !editForm.gamerTag ? 0.6 : 1 }}
                                        >
                                            {isSavingProfile ? 'Saving…' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                                    <div>
                                        {(() => {
                                            const dn = getStudentDisplayName(student);
                                            return (
                                                <>
                                                    <h2 className="pz-display" style={{ margin: '0 0 0.25rem', color: PZ.white, fontSize: 'clamp(1.25rem, 4vw, 1.625rem)', lineHeight: 1.15, wordBreak: 'break-word' }}>
                                                        {dn.primary}
                                                    </h2>
                                                    {dn.secondary && (
                                                        <p style={{ margin: '0 0 0.5rem', color: PZ.muted, fontSize: '0.9375rem', wordBreak: 'break-word' }}>{dn.secondary}</p>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <div>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                            background: `${house.colorHex}1a`, border: `1px solid ${house.colorHex}55`,
                                            color: house.colorHex, borderRadius: '3px',
                                            padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 700,
                                            textTransform: 'uppercase', letterSpacing: '0.04em',
                                            marginBottom: '0.5rem', maxWidth: '100%'
                                        }}>
                                            {house.customIcon && (
                                                <img src={house.customIcon} alt="" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                                            )}
                                            {house.name} House
                                        </div>
                                    </div>
                                    <div>
                                        <button
                                            onClick={() => setIsEditingProfile(true)}
                                            className="pz-btn-ghost"
                                            style={{
                                                ...pStyles.btnSecondary,
                                                padding: '0.6rem 1rem', minHeight: '44px',
                                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
                                            }}
                                        >
                                            <Ic.Edit size={16} /> Edit Profile
                                        </button>
                                    </div>
                                    {student.bio && <p style={{ margin: '0.5rem 0 0', color: PZ.muted, fontSize: '0.9375rem' }}>{student.bio}</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Large Team Logo */}
                    {!isEditingProfile && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                            {house.customIcon ? (
                                <img src={house.customIcon} style={{ width: 'clamp(80px, 25vw, 128px)', height: 'clamp(80px, 25vw, 128px)', objectFit: 'contain', filter: `drop-shadow(0 0 18px ${house.colorHex}40)` }} alt={house.name} />
                            ) : (
                                <DataIcon glyph={house.mascot} size={80} style={{ color: house.colorHex }} />
                            )}
                        </div>
                    )}
                </div>
            </div>


            {/* ── Student self-login (parent-granted) ───────────────────── */}
            <div style={{ ...styles.card, marginBottom: '1.25rem' }}>
                <div className="pz-eyebrow" style={pStyles.eyebrow}>Student Login</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <p style={{ margin: 0, color: PZ.muted, fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.45 }}>
                            Let {student.fullName.split(' ')[0]} sign in on their own at the
                            <span style={{ color: PZ.white, fontWeight: 700 }}> Players page</span> to customize
                            their avatar, open crates, and spend perks. They pick their name and enter this PIN.
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={4}
                            value={portalPin}
                            onChange={e => setPortalPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            onBlur={() => { if (portalEnabled && /^\d{4}$/.test(portalPin)) savePortalAccess(true); }}
                            placeholder="PIN"
                            aria-label="4-digit login PIN"
                            style={{
                                ...styles.input, width: '86px', textAlign: 'center',
                                fontWeight: 900, letterSpacing: '0.35em', fontSize: '1rem',
                            }}
                        />
                        <button
                            onClick={() => savePortalAccess(!portalEnabled)}
                            disabled={portalBusy}
                            className={portalEnabled ? 'pz-btn' : 'pz-btn-ghost'}
                            style={{
                                ...(portalEnabled ? pStyles.btnPrimary : pStyles.btnSecondary),
                                minHeight: '44px', padding: '0 1rem', opacity: portalBusy ? 0.6 : 1,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {portalBusy ? 'Saving…' : portalEnabled ? 'Login ON' : 'Login OFF'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── FitTokens (parent-paid avatar currency) ───────────────── */}
            <FitTokensCard student={student} />

            {/* ── Stats Summary ─────────────────────────────────────────── */}
            <div style={{ ...styles.card, marginBottom: '1.25rem' }}>
                <div className="pz-eyebrow" style={pStyles.eyebrow}>Athlete Summary</div>

                {/* 4-column stat grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {/* Total Points */}
                    <div style={{
                        background: PZ.voltFaint,
                        border: `1px solid ${PZ.voltDim}`, clipPath: PZ.notchSm, padding: '1rem',
                        display: 'flex', flexDirection: 'column', gap: '0.25rem',
                    }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: PZ.muted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Total Points</div>
                        <div className="pz-display" style={{ fontSize: '2rem', color: PZ.volt, lineHeight: 1 }}>{student.points.toLocaleString()}</div>
                        <div style={{ fontSize: '0.75rem', color: PZ.muted }}>pts earned</div>
                    </div>

                    {/* Current Rank */}
                    <div style={{
                        background: PZ.panel2,
                        border: `1px solid ${PZ.border}`, clipPath: PZ.notchSm, padding: '1rem',
                        display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start',
                    }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: PZ.muted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Current Rank</div>
                        <img src={rank.icon} alt={rank.name} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: PZ.white }}>{rank.name}</div>
                    </div>

                    {/* House */}
                    <div style={{
                        background: `${house.colorHex}14`,
                        border: `1px solid ${house.colorHex}44`, clipPath: PZ.notchSm, padding: '1rem',
                        display: 'flex', flexDirection: 'column', gap: '0.35rem',
                    }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: PZ.muted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>House</div>
                        {house.customIcon ? (
                            <img src={house.customIcon} alt="" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                        ) : (
                            <DataIcon glyph={house.mascot} size={24} style={{ color: house.colorHex }} />
                        )}
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: house.colorHex }}>{house.name}</div>
                    </div>

                    {/* Badges */}
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.3)', clipPath: PZ.notchSm, padding: '1rem',
                        display: 'flex', flexDirection: 'column', gap: '0.25rem',
                    }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: PZ.muted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Badges</div>
                        <div className="pz-display" style={{ fontSize: '2rem', color: '#34d399', lineHeight: 1 }}>{student.badges?.length ?? 0}</div>
                        <div style={{ fontSize: '0.75rem', color: PZ.muted }}>earned</div>
                    </div>
                </div>

                {/* General info row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <div style={{ background: PZ.panel2, border: `1px solid ${PZ.border}`, borderRadius: '4px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: PZ.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Gender</div>
                        <div style={{ fontWeight: 700, color: PZ.white, fontSize: '0.9375rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Ic.User size={16} /> {student.gender}
                        </div>
                    </div>
                    <div style={{ background: PZ.panel2, border: `1px solid ${PZ.border}`, borderRadius: '4px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: PZ.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Rewards</div>
                        <div style={{ fontWeight: 700, color: PZ.white, fontSize: '0.9375rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Ic.Gift size={16} /> {student.inventory?.length ?? 0}
                        </div>
                    </div>
                    <div style={{ background: PZ.panel2, border: `1px solid ${PZ.border}`, borderRadius: '4px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: PZ.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Status</div>
                        <div style={{ fontWeight: 700, color: student.isPresent ? PZ.volt : PZ.muted, fontSize: '0.9375rem' }}>
                            {student.isPresent ? '● Present' : '○ Away'}
                        </div>
                    </div>
                </div>

                {/* Rank progress bar */}
                {nextRank && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <span style={{ color: PZ.muted, fontSize: '0.8125rem', fontWeight: 700 }}>
                                Progress to <span style={{ color: PZ.volt }}>{nextRank.name}</span>
                            </span>
                            <span style={{ color: PZ.volt, fontSize: '0.8125rem', fontWeight: 700 }}>
                                {nextRank.threshold - student.points} pts to go · {Math.round(progress)}%
                            </span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.08)', height: '10px', overflow: 'hidden', clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}>
                            <div style={{
                                width: `${progress}%`, height: '100%',
                                background: `linear-gradient(90deg, rgba(203,254,28,0.55), ${PZ.volt})`,
                                transition: 'width 0.8s ease',
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                            <span style={{ color: PZ.faint, fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{rank.name}</span>
                            <span style={{ color: PZ.faint, fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{nextRank.name}</span>
                        </div>
                    </div>
                )}
                {!nextRank && (
                    <div style={{
                        background: PZ.voltFaint,
                        border: `1px solid ${PZ.voltDim}`, clipPath: PZ.notchSm, padding: '0.75rem 1rem',
                        textAlign: 'center', fontWeight: 700, color: PZ.volt,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    }}>
                        <Ic.Trophy size={20} /> Max Rank Achieved — top of the class!
                    </div>
                )}
            </div>

            {/* The whole level ladder — what's next, all the way to Apex */}
            <div style={{ marginBottom: '1.25rem' }}>
                <LevelPath points={student.points} rankId={student.rankId} />
            </div>

            {/* Coach medals — superlatives, all in one place */}
            <div style={{ marginBottom: '1.25rem' }}>
                <TrophyCase student={student} full={false} />
            </div>

            {/* Badges */}
            {(student.badges?.length ?? 0) > 0 && (
                <div style={{ ...styles.card, marginBottom: '1.25rem' }}>
                    <div className="pz-eyebrow" style={pStyles.eyebrow}>Badges Earned</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {student.badges!.map(b => (
                            <div key={b} style={{
                                background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)',
                                color: '#fcd34d', borderRadius: '3px', padding: '0.375rem 0.75rem',
                                fontSize: '0.8125rem', fontWeight: 700,
                                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            }}>
                                <Ic.Medal size={16} /> {b}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Inventory (rewards) */}
            {(student.inventory?.length ?? 0) > 0 && (
                <div style={{ ...styles.card, marginBottom: '1.25rem' }}>
                    <div className="pz-eyebrow" style={pStyles.eyebrow}>Rewards Collected</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {student.inventory!.map(r => (
                            <div key={r} style={{
                                background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.3)',
                                color: '#6ee7b7', borderRadius: '3px', padding: '0.375rem 0.75rem',
                                fontSize: '0.8125rem', fontWeight: 700,
                                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            }}>
                                <Ic.Gift size={16} /> {r}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(student.badges?.length ?? 0) === 0 && (student.inventory?.length ?? 0) === 0 && (
                <div style={{ ...styles.card, textAlign: 'center', padding: '2rem', marginBottom: '1.25rem' }}>
                    <div style={{ marginBottom: '0.5rem', color: PZ.volt }}><Ic.Sparkle size={32} /></div>
                    <p style={{ color: PZ.muted, margin: 0, fontWeight: 500 }}>No badges or rewards yet — keep training!</p>
                </div>
            )}

            {/* Game-center activity: check-ins, business visits, redemptions */}
            <StudentDetailExtras studentId={student.id} />
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* FitTokens card (balance + Get FitTokens sheet + purchase history)          */
/* -------------------------------------------------------------------------- */
const PURCHASE_CHIPS: Record<string, { bg: string; border: string; color: string; label: string }> = {
    PENDING: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.35)', color: '#fcd34d', label: 'Pending' },
    CREDITED: { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.3)', color: '#6ee7b7', label: 'Credited' },
    CANCELLED: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.14)', color: PZ.muted, label: 'Cancelled' },
};

const FitTokensCard: React.FC<{ student: Student }> = ({ student }) => {
    const [packs, setPacks] = useState<FitTokenPack[]>([]);
    const [purchases, setPurchases] = useState<FitTokenPurchase[]>([]);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [intent, setIntent] = useState<StartPurchaseResult | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [copiedRef, setCopiedRef] = useState<string | null>(null);

    useEffect(() => {
        fitTokensClient.packs()
            .then(setPacks)
            .catch(err => console.warn('Failed to load FitToken packs:', err));
        let unsub: (() => void) | undefined;
        try {
            // Live list: status chips flip on their own when the desk or the
            // payment webhook credits a code.
            unsub = fitTokensClient.subscribeMyPurchases(rows => {
                setPurchases(rows.filter(r => r.studentId === student.id));
            });
        } catch (err) {
            console.warn('Failed to load FitToken purchases:', err);
        }
        return () => { if (unsub) unsub(); };
    }, [student.id]);

    const copyReference = async (ref: string) => {
        try {
            await navigator.clipboard.writeText(ref);
            setCopiedRef(ref);
            setTimeout(() => setCopiedRef(null), 2000);
        } catch {
            window.prompt('Copy this code:', ref);
        }
    };

    const openPayment = (paymentUrl: string, reference: string) => {
        const url = paymentUrl
            + (paymentUrl.includes('?') ? '&' : '?')
            + 'client_reference_id=' + encodeURIComponent(reference);
        window.open(url, '_blank', 'noopener');
    };

    const handlePick = async (pack: FitTokenPack) => {
        if (busyKey) return;
        setBusyKey(pack.key);
        try {
            const res = await fitTokensClient.startPurchase(student.id, pack.key);
            setIntent(res);
        } catch (err: any) {
            alert(err?.message || 'Could not start the purchase. Please try again.');
        } finally {
            setBusyKey(null);
        }
    };

    const handleCancel = async (purchaseId: string) => {
        if (busyKey) return;
        if (!window.confirm('Cancel this FitTokens purchase? The code will stop working.')) return;
        setBusyKey(purchaseId);
        try {
            await fitTokensClient.cancelPurchase(purchaseId);
            if (intent?.purchaseId === purchaseId) setIntent(null);
        } catch (err: any) {
            alert(err?.message || 'Could not cancel that purchase.');
        } finally {
            setBusyKey(null);
        }
    };

    const firstName = student.fullName.split(' ')[0];

    return (
        <div style={{ ...styles.card, marginBottom: '1.25rem' }}>
            <div className="pz-eyebrow" style={pStyles.eyebrow}>FitTokens</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: PZ.volt, display: 'inline-flex' }}><Ic.Coin size={26} /></span>
                        <span className="pz-display" style={{ fontSize: '2rem', color: PZ.volt, lineHeight: 1 }}>
                            {(student.fitTokens ?? 0).toLocaleString()}
                        </span>
                    </div>
                    <p style={{ margin: '0.45rem 0 0', color: PZ.muted, fontSize: '0.8rem', fontWeight: 500, lineHeight: 1.45 }}>
                        FitTokens unlock avatar looks in {firstName}'s studio. They never affect
                        points, boosts, or scores.
                    </p>
                </div>
                <button
                    onClick={() => { setIntent(null); setSheetOpen(true); }}
                    className="pz-btn"
                    style={{
                        ...pStyles.btnPrimary, minHeight: '44px', padding: '0 1rem',
                        whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    }}
                >
                    <Ic.Coin size={16} /> Get FitTokens
                </button>
            </div>

            {purchases.length > 0 && (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: PZ.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Recent Purchases
                    </div>
                    {purchases.map(p => {
                        const chip = PURCHASE_CHIPS[p.status] ?? PURCHASE_CHIPS.PENDING;
                        return (
                            <div key={p.id} style={{
                                background: PZ.panel2, border: `1px solid ${PZ.border}`, borderRadius: '4px',
                                padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
                            }}>
                                <div style={{ flex: '1 1 170px', minWidth: 0 }}>
                                    <div style={{ color: PZ.white, fontWeight: 700, fontSize: '0.85rem' }}>
                                        {p.packName} · {p.tokens.toLocaleString()} tokens
                                    </div>
                                    <div style={{ color: PZ.muted, fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => copyReference(p.reference)}
                                            title="Copy code"
                                            style={{
                                                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                                color: PZ.volt, fontWeight: 800, fontFamily: 'inherit', fontSize: '0.75rem',
                                                letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                            }}
                                        >
                                            <Ic.ClipboardCheck size={13} /> {p.reference}
                                        </button>
                                        {copiedRef === p.reference && <span style={{ color: PZ.volt }}>Copied</span>}
                                        <span>· {new Date(p.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <span style={{
                                    background: chip.bg, border: `1px solid ${chip.border}`, color: chip.color,
                                    borderRadius: '3px', padding: '0.25rem 0.55rem', fontSize: '0.65rem',
                                    fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0,
                                }}>
                                    {chip.label}
                                </span>
                                {p.status === 'PENDING' && (
                                    <button
                                        onClick={() => handleCancel(p.id)}
                                        disabled={busyKey === p.id}
                                        className="pz-btn-ghost"
                                        style={{
                                            minHeight: '36px', padding: '0 0.75rem', fontSize: '0.7rem', fontWeight: 700,
                                            textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                                            opacity: busyKey === p.id ? 0.6 : 1, flexShrink: 0,
                                        }}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Get FitTokens sheet */}
            {sheetOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Get FitTokens"
                    onClick={() => setSheetOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(6,8,12,0.8)',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        padding: '1rem', boxSizing: 'border-box',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ ...styles.card, width: '100%', maxWidth: '440px', maxHeight: '85vh', overflowY: 'auto' }}
                    >
                        {!intent ? (
                            <>
                                <div className="pz-eyebrow" style={pStyles.eyebrow}>Get FitTokens</div>
                                <p style={{ margin: '0 0 1rem', color: PZ.muted, fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.45 }}>
                                    Pick a pack for <span style={{ color: PZ.white, fontWeight: 700 }}>{firstName}</span>.
                                    You'll get a reference code to pay with.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {packs.map(pack => (
                                        <button
                                            key={pack.key}
                                            onClick={() => handlePick(pack)}
                                            disabled={busyKey === pack.key}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
                                                background: PZ.panel2, border: `1px solid ${PZ.border}`, clipPath: PZ.notchSm,
                                                padding: '0.85rem 1rem', cursor: 'pointer', fontFamily: 'inherit',
                                                minHeight: '56px', textAlign: 'left', width: '100%',
                                                opacity: busyKey === pack.key ? 0.6 : 1,
                                            }}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ color: PZ.white, fontWeight: 800, fontSize: '0.9375rem' }}>{pack.name}</div>
                                                <div style={{ color: PZ.volt, fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    <Ic.Coin size={14} /> {pack.tokens.toLocaleString()} tokens
                                                </div>
                                            </div>
                                            <div className="pz-display" style={{ color: PZ.white, fontSize: '1.125rem', flexShrink: 0 }}>
                                                {pack.priceLabel}
                                            </div>
                                        </button>
                                    ))}
                                    {packs.length === 0 && (
                                        <p style={{ margin: 0, color: PZ.muted, fontSize: '0.85rem', fontWeight: 500 }}>
                                            No packs are available right now. Ask at the front desk.
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setSheetOpen(false)}
                                    className="pz-btn-ghost"
                                    style={{ ...pStyles.btnSecondary, width: '100%', marginTop: '1rem', minHeight: '44px' }}
                                >
                                    Close
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="pz-eyebrow" style={pStyles.eyebrow}>Your Reference Code</div>
                                <p style={{ margin: '0 0 0.75rem', color: PZ.muted, fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.45 }}>
                                    {intent.packName} · {intent.tokens.toLocaleString()} tokens for{' '}
                                    <span style={{ color: PZ.white, fontWeight: 700 }}>{firstName}</span>
                                </p>
                                <div style={{
                                    background: PZ.voltFaint, border: `1px solid ${PZ.voltDim}`, clipPath: PZ.notchSm,
                                    padding: '1rem', textAlign: 'center', marginBottom: '0.75rem',
                                }}>
                                    <div className="pz-display" style={{ fontSize: '2rem', color: PZ.volt, letterSpacing: '0.12em', lineHeight: 1 }}>
                                        {intent.reference}
                                    </div>
                                    <button
                                        onClick={() => copyReference(intent.reference)}
                                        className="pz-btn-ghost"
                                        style={{
                                            marginTop: '0.6rem', minHeight: '40px', padding: '0 0.875rem', cursor: 'pointer',
                                            fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                        }}
                                    >
                                        <Ic.ClipboardCheck size={16} />
                                        {copiedRef === intent.reference ? 'Copied' : 'Copy Code'}
                                    </button>
                                </div>
                                {intent.paymentUrl ? (
                                    <>
                                        <button
                                            onClick={() => openPayment(intent.paymentUrl!, intent.reference)}
                                            className="pz-btn"
                                            style={{ ...pStyles.btnPrimary, width: '100%', minHeight: '48px', fontSize: '0.9375rem' }}
                                        >
                                            Pay Now ({intent.priceLabel})
                                        </button>
                                        <p style={{ margin: '0.6rem 0 0', color: PZ.faint, fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.45 }}>
                                            Checkout opens in a new tab. Your code rides along with the payment,
                                            so the tokens land automatically. You can also pay at the front desk
                                            with this code.
                                        </p>
                                    </>
                                ) : (
                                    <p style={{ margin: 0, color: PZ.muted, fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.5 }}>
                                        Pay at the front desk ({intent.priceLabel}) and show this code.
                                        Staff will add the tokens to {firstName}'s account right away.
                                    </p>
                                )}
                                <button
                                    onClick={() => { setSheetOpen(false); setIntent(null); }}
                                    className="pz-btn-ghost"
                                    style={{ ...pStyles.btnSecondary, width: '100%', marginTop: '1rem', minHeight: '44px' }}
                                >
                                    Done
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* Sub-components */
/* -------------------------------------------------------------------------- */
const StudentCard: React.FC<{
    student: Student;
    onView: () => void;
    onShowPass: () => void;
}> = ({ student, onView, onShowPass }) => {
    const house = HOUSES[student.houseId];
    const rank = RANKS.find(r => r.id === student.rankId) || RANKS[0];
    return (
        <div style={{
            ...styles.card,
            borderLeft: `3px solid ${house.colorHex}`,
            transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
            cursor: 'pointer',
        }}
            onClick={onView}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(); } }}
            onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = 'translateY(-2px)';
                el.style.boxShadow = 'inset 0 0 28px rgba(203,254,28,0.06)';
                el.style.borderColor = 'rgba(203,254,28,0.35)';
                el.style.borderLeftColor = house.colorHex;
            }}
            onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = 'none';
                el.style.boxShadow = 'none';
                el.style.borderColor = PZ.border;
                el.style.borderLeftColor = house.colorHex;
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
                <img src={student.avatarUrl} alt="" onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.id}`; }} style={{
                    width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover',
                    border: `3px solid ${house.colorHex}`,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pz-display" style={{ color: PZ.white, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getStudentDisplayName(student).primary}
                    </div>
                    <div style={{ color: PZ.muted, fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {house.customIcon && (
                            <img src={house.customIcon} alt="" style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }} />
                        )}
                        <span style={{ color: house.colorHex }}>{house.name}</span>
                        <span>·</span>
                        <img src={rank.icon} alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', flexShrink: 0 }} />
                        <span>{rank.name}</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                    <div className="pz-display" style={{ color: PZ.volt, fontSize: '1.5rem' }}>
                        {student.points.toLocaleString()} <span style={{ fontSize: '0.6875rem', color: PZ.muted, fontFamily: PZ.bodyFont, fontWeight: 700, letterSpacing: '0.1em' }}>PTS</span>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: PZ.muted, fontSize: '0.72rem', fontWeight: 700, marginTop: '0.2rem' }}>
                        <span style={{ color: PZ.volt, display: 'inline-flex' }}><Ic.Coin size={13} /></span>
                        {(student.fitTokens ?? 0).toLocaleString()} FitTokens
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button
                        onClick={e => { e.stopPropagation(); onShowPass(); }}
                        className="pz-btn-ghost"
                        aria-label={`Show ${student.fullName}'s check-in pass`}
                        style={{
                            cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                            padding: '0 0.875rem', minHeight: '44px',
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}
                    >
                        <Ic.QrCode size={18} /> Pass
                    </button>
                    <span style={{ color: PZ.faint, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        View <Ic.ChevronRight size={14} />
                    </span>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <div style={{ ...styles.card, flex: 1, textAlign: 'center', minWidth: 0, padding: '0.875rem 0.5rem' }}>
        <div className="pz-display" style={{ fontSize: '1.75rem', color, lineHeight: 1.2 }}>{value.toLocaleString()}</div>
        <div style={{ color: PZ.muted, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '0.25rem' }}>{label}</div>
    </div>
);

const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
    <div style={{ ...styles.card, textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ marginBottom: '1rem', color: PZ.volt }}><Ic.Family size={48} /></div>
        <h3 className="pz-display" style={{ color: PZ.white, margin: '0 0 0.5rem', fontSize: '1.125rem' }}>No Athletes Yet</h3>
        <p style={{ color: PZ.muted, fontSize: '0.9375rem', margin: '0 0 1.5rem' }}>
            Enroll your child to start tracking their Fun 'N Fit progress!
        </p>
        <button onClick={onAdd} className="pz-btn" style={{ ...pStyles.btnPrimary, padding: '0.875rem 2rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Ic.Plus size={18} /> Enroll a Student
        </button>
    </div>
);

const LoadingScreen = () => (
    <div className="pz-scope" style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: PZ.muted }}>
            <div className="pz-live" style={{
                width: '14px', height: '14px', borderRadius: '50%',
                background: PZ.volt, margin: '0 auto 1rem',
            }} />
            <div style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.8125rem' }}>Loading your squad…</div>
        </div>
    </div>
);

/* -------------------------------------------------------------------------- */
/* Styles — dark Pubzi tokens (see components/Parent/shared.tsx for palette)  */
/* -------------------------------------------------------------------------- */
const styles: Record<string, any> = {
    page: {
        minHeight: '100vh',
        background: PZ.bg,
        padding: 'clamp(1rem, 4vw, 1.5rem)',
        // Room for the fixed bottom tab bar (+ home-indicator safe area)
        paddingBottom: 'calc(88px + var(--safe-area-bottom, 0px))',
        fontFamily: PZ.bodyFont,
        position: 'relative',
        color: PZ.white,
        // Desktop uses the entire screen; mobile keeps the same clamp padding.
        maxWidth: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
    },
    banner: {
        clipPath: PZ.notch,
        border: `1px solid ${PZ.border}`,
        padding: '1rem 1rem 0.875rem',
        marginBottom: '1rem',
        position: 'relative', zIndex: 1,
    },
    heading: {
        margin: '0.1rem 0 0', fontSize: 'clamp(1.25rem, 5vw, 1.625rem)',
        color: '#ffffff', lineHeight: 1.1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    },
    subheading: {
        margin: '0.6rem 0 0', fontSize: '0.8125rem', color: PZ.muted, fontWeight: 500,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    },
    signOutBtn: {
        width: '44px', height: '44px', minHeight: '44px', padding: 0,
        cursor: 'pointer', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    },
    statsRow: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', position: 'relative', zIndex: 1 },
    card: {
        background: PZ.panel,
        border: `1px solid ${PZ.border}`,
        clipPath: PZ.notch,
        padding: '1.25rem',
        position: 'relative', zIndex: 1,
    },
    /* Bottom tab bar items (the bar itself is the .pzp-tabbar class) */
    tabItem: {
        flex: 1, minHeight: '56px', minWidth: 0,
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '3px', padding: '8px 2px 7px', position: 'relative',
        fontFamily: 'inherit', transition: 'color 0.15s',
        WebkitTapHighlightColor: 'transparent',
    },
    tabLabel: {
        fontSize: '11px', fontWeight: 700, lineHeight: 1,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
    },
    tabBadge: {
        position: 'absolute', top: '-5px', right: '-9px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: '17px', height: '17px', padding: '0 4px', boxSizing: 'border-box',
        background: PZ.volt, color: PZ.bg, borderRadius: '9px',
        fontSize: '0.625rem', fontWeight: 800, lineHeight: 1,
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '1rem', position: 'relative', zIndex: 1 },
    input: {
        width: '100%', padding: '0.875rem 1rem', boxSizing: 'border-box',
        background: PZ.bg, border: '1.5px solid rgba(255,255,255,0.12)',
        borderRadius: '4px', color: PZ.white, fontSize: '1rem', outline: 'none',
        fontFamily: 'inherit',
    },
    sectionTitle: { margin: '0 0 1rem', color: PZ.white, fontSize: '1.25rem', lineHeight: 1.2 },
    backBtn: {
        padding: '0.6rem 1rem', fontSize: '0.8125rem', cursor: 'pointer',
        minHeight: '44px', marginBottom: '1.25rem',
        position: 'relative', zIndex: 1,
    },
    label: {
        display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem',
        color: PZ.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em',
    }
};

export default ParentDashboard;
