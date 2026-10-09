/**
 * Consultation language registry (ADR-052; owner decision on OD-007 candidate languages, 2026-10-09).
 * The UI reads availability from here, never from hard-coded assumptions. A language is selectable only when
 * the recognition path on this device reports it. Being listed is not a claim that a language works.
 *
 * Verified sources (2026-10-09):
 * - Android RecognizerIntent reference (developer.android.com/reference/android/speech/RecognizerIntent):
 *   EXTRA_BIASING_STRINGS and EXTRA_ENABLE_FORMATTING are API 33; EXTRA_ENABLE_LANGUAGE_DETECTION,
 *   EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES and EXTRA_ENABLE_LANGUAGE_SWITCH are API 34, and switching
 *   requires the language models to be downloaded.
 * - expo-speech-recognition 57.1 type docs: getSupportedLocales() returns an empty list on Android 12 and below.
 * - The cloud final pass (Gemini free tier, synthetic demo visits only, ADR-047) is enabled for English only:
 *   its language support for the other candidates was not verified for this release.
 */

export type Support = 'AVAILABLE' | 'AVAILABLE_SYNTHETIC_ONLY' | 'RUNTIME_CHECK' | 'NOT_VERIFIED' | 'NONE';

export interface LanguageEntry {
  /** Registry code stored on visits and segments (BCP-47, or "auto"). */
  languageCode: string;
  displayName: string;
  nativeName: string;
  /** Locale passed to the Android recognizer. */
  androidLocale: string | null;
  providerSupport: { androidSpeechRecognizer: Support; cloudFinalPass: Support };
  liveRecognitionSupport: Support;
  finalTranscriptionSupport: Support;
  speakerDiarizationSupport: 'CLINICIAN_TAGGING' | 'CLINICIAN_TAGGING_AND_CLOUD_SYNTHETIC_ONLY';
  translationSupport: Support;
  /** Rule-based fact extraction (English lexicon and negation rules only). */
  extractionSupport: 'RULE_BASED' | 'MANUAL_ONLY';
  status: 'DEFAULT' | 'CANDIDATE' | 'EXPERIMENTAL';
}

const candidate = (languageCode: string, displayName: string, nativeName: string): LanguageEntry => ({
  languageCode,
  displayName,
  nativeName,
  androidLocale: languageCode,
  providerSupport: { androidSpeechRecognizer: 'RUNTIME_CHECK', cloudFinalPass: 'NOT_VERIFIED' },
  liveRecognitionSupport: 'RUNTIME_CHECK',
  finalTranscriptionSupport: 'NOT_VERIFIED',
  speakerDiarizationSupport: 'CLINICIAN_TAGGING',
  translationSupport: 'NONE',
  extractionSupport: 'MANUAL_ONLY',
  status: 'CANDIDATE',
});

export const LANGUAGES: LanguageEntry[] = [
  {
    languageCode: 'auto',
    displayName: 'Auto-detect',
    nativeName: 'Auto-detect',
    androidLocale: null,
    providerSupport: { androidSpeechRecognizer: 'RUNTIME_CHECK', cloudFinalPass: 'NONE' },
    liveRecognitionSupport: 'RUNTIME_CHECK',
    finalTranscriptionSupport: 'NONE',
    speakerDiarizationSupport: 'CLINICIAN_TAGGING',
    translationSupport: 'NONE',
    extractionSupport: 'MANUAL_ONLY',
    status: 'EXPERIMENTAL',
  },
  {
    languageCode: 'en-US',
    displayName: 'English',
    nativeName: 'English',
    androidLocale: 'en-US',
    providerSupport: { androidSpeechRecognizer: 'AVAILABLE', cloudFinalPass: 'AVAILABLE_SYNTHETIC_ONLY' },
    liveRecognitionSupport: 'AVAILABLE',
    finalTranscriptionSupport: 'AVAILABLE_SYNTHETIC_ONLY',
    speakerDiarizationSupport: 'CLINICIAN_TAGGING_AND_CLOUD_SYNTHETIC_ONLY',
    translationSupport: 'NONE',
    extractionSupport: 'RULE_BASED',
    status: 'DEFAULT',
  },
  candidate('te-IN', 'Telugu', 'తెలుగు'),
  candidate('hi-IN', 'Hindi', 'हिन्दी'),
  candidate('bn-IN', 'Bengali', 'বাংলা'),
  candidate('ta-IN', 'Tamil', 'தமிழ்'),
  candidate('kn-IN', 'Kannada', 'ಕನ್ನಡ'),
  candidate('ml-IN', 'Malayalam', 'മലയാളം'),
];

export const languageEntry = (code: string | undefined): LanguageEntry | undefined =>
  LANGUAGES.find((l) => l.languageCode === code) ?? (code ? LANGUAGES.find((l) => l.languageCode !== 'auto' && l.languageCode.split('-')[0] === code.split('-')[0]) : undefined);

export const languageName = (code: string | undefined): string => {
  const e = languageEntry(code);
  return e ? e.displayName : code ?? 'not recorded';
};

/** What the device reported: null when the query was impossible (e.g. Android 12 or older, or no service). */
export interface DeviceSpeechLocales {
  locales: string[];
  installedLocales: string[];
  apiLevel: number;
  /** The recognizer accepts only what it reports; a failed query means "unknown", never "supported". */
  queryFailed?: boolean;
}

export interface LanguageAvailability {
  entry: LanguageEntry;
  enabled: boolean;
  onDevice: boolean;
  reason: string;
}

const lang = (tag: string) => tag.toLowerCase().split(/[-_]/)[0];
const reports = (list: string[], code: string) => list.some((l) => l.toLowerCase().replace('_', '-') === code.toLowerCase()) || list.some((l) => lang(l) === lang(code));

/** Deterministic availability per registry entry for this device. English stays available (V1 behaviour). */
export function resolveLanguages(device: DeviceSpeechLocales | null): LanguageAvailability[] {
  return LANGUAGES.map((entry) => {
    if (entry.languageCode === 'en-US') {
      const onDevice = !!device && reports(device.installedLocales, 'en-US');
      return { entry, enabled: true, onDevice, reason: onDevice ? 'Installed for on-device recognition.' : 'Uses the Android speech service; may need a network connection.' };
    }
    if (!device || device.queryFailed || (!device.locales.length && !device.installedLocales.length)) {
      return { entry, enabled: false, onDevice: false, reason: 'This device does not report its speech-recognition languages (Android 12 or older, or the speech service does not list them), so this language cannot be confirmed here.' };
    }
    if (entry.languageCode === 'auto') {
      const installed = LANGUAGES.filter((l) => l.androidLocale && reports(device.installedLocales, l.androidLocale));
      if (device.apiLevel < 34) return { entry, enabled: false, onDevice: false, reason: 'Automatic language switching needs Android 14 or newer.' };
      if (installed.length < 2) return { entry, enabled: false, onDevice: false, reason: 'Needs at least two of the listed languages downloaded for on-device recognition (Android settings → speech recognition languages).' };
      return { entry, enabled: true, onDevice: true, reason: `Experimental: switches between ${installed.map((l) => l.displayName).join(', ')} when the speech service supports it.` };
    }
    const code = entry.androidLocale as string;
    const onDevice = reports(device.installedLocales, code);
    if (onDevice) return { entry, enabled: true, onDevice, reason: 'Installed for on-device recognition. Automatic fact extraction is English-only; facts are added manually.' };
    if (reports(device.locales, code)) return { entry, enabled: true, onDevice, reason: 'Supported by the speech service; needs a network connection unless the language is downloaded. Automatic fact extraction is English-only.' };
    return { entry, enabled: false, onDevice: false, reason: "Not supported by this device's speech service. Install it in Android speech settings, or choose another language." };
  });
}

/** Languages the auto-detect mode may switch between on this device (installed ones only). */
export function autoDetectLocales(device: DeviceSpeechLocales | null): string[] {
  if (!device) return [];
  return LANGUAGES.filter((l) => l.androidLocale && reports(device.installedLocales, l.androidLocale)).map((l) => l.androidLocale as string);
}
