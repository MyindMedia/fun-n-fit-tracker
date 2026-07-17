// The Portal entry point (/#/parent-login). Clerk handles identity (email or
// Google); once signed in we exchange the Clerk session for the app's own
// parent session (convex/clerkBridge.ts) and route by role:
//   admins  → /admin   (the Admin portal)
//   parents → /parent-dashboard
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn, useAuth, useUser } from '@clerk/clerk-react';
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

const PortalGate: React.FC = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [bridgingParent, setBridgingParent] = useState(false);
  const bridging = useRef(false);

  const isAdmin = isAdminUser(user);

  // Invite links land as #/parent-login?invite=<token> — personalize the gate.
  // Coach invites land as ?coach=1 — brand the gate and route to /admin.
  const [invite, setInvite] = useState<{ fullName: string; kidNames: string[] } | null>(null);
  const [coachInvite, setCoachInvite] = useState(false);
  useEffect(() => {
    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
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
  }, []);

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

      {!isLoaded && (
        <div style={{ color: 'var(--pz-text)', fontSize: '0.9rem' }}>Loading…</div>
      )}

      {isLoaded && !isSignedIn && <SignIn appearance={clerkAppearance} routing="virtual" />}

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
