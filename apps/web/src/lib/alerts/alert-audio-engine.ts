import { AlertSoundName, AlertSoundMetadata } from "./types";

export const ALERT_SOUNDS: AlertSoundMetadata[] = [
  // CLASSIC
  { id: "fired", label: "Thin", filename: "fired.mp3", path: "/sounds/alerts/fired.mp3" },
  { id: "3_notes_reverb", label: "3 Notes Reverb", filename: "3_notes_reverb.mp3", path: "/sounds/alerts/3_notes_reverb.mp3" },
  { id: "alarm_clock", label: "Alarm Clock", filename: "alarm_clock.mp3", path: "/sounds/alerts/alarm_clock.mp3" },
  { id: "beep_beep", label: "Beep-beep", filename: "beep_beep.mp3", path: "/sounds/alerts/beep_beep.mp3" },
  { id: "call", label: "Calling", filename: "call.mp3", path: "/sounds/alerts/call.mp3" },
  { id: "chirpy", label: "Chirpy", filename: "chirpy.mp3", path: "/sounds/alerts/chirpy.mp3" },
  { id: "fault", label: "Fault", filename: "fault.mp3", path: "/sounds/alerts/fault.mp3" },
  { id: "hand_bell", label: "Hand Bell", filename: "hand_bell.mp3", path: "/sounds/alerts/hand_bell.mp3" },

  // SOFT
  { id: "banjo", label: "Banjo", filename: "banjo.mp3", path: "/sounds/alerts/banjo.mp3" },
  { id: "droplet", label: "Droplet", filename: "droplet.mp3", path: "/sounds/alerts/droplet.mp3" },
  { id: "flickering", label: "Flickering", filename: "flickering.mp3", path: "/sounds/alerts/flickering.mp3" },
  { id: "hoarse", label: "Hoarse", filename: "hoarse.mp3", path: "/sounds/alerts/hoarse.mp3" },
  { id: "knock_knock", label: "Knock-knock", filename: "knock_knock.mp3", path: "/sounds/alerts/knock_knock.mp3" },
  { id: "promise", label: "Promise", filename: "promise.mp3", path: "/sounds/alerts/promise.mp3" },
  { id: "trumpets", label: "Trumpets", filename: "trumpets.mp3", path: "/sounds/alerts/trumpets.mp3" },
  { id: "you_win", label: "You win", filename: "you_win.mp3", path: "/sounds/alerts/you_win.mp3" },

  // NATURE
  { id: "bullfrog", label: "Bullfrog", filename: "bullfrog.mp3", path: "/sounds/alerts/bullfrog.mp3" },
  { id: "cat", label: "Cat", filename: "cat.mp3", path: "/sounds/alerts/cat.mp3" },
  { id: "dog", label: "Dog", filename: "dog.mp3", path: "/sounds/alerts/dog.mp3" },
  { id: "raven", label: "Raven", filename: "raven.mp3", path: "/sounds/alerts/raven.mp3" },
  { id: "rooster", label: "Rooster", filename: "rooster.mp3", path: "/sounds/alerts/rooster.mp3" },
  { id: "thunder", label: "Thunder", filename: "thunder.mp3", path: "/sounds/alerts/thunder.mp3" },
  { id: "water_drop", label: "Water drop", filename: "water_drop.mp3", path: "/sounds/alerts/water_drop.mp3" },
  { id: "whale", label: "Whale", filename: "whale.mp3", path: "/sounds/alerts/whale.mp3" },

  // VOICES
  { id: "attention", label: "Attention", filename: "attention.mp3", path: "/sounds/alerts/attention.mp3" },
  { id: "guess_what", label: "Guess what", filename: "guess_what.mp3", path: "/sounds/alerts/guess_what.mp3" },
  { id: "hey_pssst", label: "Hey, pssst", filename: "hey_pssst.mp3", path: "/sounds/alerts/hey_pssst.mp3" },
  { id: "hey_take_a_look", label: "Hey, take a look", filename: "hey_take_a_look.mp3", path: "/sounds/alerts/hey_take_a_look.mp3" },
  { id: "hey", label: "Hey!", filename: "hey.mp3", path: "/sounds/alerts/hey.mp3" },
  { id: "look_at_me", label: "Look at me", filename: "look_at_me.mp3", path: "/sounds/alerts/look_at_me.mp3" },
  { id: "sexy_mmm", label: "Sexy mmm", filename: "sexy_mmm.mp3", path: "/sounds/alerts/sexy_mmm.mp3" },
  { id: "oh", label: "Oh!", filename: "oh.mp3", path: "/sounds/alerts/oh.mp3" },

  // FUNNY
  { id: "applause", label: "Applause", filename: "applause.mp3", path: "/sounds/alerts/applause.mp3" },
  { id: "breaking_glass", label: "Breaking glass", filename: "breaking_glass.mp3", path: "/sounds/alerts/breaking_glass.mp3" },
  { id: "cash_register", label: "Cash register", filename: "cash_register.mp3", path: "/sounds/alerts/cash_register.mp3" },
  { id: "chimes_power_down", label: "Chimes power down", filename: "chimes_power_down.mp3", path: "/sounds/alerts/chimes_power_down.mp3" },
  { id: "dramatic_one_note", label: "Dramatic one note", filename: "dramatic_one_note.mp3", path: "/sounds/alerts/dramatic_one_note.mp3" },
  { id: "jackpot", label: "Jackpot", filename: "jackpot.mp3", path: "/sounds/alerts/jackpot.mp3" },
  { id: "man_laughing", label: "Man laughing", filename: "man_laughing.mp3", path: "/sounds/alerts/man_laughing.mp3" },
  { id: "martian_gun", label: "Martian gun", filename: "martian_gun.mp3", path: "/sounds/alerts/martian_gun.mp3" },
];

export const ALERT_SOUND_MAP = new Map<AlertSoundName, AlertSoundMetadata>(
  ALERT_SOUNDS.map((s) => [s.id, s]),
);

export class AlertAudioEngine {
  private static instance: AlertAudioEngine | null = null;
  private audioElements: Map<AlertSoundName, HTMLAudioElement> = new Map();
  private activeLoops: Map<string, ReturnType<typeof setInterval>> = new Map();
  private activeTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private masterVolume: number = 0.8;
  private isMuted: boolean = false;
  private audioContext: AudioContext | null = null;
  private isUnlocked: boolean = false;

  private constructor() {
    if (typeof window !== "undefined") {
      this.initUserGestureUnlock();
      this.preloadSounds();
    }
  }

  public static getInstance(): AlertAudioEngine {
    if (!AlertAudioEngine.instance) {
      AlertAudioEngine.instance = new AlertAudioEngine();
    }
    return AlertAudioEngine.instance;
  }

  /**
   * Listen for first user interaction (click/keydown) to resume AudioContext
   * and allow audio playback under browser autoplay policies.
   */
  private initUserGestureUnlock(): void {
    if (typeof window === "undefined") return;

    const unlock = () => {
      this.unlock();
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("click", unlock, true);
    };

    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    window.addEventListener("click", unlock, true);
  }

  public unlock(): void {
    if (this.isUnlocked) return;
    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioContext) {
          this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === "suspended") {
          void this.audioContext.resume();
        }
      }
      this.isUnlocked = true;
    } catch {
      // AudioContext unavailable or denied
    }
  }

  /**
   * Preload HTMLAudioElements into memory cache for zero latency playback.
   */
  public preloadSounds(): void {
    if (typeof window === "undefined" || typeof Audio === "undefined") return;

    for (const sound of ALERT_SOUNDS) {
      if (!this.audioElements.has(sound.id)) {
        try {
          const audio = new Audio(sound.path);
          audio.preload = "auto";
          audio.volume = this.masterVolume;
          this.audioElements.set(sound.id, audio);
        } catch {
          // Fallback will handle playback
        }
      }
    }
  }

  public setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    for (const audio of this.audioElements.values()) {
      audio.volume = this.masterVolume;
    }
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    for (const audio of this.audioElements.values()) {
      audio.muted = muted;
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Play an alert sound by name.
   * If durationSeconds > 0, loops the sound until duration expires or stop() is called.
   */
  public async play(
    soundName: AlertSoundName = "fired",
    options?: {
      volume?: number;
      durationSeconds?: number;
      loopId?: string;
    },
  ): Promise<boolean> {
    if (this.isMuted) return false;

    const vol =
      typeof options?.volume === "number"
        ? Math.max(0, Math.min(1, options.volume))
        : this.masterVolume;

    const durationSeconds = options?.durationSeconds ?? 0;
    const loopId = options?.loopId || `alert-${Date.now()}-${Math.random()}`;

    // Clear existing loop with same ID if any
    this.stop(loopId);

    const playOnce = async (): Promise<boolean> => {
      try {
        const soundMeta = ALERT_SOUND_MAP.get(soundName);
        if (!soundMeta) return false;

        let audio = this.audioElements.get(soundName);
        if (!audio && typeof Audio !== "undefined") {
          audio = new Audio(soundMeta.path);
          this.audioElements.set(soundName, audio);
        }

        if (audio) {
          audio.volume = vol;
          audio.currentTime = 0;
          await audio.play();
          return true;
        } else {
          this.synthesizeFallbackTone(soundName, vol);
          return true;
        }
      } catch {
        // Fallback to Web Audio synthesis on browser autoplay or network failure
        this.synthesizeFallbackTone(soundName, vol);
        return true;
      }
    };

    const firstSuccess = await playOnce();

    if (durationSeconds > 0) {
      // Repeat every 1.5 seconds until duration expires
      const interval = setInterval(() => {
        void playOnce();
      }, 1500);
      this.activeLoops.set(loopId, interval);

      const timeout = setTimeout(() => {
        this.stop(loopId);
      }, durationSeconds * 1000);
      this.activeTimeouts.set(loopId, timeout);
    }

    return firstSuccess;
  }

  /**
   * Stop specific loop or all alert sounds.
   */
  public stop(loopId?: string): void {
    if (loopId) {
      const interval = this.activeLoops.get(loopId);
      if (interval) {
        clearInterval(interval);
        this.activeLoops.delete(loopId);
      }
      const timeout = this.activeTimeouts.get(loopId);
      if (timeout) {
        clearTimeout(timeout);
        this.activeTimeouts.delete(loopId);
      }
    } else {
      this.stopAll();
    }
  }

  public stopAll(): void {
    for (const interval of this.activeLoops.values()) {
      clearInterval(interval);
    }
    this.activeLoops.clear();

    for (const timeout of this.activeTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.activeTimeouts.clear();

    for (const audio of this.audioElements.values()) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
  }

  /**
   * Web Audio API tone synthesis fallback for offline or restricted environments.
   */
  public synthesizeFallbackTone(
    soundName: AlertSoundName = "fired",
    volume: number = this.masterVolume,
  ): void {
    if (typeof window === "undefined") return;

    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }

      const ctx = this.audioContext;
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const baseVol = Math.max(0.01, Math.min(1, volume)) * 0.25;

      switch (soundName) {
        case "alarm_clock":
        case "beep_beep":
          // Staccato dual beep (880Hz -> 1046Hz)
          osc.type = "square";
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.setValueAtTime(1046, now + 0.1);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
          break;

        case "3_notes_reverb":
        case "chirpy":
          // Arpeggio (523Hz -> 659Hz -> 784Hz)
          osc.type = "sine";
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(659.25, now + 0.08);
          osc.frequency.setValueAtTime(783.99, now + 0.16);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
          break;

        case "hand_bell":
        case "call":
          // Bright chime (1200Hz)
          osc.type = "triangle";
          osc.frequency.setValueAtTime(1200, now);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
          osc.start(now);
          osc.stop(now + 0.8);
          break;

        case "fault":
          // Low buzz warning (220Hz)
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(220, now);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
          break;

        case "cash_register":
        case "jackpot":
          // Chime high dual coin effect (1318Hz -> 1568Hz)
          osc.type = "sine";
          osc.frequency.setValueAtTime(1318.5, now);
          osc.frequency.setValueAtTime(1567.98, now + 0.1);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc.start(now);
          osc.stop(now + 0.6);
          break;

        case "droplet":
        case "water_drop":
          // Water drop pitch drop (1800Hz -> 800Hz)
          osc.type = "sine";
          osc.frequency.setValueAtTime(1800, now);
          osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
          break;

        case "banjo":
          // Plucked harmonic (330Hz)
          osc.type = "triangle";
          osc.frequency.setValueAtTime(329.63, now);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
          break;

        case "flickering":
          // Sparkle dual tone (987Hz -> 1318Hz)
          osc.type = "sine";
          osc.frequency.setValueAtTime(987.77, now);
          osc.frequency.setValueAtTime(1318.51, now + 0.08);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
          break;

        case "knock_knock":
          // Low wood thud (160Hz)
          osc.type = "sine";
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.setValueAtTime(140, now + 0.1);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
          break;

        case "promise":
        case "trumpets":
        case "you_win":
          // Majestic brass chord fanfare (440Hz -> 554Hz -> 659Hz)
          osc.type = "sine";
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(554.37, now + 0.1);
          osc.frequency.setValueAtTime(659.25, now + 0.2);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
          osc.start(now);
          osc.stop(now + 0.7);
          break;

        case "thunder":
        case "bullfrog":
          // Deep rumble low pitch (90Hz -> 60Hz)
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(90, now);
          osc.frequency.exponentialRampToValueAtTime(55, now + 0.5);
          gain.gain.setValueAtTime(baseVol * 0.8, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc.start(now);
          osc.stop(now + 0.6);
          break;

        case "cat":
        case "dog":
        case "rooster":
        case "raven":
        case "whale":
          // Organic melodic sweep (600Hz -> 900Hz -> 400Hz)
          osc.type = "triangle";
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.start(now);
          osc.stop(now + 0.45);
          break;

        case "attention":
        case "guess_what":
        case "hey_pssst":
        case "hey_take_a_look":
        case "hey":
        case "look_at_me":
        case "sexy_mmm":
        case "oh":
          // Vocal formant dual peak simulation (700Hz -> 1050Hz)
          osc.type = "sine";
          osc.frequency.setValueAtTime(700, now);
          osc.frequency.exponentialRampToValueAtTime(1050, now + 0.18);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
          break;

        case "applause":
        case "breaking_glass":
        case "martian_gun":
          // Futuristic laser pulse / frequency modulation (1200Hz down to 200Hz)
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(1400, now);
          osc.frequency.exponentialRampToValueAtTime(180, now + 0.3);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
          break;

        case "chimes_power_down":
        case "dramatic_one_note":
        case "man_laughing":
        case "hoarse":
          // Minor pitch descent
          osc.type = "triangle";
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(220, now + 0.4);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.start(now);
          osc.stop(now + 0.45);
          break;

        case "fired":
        default:
          // Chirp sweep (700Hz -> 1400Hz)
          osc.type = "sine";
          osc.frequency.setValueAtTime(700, now);
          osc.frequency.exponentialRampToValueAtTime(1400, now + 0.2);
          gain.gain.setValueAtTime(baseVol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
      }
    } catch {
      // Audio synthesis silenced safely
    }
  }
}

export const alertAudioEngine = AlertAudioEngine.getInstance();
