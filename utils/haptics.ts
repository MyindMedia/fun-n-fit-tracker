// Haptic feedback via the Vibration API. Works on Android browsers; iOS
// Safari has no web vibration support, so calls no-op there silently.
// Patterns are short and distinct so button taps feel different from alerts.

type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 10, // light key-press feel (buttons, tab switches)
  select: 25, // stronger pick (choosing a kid, mode, preset)
  success: [15, 40, 60], // double-pulse celebration (check-in OK, scan bound)
  warning: [40, 60, 40], // attention (already checked in, unknown tag)
  error: [70, 50, 70, 50, 70], // something failed
};

export const hapticsSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'vibrate' in navigator;

export function haptic(kind: HapticKind = 'tap'): void {
  try {
    if (!hapticsSupported()) return;
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // never let feedback break a flow
  }
}
