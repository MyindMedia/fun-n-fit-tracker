import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

type TabId = 'my-students' | 'add' | 'check-in' | 'messages' | 'earn' | 'perks';

const TABS: Array<{ id: Exclude<TabId, 'add'>; label: string }> = [
    { id: 'my-students', label: '🏠 My Kids' },
    { id: 'check-in', label: '📍 Check In' },
    { id: 'messages', label: '💬 Messages' },
    { id: 'earn', label: '🌟 Earn' },
    { id: 'perks', label: '🎁 Perks' },
];

const ParentDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [parentId, setParentId] = useState('');
    const [parentEmail, setParentEmail] = useState('');
    const [parentName, setParentName] = useState('');
    const [myStudents, setMyStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>('my-students');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
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
        <div style={styles.page}>
            <Blob top="-8rem" left="-8rem" color="rgba(99,102,241,0.2)" />
            <Blob bottom="-6rem" right="-6rem" color="rgba(16,185,129,0.15)" />

            {/* Header */}
            <div style={styles.header}>
                <div>
                    <div style={styles.headerBadge}>Parent Portal</div>
                    <h1 style={styles.heading}>Welcome, {parentName}! 👋</h1>
                    <p style={styles.subheading}>{parentEmail}</p>
                </div>
                <button onClick={handleSignOut} style={styles.signOutBtn}>Sign Out</button>
            </div>

            {/* Stats strip */}
            <div style={styles.statsRow}>
                <StatCard icon="👨‍👩‍👧‍👦" label="My Students" value={myStudents.length} color="#818cf8" />
                <StatCard icon="⭐" label="Total Points" value={myStudents.reduce((a, s) => a + s.points, 0)} color="#f59e0b" />
                <StatCard icon="🎖️" label="Badges Earned" value={myStudents.reduce((a, s) => a + (s.badges?.length || 0), 0)} color="#10b981" />
            </div>

            {/* Tabs */}
            <div style={styles.tabs}>
                {TABS.map(t => {
                    const isActive = activeTab === t.id || (t.id === 'my-students' && activeTab === 'add');
                    return (
                        <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                            ...styles.tab,
                            ...(isActive ? styles.tabActive : {}),
                        }}>
                            {t.label}
                            {t.id === 'messages' && unreadMessages > 0 && (
                                <span style={styles.unreadBadge}>{unreadMessages > 9 ? '9+' : unreadMessages}</span>
                            )}
                        </button>
                    );
                })}
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
                                />
                            ))}
                        </div>
                        <button
                            onClick={() => setActiveTab('add')}
                            style={{
                                width: '100%', marginTop: '1rem', padding: '0.875rem',
                                background: 'transparent', border: '2px dashed #c7d2fe',
                                borderRadius: '14px', color: '#4f46e5', fontWeight: 700,
                                fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit',
                                position: 'relative', zIndex: 1,
                            }}
                        >
                            ➕ Enroll Another Student
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
                            background: 'none', border: 'none', color: '#4f46e5',
                            fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                            padding: 0, marginBottom: '0.75rem', fontFamily: 'inherit',
                        }}
                    >
                        ← Back to My Kids
                    </button>
                    <h2 style={styles.sectionTitle}>Enroll a New Student</h2>
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
                        <button type="submit" disabled={enrollLoading} style={{
                            ...styles.btnPrimary,
                            padding: '0.875rem', marginTop: '1rem',
                            fontSize: '1rem',
                            opacity: enrollLoading ? 0.7 : 1
                        }}>
                            {enrollLoading ? 'Enrolling...' : 'Enroll Student'}
                        </button>
                    </form>
                </div>
            )}
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
        <div style={styles.page}>
            <Blob top="-8rem" left="-8rem" color="rgba(99,102,241,0.2)" />

            <button onClick={onBack} style={styles.backBtn}>← Back</button>

            {/* Hero card */}
            <div style={{ ...styles.card, padding: '1.25rem', marginBottom: '1.25rem' }}>
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
                                    background: '#4f46e5', border: '2px solid #1e293b',
                                    color: '#fff', borderRadius: '50%', width: '36px', height: '36px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', fontSize: '16px', zIndex: 10
                                }}
                                title="Change Picture"
                            >
                                📷
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
                                            style={{ ...styles.btnSecondary, flex: 1, padding: '0.75rem' }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={isSavingProfile || !editForm.fullName || !editForm.gamerTag}
                                            style={{ ...styles.btnPrimary, flex: 1, padding: '0.75rem' }}
                                        >
                                            {isSavingProfile ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                                    <div>
                                        <h2 style={{ margin: '0 0 0.25rem', color: '#0f172a', fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {student.gamerTag || student.fullName}
                                        </h2>
                                        {student.gamerTag && (
                                            <p style={{ margin: '0 0 0.5rem', color: '#64748b', fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.fullName}</p>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                            background: `${house.colorHex}22`, border: `1px solid ${house.colorHex}55`,
                                            color: house.colorHex, borderRadius: '999px',
                                            padding: '0.375rem 0.875rem', fontSize: '0.8125rem', fontWeight: 700,
                                            marginBottom: '0.5rem', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                            <span>{house.mascot}</span> {house.name} House
                                        </div>
                                    </div>
                                    <div>
                                        <button
                                            onClick={() => setIsEditingProfile(true)}
                                            style={{
                                                ...styles.btnSecondary,
                                                padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
                                            }}
                                        >
                                            ✏️ Edit Profile
                                        </button>
                                    </div>
                                    {student.bio && <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '1rem' }}>{student.bio}</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Large Team Logo */}
                    {!isEditingProfile && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                            {house.customIcon ? (
                                <img src={house.customIcon} style={{ width: 'clamp(80px, 25vw, 128px)', height: 'clamp(80px, 25vw, 128px)', objectFit: 'contain' }} alt={house.name} />
                            ) : (
                                <span style={{ fontSize: 'clamp(3rem, 12vw, 6rem)', lineHeight: 1 }}>{house.mascot}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>


            {/* ── Stats Summary ─────────────────────────────────────────── */}
            <div style={{ ...styles.card, marginBottom: '1.25rem' }}>
                <h3 style={{ ...styles.sectionTitle, marginBottom: '1rem' }}>📊 Student Summary</h3>

                {/* 4-column stat grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {/* Total Points */}
                    <div style={{
                        background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                        border: '1px solid #fde68a', borderRadius: '12px', padding: '1rem',
                        display: 'flex', flexDirection: 'column', gap: '0.25rem',
                    }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Points</div>
                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{student.points.toLocaleString()}</div>
                        <div style={{ fontSize: '0.75rem', color: '#b45309' }}>⭐ pts earned</div>
                    </div>

                    {/* Current Rank */}
                    <div style={{
                        background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                        border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1rem',
                        display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start',
                    }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Rank</div>
                        <img src={rank.icon} alt={rank.name} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1d4ed8' }}>{rank.name}</div>
                    </div>

                    {/* House */}
                    <div style={{
                        background: `linear-gradient(135deg, ${house.colorHex}12, ${house.colorHex}22)`,
                        border: `1px solid ${house.colorHex}44`, borderRadius: '12px', padding: '1rem',
                        display: 'flex', flexDirection: 'column', gap: '0.35rem',
                    }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: house.colorHex, textTransform: 'uppercase', letterSpacing: '0.05em' }}>House</div>
                        <div style={{ fontSize: '1.5rem' }}>{house.mascot}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: house.colorHex }}>{house.name}</div>
                    </div>

                    {/* Badges */}
                    <div style={{
                        background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                        border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1rem',
                        display: 'flex', flexDirection: 'column', gap: '0.25rem',
                    }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Badges</div>
                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#16a34a', lineHeight: 1 }}>{student.badges?.length ?? 0}</div>
                        <div style={{ fontSize: '0.75rem', color: '#15803d' }}>🏅 earned</div>
                    </div>
                </div>

                {/* General info row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Gender</div>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9375rem' }}>
                            {student.gender === 'Female' ? '👧' : '👦'} {student.gender}
                        </div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Rewards</div>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9375rem' }}>
                            🎁 {student.inventory?.length ?? 0}
                        </div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Status</div>
                        <div style={{ fontWeight: 800, color: student.isPresent ? '#16a34a' : '#94a3b8', fontSize: '0.9375rem' }}>
                            {student.isPresent ? '🟢 Present' : '⚪ Away'}
                        </div>
                    </div>
                </div>

                {/* Rank progress bar */}
                {nextRank && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <span style={{ color: '#64748b', fontSize: '0.8125rem', fontWeight: 700 }}>
                                Progress to <span style={{ color: '#4f46e5' }}>{nextRank.name}</span>
                            </span>
                            <span style={{ color: '#4f46e5', fontSize: '0.8125rem', fontWeight: 700 }}>
                                {nextRank.threshold - student.points} pts to go · {Math.round(progress)}%
                            </span>
                        </div>
                        <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${progress}%`, height: '100%',
                                background: 'linear-gradient(90deg, #4f46e5, #818cf8)',
                                borderRadius: '999px', transition: 'width 0.8s ease',
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                            <span style={{ color: '#94a3b8', fontSize: '0.6875rem', fontWeight: 600 }}>{rank.name}</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.6875rem', fontWeight: 600 }}>{nextRank.name}</span>
                        </div>
                    </div>
                )}
                {!nextRank && (
                    <div style={{
                        background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                        border: '1px solid #f59e0b', borderRadius: '12px', padding: '0.75rem 1rem',
                        textAlign: 'center', fontWeight: 700, color: '#92400e',
                    }}>
                        🏆 Max Rank Achieved — Top of the class!
                    </div>
                )}
            </div>



            {/* Badges */}
            {(student.badges?.length ?? 0) > 0 && (
                <div style={{ ...styles.card, marginBottom: '1.25rem' }}>
                    <h3 style={styles.sectionTitle}>🎖️ Badges Earned</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {student.badges!.map(b => (
                            <div key={b} style={{
                                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                                color: '#fcd34d', borderRadius: '8px', padding: '0.375rem 0.75rem',
                                fontSize: '0.8125rem', fontWeight: 700,
                            }}>
                                🏅 {b}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Inventory (rewards) */}
            {(student.inventory?.length ?? 0) > 0 && (
                <div style={{ ...styles.card, marginBottom: '1.25rem' }}>
                    <h3 style={styles.sectionTitle}>🎁 Rewards Collected</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {student.inventory!.map(r => (
                            <div key={r} style={{
                                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                                color: '#6ee7b7', borderRadius: '8px', padding: '0.375rem 0.75rem',
                                fontSize: '0.8125rem', fontWeight: 700,
                            }}>
                                🎁 {r}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(student.badges?.length ?? 0) === 0 && (student.inventory?.length ?? 0) === 0 && (
                <div style={{ ...styles.card, textAlign: 'center', padding: '2rem', marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌱</div>
                    <p style={{ color: '#94a3b8', margin: 0, fontWeight: 500 }}>No badges or rewards yet — keep training!</p>
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
}> = ({ student, onView }) => {
    const house = HOUSES[student.houseId];
    const rank = RANKS.find(r => r.id === student.rankId) || RANKS[0];
    return (
        <div style={{
            ...styles.card,
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer',
        }}
            onClick={onView}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <img src={student.avatarUrl} alt="" onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.id}`; }} style={{
                    width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover',
                    border: `3px solid ${house.colorHex}`,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.gamerTag || student.fullName}</div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {house.mascot} {house.name} &middot; <img src={rank.icon} alt={rank.name} style={{ width: '16px', height: '16px', objectFit: 'contain' }} /> {rank.name}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#f59e0b', fontWeight: 900, fontSize: '1.125rem' }}>
                    {student.points.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>pts</span>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ icon: string; label: string; value: number; color: string }> = ({ icon, label, value, color }) => (
    <div style={{ ...styles.card, flex: 1, textAlign: 'center', minWidth: 0 }}>
        <div style={{ fontSize: '1.75rem' }}>{icon}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 900, color }}>{value.toLocaleString()}</div>
        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>{label}</div>
    </div>
);

const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👨‍👩‍👧</div>
        <h3 style={{ color: '#0f172a', fontWeight: 800, margin: '0 0 0.5rem' }}>No Students Linked Yet</h3>
        <p style={{ color: '#64748b', fontSize: '0.9375rem', margin: '0 0 1.5rem' }}>
            Enroll your child to start tracking their Fun 'N Fit progress!
        </p>
        <button onClick={onAdd} style={{
            ...styles.btnPrimary, padding: '0.75rem 2rem',
        }}>
            ➕ Enroll a Student
        </button>
    </div>
);

const LoadingScreen = () => (
    <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            <div style={{ fontWeight: 600 }}>Loading dashboard...</div>
        </div>
    </div>
);

const Blob: React.FC<{ top?: string; bottom?: string; left?: string; right?: string; color: string }> = ({ top, bottom, left, right, color }) => (
    <div style={{
        position: 'fixed', top, bottom, left, right,
        width: '28rem', height: '28rem',
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
    }} />
);

/* -------------------------------------------------------------------------- */
/* Styles */
/* -------------------------------------------------------------------------- */
const styles: Record<string, any> = {
    page: {
        minHeight: '100vh',
        background: '#f1f5f9',
        padding: 'clamp(1rem, 4vw, 1.5rem)',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        position: 'relative',
        color: '#0f172a',
        maxWidth: '900px',
        margin: '0 auto',
        boxSizing: 'border-box',
        overflowX: 'hidden',
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '1.5rem', position: 'relative', zIndex: 1,
    },
    headerBadge: {
        display: 'inline-block', background: 'rgba(99,102,241,0.1)',
        border: '1px solid rgba(99,102,241,0.2)', color: '#4f46e5',
        borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.75rem', fontWeight: 700,
        marginBottom: '0.5rem', letterSpacing: '0.04em',
    },
    heading: { margin: '0 0 0.25rem', fontSize: 'clamp(1.25rem, 5vw, 1.75rem)', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' },
    subheading: { margin: 0, fontSize: '0.875rem', color: '#64748b', fontWeight: 500 },
    signOutBtn: {
        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
        color: '#ef4444', borderRadius: '10px', padding: '0.5rem 1rem',
        fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
    },
    statsRow: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem', position: 'relative', zIndex: 1 },
    card: {
        background: '#ffffff',
        border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'relative', zIndex: 1,
    },
    tabs: {
        display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', position: 'relative', zIndex: 1,
        overflowX: 'auto', paddingBottom: '0.25rem', WebkitOverflowScrolling: 'touch',
    },
    tab: {
        flex: '1 0 auto', padding: '0.7rem 0.85rem', border: '1.5px solid #e2e8f0',
        borderRadius: '12px', background: '#f8fafc',
        color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
        transition: 'all 0.2s', whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
    },
    tabActive: {
        background: '#e0e7ff', border: '1.5px solid #c7d2fe',
        color: '#4f46e5',
    },
    unreadBadge: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: '18px', height: '18px', padding: '0 5px', boxSizing: 'border-box',
        background: '#ef4444', color: '#ffffff', borderRadius: '999px',
        fontSize: '0.65rem', fontWeight: 800, lineHeight: 1,
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '1rem', position: 'relative', zIndex: 1 },
    input: {
        width: '100%', padding: '0.875rem 1.25rem', boxSizing: 'border-box',
        background: '#ffffff', border: '1.5px solid #e2e8f0',
        borderRadius: '12px', color: '#0f172a', fontSize: '1rem', outline: 'none',
        fontFamily: 'inherit',
    },
    sectionTitle: { margin: '0 0 1rem', color: '#0f172a', fontWeight: 800, fontSize: '1.25rem' },
    backBtn: {
        background: '#ffffff', border: '1px solid #e2e8f0',
        color: '#475569', borderRadius: '10px', padding: '0.5rem 1rem',
        fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', marginBottom: '1.25rem',
        position: 'relative', zIndex: 1,
    },
    btnPrimary: {
        background: '#4f46e5', color: '#fff',
        border: 'none', borderRadius: '12px',
        fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
    },
    btnSecondary: {
        background: '#f1f5f9', border: '1px solid #e2e8f0',
        color: '#0f172a', borderRadius: '12px',
        fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
    },
    label: {
        display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#64748b', fontWeight: 600
    }
};

export default ParentDashboard;
