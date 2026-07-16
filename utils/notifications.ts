/**
 * Admin notification system for real-time feedback
 */

import { AudioService } from './audio';

export class AdminNotifications {
  private static playSound(frequency: number, duration: number) {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      console.warn('Audio not available:', e);
    }
  }

  private static vibrate(pattern: number | number[]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  public static sessionStarted(sessionName: string) {
    // Visual notification
    this.showToast(`🚀 Session Started: ${sessionName}`, 'success');

    // Audio feedback - ascending chime
    this.playSound(523.25, 0.1); // C5
    setTimeout(() => this.playSound(659.25, 0.1), 100); // E5
    setTimeout(() => this.playSound(783.99, 0.2), 200); // G5

    // Haptic feedback
    this.vibrate([50, 50, 100]);
  }

  public static sessionEnded(sessionName: string) {
    // Visual notification
    this.showToast(`⏹️ Session Ended: ${sessionName}`, 'info');

    // Audio feedback - descending chime
    this.playSound(783.99, 0.1); // G5
    setTimeout(() => this.playSound(659.25, 0.1), 100); // E5
    setTimeout(() => this.playSound(523.25, 0.2), 200); // C5

    // Haptic feedback
    this.vibrate([100, 50, 50]);
  }

  public static pointsAwarded(amount: number, studentName?: string) {
    const message = studentName
      ? `+${amount} points → ${studentName}`
      : `+${amount} points awarded`;

    this.showToast(message, 'success');
    try { AudioService.playRandomAward(); } catch {}
    this.vibrate(50);
  }

  public static error(message: string) {
    this.showToast(`❌ ${message}`, 'error');
    this.playSound(220, 0.3); // A3 - low error tone
    this.vibrate([100, 100, 100]);
  }

  private static showToast(message: string, type: 'success' | 'error' | 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `fixed top-24 right-6 z-[300] px-6 py-4 rounded-2xl shadow-2xl font-black text-sm animate-slide-in-right ${
      type === 'success' ? 'bg-emerald-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      'bg-blue-500 text-white'
    }`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slide-out-right 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in-right {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slide-out-right {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  .animate-slide-in-right {
    animation: slide-in-right 0.3s ease-out;
  }
`;
document.head.appendChild(style);
