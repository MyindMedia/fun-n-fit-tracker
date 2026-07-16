
// Simple audio synthesizer to avoid external asset dependencies
import { POINT_SPARKLE_SOUNDS, POINT_LOST_SOUND, GAME_COUNTDOWN_10_SOUND, GAME_WINNER_SOUND, LEVEL_UP_SOUND, GAME_START_SOUND, GAME_OVER_LOGO_SOUND } from '../constants';

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
let audioUnlocked = true;
const assetCache: Record<string, HTMLAudioElement> = {};

let preferredVoice: SpeechSynthesisVoice | null = null;

// Audio queue system to prevent overlapping
let audioQueue: Array<() => Promise<void>> = [];
let isPlaying = false;

const processQueue = async () => {
  if (isPlaying || audioQueue.length === 0) return;
  isPlaying = true;

  while (audioQueue.length > 0) {
    const nextAudio = audioQueue.shift();
    if (nextAudio) {
      try {
        await nextAudio();
      } catch (e) {
        console.warn('Audio playback error:', e);
      }
    }
  }

  isPlaying = false;
};

const queueAudio = (playFn: () => Promise<void>) => {
  audioQueue.push(playFn);
  processQueue();
};

const ensureUnlocked = () => {
  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(e => console.warn('Audio context resume failed:', e));
    }
  } catch (e) {
    console.warn('Audio unlock error:', e);
  }
  audioUnlocked = true;
};

// Preload all audio assets for faster playback
const preloadAudio = () => {
  const urls = [
    ...POINT_SPARKLE_SOUNDS,
    POINT_LOST_SOUND,
    GAME_COUNTDOWN_10_SOUND,
    GAME_WINNER_SOUND,
    LEVEL_UP_SOUND,
    GAME_START_SOUND,
    GAME_OVER_LOGO_SOUND
  ];
  urls.forEach(url => {
    if (!assetCache[url]) {
      const a = new Audio(url);
      a.crossOrigin = 'anonymous';
      a.preload = 'auto';
      a.volume = 0;
      a.load();
      assetCache[url] = a;
    }
  });
  console.log('🔊 Audio assets preloaded:', urls.length);
};

// Play asset and wait for it to actually finish
const playAsset = async (url: string): Promise<void> => {
  ensureUnlocked();
  return new Promise((resolve, reject) => {
    try {
      const a = assetCache[url] || new Audio(url);
      a.crossOrigin = 'anonymous';
      a.preload = 'auto';
      a.currentTime = 0;
      a.volume = 0.9;
      assetCache[url] = a;

      const cleanup = () => {
        a.removeEventListener('ended', onEnded);
        a.removeEventListener('error', onError);
      };

      const onEnded = () => {
        cleanup();
        resolve();
      };

      const onError = (e: Event) => {
        cleanup();
        reject(e);
      };

      a.addEventListener('ended', onEnded);
      a.addEventListener('error', onError);

      a.play().catch((e) => {
        cleanup();
        reject(e);
      });
    } catch (e) {
      reject(e);
    }
  });
};

// Play asset without waiting (for non-critical sounds) - fire and forget
const playAssetNoWait = (url: string) => {
  ensureUnlocked();
  try {
    const a = assetCache[url] || new Audio(url);
    a.crossOrigin = 'anonymous';
    a.preload = 'auto';
    a.currentTime = 0;
    a.volume = 0.9;
    assetCache[url] = a;
    const playPromise = a.play();
    if (playPromise) {
      playPromise.catch(e => {
        console.warn('Audio play failed:', url, e);
      });
    }
  } catch (e) {
    console.warn('Audio setup failed:', url, e);
    throw e;
  }
};

const playTone = (freq: number, type: OscillatorType, duration: number, delay = 0, volume = 0.1) => {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
  
  gain.gain.setValueAtTime(volume, audioCtx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(audioCtx.currentTime + delay);
  osc.stop(audioCtx.currentTime + delay + duration);
};

export const AudioService = {
  isUnlocked: () => audioUnlocked,
  unlock: () => {
    ensureUnlocked();
    preloadAudio();
  },
  preload: preloadAudio,
  speak: (text: string, cancelPrevious = false) => {
    console.log('🔊 Attempting to speak:', text);
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not available');
      return;
    }

    try {
      // Ensure audio context is active
      ensureUnlocked();

      // Only cancel if explicitly requested (prevents cutting off important announcements)
      if (cancelPrevious) {
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);

      // Choose a more pleasant default voice when available
      const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferredNames = ['Samantha', 'Victoria', 'Google US English', 'Google en-US'];
        let chosen = voices.find(v => preferredNames.includes(v.name))
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'))
          || null;
        return chosen;
      };

      // Try to pick a voice
      if (!preferredVoice) {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          preferredVoice = pickVoice();
        } else {
          // Voices not loaded yet, set up callback
          window.speechSynthesis.onvoiceschanged = () => {
            preferredVoice = pickVoice();
          };
        }
      }

      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => console.log('🗣️ Speech started:', text);
      utterance.onend = () => console.log('🗣️ Speech ended:', text);
      utterance.onerror = (e) => console.warn('🗣️ Speech error:', e);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  },

  playAirHorn: () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const freqs = [350, 355, 360, 520, 525];
    freqs.forEach(f => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.9, now + 0.6);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 1.0);
    });
  },

  playBuzzer: () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(100, now + 1.5);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 1.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 1.5);
  },

  playCountdownBeep: () => playTone(600, 'sine', 0.1),
  playWarningBeep: () => playTone(400, 'triangle', 0.2),
  playUrgentBeep: () => playTone(800, 'sawtooth', 0.1),
  
  playCongratulations: () => {
    const now = audioCtx.currentTime;
    // Fast sparkle sweep
    for(let i=0; i<15; i++) {
      playTone(800 + (i * 150), 'sine', 0.4, i * 0.04, 0.15);
    }
    // Deep harmonic base
    playTone(261.63, 'triangle', 2.0, 0.1, 0.2); // C4
    playTone(329.63, 'triangle', 2.0, 0.2, 0.15); // E4
    playTone(392.00, 'triangle', 2.0, 0.3, 0.15); // G4
  },

  playBadgeEarned: () => {
    [400, 600, 800, 1000, 1200, 1500].forEach((freq, i) => {
        playTone(freq, 'sine', 0.3, i * 0.08, 0.2);
    });
    playTone(2000, 'triangle', 1.0, 0.6, 0.1);
  },

  playWinnerFanfare: () => {
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
       playTone(freq, 'square', 0.4, i * 0.15);
    });
  },

  playSuperPoints: () => {
    for(let i=0; i<5; i++) {
      playTone(1000 + (i*200), 'sine', 0.1, i * 0.05);
    }
  },

  // Point sounds - don't block, can overlap slightly
  playRandomAward: () => {
    ensureUnlocked();
    try {
      const urls = POINT_SPARKLE_SOUNDS;
      const pick = urls[Math.floor(Math.random() * urls.length)];
      playAssetNoWait(pick);
    } catch (e) {
      AudioService.playSuperPoints();
    }
  },

  playPointLost: () => {
    ensureUnlocked();
    try {
      playAssetNoWait(POINT_LOST_SOUND);
    } catch (e) {
      AudioService.playWarningBeep();
    }
  },

  // Countdown sound - plays immediately (not queued) so it syncs with visual
  playTenSecondCountdown: () => {
    console.log('🔊 Playing 10-second countdown sound');
    ensureUnlocked();
    try {
      // Try to play the audio asset
      const url = GAME_COUNTDOWN_10_SOUND;
      const a = assetCache[url] || new Audio(url);
      a.crossOrigin = 'anonymous';
      a.preload = 'auto';
      a.currentTime = 0;
      a.volume = 0.9;
      assetCache[url] = a;

      const playPromise = a.play();
      if (playPromise) {
        playPromise.catch(e => {
          console.warn('Countdown audio failed, using beep fallback:', e);
          // Play urgent beeps as fallback
          AudioService.playUrgentBeep();
        });
      }
    } catch (e) {
      console.warn('Countdown sound setup failed, using fallback:', e);
      AudioService.playUrgentBeep();
    }
  },

  playGameWinner: async () => {
    return new Promise<void>((resolve) => {
      queueAudio(async () => {
        try {
          await playAsset(GAME_WINNER_SOUND);
        } catch {
          AudioService.playWinnerFanfare();
        }
        resolve();
      });
    });
  },

  playGameOverLogo: async () => {
    return new Promise<void>((resolve) => {
      queueAudio(async () => {
        try {
          await playAsset(GAME_OVER_LOGO_SOUND);
        } catch {
          AudioService.playBuzzer();
        }
        resolve();
      });
    });
  },

  playLevelUp: async () => {
    return new Promise<void>((resolve) => {
      queueAudio(async () => {
        try {
          await playAsset(LEVEL_UP_SOUND);
        } catch {
          AudioService.playCongratulations();
        }
        resolve();
      });
    });
  },

  playGameStartCountdown: async (_title: string) => {
    return new Promise<void>((resolve) => {
      queueAudio(async () => {
        try {
          await playAsset(GAME_START_SOUND);
        } catch {
          AudioService.playCountdownBeep();
        }
        resolve();
      });
    });
  },

  // Game start sound - plays immediately (not queued) so it syncs with title announcement
  playGameStartAssetOnly: () => {
    console.log('🔊 Playing game start sound');
    ensureUnlocked();
    try {
      playAssetNoWait(GAME_START_SOUND);
    } catch (e) {
      console.warn('Game start sound failed, using fallback:', e);
      AudioService.playCountdownBeep();
    }
  },

  // Clear the audio queue (useful when game state changes)
  clearQueue: () => {
    audioQueue = [];
    isPlaying = false;
  },

  // Check if audio is currently playing
  isAudioPlaying: () => isPlaying
};
