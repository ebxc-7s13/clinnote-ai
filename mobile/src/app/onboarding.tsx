/** Screen 1 — Onboarding (FR-27, FR-28.1). Acknowledgement is explicit; cloud processing is offered after it. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { nowIso } from '../domain/util';
import { GlassBackground, Banner, Button, Icon, Row, T, type IconName } from '../presentation/components';
import { useApp } from '../presentation/AppContext';
import { ONBOARDING_VERSION } from '../presentation/labels';
import { radius, space, useTheme } from '../presentation/theme';

const PAGES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'stethoscope', title: 'Documentation assistant, not a doctor', body: 'ClinNote organizes what was said in a consultation and shows public reference information. It does not diagnose, prescribe, change doses or triage. You remain responsible for every clinical decision.' },
  { icon: 'microphone-outline', title: 'Records only after you confirm consent', body: 'Recording starts only after you confirm that appropriate patient consent was obtained. You can pause, stop or withdraw at any time.' },
  { icon: 'cellphone-lock', title: 'Patient data stays on this device', body: 'Patient records are stored encrypted on this device. When cloud processing is on, audio and transcript text are sent to cloud services for transcription and extraction, and clinical terms (never names or identifiers) are sent to public evidence sources. You can turn this off.' },
  { icon: 'robot-outline', title: 'AI output is provisional', body: 'Anything extracted automatically is marked provisional and keeps its source. Only your explicit action confirms a fact. Finalizing a note does not confirm facts.' },
];

export default function Onboarding() {
  const { c } = useTheme();
  const { updateSettings } = useApp();
  const [page, setPage] = useState(0);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const last = page === PAGES.length;

  const finish = async (cloud: boolean) => {
    setBusy(true);
    await updateSettings({ onboardingAcknowledgedAt: nowIso(), onboardingVersion: ONBOARDING_VERSION, cloudProcessingEnabled: cloud });
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bgGradient[0] }}>
      <GlassBackground />
      <View style={{ flex: 1, padding: space.xl, gap: space.lg, justifyContent: 'center' }}>
        <T variant="small" muted>
          ClinNote · {Math.min(page + 1, PAGES.length + 1)} of {PAGES.length + 1}
        </T>
        {!last ? (
          <>
            <Icon name={PAGES[page].icon} size={40} color={c.primary} />
            <T variant="title" style={{ fontSize: 26 }}>
              {PAGES[page].title}
            </T>
            <T>{PAGES[page].body}</T>
          </>
        ) : (
          <>
            <T variant="title">Before you start</T>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ack }} onPress={() => setAck(!ack)} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: ack ? c.primary : c.border, backgroundColor: c.surface, minHeight: 56 }}>
              <Icon name={ack ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={ack ? c.primary : c.textMuted} />
              <T style={{ flex: 1 }}>I understand that ClinNote is a documentation aid, that AI output is provisional, and that I remain responsible for clinical decisions.</T>
            </Pressable>
            <Banner tone="info" title="Cloud processing" message="Turn on to use live transcription, AI fact extraction and public evidence search. Keep off for manual mode: nothing leaves this device. You can change this in Settings." />
          </>
        )}
      </View>
      <View style={{ padding: space.lg, gap: space.sm }}>
        {!last ? (
          <Row>
            {page > 0 ? <Button kind="secondary" label="Back" onPress={() => setPage(page - 1)} style={{ flex: 1 }} /> : null}
            <Button label="Continue" onPress={() => setPage(page + 1)} style={{ flex: 2 }} icon="arrow-right" />
          </Row>
        ) : (
          <>
            <Button label="Acknowledge and turn on cloud processing" disabled={!ack} busy={busy} onPress={() => void finish(true)} icon="cloud-check-outline" />
            <Button kind="secondary" label="Acknowledge — manual mode (cloud off)" disabled={!ack} busy={busy} onPress={() => void finish(false)} icon="cloud-off-outline" />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
