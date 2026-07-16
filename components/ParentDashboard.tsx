import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { supabaseService } from '../services/supabaseService';
import { parentAuth } from '../services/parentAuth';
import { gameCenter } from '../services/gameCenter';
import { Student, HouseId } from '../types';
import { HOUSES, RANKS } from '../constants';
import CheckInScanner from './Parent/CheckInScanner';
import ParentMessages from './Parent/ParentMessages';
import EarnAroundTown from './Parent/EarnAroundTown';
import PerksHistory from './Parent/PerksHistory';
import StudentDetailExtras from './Parent/StudentDetailExtras';
import KidPassSheet from './Parent/KidPassSheet';
import { PZ, PzPortalCss, pStyles } from './Parent/shared';
import { Ic, DataIcon, IconProps } from './icons';

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
                                onClick={() => setActiveTab(t.id)}
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
        <div className="pz-scope" style={styles.page}>
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
                            <img src={currentAvatarUrl} alt="" onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.id}`; }} style={{
                                width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover',
                                border: `4px solid ${house.colorHex}`,
                                boxShadow: `0 0 16px ${house.colorHex}50`,
                                opacity: uploadingAvatar ? 0.5 : 1
                            }} />

                            {/* Upload button overlay */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingAvatar}
                                style={{
                                    position: 'absolute', bottom: -5, right: -5,
                                    background: PZ.volt, border: `2px solid ${PZ.bg}`,
                                    color: PZ.bg, borderRadius: '50%', width: '36px', height: '36px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', zIndex: 10
                                }}
                                title="Change Picture"
                                aria-label="Change picture"
                            >
                                <Ic.Camera size={18} />
                            </button>
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
                                        <h2 className="pz-display" style={{ margin: '0 0 0.25rem', color: PZ.white, fontSize: 'clamp(1.25rem, 4vw, 1.625rem)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {student.gamerTag || student.fullName}
                                        </h2>
                                        {student.gamerTag && (
                                            <p style={{ margin: '0 0 0.5rem', color: PZ.muted, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.fullName}</p>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                            background: `${house.colorHex}1a`, border: `1px solid ${house.colorHex}55`,
                                            color: house.colorHex, borderRadius: '3px',
                                            padding: '0.375rem 0.875rem', fontSize: '0.8125rem', fontWeight: 700,
                                            textTransform: 'uppercase', letterSpacing: '0.04em',
                                            marginBottom: '0.5rem', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis'
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
                        {student.gamerTag || student.fullName}
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
                <div className="pz-display" style={{ color: PZ.volt, fontSize: '1.5rem' }}>
                    {student.points.toLocaleString()} <span style={{ fontSize: '0.6875rem', color: PZ.muted, fontFamily: PZ.bodyFont, fontWeight: 700, letterSpacing: '0.1em' }}>PTS</span>
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
        maxWidth: '900px',
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
