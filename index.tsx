import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Coach invitation tickets: Clerk's accept endpoint lands here with
// ?__clerk_ticket=...&__clerk_status=sign_up in the query. If clerk-js boots
// while those params are in the URL, the dev-instance handshake bounces the
// browser to the hosted sign-in page and the ticket is lost — which is why
// invites sat "pending" forever. Capture the ticket and scrub the params
// BEFORE ClerkProvider initializes; PortalGate redeems it from storage.
try {
  const ticketMatch = window.location.search.match(/[?&]__clerk_ticket=([^&]+)/);
  if (ticketMatch) {
    sessionStorage.setItem('fnf_invite_ticket', decodeURIComponent(ticketMatch[1]));
    const url = new URL(window.location.href);
    url.searchParams.delete('__clerk_ticket');
    url.searchParams.delete('__clerk_status');
    // Ticket links may land on the root path: make sure the coach ends up on
    // the portal gate route where the redemption flow lives.
    if (!url.hash || url.hash === '#/' || url.hash === '#') {
      url.hash = '#/parent-login?coach=1';
    }
    window.history.replaceState(null, '', url.toString());
  }
} catch { /* storage unavailable: the gate's URL fallback still applies */ }

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;
if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing VITE_CLERK_PUBLISHABLE_KEY — set it in .env.local (and in the host build env)'
  );
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/#/">
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
