import React, { useState, useEffect } from 'react';
import { Student } from '../../types';
import { HOUSES } from '../../constants';
import { parentAuth } from '../../services/parentAuth';

interface ParentRecord {
    id: string;
    email: string;
    fullName: string;
    phone: string;
    createdAt: string;
    linkedStudents: Student[];
}

// ─── Onboarding wizard steps ─────────────────────────────────────────────────
type Step = 1 | 2 | 3;

const STEPS = [
    { step: 1, icon: '🏃', label: 'Parent Info' },
    { step: 2, icon: '🔐', label: 'Account Setup' },
    { step: 3, icon: '🏆', label: 'Done!' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
const ParentManager: React.FC<{ students: Student[] }> = ({ students }) => {
    const [parents, setParents] = useState<ParentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'list' | 'create'>('list');
    const [selectedParent, setSelectedParent] = useState<ParentRecord | null>(null);

    // Link form
    const [linkStudentId, setLinkStudentId] = useState('');
    const [linking, setLinking] = useState(false);
    const [linkMsg, setLinkMsg] = useState<string | null>(null);

    useEffect(() => { loadParents(); }, []);

    const loadParents = async () => {
        setLoading(true);
        try {
            const rows = await parentAuth.listParents();
            setParents(rows.map(p => ({
                id: p.id,
                email: p.email || '—',
                fullName: p.fullName || p.email || p.id,
                phone: p.phone || '—',
                createdAt: p.createdAt || '',
                linkedStudents: p.linkedStudents,
            })));
        } catch (err) {
            console.error('Error loading parents:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLinkStudent = async (parentId: string) => {
        if (!linkStudentId) return;
        setLinking(true);
        setLinkMsg(null);
        try {
            await parentAuth.linkStudent(parentId, linkStudentId);
            setLinkMsg('✅ Student linked!');
            setLinkStudentId('');
            await loadParents();
        } catch (err: any) {
            setLinkMsg(`❌ ${err.message}`);
        } finally {
            setLinking(false);
        }
    };

    const handleUnlink = async (parentId: string, studentId: string) => {
        if (!confirm('Remove this student from the parent account?')) return;
        await parentAuth.unlinkStudent(parentId, studentId);
        await loadParents();
    };

    // ─── Detail view ────────────────────────────────────────────────────────
    if (selectedParent) {
        const parent = parents.find(p => p.id === selectedParent.id) || selectedParent;
        const linkedIds = new Set(parent.linkedStudents.map(s => s.id));
        const available = students.filter(s => !linkedIds.has(s.id));

        return (
            <div className="pz-scope space-y-4">
                <button onClick={() => { setSelectedParent(null); setLinkMsg(null); setLinkStudentId(''); }}
                    className="flex items-center gap-2 text-sm font-black text-[#ABABAB] hover:text-white transition-colors">
                    ← Back to Parents
                </button>

                <div className="pz-card p-5">
                    {/* Parent header */}
                    <div className="flex items-center gap-4 mb-5 pb-4 border-b border-white/10">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0ea5e9] to-sky-400 flex items-center justify-center text-white font-black text-2xl">
                            {parent.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-white text-lg leading-tight">{parent.fullName}</h2>
                            <p className="text-[#ABABAB] text-sm">{parent.email}</p>
                            {parent.phone !== '—' && (
                                <p className="text-[#ABABAB] text-xs">📱 {parent.phone}</p>
                            )}
                        </div>
                    </div>

                    {/* Linked students */}
                    <h3 className="text-[10px] text-[#ABABAB] uppercase tracking-widest mb-2">
                        Linked Athletes ({parent.linkedStudents.length})
                    </h3>
                    <div className="space-y-2 mb-5">
                        {parent.linkedStudents.length === 0 && (
                            <p className="text-[#ABABAB] text-sm text-center py-4 pz-card-sm" style={{ background: 'var(--pz-panel-2)' }}>No athletes linked yet</p>
                        )}
                        {parent.linkedStudents.map(s => {
                            const house = HOUSES[s.houseId] || HOUSES['UNITY'];
                            return (
                                <div key={s.id} className="pz-card-sm flex items-center gap-3 p-3" style={{ background: 'var(--pz-panel-2)' }}>
                                    <img
                                        src={s.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.id}`}
                                        className="w-9 h-9 rounded-full object-cover border-2 flex-shrink-0"
                                        style={{ borderColor: house.colorHex }} alt=""
                                    />
                                    <div className="flex-grow min-w-0">
                                        <div className="font-black text-white text-sm truncate">{s.fullName}</div>
                                        <div className="text-[10px] text-[#ABABAB]">{house.mascot} {house.name} · {s.points} pts</div>
                                    </div>
                                    <button onClick={() => handleUnlink(parent.id, s.id)}
                                        className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0">
                                        Remove
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Add student */}
                    <h3 className="text-[10px] text-[#ABABAB] uppercase tracking-widest mb-2">
                        Link an Athlete
                    </h3>
                    <div className="flex gap-2">
                        <select value={linkStudentId} onChange={e => setLinkStudentId(e.target.value)}
                            className="flex-grow px-3 py-2 rounded-xl border border-white/10 bg-[#171C27] text-sm font-bold text-white focus:border-[#CBFE1C] outline-none">
                            <option value="">— Select athlete —</option>
                            {available.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                        </select>
                        <button onClick={() => handleLinkStudent(parent.id)} disabled={!linkStudentId || linking}
                            className="pz-btn px-4 py-2 text-sm disabled:opacity-40">
                            {linking ? '...' : 'Link'}
                        </button>
                    </div>
                    {linkMsg && (
                        <p className={`text-sm font-medium mt-2 ${linkMsg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{linkMsg}</p>
                    )}
                </div>
            </div>
        );
    }

    // ─── Create wizard ──────────────────────────────────────────────────────
    if (activeView === 'create') {
        return (
            <OnboardingWizard
                onDone={async () => { await loadParents(); setActiveView('list'); }}
                onCancel={() => setActiveView('list')}
            />
        );
    }

    // ─── Parent list ─────────────────────────────────────────────────────────
    return (
        <div className="pz-scope space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-white text-base">👨‍👩‍👧‍👦 Parent Accounts</h2>
                    <p className="text-[#ABABAB] text-xs">{parents.length} registered</p>
                </div>
                <button onClick={() => setActiveView('create')}
                    className="pz-btn px-4 py-2 text-sm">
                    + New Parent
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-[#ABABAB] text-sm">Loading...</div>
            ) : parents.length === 0 ? (
                <div className="pz-card p-8 text-center">
                    <div className="text-5xl mb-3">👪</div>
                    <h3 className="text-white mb-2">No Parent Accounts Yet</h3>
                    <p className="text-[#ABABAB] text-sm mb-4">Create the first parent account to get started.</p>
                    <button onClick={() => setActiveView('create')}
                        className="pz-btn px-5 py-2.5 text-sm">
                        + Create Parent Account
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {parents.map(parent => (
                        <button key={parent.id} onClick={() => { setSelectedParent(parent); setLinkMsg(null); setLinkStudentId(''); }}
                            className="w-full pz-card-sm p-4 flex items-center gap-4 hover:border-[#CBFE1C] transition-all text-left active:scale-[0.99]"
                            style={{ background: 'var(--pz-panel-2)' }}>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0ea5e9] to-sky-400 flex items-center justify-center text-white font-black text-base flex-shrink-0">
                                {parent.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-grow min-w-0">
                                <div className="font-black text-white text-sm truncate">{parent.fullName}</div>
                                <div className="text-[11px] text-[#ABABAB] truncate">{parent.email}</div>
                                {parent.phone !== '—' && <div className="text-[10px] text-[#ABABAB]">📱 {parent.phone}</div>}
                            </div>
                            <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                <span className="text-[10px] font-black text-[#ABABAB] uppercase">
                                    {parent.linkedStudents.length} athlete{parent.linkedStudents.length !== 1 ? 's' : ''}
                                </span>
                                <div className="flex -space-x-1.5">
                                    {parent.linkedStudents.slice(0, 3).map(s => (
                                        <img key={s.id}
                                            src={s.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.id}`}
                                            className="w-6 h-6 rounded-full border-2 border-[#12161F] object-cover" alt="" />
                                    ))}
                                </div>
                            </div>
                            <span className="text-white/30 text-lg flex-shrink-0">›</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Onboarding Wizard ────────────────────────────────────────────────────────
const OnboardingWizard: React.FC<{ onDone: () => void; onCancel: () => void }> = ({ onDone, onCancel }) => {
    const [step, setStep] = useState<Step>(1);
    const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdName, setCreatedName] = useState('');

    const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [field]: e.target.value }));

    const handleSubmitAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await parentAuth.createAccount({
                email: form.email,
                password: form.password,
                fullName: form.fullName,
                phone: form.phone,
            });

            setCreatedName(form.fullName.split(' ')[0]);
            setStep(3);
        } catch (err: any) {
            setError(err.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    // Progress bar
    const progress = ((step - 1) / 2) * 100;

    return (
        <div className="pz-scope max-w-md mx-auto">
            {/* Cancel */}
            <button onClick={onCancel} className="flex items-center gap-2 text-sm font-black text-[#ABABAB] hover:text-white transition-colors mb-4">
                ← Back to Parents
            </button>

            {/* Branded header */}
            <div className="pz-card p-6 text-white text-center mb-4 relative overflow-hidden" style={{ borderColor: 'rgba(203, 254, 28, 0.35)' }}>
                {/* Decorative blobs */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-[#CBFE1C]/5 rounded-full" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full" />
                <div className="relative">
                    <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <img src="/fnfa-logo.png" alt="Logo" className="w-full h-full object-contain p-1" />
                    </div>
                    <h1 className="text-xl text-white tracking-tight">Fun 'N Fit Academy</h1>
                    <p className="text-[#CBFE1C] text-sm mt-1 font-bold uppercase tracking-widest">Parent Onboarding</p>
                </div>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-4">
                {STEPS.map((s, i) => (
                    <React.Fragment key={s.step}>
                        <div className={`flex items-center gap-1.5 ${step >= s.step ? 'opacity-100' : 'opacity-30'} transition-opacity`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${step > s.step ? 'bg-emerald-500 text-white' : step === s.step ? 'bg-[#CBFE1C] text-[#0B0E13]' : 'bg-white/10 text-[#ABABAB]'
                                }`}>
                                {step > s.step ? '✓' : s.step}
                            </div>
                            <span className="text-[10px] font-black text-[#ABABAB] uppercase tracking-wide hidden sm:block">{s.label}</span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className="flex-grow h-0.5 bg-white/10 rounded-full overflow-hidden">
                                <div className={`h-full bg-[#CBFE1C] rounded-full transition-all duration-500 ${step > s.step ? 'w-full' : 'w-0'}`} />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Step 1: Parent Info */}
            {step === 1 && (
                <div className="pz-card p-5 space-y-4">
                    <div>
                        <h2 className="text-white text-base">👋 Let's start with the basics</h2>
                        <p className="text-[#ABABAB] text-sm">Tell us about the parent joining the Fun 'N Fit family.</p>
                    </div>
                    <WizField label="Parent's Full Name" value={form.fullName} onChange={set('fullName')}
                        placeholder="e.g. Jane Smith" type="text" icon="👤" />
                    <WizField label="Phone Number" value={form.phone} onChange={set('phone')}
                        placeholder="(555) 000-0000" type="tel" icon="📱" />
                    <button
                        onClick={() => { if (form.fullName && form.phone) setStep(2); }}
                        disabled={!form.fullName || !form.phone}
                        className="w-full pz-btn py-3 text-sm disabled:opacity-40">
                        Continue →
                    </button>
                </div>
            )}

            {/* Step 2: Account Setup */}
            {step === 2 && (
                <form onSubmit={handleSubmitAccount} className="pz-card p-5 space-y-4">
                    <div>
                        <h2 className="text-white text-base">🔐 Create their account</h2>
                        <p className="text-[#ABABAB] text-sm">Set up login credentials for <strong className="text-white">{form.fullName}</strong>.</p>
                    </div>
                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-medium">
                            ⚠️ {error}
                        </div>
                    )}
                    <WizField label="Email Address" value={form.email} onChange={set('email')}
                        placeholder="parent@email.com" type="email" icon="✉️" />
                    <WizField label="Temporary Password" value={form.password} onChange={set('password')}
                        placeholder="Min 6 characters" type="password" icon="🔑" />
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setStep(1)}
                            className="flex-1 pz-btn-ghost py-3 text-sm">
                            ← Back
                        </button>
                        <button type="submit" disabled={loading || !form.email || !form.password}
                            className="flex-[2] pz-btn py-3 text-sm disabled:opacity-40">
                            {loading ? '⏳ Creating...' : '🚀 Create Account'}
                        </button>
                    </div>
                </form>
            )}

            {/* Step 3: Done! */}
            {step === 3 && (
                <div className="pz-card p-8 text-center space-y-4">
                    <div className="text-6xl animate-bounce">🎉</div>
                    <div>
                        <h2 className="text-white text-xl">Welcome to the team, {createdName}!</h2>
                        <p className="text-[#ABABAB] text-sm mt-2">
                            The parent account has been created. They can now log in at the Parent Portal with their email and password.
                        </p>
                    </div>
                    <div className="pz-card-sm p-4 text-left space-y-1" style={{ background: 'var(--pz-panel-2)' }}>
                        <p className="text-[10px] font-black text-[#ABABAB] uppercase tracking-widest">Account Details</p>
                        <p className="text-sm font-bold text-white">👤 {form.fullName}</p>
                        <p className="text-sm font-bold text-white">✉️ {form.email}</p>
                        <p className="text-sm font-bold text-white">📱 {form.phone}</p>
                    </div>
                    <p className="text-xs text-[#ABABAB]">
                        💡 Next step: open their account to link their athletes.
                    </p>
                    <button onClick={onDone}
                        className="w-full pz-btn py-3 text-sm">
                        View All Parents →
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── Field Component ──────────────────────────────────────────────────────────
const WizField: React.FC<{
    label: string; value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string; type: string; icon: string;
}> = ({ label, value, onChange, placeholder, type, icon }) => (
    <div>
        <label className="block text-[10px] font-black text-[#ABABAB] uppercase tracking-widest mb-1.5">{label}</label>
        <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">{icon}</span>
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-white/10 bg-[#171C27] font-bold text-white placeholder:text-white/30 text-sm focus:border-[#CBFE1C] outline-none transition-all"
            />
        </div>
    </div>
);

export default ParentManager;
