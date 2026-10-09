/**
 * Screens 8/9 (live part) — Consultation recording (ADR-050). A consultation is one or more recording segments.
 * PAUSE / RESUME / FINISH SEGMENT / FINALIZE CONSULTATION are distinct actions offered per state
 * (domain/consultation.ts PHASE_ACTIONS); finishing a segment never finalizes; ADD MORE CONVERSATION appends a new
 * segment to the same visit. Every final utterance is saved immediately (no loss on crash/restart). No AI output
 * during recording (ADR-027). The speaker toggle is a proposal; roles are confirmed on the Transcript screen.
 */
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect, useLocalSearchParams, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { deleteAudio, mergeAudio } from '../../../../application/container';
import { DEMO_VISIT_1, DEMO_VISIT_1_MORE, DEMO_VISIT_2, type DemoLine } from '../../../../application/demo';
import { activeRecordingSegment, consultationPhase, PHASE_ACTIONS, PHASE_LABEL, totalRecordedSec, type ConsultationAction } from '../../../../domain/consultation';
import { autoDetectLocales, languageEntry, languageName, resolveLanguages, type DeviceSpeechLocales, type LanguageAvailability } from '../../../../domain/languages';
import type { Patient, SpeakerRole, Visit } from '../../../../domain/types';
import { formatDateTime, formatDuration } from '../../../../domain/util';
import { audioDir } from '../../../../infrastructure/storage/expoFileBackend';
import { BIASING_TERMS, deviceSpeechLocales, LiveSpeechController, requestSpeechPermission, speechCapabilities, type SpeechStatus } from '../../../../infrastructure/speech/liveSpeech';
import { Banner, BottomBar, Button, Chip, DemoBadge, glassStyle, haptic, Loading, PulseDot, Row, ScreenSurface, Segmented, T, type IconName } from '../../../../presentation/components';
import { showError, useApp } from '../../../../presentation/AppContext';
import { radius, space, useTheme } from '../../../../presentation/theme';

function KeepAwake() {
  useKeepAwake();
  return null;
}

const ROLE_OPTIONS: { value: SpeakerRole; label: string }[] = [
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'PATIENT', label: 'Patient' },
  { value: 'OTHER', label: 'Other' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const ACTION: Record<ConsultationAction, { label: string; icon: IconName; kind: 'primary' | 'secondary' | 'danger' | 'record' | 'success' | 'ghost' }> = {
  START: { label: 'Start recording', icon: 'microphone', kind: 'record' },
  PAUSE: { label: 'Pause', icon: 'pause', kind: 'secondary' },
  RESUME: { label: 'Resume', icon: 'play', kind: 'record' },
  FINISH_SEGMENT: { label: 'Finish segment', icon: 'stop-circle-outline', kind: 'danger' },
  CONTINUE: { label: 'Continue conversation', icon: 'microphone-plus', kind: 'record' },
  FINALIZE: { label: 'Finalize consultation', icon: 'flag-checkered', kind: 'success' },
  ADD_MORE: { label: 'Add more conversation', icon: 'microphone-plus', kind: 'record' },
  REVIEW_NEW: { label: 'Review new transcript', icon: 'text-box-search-outline', kind: 'secondary' },
  RECONCILE: { label: 'Reconcile complete visit', icon: 'source-merge', kind: 'primary' },
  REVIEW_TRANSCRIPT: { label: 'Review transcript', icon: 'text-box-outline', kind: 'secondary' },
};

export default function Record() {
  const { c } = useTheme();
  const { app, settings } = useApp();
  const { patientId, visitId } = useLocalSearchParams<{ patientId: string; visitId: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [partial, setPartial] = useState('');
  const [mic, setMic] = useState<SpeechStatus>('IDLE');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [role, setRole] = useState<SpeakerRole>('UNKNOWN');
  const [processing, setProcessing] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState(false);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  /** true while this screen drives the microphone or demo script; false after a crash/restart (= recoverable) */
  const [live, setLive] = useState(false);
  const [device, setDevice] = useState<DeviceSpeechLocales | null>(null);
  const [lang, setLang] = useState<string>(settings.language || 'en-US');

  const vRef = useRef<Visit | null>(null);
  const roleRef = useRef<SpeakerRole>('UNKNOWN');
  const ctrl = useRef<LiveSpeechController | null>(null);
  const clock = useRef<{ base: number; since: number | null }>({ base: 0, since: null });
  const partialStart = useRef<number | null>(null);
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** words spoken before a pause or finish are kept, as the recognizer delivers its final result on stop */
  const flushDemo = () => {
    const p = demo.current?.pending;
    if (!p) return;
    demo.current!.pending = null;
    setPartial('');
    addUtterance(p.line.text, 0.95, p.recSegId, { origin: 'DEMO', source: 'demo-script', language: 'en-US' });
  };
  const demo = useRef<{ lines: DemoLine[]; i: number; pending: { line: DemoLine; recSegId: string } | null } | null>(null);
  const lock = useRef(false);
  /** mirrors `live` for callbacks: while the microphone/demo runs, vRef is the source of truth */
  const liveRef = useRef(false);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  /**
   * Re-reads the visit from storage when this screen is not capturing. Other screens (transcript, facts) change
   * the visit while this screen stays mounted underneath; saving a stale copy would undo their work.
   */
  const refresh = useCallback(async () => {
    if (liveRef.current || ctrl.current) return vRef.current;
    const v = await app.store.getVisit(patientId, visitId);
    vRef.current = v;
    clock.current.base = totalRecordedSec(v);
    clock.current.since = null;
    setElapsed(clock.current.base);
    setVisit(v);
    return v;
  }, [app, patientId, visitId]);

  useFocusEffect(
    useCallback(() => {
      if (vRef.current) void refresh().catch(() => undefined);
    }, [refresh]),
  );

  const chooseRole = (r: SpeakerRole) => {
    roleRef.current = r;
    setRole(r);
  };
  const now = () => clock.current.base + (clock.current.since ? (Date.now() - clock.current.since) / 1000 : 0);

  const persist = useCallback(async () => {
    const v = vRef.current;
    if (!v) return;
    const s = activeRecordingSegment(v);
    if (s) s.durationSec = Math.max(s.durationSec, Math.round(now() - s.clockOffsetSec));
    v.recordingDurationSec = Math.max(v.recordingDurationSec, Math.round(now()));
    try {
      await app.store.saveVisit(v);
      setLastSaved(new Date().toISOString());
    } catch {
      setStatusMsg('Saving failed once; the transcript is kept in memory and saved with the next utterance.');
    }
    setVisit({ ...v, segments: [...v.segments], recordingSegments: v.recordingSegments.map((x) => ({ ...x })) });
  }, [app]);

  useEffect(() => {
    void (async () => {
      try {
        const p = await app.store.getPatient(patientId);
        const v = await app.store.getVisit(patientId, visitId);
        vRef.current = v;
        clock.current.base = totalRecordedSec(v);
        setElapsed(clock.current.base);
        const active = activeRecordingSegment(v);
        if (active) setLang(active.language);
        setPatient(p);
        setVisit(v);
      } catch (e) {
        showError(e);
      }
    })();
    void deviceSpeechLocales().then(setDevice).catch(() => setDevice(null));
    return () => {
      if (demoTimer.current) clearTimeout(demoTimer.current);
      ctrl.current?.stop();
    };
  }, [app, patientId, visitId]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(now()), 500);
    return () => clearInterval(t);
  }, []);

  /** serializes button actions: a second press while one runs is ignored (no duplicate segments) */
  const guarded = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    try {
      await fn();
    } catch (e) {
      showError(e);
    } finally {
      lock.current = false;
    }
  };

  const addUtterance = (text: string, confidence: number, recSegId: string, meta: { origin?: 'LIVE' | 'PARTIAL_COMMIT' | 'DEMO'; language?: string; source?: string } = {}) => {
    const v = vRef.current;
    if (!v) return;
    const end = now();
    const start = partialStart.current ?? Math.max(0, end - Math.max(1, text.split(/\s+/).length * 0.4));
    partialStart.current = null;
    app.visits.addLiveSegment(v, text, confidence, roleRef.current, Math.round(start * 10) / 10, Math.round(end * 10) / 10, meta.source, { origin: meta.origin, language: meta.language, recordingSegmentId: recSegId });
    void persist();
  };

  const startMic = async (recSegId: string, language: string): Promise<boolean> => {
    const caps = speechCapabilities();
    if (!caps.available) {
      setError(true);
      setStatusMsg('Speech recognition is not available on this device. Finish the segment and add the conversation manually in the transcript.');
      return false;
    }
    setRequesting(true);
    const granted = await requestSpeechPermission();
    setRequesting(false);
    if (!granted) {
      setError(true);
      setStatusMsg('Microphone permission was denied. Nothing was recorded. Allow microphone access in Android settings, or continue manually.');
      return false;
    }
    // temporary audio is only kept when it can be used: backend AI is for synthetic demo visits only (ADR-047)
    const captureAudio = settings.cloudProcessingEnabled && app.backend.configured() && !!patient?.isDemo && languageEntry(language)?.finalTranscriptionSupport === 'AVAILABLE_SYNTHETIC_ONLY';
    const auto = language === 'auto' ? autoDetectLocales(device) : undefined;
    ctrl.current = new LiveSpeechController(
      {
        onFinal: (text, conf, meta) => addUtterance(text, conf, recSegId, { origin: meta?.keptPartial ? 'PARTIAL_COMMIT' : 'LIVE', language: meta?.language }),
        onPartial: (text) => {
          if (text && partialStart.current === null) partialStart.current = now();
          setPartial(text);
        },
        onStatus: (s, m) => {
          setMic(s);
          if (m) setStatusMsg(m);
          if (s === 'LISTENING') {
            setStatusMsg(null);
            setError(false);
          }
          if (s === 'ERROR') {
            setError(true);
            setLive(false);
            clock.current.base = now();
            clock.current.since = null;
            const v = vRef.current;
            if (v) app.visits.pauseRecording(v, clock.current.base);
            void persist();
          }
        },
        onAudioFile: (uri) => {
          const v = vRef.current;
          if (!v) return;
          v.pendingAudioUris.push(uri);
          void persist();
        },
      },
      { lang: language === 'auto' ? (auto?.[0] ?? 'en-US') : (languageEntry(language)?.androidLocale ?? 'en-US'), audioDir: captureAudio ? audioDir().uri : undefined, filePrefix: `${visitId.slice(0, 8)}-${recSegId.slice(0, 4)}`, captureAudio, autoDetectLocales: auto, biasing: language === 'en-US' ? BIASING_TERMS : undefined },
    );
    clock.current.since = Date.now();
    ctrl.current.start();
    setLive(true);
    return true;
  };

  const demoStep = (recSegId: string) => {
    const d = demo.current;
    if (!d || d.i >= d.lines.length || !vRef.current || activeRecordingSegment(vRef.current)?.status !== 'RECORDING') {
      setPartial('');
      return;
    }
    const line = d.lines[d.i++];
    chooseRole(line.role);
    setPartial(line.text);
    partialStart.current = now();
    d.pending = { line, recSegId };
    demoTimer.current = setTimeout(() => {
      d.pending = null;
      setPartial('');
      addUtterance(line.text, 0.95, recSegId, { origin: 'DEMO', source: 'demo-script', language: 'en-US' });
      demoTimer.current = setTimeout(() => demoStep(recSegId), 400);
    }, 900);
  };

  const beginSegment = async (useDemo: boolean) => {
    const v = await refresh();
    if (!v) return;
    const avail = resolveLanguages(device).find((l) => l.entry.languageCode === lang);
    if (!useDemo && avail && !avail.enabled) {
      setStatusMsg(`${avail.entry.displayName}: ${avail.reason}`);
      return;
    }
    setJustCompleted(null);
    setError(false);
    setStatusMsg(null);
    const seg = app.visits.startRecording(v, { language: useDemo ? 'en-US' : lang, provider: useDemo ? 'demo-script' : 'android-speechrecognizer' });
    await persist();
    haptic('medium');
    if (useDemo) {
      const others = (await app.store.listVisits(patientId)).filter((x) => x.visitId !== visitId && x.segments.length).length;
      const lines = v.recordingSegments.length > 1 ? DEMO_VISIT_1_MORE : others ? DEMO_VISIT_2 : DEMO_VISIT_1;
      demo.current = { lines, i: 0, pending: null };
      setDemoMode(true);
      clock.current.since = Date.now();
      setLive(true);
      setMic('LISTENING');
      demoStep(seg.recordingSegmentId);
    } else {
      setDemoMode(false);
      const ok = await startMic(seg.recordingSegmentId, lang);
      if (!ok) {
        app.visits.pauseRecording(v, now());
        await persist();
      }
    }
  };

  const pause = async () => {
    const v = vRef.current;
    if (!v) return;
    ctrl.current?.pause();
    if (demoTimer.current) clearTimeout(demoTimer.current);
    flushDemo();
    clock.current.base = now();
    clock.current.since = null;
    setMic('PAUSED');
    app.visits.pauseRecording(v, clock.current.base);
    await persist();
  };

  const resume = async () => {
    const v = vRef.current;
    const seg = v && activeRecordingSegment(v);
    if (!v || !seg) return;
    setError(false);
    app.visits.resumeRecording(v);
    await persist();
    if (demoMode && demo.current) {
      clock.current.since = Date.now();
      setLive(true);
      setMic('LISTENING');
      demoStep(seg.recordingSegmentId);
    } else if (ctrl.current) {
      clock.current.since = Date.now();
      ctrl.current.resume();
      setLive(true);
    } else {
      const ok = await startMic(seg.recordingSegmentId, seg.language);
      if (!ok) {
        app.visits.pauseRecording(v, now());
        await persist();
      }
    }
  };

  const finishSegment = async () => {
    const v = vRef.current;
    const seg = v && activeRecordingSegment(v);
    if (!v || !seg) return;
    if (demoTimer.current) clearTimeout(demoTimer.current);
    flushDemo();
    setProcessing('Saving this segment…');
    const hadCtrl = !!ctrl.current;
    ctrl.current?.stop();
    // wait for the recognizer's last final result / audio file (the controller keeps a dangling partial)
    if (hadCtrl) await new Promise((r) => setTimeout(r, 1800));
    ctrl.current = null;
    demo.current = null;
    setDemoMode(false);
    setLive(false);
    setPartial('');
    setMic('STOPPED');
    clock.current.base = now();
    clock.current.since = null;
    app.visits.stopRecording(v, clock.current.base);
    await persist();
    const uris = [...v.pendingAudioUris];
    if (uris.length && settings.cloudProcessingEnabled && app.backend.configured()) {
      setProcessing('Creating final transcript with speaker separation…');
      const merged = mergeAudio(uris);
      const r = await app.visits.finalTranscription(v, settings, merged, seg.recordingSegmentId);
      deleteAudio([merged, ...uris]);
      v.pendingAudioUris = [];
      await persist();
      if (r.message) setStatusMsg(r.message);
    } else if (uris.length) {
      deleteAudio(uris);
      v.pendingAudioUris = [];
      await persist();
    }
    setProcessing(null);
    setJustCompleted(seg.recordingSegmentId);
    haptic('success');
  };

  const finalize = async () => {
    const v = await refresh();
    if (!v) return;
    setFinalizing(true);
    try {
      app.visits.finalizeConsultation(v);
      await persist();
      haptic('success');
    } finally {
      setFinalizing(false);
      setJustCompleted(null);
    }
  };

  const withdraw = () =>
    Alert.alert('Withdraw consent?', 'Recording stops now. The transcript captured so far stays on this device until you delete it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          ctrl.current?.stop();
          ctrl.current = null;
          if (demoTimer.current) clearTimeout(demoTimer.current);
          const v = vRef.current;
          if (!v) return;
          app.visits.withdrawConsent(v);
          deleteAudio(v.pendingAudioUris);
          v.pendingAudioUris = [];
          await persist();
          router.replace(`/visit/${patientId}/${visitId}`);
        },
      },
    ]);

  if (!visit || !patient) return <Loading />;
  const phase = consultationPhase(visit, { live, requesting, processing: !!processing, finalizing, error, justCompleted: !!justCompleted });
  const actions = visit.consent?.state === 'CONFIRMED' ? PHASE_ACTIONS[phase] : [];
  const active = activeRecordingSegment(visit);
  const recording = phase === 'RECORDING';
  const pausedish = phase === 'PAUSED' || phase === 'RECOVERABLE' || phase === 'ERROR';
  const segClock = active ? Math.max(0, elapsed - active.clockOffsetSec) : 0;
  const base = `/visit/${patientId}/${visitId}`;
  const langs = resolveLanguages(device);
  const chosen = langs.find((l) => l.entry.languageCode === lang) ?? langs[1];
  const canChooseLanguage = !active && actions.some((a) => a === 'START' || a === 'CONTINUE' || a === 'ADD_MORE');
  const newSegId = justCompleted ?? visit.recordingSegments[visit.recordingSegments.length - 1]?.recordingSegmentId;
  const run: Record<ConsultationAction, () => void> = {
    START: () => void guarded(() => beginSegment(false)),
    CONTINUE: () => void guarded(() => beginSegment(false)),
    ADD_MORE: () => void guarded(() => beginSegment(false)),
    PAUSE: () => void guarded(pause),
    RESUME: () => void guarded(resume),
    FINISH_SEGMENT: () => void guarded(finishSegment),
    FINALIZE: () => void guarded(finalize),
    REVIEW_NEW: () => router.push(`${base}/transcript?segment=${newSegId ?? ''}`),
    RECONCILE: () => router.push(`${base}/transcript?reconcile=1`),
    REVIEW_TRANSCRIPT: () => router.push(`${base}/transcript`),
  };
  const heroColor = recording ? c.recording : pausedish ? c.warning : phase === 'FINALIZED' ? c.success : c.primary;
  const micText = demoMode ? 'synthetic demo script (microphone not used)' : recording ? (mic === 'RESTARTING' ? 'reconnecting' : 'listening') : mic === 'PAUSED' || pausedish ? 'paused' : mic === 'ERROR' ? 'unavailable' : 'off';
  const items = [...visit.segments].filter((s) => !s.excluded).reverse();
  const segCode = (id?: string) => visit.recordingSegments.find((r) => r.recordingSegmentId === id)?.displayCode ?? '';
  const primary = actions.filter((a) => a !== 'REVIEW_TRANSCRIPT' && a !== 'REVIEW_NEW' && a !== 'RECONCILE');
  const secondary = actions.filter((a) => a === 'REVIEW_TRANSCRIPT' || a === 'REVIEW_NEW' || a === 'RECONCILE');

  return (
    <ScreenSurface>
      <Stack.Screen options={{ title: `${patient.patientReference} · ${visit.visitCode}`, headerBackVisible: !(recording && live) }} />
      {recording ? <KeepAwake /> : null}
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: 260 }}
        data={items}
        keyExtractor={(s) => s.segmentId}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            <View
              accessible
              accessibilityRole="header"
              accessibilityLiveRegion="assertive"
              accessibilityLabel={`${PHASE_LABEL[phase]}${active ? `, segment ${active.displayCode}, ${formatDuration(segClock)}` : ''}, total ${formatDuration(elapsed)}`}
              style={{ ...glassStyle(c, true), padding: space.lg, gap: 6, borderColor: heroColor, borderWidth: 1.5 }}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flexShrink: 1 }}>
                  <PulseDot color={heroColor} active={recording} />
                  <Text style={{ fontSize: 19, fontWeight: '900', color: heroColor, letterSpacing: 0.6, flexShrink: 1 }}>{recording ? '● RECORDING' : pausedish && phase === 'PAUSED' ? '❚❚ PAUSED' : PHASE_LABEL[phase]}</Text>
                </Row>
                <Text style={{ fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'], color: c.text }}>{formatDuration(elapsed)}</Text>
              </Row>
              {active ? <T variant="small" style={{ fontWeight: '700' }}>Segment {active.displayCode} · {formatDuration(segClock)} · {languageName(active.language)}</T> : null}
              <T variant="small" muted>Visit started {formatDateTime(visit.startedAt)} · {visit.recordingSegments.length} segment(s) · total recorded {formatDuration(elapsed)}</T>
              <T variant="small" muted>Microphone: {micText}{settings.cloudProcessingEnabled ? (app.backend.configured() && patient.isDemo ? ' · cloud final transcript available (English)' : ' · on-device transcript') : ''}</T>
              <T variant="small" muted>{lastSaved ? `Last saved ${formatDateTime(lastSaved)}` : 'Saved on this device after every utterance'}</T>
              {patient.isDemo ? <DemoBadge /> : null}
            </View>

            {visit.recordingSegments.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {visit.recordingSegments.map((s) => (
                  <View key={s.recordingSegmentId} accessible accessibilityLabel={`${s.displayCode}, ${s.status.toLowerCase()}, ${formatDuration(s.durationSec)}`} style={{ ...glassStyle(c), paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, borderColor: s.status === 'COMPLETED' ? c.glassBorder : heroColor }}>
                    <T variant="small" style={{ fontWeight: '800' }}>{s.displayCode}{s.recordingSegmentId === justCompleted ? ' · new' : ''}</T>
                    <T variant="small" muted>{formatDateTime(s.startedAt).slice(-5)}–{s.endedAt ? formatDateTime(s.endedAt).slice(-5) : s.status.toLowerCase()} · {formatDuration(s.durationSec)}</T>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {statusMsg ? <Banner tone={error ? 'danger' : 'warning'} message={statusMsg} /> : null}
            {phase === 'RECOVERABLE' ? <Banner tone="warning" title="Recording was interrupted" message={`${visit.segments.filter((s) => s.recordingSegmentId === active?.recordingSegmentId).length} utterance(s) of ${active?.displayCode} were saved. Resume recording or finish the segment.`} /> : null}
            {processing ? <Banner tone="info" message={processing} /> : null}
            {phase === 'SEGMENT_COMPLETE' ? <Banner tone="success" title={`${segCode(justCompleted ?? undefined)} saved`} message="The consultation stays open. Continue the conversation, review the new transcript, or finalize when the consultation is over." /> : null}
            {phase === 'FINALIZED' ? <Banner tone="success" title="Consultation finalized" message={`Finalized ${formatDateTime(visit.consultationFinalizedAt)}. Nothing was confirmed by finalizing. Add more conversation at any time — earlier segments stay unchanged.`} /> : null}

            {canChooseLanguage ? (
              <View style={{ gap: space.xs }}>
                <T variant="small" muted>Consultation language for the next segment</T>
                <Row wrap>
                  {langs.map((l: LanguageAvailability) => {
                    const on = l.entry.languageCode === lang;
                    return (
                      <Pressable
                        key={l.entry.languageCode}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on, disabled: !l.enabled }}
                        accessibilityLabel={`${l.entry.displayName}${l.enabled ? '' : ', unavailable'}`}
                        onPress={() => {
                          haptic('select');
                          if (l.enabled) setLang(l.entry.languageCode);
                          else setStatusMsg(`${l.entry.displayName}: ${l.reason}`);
                        }}
                        style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? c.primary : c.glassStrong, borderWidth: 1, borderColor: on ? c.primary : c.glassBorder, opacity: l.enabled ? 1 : 0.5 }}
                      >
                        <Text style={{ color: on ? c.primaryText : c.text, fontWeight: '700' }}>{l.entry.displayName}{l.entry.nativeName !== l.entry.displayName ? ` · ${l.entry.nativeName}` : ''}</Text>
                      </Pressable>
                    );
                  })}
                </Row>
                <T variant="small" muted>{chosen.reason}</T>
              </View>
            ) : null}

            {active && live ? (
              <View style={{ gap: space.xs }}>
                <T variant="small" muted>Who is speaking now (proposal; confirmed on the transcript screen)</T>
                <Segmented label="Current speaker" value={role} onChange={chooseRole} options={ROLE_OPTIONS} />
              </View>
            ) : null}
            {partial ? (
              <View style={{ ...glassStyle(c), padding: space.md, borderStyle: 'dashed' }}>
                <T variant="small" muted>{role} · speaking…</T>
                <T style={{ fontStyle: 'italic', color: c.textMuted }}>{partial}</T>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={!partial ? <T muted>{recording ? 'Listening…' : 'The live transcript appears here.'}</T> : null}
        renderItem={({ item: s }) => (
          <View style={{ ...glassStyle(c), padding: space.md, gap: 4, borderRadius: radius.md, borderColor: s.recordingSegmentId === justCompleted ? c.success : c.glassBorder }}>
            <Row wrap>
              <Chip label={s.speakerRole} tone={s.speakerRole === 'DOCTOR' ? 'primary' : s.speakerRole === 'PATIENT' ? 'info' : 'neutral'} />
              <T variant="small" muted>{segCode(s.recordingSegmentId)} · {s.displayCode} · {formatDuration(s.startTime)}{s.language && !s.language.startsWith('en') ? ` · ${languageName(s.language)}` : ''}{s.confidence === 'LOW' ? ' · low confidence' : ''}</T>
            </Row>
            <T>{s.text}</T>
          </View>
        )}
      />
      <BottomBar gap={space.sm}>
        {visit.consent?.state !== 'CONFIRMED' ? (
          <Banner tone="warning" message="Consent is not confirmed for this visit, so recording is unavailable." />
        ) : (
          <>
            {phase === 'PROCESSING_SEGMENT' || phase === 'FINALIZING' || phase === 'REQUESTING_PERMISSION' ? <Button kind="secondary" label={phase === 'FINALIZING' ? 'Finalizing…' : phase === 'REQUESTING_PERMISSION' ? 'Waiting for microphone permission…' : 'Saving segment…'} busy onPress={() => undefined} /> : null}
            <Row>
              {primary.map((a) => (
                <Button key={a} kind={ACTION[a].kind} label={ACTION[a].label} icon={ACTION[a].icon} onPress={run[a]} style={{ flex: 1 }} compact={primary.length > 1} />
              ))}
            </Row>
            {secondary.length ? (
              <Row>
                {secondary.map((a) => (
                  <Button key={a} kind={ACTION[a].kind} label={ACTION[a].label} icon={ACTION[a].icon} onPress={run[a]} style={{ flex: 1 }} compact />
                ))}
              </Row>
            ) : null}
            {phase === 'IDLE' && patient.isDemo ? <Button kind="secondary" label="Run synthetic demo consultation (no microphone)" icon="flask-outline" onPress={() => void guarded(() => beginSegment(true))} /> : null}
            {(phase === 'SEGMENT_COMPLETE' || phase === 'CONSULTATION_OPEN' || phase === 'FINALIZED') && patient.isDemo ? <Button kind="ghost" compact label="Continue with synthetic demo script" icon="flask-outline" onPress={() => void guarded(() => beginSegment(true))} /> : null}
            {active ? <Button kind="ghost" compact label="Withdraw consent" onPress={withdraw} /> : null}
          </>
        )}
      </BottomBar>
    </ScreenSurface>
  );
}
