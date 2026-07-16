import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parentAuth } from '../services/parentAuth';
import { PzPortalCss } from './Parent/shared';

type Mode = 'login' | 'signup' | 'reset';
type Step = 1 | 2 | 3;

// ─── Branded Header ──────────────────────────────────────────────────────────
const BrandHeader: React.FC = () => (
  <div className="p-6 text-center border-b border-[rgba(255,255,255,0.08)]">
    <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center">
      <img src="/fnfa-logo.png" alt="Fun 'N Fit Academy" className="w-full h-full object-contain" />
    </div>
    <div className="pz-eyebrow">Fun 'N Fit Academy</div>
    <h1 className="pz-display text-white text-2xl mt-1">Parent Portal</h1>
  </div>
);

// ─── Input field helper ──────────────────────────────────────────────────────
const Field: React.FC<{
  label: string; value: string; icon: string;
  onChange: (v: string) => void;
  placeholder: string; type: string; required?: boolean;
}> = ({ label, value, icon, onChange, placeholder, type, required }) => (
  <div>
    <label className="block text-[11px] font-bold text-[#98A2B3] uppercase tracking-widest mb-1.5">
      {label}
    </label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full pl-9 pr-4 py-3 min-h-[48px] rounded-[4px] border-2 border-[rgba(255,255,255,0.12)] bg-[#0B0E13] font-semibold text-white text-sm focus:border-[#CBFE1C] outline-none transition-colors"
      />
    </div>
  </div>
);

// ─── Step progress bar ───────────────────────────────────────────────────────
const STEPS = [
  { step: 1, label: 'Your Info' },
  { step: 2, label: 'Account' },
  { step: 3, label: 'Done!' },
];

const StepBar: React.FC<{ current: Step }> = ({ current }) => (
  <div className="flex items-center gap-2 mb-5">
    {STEPS.map((s, i) => (
      <React.Fragment key={s.step}>
        <div className="flex items-center gap-1.5">
          <div className={`w-7 h-7 rounded-[4px] flex items-center justify-center text-xs font-black transition-all ${current > s.step ? 'bg-[rgba(203,254,28,0.2)] text-[#CBFE1C] border border-[rgba(203,254,28,0.4)]'
            : current === s.step ? 'bg-[#CBFE1C] text-[#0B0E13]'
              : 'bg-[#171C27] text-[#667085] border border-[rgba(255,255,255,0.08)]'
            }`}>
            {current > s.step ? '✓' : s.step}
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-widest hidden sm:block transition-colors ${current >= s.step ? 'text-[#F2F4F7]' : 'text-[#667085]'
            }`}>{s.label}</span>
        </div>
        {i < STEPS.length - 1 && (
          <div className="flex-grow h-0.5 bg-[rgba(255,255,255,0.1)] overflow-hidden">
            <div className={`h-full bg-[#CBFE1C] transition-all duration-500 ${current > s.step ? 'w-full' : 'w-0'}`} />
          </div>
        )}
      </React.Fragment>
    ))}
  </div>
);

// ─── Sign-Up Wizard ──────────────────────────────────────────────────────────
const SignUpWizard: React.FC<{ onSwitchToLogin: () => void; onSignedUp: () => void }> = ({ onSwitchToLogin, onSignedUp }) => {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState('');

  const set = (field: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [field]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await parentAuth.signUp({
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

  // Step 1 — Personal info
  if (step === 1) return (
    <div className="space-y-4">
      <StepBar current={1} />
      <div className="mb-1">
        <h2 className="font-bold text-white text-base" style={{ fontFamily: "'Chakra Petch', sans-serif", textTransform: 'none', letterSpacing: 0 }}>👋 Welcome! Let's get started</h2>
        <p className="text-[#98A2B3] text-sm">Tell us a bit about yourself.</p>
      </div>
      <Field label="Your Full Name" value={form.fullName} icon="👤"
        onChange={set('fullName')} placeholder="Jane Smith" type="text" required />
      <Field label="Phone Number" value={form.phone} icon="📱"
        onChange={set('phone')} placeholder="(555) 000-0000" type="tel" required />
      <button
        onClick={() => { if (form.fullName && form.phone) setStep(2); }}
        disabled={!form.fullName || !form.phone}
        className="pz-btn w-full py-3.5 min-h-[48px] text-sm disabled:opacity-40"
      >
        Continue →
      </button>
      <p className="text-center text-sm text-[#98A2B3]">
        Already have an account?{' '}
        <button onClick={onSwitchToLogin} className="text-[#CBFE1C] font-bold hover:underline">Sign In</button>
      </p>
    </div>
  );

  // Step 2 — Account credentials
  if (step === 2) return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <StepBar current={2} />
      <div className="mb-1">
        <h2 className="font-bold text-white text-base" style={{ fontFamily: "'Chakra Petch', sans-serif", textTransform: 'none', letterSpacing: 0 }}>🔐 Set up your account</h2>
        <p className="text-[#98A2B3] text-sm">Create your login for <strong className="text-white">{form.fullName}</strong>.</p>
      </div>
      {error && (
        <div className="p-3 rounded-[4px] bg-[rgba(239,68,68,0.1)] border border-[rgba(248,113,113,0.35)] border-l-[3px] border-l-[#ef4444] text-[#fca5a5] text-sm font-medium">
          {error}
        </div>
      )}
      <Field label="Email Address" value={form.email} icon="✉️"
        onChange={set('email')} placeholder="parent@email.com" type="email" required />
      <Field label="Password" value={form.password} icon="🔑"
        onChange={set('password')} placeholder="Min 6 characters" type="password" required />
      <Field label="Confirm Password" value={form.confirmPassword} icon="🔑"
        onChange={set('confirmPassword')} placeholder="Repeat your password" type="password" required />
      <div className="flex gap-2">
        <button type="button" onClick={() => setStep(1)}
          className="pz-btn-ghost flex-1 py-3.5 min-h-[48px] text-sm">
          ← Back
        </button>
        <button type="submit" disabled={loading || !form.email || !form.password}
          className="pz-btn flex-[2] py-3.5 min-h-[48px] text-sm disabled:opacity-40">
          {loading ? 'Creating…' : 'Create Account'}
        </button>
      </div>
    </form>
  );

  // Step 3 — Done!
  return (
    <div className="text-center space-y-4 py-2">
      <StepBar current={3} />
      <div className="text-5xl animate-bounce motion-reduce:animate-none">🎉</div>
      <div>
        <h2 className="pz-display text-white text-xl">You're in, {createdName}!</h2>
        <p className="text-[#98A2B3] text-sm mt-2">
          Your account is ready. Head to your dashboard to see your athletes.
        </p>
      </div>
      <div className="bg-[#171C27] rounded-[4px] p-4 border border-[rgba(203,254,28,0.25)] text-left space-y-1.5">
        <p className="text-[10px] font-bold text-[#CBFE1C] uppercase tracking-widest">Your Account</p>
        <p className="text-sm font-semibold text-[#F2F4F7]">👤 {form.fullName}</p>
        <p className="text-sm font-semibold text-[#F2F4F7]">✉️ {form.email}</p>
        <p className="text-sm font-semibold text-[#F2F4F7]">📱 {form.phone}</p>
      </div>
      <button onClick={onSignedUp}
        className="pz-btn w-full py-3.5 min-h-[48px] text-sm">
        Go to Dashboard →
      </button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ParentAuth: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const switchMode = (m: Mode) => { setMode(m); setError(null); setSuccess(null); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await parentAuth.signIn(email, password);
      navigate('/parent-dashboard');
    } catch (err: any) {
      setError(err.message?.replace(/^.*Uncaught Error:\s*/, '') || 'Sign in failed.');
    }
    setLoading(false);
  };

  return (
    <div className="pz-scope pz-banner min-h-screen flex flex-col items-center justify-center p-4">
      <PzPortalCss />
      <div className="w-full max-w-md pz-card">

        <BrandHeader />

        {/* Tab switcher — only show Login/Sign Up tabs (not during reset) */}
        {mode !== 'reset' && (
          <div className="flex border-b border-[rgba(255,255,255,0.08)]">
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={`flex-1 py-3.5 min-h-[48px] text-[13px] font-bold uppercase tracking-widest transition-all border-b-2 ${mode === m
                  ? 'border-[#CBFE1C] text-[#CBFE1C] bg-[rgba(203,254,28,0.05)]'
                  : 'border-transparent text-[#98A2B3] hover:text-white'
                  }`}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>
        )}

        <div className="p-6">
          {/* ── Sign Up: full wizard ── */}
          {mode === 'signup' && (
            <SignUpWizard
              onSwitchToLogin={() => switchMode('login')}
              onSignedUp={() => navigate('/parent-dashboard')}
            />
          )}

          {/* ── Login form ── */}
          {mode === 'login' && (
            <>
              {error && (
                <div className="mb-4 p-3 rounded-[4px] bg-[rgba(239,68,68,0.1)] border border-[rgba(248,113,113,0.35)] border-l-[3px] border-l-[#ef4444] text-[#fca5a5] text-sm font-medium flex items-center gap-2">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 rounded-[4px] bg-[rgba(203,254,28,0.08)] border border-[rgba(203,254,28,0.35)] border-l-[3px] border-l-[#CBFE1C] text-[#CBFE1C] text-sm font-medium flex items-center gap-2">
                  {success}
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="Email Address" value={email} icon="✉️"
                  onChange={setEmail} placeholder="parent@email.com" type="email" required />
                <Field label="Password" value={password} icon="🔑"
                  onChange={setPassword} placeholder="••••••••" type="password" required />
                <button type="submit" disabled={loading}
                  className={`pz-btn w-full py-3.5 min-h-[48px] text-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {loading ? 'Please wait…' : 'Sign In'}
                </button>
              </form>
              <div className="text-center mt-4">
                <button onClick={() => switchMode('reset')}
                  className="text-sm text-[#98A2B3] hover:text-[#CBFE1C] font-medium transition-colors min-h-[44px]">
                  Forgot password?
                </button>
              </div>
            </>
          )}

          {/* ── Password reset (coach-assisted) ── */}
          {mode === 'reset' && (
            <>
              <div className="mb-5 text-center">
                <h2 className="pz-display text-white text-base">Reset Password</h2>
                <p className="text-[#98A2B3] text-sm mt-1">Forgot your password? No problem.</p>
              </div>
              <div className="p-4 rounded-[4px] bg-[#171C27] border border-[rgba(255,255,255,0.08)] text-[#F2F4F7] text-sm font-medium space-y-2">
                <p>📞 Please contact your coach or the academy front desk to reset your password.</p>
                <p className="text-[#98A2B3] text-xs">A staff member can verify your identity and set a new temporary password for your account.</p>
              </div>
              <div className="text-center mt-4">
                <button onClick={() => switchMode('login')}
                  className="text-sm text-[#98A2B3] hover:text-[#CBFE1C] font-medium transition-colors min-h-[44px]">
                  ← Back to Sign In
                </button>
              </div>
            </>
          )}

          {/* Footer */}
          {mode !== 'signup' && (
            <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.08)] text-center">
              <p className="text-[#98A2B3] text-xs">
                Students:{' '}
                <a href="/#/login" className="text-[#CBFE1C] font-bold hover:underline">Student Portal</a>
                {' '}to log in
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParentAuth;
