/**
 * Level 1 live transcription with Android SpeechRecognizer (expo-speech-recognition). Recognition runs in chunks
 * that are restarted automatically (end / silence / timeout), preferring on-device recognition when available.
 * Already captured text is never lost: finals are emitted immediately and a dangling partial is committed on stop.
 * Optional per-chunk audio files (Android 13+) are reported for the Level 2 final transcription; they are temporary.
 */
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Platform } from 'react-native';
import type { DeviceSpeechLocales } from '../../domain/languages';
import { CONDITIONS, INVESTIGATIONS, MEDICATIONS, SYMPTOMS } from '../../domain/lexicon';

export type SpeechStatus = 'IDLE' | 'LISTENING' | 'RESTARTING' | 'PAUSED' | 'STOPPED' | 'ERROR';

export interface FinalMeta {
  /** language reported by the recognizer's language detection (API 34+), else the requested language */
  language: string;
  /** a partial kept because no final arrived (never lost; confidence 0 marks it unconfirmed) */
  keptPartial: boolean;
}

export interface SpeechCallbacks {
  onFinal(text: string, confidence: number, meta?: FinalMeta): void;
  onPartial(text: string): void;
  onStatus(status: SpeechStatus, message?: string): void;
  onAudioFile(uri: string): void;
}

export interface SpeechCapabilities {
  available: boolean;
  onDevice: boolean;
  recording: boolean;
}

export function speechCapabilities(): SpeechCapabilities {
  try {
    return {
      available: ExpoSpeechRecognitionModule.isRecognitionAvailable(),
      onDevice: ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
      recording: ExpoSpeechRecognitionModule.supportsRecording(),
    };
  } catch {
    return { available: false, onDevice: false, recording: false };
  }
}

/**
 * Medical vocabulary the recognizer is biased towards (EXTRA_BIASING_STRINGS, Android 13+; ignored by services
 * that do not support it). Biasing changes recognition hints only; no transcript text is altered afterwards.
 */
export const BIASING_TERMS: string[] = Array.from(new Set([...MEDICATIONS, ...SYMPTOMS, ...CONDITIONS, ...INVESTIGATIONS].filter((t) => t.length > 3))).slice(0, 300);

/** Locales the speech service reports. Returns queryFailed when the device cannot tell (never "supported"). */
export async function deviceSpeechLocales(): Promise<DeviceSpeechLocales> {
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version) || 0;
  try {
    const r = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    return { locales: r.locales ?? [], installedLocales: r.installedLocales ?? [], apiLevel };
  } catch {
    return { locales: [], installedLocales: [], apiLevel, queryFailed: true };
  }
}

export async function requestSpeechPermission(): Promise<boolean> {
  try {
    const r = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return r.granted;
  } catch {
    return false;
  }
}

const RESTARTABLE = new Set(['no-speech', 'speech-timeout', 'aborted', 'client', 'busy', 'audio-capture', 'interrupted', 'unknown']);

export class LiveSpeechController {
  private active = false;
  private paused = false;
  private chunk = 0;
  private consecutiveErrors = 0;
  private onDeviceFailed = false;
  private lastPartial = '';
  private detected: string | null = null;
  private partialTimer: ReturnType<typeof setTimeout> | null = null;
  private subs: { remove(): void }[] = [];
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly cb: SpeechCallbacks,
    private readonly opts: { lang: string; audioDir?: string; filePrefix: string; captureAudio: boolean; autoDetectLocales?: string[]; biasing?: string[] },
  ) {}

  private attach() {
    const m = ExpoSpeechRecognitionModule;
    this.subs = [
      m.addListener('result', (e) => {
        const best = e.results[0];
        if (!best) return;
        if (e.isFinal) {
          this.consecutiveErrors = 0;
          this.lastPartial = '';
          if (this.partialTimer) clearTimeout(this.partialTimer);
          this.partialTimer = null;
          if (best.transcript.trim()) this.cb.onFinal(best.transcript.trim(), best.confidence, { language: this.language(), keptPartial: false });
          this.cb.onPartial('');
        } else {
          this.lastPartial = best.transcript;
          this.cb.onPartial(best.transcript);
        }
      }),
      m.addListener('languagedetection', (e) => {
        if (e?.detectedLanguage) this.detected = e.detectedLanguage;
      }),
      m.addListener('end', () => {
        if (this.active && !this.paused) this.scheduleRestart(250);
      }),
      m.addListener('audioend', (e) => {
        if (e.uri) this.cb.onAudioFile(e.uri);
      }),
      m.addListener('error', (e) => {
        if (!this.active) return;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          this.fail('Microphone or speech permission was denied. Your transcript so far is saved.');
          return;
        }
        if (e.error === 'language-not-supported' && !this.onDeviceFailed) {
          this.onDeviceFailed = true; // fall back from on-device to the default recognizer
          this.scheduleRestart(300);
          return;
        }
        if (e.error === 'network') {
          this.cb.onStatus('RESTARTING', 'Live recognition needs a connection on this device. Recording continues; the final transcript can still be created later.');
          this.consecutiveErrors++;
        } else if (RESTARTABLE.has(e.error)) {
          if (e.error !== 'no-speech' && e.error !== 'speech-timeout') this.consecutiveErrors++;
        } else this.consecutiveErrors++;
        if (this.consecutiveErrors >= 6) {
          this.fail('Speech recognition is unavailable right now. Your transcript so far is saved; you can type notes manually.');
          return;
        }
        // restart is triggered by the following 'end' event; guard in case it does not arrive
        this.scheduleRestart(Math.min(4000, 300 * 2 ** this.consecutiveErrors));
      }),
    ];
  }

  private language(): string {
    return this.detected ?? this.opts.lang;
  }

  private fail(message: string) {
    this.active = false;
    this.commitPartial();
    this.safeStop();
    this.cb.onStatus('ERROR', message);
  }

  private scheduleRestart(ms: number) {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.active && !this.paused) this.startSession();
    }, ms);
  }

  private startSession() {
    this.chunk += 1;
    const caps = speechCapabilities();
    try {
      const auto = this.opts.autoDetectLocales?.length ? this.opts.autoDetectLocales : null;
      ExpoSpeechRecognitionModule.start({
        lang: this.opts.lang,
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        addsPunctuation: true,
        contextualStrings: this.opts.biasing,
        androidIntentOptions: auto
          ? { EXTRA_ENABLE_LANGUAGE_SWITCH: 'balanced', EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES: auto, EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES: auto }
          : undefined,
        requiresOnDeviceRecognition: caps.onDevice && !this.onDeviceFailed,
        recordingOptions:
          this.opts.captureAudio && caps.recording && this.opts.audioDir
            ? { persist: true, outputDirectory: this.opts.audioDir, outputFileName: `${this.opts.filePrefix}-${String(this.chunk).padStart(3, '0')}.wav` }
            : undefined,
      });
      this.cb.onStatus('LISTENING');
    } catch {
      this.consecutiveErrors++;
      if (this.consecutiveErrors >= 6) this.fail('Speech recognition could not start. You can continue with manual notes.');
      else this.scheduleRestart(1000);
    }
  }

  private safeStop() {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* already stopped */
    }
  }

  private commitPartial() {
    if (this.partialTimer) clearTimeout(this.partialTimer);
    this.partialTimer = null;
    if (this.lastPartial.trim()) {
      // partial text is kept rather than lost; confidence 0 marks it as unconfirmed speech
      this.cb.onFinal(this.lastPartial.trim(), 0, { language: this.language(), keptPartial: true });
      this.lastPartial = '';
    }
  }

  start() {
    this.active = true;
    this.paused = false;
    this.attach();
    this.startSession();
  }

  /**
   * Pause stops the recognizer, which normally delivers the final result of the speech in progress. The partial
   * is kept only if that final does not arrive, so a pause never stores the same words twice.
   */
  pause() {
    this.paused = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.safeStop();
    if (this.partialTimer) clearTimeout(this.partialTimer);
    this.partialTimer = setTimeout(() => this.commitPartial(), 1500);
    this.cb.onStatus('PAUSED');
  }

  /** Commits a pending partial immediately (used before a segment is finished). */
  flush() {
    this.commitPartial();
  }

  resume() {
    if (!this.active) return;
    this.commitPartial();
    this.paused = false;
    this.startSession();
  }

  stop() {
    this.active = false;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.safeStop();
    // Wait briefly for the recognizer's final result and audio file; then keep any dangling partial (no loss,
    // no duplicate when the final arrives).
    setTimeout(() => {
      this.commitPartial();
      for (const s of this.subs) s.remove();
      this.subs = [];
    }, 1500);
    this.cb.onStatus('STOPPED');
  }
}
