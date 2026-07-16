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
    // Admins get a chooser (Admin portal vs Parent portal) instead of a
    // forced redirect — otherwise they can never reach the parent side.
    if (isAdmin) return;
    void enterParentPortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, user]);

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
