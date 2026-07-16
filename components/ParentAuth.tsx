import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parentAuth } from '../services/parentAuth';

type Mode = 'login' | 'signup' | 'reset';
type Step = 1 | 2 | 3;

// ─── Branded Header ──────────────────────────────────────────────────────────
const BrandHeader: React.FC = () => (
  <div className="bg-gradient-to-br from-brand-blue via-blue-600 to-indigo-700 p-6 text-white text-center relative overflow-hidden">
    <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
    <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full" />
    <div className="relative">
      <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-xl flex items-center justify-center shadow-lg">
        <img src="/fnfa-logo.png" alt="Logo" className="w-full h-full object-contain p-1" />
      </div>
      <h1 className="text-2xl font-black uppercase tracking-tight mb-0.5">Parent Portal</h1>
      <p className="text-blue-100 text-sm font-medium">Fun 'N Fit Academy</p>
    </div>
  </div>
);

// ─── Input field helper ──────────────────────────────────────────────────────
const Field: React.FC<{
  label: string; value: string; icon: string;
  onChange: (v: string) => void;
  placeholder: string; type: string; required?: boolean;
}> = ({ label, value, icon, onChange, placeholder, type, required }) => (
  <div>
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
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
        className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 font-bold text-slate-900 text-sm focus:border-brand-blue focus:bg-white outline-none transition-all"
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
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${current > s.step ? 'bg-green-500 text-white'
            : current === s.step ? 'bg-brand-blue text-white shadow-md'
              : 'bg-slate-200 text-slate-400'
            }`}>
            {current > s.step ? '✓' : s.step}
          </div>
          <span className={`text-[10px] font-black uppercase tracking-wide hidden sm:block transition-colors ${current >= s.step ? 'text-slate-600' : 'text-slate-300'
            }`}>{s.label}</span>
        </div>
        {i < STEPS.length - 1 && (
          <div className="flex-grow h-0.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full bg-brand-blue rounded-full transition-all duration-500 ${current > s.step ? 'w-full' : 'w-0'}`} />
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
        <h2 className="font-black text-slate-900 text-base">👋 Welcome! Let's get started</h2>
        <p className="text-slate-400 text-sm">Tell us a bit about yourself.</p>
      </div>
      <Field label="Your Full Name" value={form.fullName} icon="👤"
        onChange={set('fullName')} placeholder="Jane Smith" type="text" required />
      <Field label="Phone Number" value={form.phone} icon="📱"
        onChange={set('phone')} placeholder="(555) 000-0000" type="tel" required />
      <button
        onClick={() => { if (form.fullName && form.phone) setStep(2); }}
        disabled={!form.fullName || !form.phone}
        className="w-full py-3 bg-brand-blue text-white rounded-xl font-black text-sm uppercase tracking-wider disabled:opacity-40 hover:opacity-90 transition-all active:scale-[0.98]"
      >
        Continue →
      </button>
      <p className="text-center text-sm text-slate-400">
        Already have an account?{' '}
        <button onClick={onSwitchToLogin} className="text-brand-blue font-bold hover:underline">Sign In</button>
      </p>
    </div>
  );

  // Step 2 — Account credentials
  if (step === 2) return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <StepBar current={2} />
      <div className="mb-1">
        <h2 className="font-black text-slate-900 text-base">🔐 Set up your account</h2>
        <p className="text-slate-400 text-sm">Create your login for <strong>{form.fullName}</strong>.</p>
      </div>
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          ⚠️ {error}
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
          className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-sm hover:bg-slate-200 transition-colors">
          ← Back
        </button>
        <button type="submit" disabled={loading || !form.email || !form.password}
          className="flex-[2] py-3 bg-brand-blue text-white rounded-xl font-black text-sm uppercase tracking-wider disabled:opacity-40 hover:opacity-90 transition-all active:scale-[0.98]">
          {loading ? '⏳ Creating...' : '🚀 Create Account'}
        </button>
      </div>
    </form>
  );

  // Step 3 — Done!
  return (
    <div className="text-center space-y-4 py-2">
      <StepBar current={3} />
      <div className="text-5xl animate-bounce">🎉</div>
      <div>
        <h2 className="font-black text-slate-900 text-xl">You're in, {createdName}!</h2>
        <p className="text-slate-500 text-sm mt-2">
          Your account is ready. Head to your dashboard to see your athletes.
        </p>
      </div>
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 text-left space-y-1.5">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your Account</p>
        <p className="text-sm font-bold text-slate-700">👤 {form.fullName}</p>
        <p className="text-sm font-bold text-slate-700">✉️ {form.email}</p>
        <p className="text-sm font-bold text-slate-700">📱 {form.phone}</p>
      </div>
      <button onClick={onSignedUp}
        className="w-full py-3 bg-brand-blue text-white rounded-xl font-black text-sm uppercase tracking-wider hover:opacity-90 transition-all active:scale-[0.98]">
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">

        <BrandHeader />

        {/* Tab switcher — only show Login/Sign Up tabs (not during reset) */}
        {mode !== 'reset' && (
          <div className="flex border-b border-slate-100">
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={`flex-1 py-3 text-sm font-black uppercase tracking-wider transition-all border-b-2 ${mode === m
                  ? 'border-brand-blue text-brand-blue bg-blue-50'
                  : 'border-transparent text-slate-400 hover:text-slate-600 bg-white'
                  }`}>
                {m === 'login' ? '🔑 Sign In' : '✨ Sign Up'}
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
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-2">
                  ⚠️ {error}
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium flex items-center gap-2">
                  ✅ {success}
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="Email Address" value={email} icon="✉️"
                  onChange={setEmail} placeholder="parent@email.com" type="email" required />
                <Field label="Password" value={password} icon="🔑"
                  onChange={setPassword} placeholder="••••••••" type="password" required />
                <button type="submit" disabled={loading}
                  className={`w-full py-3 rounded-xl text-white font-black text-sm uppercase tracking-wider transition-all ${loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-brand-blue hover:opacity-90 active:scale-[0.98] shadow-md shadow-blue-200'
                    }`}>
                  {loading ? '⏳ Please wait...' : '🚀 Sign In'}
                </button>
              </form>
              <div className="text-center mt-4">
                <button onClick={() => switchMode('reset')}
                  className="text-sm text-slate-400 hover:text-brand-blue font-medium transition-colors">
                  Forgot password?
                </button>
              </div>
            </>
          )}

          {/* ── Password reset (coach-assisted) ── */}
          {mode === 'reset' && (
            <>
              <div className="mb-5 text-center">
                <h2 className="font-black text-slate-900 text-base">🔓 Reset Password</h2>
                <p className="text-slate-400 text-sm">Forgot your password? No problem.</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-slate-700 text-sm font-medium space-y-2">
                <p>📞 Please contact your coach or the academy front desk to reset your password.</p>
                <p className="text-slate-500 text-xs">A staff member can verify your identity and set a new temporary password for your account.</p>
              </div>
              <div className="text-center mt-4">
                <button onClick={() => switchMode('login')}
                  className="text-sm text-slate-400 hover:text-brand-blue font-medium transition-colors">
                  ← Back to Sign In
                </button>
              </div>
            </>
          )}

          {/* Footer */}
          {mode !== 'signup' && (
            <div className="mt-5 pt-4 border-t border-slate-100 text-center">
              <p className="text-slate-400 text-xs">
                Students:{' '}
                <a href="/#/login" className="text-brand-blue font-bold hover:underline">Student Portal</a>
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
