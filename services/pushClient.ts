// Web push enrollment for game + team alert notifications.
// Android/desktop: works in the browser directly. iOS: Apple only allows web
// push for INSTALLED web apps (Add to Home Screen), so we detect that and
// guide the parent through installing first.
import { ConvexClient } from 'convex/browser';
import { api } from '../convex/_generated/api';

const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ||
  'https://dependable-spoonbill-535.convex.cloud';

// Public VAPID key (safe to ship in the bundle; pairs with the server secret)
const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ||
  'BFQptjOKsTAgCfQ1fepbXFB75p97tz6_IJa9wjDIGWjiaTe9XW_UmXIcOIu_Ax590h0rt8uKXH4wbvbx5xut2eo';

export type PushStatus =
  | 'unsupported' // browser has no push at all
  | 'ios_needs_install' // iOS Safari tab: must Add to Home Screen first
  | 'denied' // user blocked notifications
  | 'ready' // supported, not yet subscribed
  | 'enabled'; // subscribed

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

// Home-screen app icon badge (Badging API). Supported on installed PWAs in
// Chrome/Edge and iOS 16.4+ standalone; a no-op everywhere else. The service
// worker keeps its own counter for pushes that land while the app is closed, so
// we mirror the authoritative count over to it on every update.
export const setAppBadge = (count: number): void => {
  const n = Math.max(0, Math.floor(count) || 0);
  const nav = navigator as Navigator & {
    setAppBadge?: (c?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (n > 0) nav.setAppBadge?.(n)?.catch(() => {});
    else nav.clearAppBadge?.()?.catch(() => {});
  } catch { /* Badging API unavailable */ }
  navigator.serviceWorker?.ready
    .then((reg) => reg.active?.postMessage({ type: 'badge:set', count: n }))
    .catch(() => {});
};

class PushClientService {
  private client = new ConvexClient(CONVEX_URL);

  supportLevel(): PushStatus {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return isIos() && !isStandalone() ? 'ios_needs_install' : 'unsupported';
    }
    if (isIos() && !isStandalone()) return 'ios_needs_install';
    if (Notification.permission === 'denied') return 'denied';
    return 'ready';
  }

  async currentStatus(): Promise<PushStatus> {
    const base = this.supportLevel();
    if (base !== 'ready') return base;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      return sub ? 'enabled' : 'ready';
    } catch {
      return 'ready';
    }
  }

  // Ask permission, subscribe the device, and store it server-side.
  async enable(audience: 'PARENT' | 'ADMIN' | 'STUDENT', parentId?: string): Promise<PushStatus> {
    const base = this.supportLevel();
    if (base !== 'ready') return base;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'ready';

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      }));

    await this.client.mutation(api.push.subscribe, {
      subscription: JSON.stringify(sub.toJSON()),
      audience,
      parentId: (parentId as never) ?? undefined,
      label: navigator.userAgent.slice(0, 120),
    });
    return 'enabled';
  }

  async disable(): Promise<void> {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await this.client.mutation(api.push.unsubscribe, { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  }

  async sendTest(byAdmin: string): Promise<void> {
    await this.client.mutation(api.push.sendTest, { byAdmin });
  }
}

export const pushClient = new PushClientService();
