/**
 * Screens 8/9 (live part) — Live Recording + Live Transcript. Always shows whether recording is active, the
 * timer, microphone and recognizer state. Every final segment is saved immediately (no loss on crash/restart).
 * No AI output during recording (ADR-027). The speaker toggle tags live segments; it is a proposal only — roles
 * are confirmed on the Transcript screen before extraction (ADR-021).
 */
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteAudio, mergeAudio } from '../../../../application/container';
import { DEMO_VISIT_1, DEMO_VISIT_2 } from '../../../../application/demo';
import type { Patient, SpeakerRole, Visit } from '../../../../domain/types';
import { formatDuration } from '../../../../domain/util';
import { audioDir } from '../../../../infrastructure/storage/expoFileBackend';
import { LiveSpeechController, requestSpeechPermission, speechCapabilities, type SpeechStatus } from '../../../../infrastructure/speech/liveSpeech';
import { Banner, Button, Chip, DemoBadge, Loading, Row, Segmented, T } from '../../../../presentation/components';
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

export default function Record() {
  const { c } = useTheme();
  const { app, settings } = useApp();
  const { patientId, visitId } = useLocalSearchParams<{ patientId: string; visitId: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [partial, setPartial] = useState('');
  const [status, setStatus] = useState<SpeechStatus>('IDLE');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [role, setRole] = useState<SpeakerRole>('UNKNOWN');
  const [finishing, setFinishing] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  /** a synthetic script was used: the microphone was never opened, so never claim it is listening */
  const [demoUsed, setDemoUsed] = useState(false);
  /** true while this screen drives the microphone or demo script; false after a crash/restart (= interrupted) */
  const [active, setActive] = useState(false);

  const vRef = useRef<Visit | null>(null);
  const roleRef = useRef<SpeakerRole>('UNKNOWN');
  const ctrl = useRef<LiveSpeechController | null>(null);
  const clock = useRef<{ base: number; since: number | null }>({ base: 0, since: null });
  const partialStart = useRef<number | null>(null);
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chooseRole = (r: SpeakerRole) => {
    roleRef.current = r;
    setRole(r);
  };

  const now = () => clock.current.base + (clock.current.since ? (Date.now() - clock.current.since) / 1000 : 0);

  const persist = useCallback(async () => {
    const v = vRef.current;
    if (!v) return;
    v.recordingDurationSec = Math.round(now());
    try {
      await app.store.saveVisit(v);
    } catch {
      setStatusMsg('Saving failed once; the transcript is kept in memory and saved on the next segment.');
    }
    setVisit({ ...v, segments: [...v.segments] });
  }, [app]);

  useEffect(() => {
    void (async () => {
      try {
        const p = await app.store.getPatient(patientId);
        const v = await app.store.getVisit(patientId, visitId);
        vRef.current = v;
        clock.current.base = v.recordingDurationSec;
        setElapsed(v.recordingDurationSec);
        setPatient(p);
        setVisit(v);
      } catch (e) {
        showError(e);
      }
    })();
    return () => {
      if (demoTimer.current) clearTimeout(demoTimer.current);
      ctrl.current?.stop();
    };
  }, [app, patientId, visitId]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(now()), 500);
    return () => clearInterval(t);
  }, []);

  const addSegment = (text: string, confidence: number, source?: string) => {
    const v = vRef.current;
    if (!v) return;
    const end = now();
    const start = partialStart.current ?? Math.max(0, end - Math.max(1, text.split(/\s+/).length * 0.4));
    partialStart.current = null;
    app.visits.addLiveSegment(v, text, confidence, roleRef.current, Math.round(start * 10) / 10, Math.round(end * 10) / 10, source);
    void persist();
  };

  const setRecording = async (state: Visit['recordingState']) => {
    const v = vRef.current;
    if (!v) return;
    if (state === 'RECORDING' && v.recordingState === 'NOT_STARTED') app.visits.startRecording(v);
    v.recordingState = state;
    await persist();
  };

  const startMic = async () => {
    const caps = speechCapabilities();
    if (!caps.available) {
      setStatus('ERROR');
      setStatusMsg('Speech recognition is not available on this device. You can continue with manual entry.');
      return;
    }
    const granted = await requestSpeechPermission();
    if (!granted) {
      setStatus('ERROR');
      setStatusMsg('Microphone permission was denied. Nothing was recorded. Allow microphone access in Android settings, or continue manually.');
      return;
    }
    // temporary audio is only kept when it can be used: backend AI is for synthetic demo visits only (ADR-047)
    const captureAudio = settings.cloudProcessingEnabled && app.backend.configured() && !!patient?.isDemo;
    ctrl.current = new LiveSpeechController(
      {
        onFinal: (text, conf) => addSegment(text, conf),
        onPartial: (text) => {
          if (text && partialStart.current === null) partialStart.current = now();
          setPartial(text);
        },
        onStatus: (s, m) => {
          setStatus(s);
          if (m) setStatusMsg(m);
          if (s === 'LISTENING') setStatusMsg(null);
          if (s === 'ERROR') {
            setActive(false);
            clock.current.base = now();
            clock.current.since = null;
            void setRecording('PAUSED');
          }
        },
        onAudioFile: (uri) => {
          const v = vRef.current;
          if (!v) return;
          v.pendingAudioUris.push(uri);
          void persist();
        },
      },
      { lang: settings.language, audioDir: captureAudio ? audioDir().uri : undefined, filePrefix: visitId.slice(0, 8), captureAudio },
    );
    clock.current.since = Date.now();
    await setRecording('RECORDING');
    setActive(true);
    ctrl.current.start();
  };

  const runDemo = async () => {
    const all = await app.store.listVisits(patientId);
    const lines = all.filter((x) => x.visitId !== visitId && x.segments.length).length ? DEMO_VISIT_2 : DEMO_VISIT_1;
    setDemoRunning(true);
    setDemoUsed(true);
    setActive(true);
    clock.current.since = Date.now();
    await setRecording('RECORDING');
    setStatus('LISTENING');
    let i = 0;
    const step = () => {
      if (i >= lines.length || vRef.current?.recordingState !== 'RECORDING') {
        setDemoRunning(false);
        setPartial('');
        return;
      }
      const line = lines[i++];
      chooseRole(line.role);
      setPartial(line.text);
      partialStart.current = now();
      demoTimer.current = setTimeout(() => {
        setPartial('');
        addSegment(line.text, 0.95, 'demo-script');
        demoTimer.current = setTimeout(step, 400);
      }, 900);
    };
    step();
  };

  const pause = async () => {
    ctrl.current?.pause();
    clock.current.base = now();
    clock.current.since = null;
    setStatus('PAUSED');
    await setRecording('PAUSED');
  };
  const resume = async () => {
    clock.current.since = Date.now();
    await setRecording('RECORDING');
    if (ctrl.current) ctrl.current.resume();
    else if (!demoRunning) await startMic();
    setActive(true);
  };

  const stop = async () => {
    const v = vRef.current;
    if (!v) return;
    if (demoTimer.current) clearTimeout(demoTimer.current);
    setDemoRunning(false);
    setActive(false);
    ctrl.current?.stop();
    setFinishing('Saving transcript…');
    // wait for the recognizer's last final result / audio file (controller commits a dangling partial)
    if (ctrl.current) await new Promise((r) => setTimeout(r, 1800));
    ctrl.current = null;
    clock.current.base = now();
    clock.current.since = null;
    app.visits.stopRecording(v, clock.current.base);
    await persist();
    const uris = [...v.pendingAudioUris];
    if (uris.length && settings.cloudProcessingEnabled && app.backend.configured()) {
      setFinishing('Creating final transcript with speaker separation…');
      const merged = mergeAudio(uris);
      const r = await app.visits.finalTranscription(v, settings, merged);
      deleteAudio([merged, ...uris]);
      v.pendingAudioUris = [];
      await persist();
      if (r.message) Alert.alert(r.ok ? 'Final transcript' : 'Final transcript not created', r.message);
    } else if (uris.length) {
      deleteAudio(uris);
      v.pendingAudioUris = [];
      await persist();
    }
    setFinishing(null);
    router.replace(`/visit/${patientId}/${visitId}/transcript`);
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
  const st = visit.recordingState;
  const recording = st === 'RECORDING';
  const paused = st === 'PAUSED';
  const interrupted = (recording || paused) && !active;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: `${patient.patientReference} · ${visit.visitCode}`, headerBackVisible: !recording }} />
      {recording ? <KeepAwake /> : null}
      <View
        accessible
        accessibilityRole="header"
        accessibilityLiveRegion="assertive"
        accessibilityLabel={recording ? `Recording, ${formatDuration(elapsed)}` : paused ? `Paused at ${formatDuration(elapsed)}` : st === 'STOPPED' ? 'Recording stopped' : 'Not recording'}
        style={{ margin: space.lg, marginBottom: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: recording ? c.recording : paused ? c.warningSoft : c.surface, borderWidth: recording ? 0 : 1, borderColor: c.border, gap: 4 }}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: recording ? '#fff' : paused ? c.warning : c.text }}>{recording ? '● RECORDING' : paused ? '❚❚ PAUSED' : st === 'STOPPED' ? '■ STOPPED' : 'NOT RECORDING'}</Text>
          <Text style={{ fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'], color: recording ? '#fff' : c.text }}>{formatDuration(elapsed)}</Text>
        </Row>
        <Text style={{ color: recording ? '#fff' : c.textMuted, fontSize: 13 }}>
          {demoRunning ? 'Synthetic demo script (no microphone)' : demoUsed ? 'Synthetic demo script finished (microphone not used)' : `Microphone: ${status === 'LISTENING' ? 'listening' : status === 'RESTARTING' ? 'reconnecting' : status === 'PAUSED' ? 'paused' : status === 'ERROR' ? 'unavailable' : status === 'STOPPED' ? 'off' : 'off'}`}
          {settings.cloudProcessingEnabled ? (app.backend.configured() && patient.isDemo ? ' · cloud final transcript available' : ' · on-device live transcript only') : ''}
        </Text>
      </View>
      <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
        {patient.isDemo ? <DemoBadge /> : null}
        {statusMsg ? <Banner tone={status === 'ERROR' ? 'danger' : 'warning'} message={statusMsg} /> : null}
        {interrupted ? <Banner tone="warning" title="Recording was interrupted" message={`${visit.segments.length} segment(s) were saved before the interruption. Resume recording or stop and review.`} /> : null}
        {finishing ? <Banner tone="info" message={finishing} /> : null}
        <T variant="small" muted>Who is speaking now (proposal; confirmed on the next screen)</T>
        <Segmented label="Current speaker" value={role} onChange={chooseRole} options={ROLE_OPTIONS} />
      </View>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        data={[...visit.segments].reverse()}
        keyExtractor={(s) => s.segmentId}
        ListHeaderComponent={partial ? <T style={{ fontStyle: 'italic', color: c.textMuted }}>{role} · {partial}</T> : null}
        ListEmptyComponent={!partial ? <T muted>{recording ? 'Listening…' : 'The live transcript appears here.'}</T> : null}
        renderItem={({ item: s }) => (
          <View style={{ gap: 2 }}>
            <Row>
              <Chip label={s.speakerRole} tone={s.speakerRole === 'DOCTOR' ? 'primary' : s.speakerRole === 'PATIENT' ? 'info' : 'neutral'} />
              <T variant="small" muted>{s.displayCode} · {formatDuration(s.startTime)}{s.confidence === 'LOW' ? ' · low confidence' : ''}</T>
            </Row>
            <T>{s.text}</T>
          </View>
        )}
      />
      <View style={{ padding: space.lg, gap: space.sm, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }}>
        {st === 'NOT_STARTED' ? (
          <>
            <Button kind="record" label="Start recording" icon="microphone" onPress={() => void startMic()} />
            {patient.isDemo ? <Button kind="secondary" label="Run synthetic demo consultation (no microphone)" icon="flask-outline" onPress={() => void runDemo()} /> : null}
          </>
        ) : st === 'STOPPED' || st === 'FAILED' ? (
          <Button label="Review transcript" icon="arrow-right" onPress={() => router.replace(`/visit/${patientId}/${visitId}/transcript`)} />
        ) : (
          <>
            <Row>
              {recording && !interrupted ? (
                <Button kind="secondary" label="Pause" icon="pause" onPress={() => void pause()} style={{ flex: 1 }} disabled={demoRunning || !!finishing} />
              ) : (
                <Button kind="secondary" label="Resume" icon="play" onPress={() => void resume()} style={{ flex: 1 }} disabled={!!finishing} />
              )}
              <Button kind="danger" label="Stop" icon="stop" onPress={() => void stop()} style={{ flex: 1 }} busy={!!finishing} />
            </Row>
            <Button kind="ghost" label="Withdraw consent" onPress={withdraw} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
