// The Portal entry point (/#/parent-login). Clerk handles identity (email or
// Google); once signed in we exchange the Clerk session for the app's own
// parent session (convex/clerkBridge.ts) and route by role:
//   admins  → /admin   (the Admin portal)
//   parents → /parent-dashboard
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn, useAuth, useUser, useSignIn, useSignUp } from '@clerk/clerk-react';
import { ConvexClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { parentAuth } from '../services/parentAuth';
import { isAdminUser } from '../services/adminAccess';
import { PzPortalCss } from './Parent/shared';
import { Ic } from './icons';

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ||
  'https://dependable-spoonbill-535.convex.cloud';

const clerkAppearance = {
  variables: {
    colorBackground: '#12161F',
    colorInputBackground: '#171C27',
    colorPrimary: '#CBFE1C',
    colorText: '#ffffff',
    colorTextSecondary: '#ABABAB',
    colorInputText: '#ffffff',
    borderRadius: '4px',
    fontFamily: "'Chakra Petch', sans-serif",
  },
  elements: {
    formButtonPrimary: { color: '#0B0E13', fontWeight: 700, textTransform: 'uppercase' },
    card: { border: '1px solid rgba(255,255,255,0.08)' },
  },
} as const;

// Clerk appends the invitation ticket to the redirect URL. index.tsx captures
// it into sessionStorage and scrubs the URL before clerk-js boots (else the
// dev-instance handshake bounces to the hosted sign-in and loses it). Check
// storage first, then fall back to scanning the href.
const ticketFromUrl = (): string | null => {
  try {
    const stored = sessionStorage.getItem('fnf_invite_ticket');
    if (stored) return stored;
  } catch { /* fall through to the URL */ }
  const m = window.location.href.match(/[?&]__clerk_ticket=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

const clearStoredTicket = () => {
  try { sessionStorage.removeItem('fnf_invite_ticket'); } catch { /* noop */ }
};

const PortalGate: React.FC = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { signUp, setActive: setActiveFromSignUp } = useSignUp();
  const { signIn, setActive: setActiveFromSignIn } = useSignIn();
  const [error, setError] = useState<string | null>(null);
  const [bridgingParent, setBridgingParent] = useState(false);
  const bridging = useRef(false);

  const isAdmin = isAdminUser(user);

  // Invite links land as #/parent-login?invite=<token> — personalize the gate.
  // Coach invites land as ?coach=1 — brand the gate and route to /admin.
  const [invite, setInvite] = useState<{ fullName: string; kidNames: string[] } | null>(null);
  const [coachInvite, setCoachInvite] = useState(false);

  // Clerk invitation ticket (coach invites): redeeming it is what flips the
  // invitation to "accepted" and stamps publicMetadata.role = admin. The old
  // flow showed a plain sign-in and never consumed the ticket, so invites sat
  // pending forever and coaches never got the admin role.
  const [ticket] = useState<string | null>(() => ticketFromUrl());

  // Clerk can wedge on a stale session and never finish loading. Give it 8
  // seconds, then offer a way out instead of an endless "Loading" screen.
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    if (isLoaded) return;
    const timer = window.setTimeout(() => setLoadTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

  const startFresh = () => {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('__clerk') || key.startsWith('clerk')) window.localStorage.removeItem(key);
      }
      document.cookie.split(';').forEach(c => {
        const name = c.split('=')[0].trim();
        if (name.startsWith('__clerk') || name.startsWith('__session') || name.startsWith('__client')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
      });
    } catch { /* best effort */ }
    window.location.reload();
  };
  const [ticketPhase, setTicketPhase] = useState<'idle' | 'redeeming' | 'needs_details' | 'verify_phone' | 'done' | 'failed'>('idle');
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [finishing, setFinishing] = useState(false);
  const ticketTried = useRef(false);

  // This instance requires a verified phone number at sign-up, so the coach
  // form collects it and walks the SMS code step (same as parents get on the
  // hosted sign-up).
  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return raw.trim().startsWith('+') ? raw.trim() : `+${digits}`;
  };

  useEffect(() => {
    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    // Ticket links keep ?coach=1 inside the hash, but treat any ticket link
    // as a coach invite even if the flag got lost in a URL rewrite.
    if (ticket) setCoachInvite(true);
    if (qIndex === -1) return;
    const params = new URLSearchParams(hash.slice(qIndex + 1));
    if (params.get('coach')) setCoachInvite(true);
    const token = params.get('invite');
    if (!token) return;
    const client = new ConvexClient(CONVEX_URL);
    client
      .query(api.invites.byToken, { token })
      .then((inv: any) => { if (inv) setInvite({ fullName: inv.fullName, kidNames: inv.kidNames ?? [] }); })
      .catch(() => { /* bad/expired token — plain sign-in still works */ })
      .finally(() => void client.close());
  }, [ticket]);

  // Redeem the ticket. Sign-IN first: existing accounts (sign-in tokens, or
  // an invited coach whose account already exists) enter with zero friction
  // and no captcha. If the ticket is a fresh invitation, sign-in rejects it
  // and we fall through to the sign-UP path (which may show the captcha).
  useEffect(() => {
    if (!ticket || !isLoaded || isSignedIn || ticketTried.current) return;
    if (!signUp || !signIn) return;
    ticketTried.current = true;
    setTicketPhase('redeeming');
    (async () => {
      try {
        const trySignIn = await signIn.create({ strategy: 'ticket', ticket });
        if (trySignIn.status === 'complete' && trySignIn.createdSessionId) {
          await setActiveFromSignIn({ session: trySignIn.createdSessionId });
          clearStoredTicket();
          setTicketPhase('done');
          return;
        }
      } catch { /* not a sign-in ticket for an existing account — sign up */ }
      try {
        const res = await signUp.create({ strategy: 'ticket', ticket });
        if (res.status === 'complete' && res.createdSessionId) {
          await setActiveFromSignUp({ session: res.createdSessionId });
          clearStoredTicket();
          setTicketPhase('done');
          return;
        }
        // Instance wants more (usually a password and a name) — collect it.
        setTicketPhase('needs_details');
      } catch (e: any) {
        const code = e?.errors?.[0]?.code as string | undefined;
        if (code === 'form_identifier_exists') {
          // Existing account: accept the invite by signing in with the ticket.
          try {
            const res = await signIn.create({ strategy: 'ticket', ticket });
            if (res.status === 'complete' && res.createdSessionId) {
              await setActiveFromSignIn({ session: res.createdSessionId });
              clearStoredTicket();
              setTicketPhase('done');
              return;
            }
          } catch (e2: any) {
            console.error('Ticket sign-in failed:', e2);
          }
          clearStoredTicket();
          setTicketPhase('failed');
          setTicketError('You already have an account with this email. Sign in below and your coach access will be set up by an admin.');
          return;
        }
        console.error('Ticket sign-up failed:', e);
        clearStoredTicket();
        setTicketPhase('failed');
        setTicketError(
          e?.errors?.[0]?.long_message ||
          'This invite link is no longer valid. Ask for a fresh invite and use the newest email.'
        );
      }
    })();
  }, [ticket, isLoaded, isSignedIn, signUp, signIn]);

  // Finish a ticket sign-up that needed extra details. The instance requires
  // first/last name, a password, and a VERIFIED phone — so this runs in two
  // steps: details -> SMS code -> done.
  const finishCoachSignUp = async () => {
    if (!signUp || finishing) return;
    if (!firstName.trim() || !lastName.trim()) {
      setTicketError('First and last name are required.');
      return;
    }
    if (password.length < 8) {
      setTicketError('Password needs at least 8 characters.');
      return;
    }
    const phoneNumber = normalizePhone(phone);
    if (phoneNumber.replace(/[^\d]/g, '').length < 10) {
      setTicketError('Enter a valid mobile number.');
      return;
    }
    setFinishing(true);
    setTicketError(null);
    try {
      const res = await signUp.update({
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber,
      });
      if (res.status === 'complete' && res.createdSessionId) {
        await setActiveFromSignUp({ session: res.createdSessionId });
        clearStoredTicket();
        setTicketPhase('done');
        return;
      }
      if (res.unverifiedFields?.includes('phone_number')) {
        await signUp.preparePhoneNumberVerification();
        setTicketPhase('verify_phone');
        return;
      }
      setTicketError('Something is still missing — check the fields and try again.');
    } catch (e: any) {
      setTicketError(e?.errors?.[0]?.long_message || 'Could not finish creating your account.');
    } finally {
      setFinishing(false);
    }
  };

  const verifyCoachPhone = async () => {
    if (!signUp || finishing) return;
    if (smsCode.trim().length < 4) {
      setTicketError('Enter the code from the text message.');
      return;
    }
    setFinishing(true);
    setTicketError(null);
    try {
      const res = await signUp.attemptPhoneNumberVerification({ code: smsCode.trim() });
      if (res.status === 'complete' && res.createdSessionId) {
        await setActiveFromSignUp({ session: res.createdSessionId });
        clearStoredTicket();
        setTicketPhase('done');
      } else {
        setTicketError('That code did not work — check it and try again.');
      }
    } catch (e: any) {
      setTicketError(e?.errors?.[0]?.long_message || 'That code did not work — try again.');
    } finally {
      setFinishing(false);
    }
  };

  const resendCoachSms = async () => {
    if (!signUp) return;
    setTicketError(null);
    try {
      await signUp.preparePhoneNumberVerification();
    } catch (e: any) {
      setTicketError(e?.errors?.[0]?.long_message || 'Could not resend the code.');
    }
  };

  // Exchange the Clerk session for the app's parent session, then enter the
  // parent dashboard. Used automatically for parents; on demand for admins
  // (who are often parents too).
  const enterParentPortal = async () => {
    if (bridging.current) return;
    bridging.current = true;
    setBridgingParent(true);
    try {
      const clerkToken = await getToken();
      if (!clerkToken) throw new Error('No session token');
      const client = new ConvexClient(CONVEX_URL);
      const result = (await client.action(api.clerkBridge.signIn, {
        clerkToken,
      })) as { token: string };
      parentAuth.adoptToken(result.token);
      navigate('/parent-dashboard', { replace: true });
    } catch (e) {
      console.error('Portal sign-in bridge failed:', e);
      setError(
        e instanceof Error && /expired/i.test(e.message)
          ? 'Your session expired — please sign in again.'
          : 'Could not finish signing you in. Please try again.'
      );
      bridging.current = false;
      setBridgingParent(false);
    }
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || bridging.current) return;
    // Coach invite: skip the chooser and land in the Admin Portal directly.
    if (isAdmin && coachInvite) {
      navigate('/admin', { replace: true });
      return;
    }
    // Admins get a chooser (Admin portal vs Parent portal) instead of a
    // forced redirect — otherwise they can never reach the parent side.
    if (isAdmin) return;
    void enterParentPortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, user, coachInvite]);

  return (
    <div
      className="pz-scope pz-banner"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <PzPortalCss />

      {/* Escape hatch — the gate must never be a dead end */}
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="pz-btn-ghost"
        style={{
          position: 'absolute',
          top: 'calc(1rem + env(safe-area-inset-top, 0px))',
          left: '1rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.6rem 1rem',
          minHeight: 44,
          fontSize: '0.75rem',
        }}
        aria-label="Go back"
      >
        <Ic.ArrowLeft size={16} /> Back
      </button>

      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <img
          src="/fnfa-logo.png"
          alt="Fun 'n Fit Academy"
          style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 0.75rem' }}
        />
        <div className="pz-eyebrow">Fun 'n Fit Academy</div>
        <h1 className="pz-display" style={{ color: '#fff', fontSize: '1.6rem', marginTop: 4 }}>
          Portal
        </h1>
        <p style={{ color: 'var(--pz-text)', fontSize: '0.85rem', marginTop: 6 }}>
          Parents and coaches sign in here — email or Google.
        </p>
      </div>

      {coachInvite && !isSignedIn && (
        <div
          className="pz-card-sm"
          style={{
            padding: '0.9rem 1.25rem', marginBottom: '1.25rem', maxWidth: 380, width: '100%',
            textAlign: 'center', borderColor: 'rgba(203,254,28,0.45)', background: 'rgba(203,254,28,0.07)',
          }}
        >
          <div className="pz-eyebrow" style={{ marginBottom: 4 }}>Coach invite</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.45 }}>
            Welcome to the staff! Create your account with the email your invite
            was sent to — you'll land straight in the Admin Portal.
          </div>
        </div>
      )}

      {invite && !isSignedIn && (
        <div
          className="pz-card-sm"
          style={{
            padding: '0.9rem 1.25rem', marginBottom: '1.25rem', maxWidth: 380, width: '100%',
            textAlign: 'center', borderColor: 'rgba(203,254,28,0.45)', background: 'rgba(203,254,28,0.07)',
          }}
        >
          <div className="pz-eyebrow" style={{ marginBottom: 4 }}>You're invited</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.45 }}>
            Welcome{invite.fullName ? `, ${invite.fullName.split(' ')[0]}` : ''}!
            {invite.kidNames.length > 0
              ? ` ${invite.kidNames.join(' and ')} ${invite.kidNames.length > 1 ? 'are' : 'is'} already linked — `
              : ' Your account is ready — '}
            sign in with the email your invite was sent to.
          </div>
        </div>
      )}

      {!isLoaded && !loadTimedOut && (
        <div style={{ color: 'var(--pz-text)', fontSize: '0.9rem' }}>Loading…</div>
      )}

      {!isLoaded && loadTimedOut && (
        <div className="pz-card" style={{ padding: '1.5rem', maxWidth: 380, width: '100%', textAlign: 'center' }}>
          <p style={{ color: 'var(--pz-text)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Sign-in is taking longer than it should. A stale session can cause this.
          </p>
          <button
            className="pz-btn"
            style={{ display: 'block', width: '100%', minHeight: 48, marginBottom: '0.6rem', fontSize: '0.85rem' }}
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
          <button
            className="pz-btn-ghost"
            style={{ display: 'block', width: '100%', minHeight: 48, fontSize: '0.85rem' }}
            onClick={startFresh}
          >
            Start fresh (clear session)
          </button>
        </div>
      )}

      {/* Clerk bot-protection needs this element for ticket sign-ups */}
      {ticket && !isSignedIn && <div id="clerk-captcha" style={{ maxWidth: 380, width: '100%' }} />}

      {/* Coach invite ticket: setting the account up automatically */}
      {isLoaded && !isSignedIn && ticketPhase === 'redeeming' && (
        <div className="pz-card-sm" style={{ padding: '1rem 1.5rem', color: '#fff' }}>
          Setting up your coach account…
        </div>
      )}

      {/* Ticket accepted but the account needs a name + password */}
      {isLoaded && !isSignedIn && ticketPhase === 'needs_details' && (
        <div className="pz-card" style={{ padding: '1.5rem', maxWidth: 380, width: '100%' }}>
          <div className="pz-eyebrow" style={{ marginBottom: 4 }}>Almost there</div>
          <p style={{ color: 'var(--pz-text)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Your invite checked out. Finish your coach account:
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              autoComplete="given-name"
              style={{ flex: 1, minWidth: 0, padding: '0.8rem 0.9rem', background: '#171C27', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#fff', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }}
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              autoComplete="family-name"
              style={{ flex: 1, minWidth: 0, padding: '0.8rem 0.9rem', background: '#171C27', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#fff', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Choose a password (8+ characters)"
            autoComplete="new-password"
            style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem 0.9rem', background: '#171C27', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#fff', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', marginBottom: '0.6rem' }}
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void finishCoachSignUp(); }}
            placeholder="Mobile number"
            autoComplete="tel"
            style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem 0.9rem', background: '#171C27', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#fff', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', marginBottom: '0.35rem' }}
          />
          <div style={{ color: 'var(--pz-text)', fontSize: '0.7rem', marginBottom: '0.9rem' }}>
            We text a quick code to verify it.
          </div>
          {ticketError && (
            <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{ticketError}</div>
          )}
          <button
            className="pz-btn"
            style={{ display: 'block', width: '100%', minHeight: 52, fontSize: '0.85rem', opacity: finishing ? 0.6 : 1 }}
            disabled={finishing}
            onClick={() => void finishCoachSignUp()}
          >
            {finishing ? 'Creating your account…' : 'Join the staff'}
          </button>
        </div>
      )}

      {/* Phone verification: the code just texted to the coach */}
      {isLoaded && !isSignedIn && ticketPhase === 'verify_phone' && (
        <div className="pz-card" style={{ padding: '1.5rem', maxWidth: 380, width: '100%' }}>
          <div className="pz-eyebrow" style={{ marginBottom: 4 }}>One last step</div>
          <p style={{ color: 'var(--pz-text)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            We texted a code to {normalizePhone(phone)} — enter it here:
          </p>
          <input
            inputMode="numeric"
            value={smsCode}
            onChange={(e) => setSmsCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void verifyCoachPhone(); }}
            placeholder="6-digit code"
            autoComplete="one-time-code"
            style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem 0.9rem', background: '#171C27', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#fff', fontSize: '1.1rem', letterSpacing: '0.35em', textAlign: 'center', outline: 'none', fontFamily: 'inherit', marginBottom: '0.9rem' }}
          />
          {ticketError && (
            <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{ticketError}</div>
          )}
          <button
            className="pz-btn"
            style={{ display: 'block', width: '100%', minHeight: 52, fontSize: '0.85rem', opacity: finishing ? 0.6 : 1 }}
            disabled={finishing}
            onClick={() => void verifyCoachPhone()}
          >
            {finishing ? 'Checking…' : 'Verify and join'}
          </button>
          <button
            onClick={() => void resendCoachSms()}
            style={{ display: 'block', margin: '0.75rem auto 0', background: 'none', border: 'none', color: 'var(--pz-text)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', minHeight: 44, fontFamily: "'Chakra Petch', sans-serif" }}
          >
            Resend code
          </button>
        </div>
      )}

      {/* Ticket problem: explain it, then fall back to the normal sign-in */}
      {isLoaded && !isSignedIn && ticketPhase === 'failed' && ticketError && (
        <div
          className="pz-card-sm"
          style={{ padding: '0.9rem 1.25rem', marginBottom: '1.25rem', maxWidth: 380, width: '100%', textAlign: 'center', borderColor: 'rgba(248,113,113,0.45)', color: '#f87171', fontSize: '0.85rem' }}
        >
          {ticketError}
        </div>
      )}

      {isLoaded && !isSignedIn && (ticketPhase === 'idle' || ticketPhase === 'failed') && (
        <SignIn appearance={clerkAppearance} routing="virtual" />
      )}

      {isLoaded && isSignedIn && !error && isAdmin && !bridgingParent && (
        <div className="pz-card" style={{ padding: '1.5rem', maxWidth: 380, width: '100%' }}>
          <p style={{ color: 'var(--pz-text)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1rem' }}>
            You're signed in as staff — where to?
          </p>
          <button
            className="pz-btn"
            style={{ display: 'block', width: '100%', minHeight: 56, marginBottom: '0.75rem', fontSize: '0.85rem' }}
            onClick={() => navigate('/admin')}
          >
            Admin Portal
          </button>
          <button
            className="pz-btn-ghost"
            style={{ display: 'block', width: '100%', minHeight: 56, fontSize: '0.85rem' }}
            onClick={() => void enterParentPortal()}
          >
            Parent Portal
          </button>
        </div>
      )}

      {isLoaded && isSignedIn && !error && (!isAdmin || bridgingParent) && (
        <div className="pz-card-sm" style={{ padding: '1rem 1.5rem', color: '#fff' }}>
          Signing you in…
        </div>
      )}

      {/* Always-available exits below the card */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: 'var(--pz-text)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', minHeight: 44, fontFamily: "'Chakra Petch', sans-serif" }}
        >
          Home
        </button>
        <button
          onClick={() => navigate('/live')}
          style={{ background: 'none', border: 'none', color: 'var(--pz-text)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', minHeight: 44, fontFamily: "'Chakra Petch', sans-serif" }}
        >
          Live Board
        </button>
      </div>

      {error && (
        <div
          className="pz-card-sm"
          style={{ padding: '1rem 1.5rem', color: '#f87171', maxWidth: 380, textAlign: 'center' }}
        >
          {error}
          <button
            className="pz-btn"
            style={{ display: 'block', margin: '0.75rem auto 0', padding: '0.5rem 1.25rem' }}
            onClick={() => {
              setError(null);
              bridging.current = false;
            }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
};

export default PortalGate;
