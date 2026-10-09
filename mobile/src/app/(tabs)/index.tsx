/** Screen 2 — Home. Start New Visit first in focus order and at the thumb-reachable bottom. */
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { renderFact } from '../../domain/note';
import { formatDate, formatDateTime } from '../../domain/util';
import { pendingFollowUps, unreviewedCount } from '../../domain/views';
import { Banner, Button, Card, Chip, DemoBadge, Empty, Loading, Row, Section, T } from '../../presentation/components';
import { showError, useApp, useWorkspace } from '../../presentation/AppContext';
import { visitStatusLine } from '../../presentation/labels';
import { space, useTheme } from '../../presentation/theme';

export default function Home() {
  const { c } = useTheme();
  const { app, settings } = useApp();
  const ws = useWorkspace();
  const [busy, setBusy] = useState(false);

  if (!ws.patients && !ws.error) return <Loading />;

  const patients = ws.patients ?? [];
  const all = Object.entries(ws.visitsByPatient ?? {}).flatMap(([pid, vs]) => vs.map((v) => ({ v, ref: patients.find((p) => p.patientId === pid)?.patientReference ?? '' })));
  const recentVisits = all.sort((a, b) => b.v.startedAt.localeCompare(a.v.startedAt)).slice(0, 5);
  const interrupted = all.filter(({ v }) => v.recordingState === 'RECORDING' || v.recordingState === 'PAUSED');
  const followUps = Object.values(ws.visitsByPatient ?? {}).flatMap((vs) => pendingFollowUps(vs));

  const createDemo = async () => {
    setBusy(true);
    try {
      const p = await app.store.createPatient({ age: 47, sex: 'MALE', name: 'Demo Patient (synthetic)', isDemo: true });
      router.push(`/patient/${p.patientId}`);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 120 }}>
        {ws.error ? <Banner tone="danger" title="Local data could not be read" message={ws.error} action={<Button kind="secondary" compact label="Retry" onPress={() => void ws.reload()} />} /> : null}
        {!settings.cloudProcessingEnabled ? <Banner tone="info" title="Manual mode" message="Cloud processing is off: nothing leaves this device. Recording, AI extraction and evidence search are unavailable. Change in Settings." /> : null}
        {interrupted.map(({ v, ref }) => (
          <Banner
            key={v.visitId}
            tone="warning"
            title={`Recording interrupted · ${ref} · ${v.visitCode}`}
            message={`${v.segments.length} transcript segment(s) are saved. Resume recording or stop and review.`}
            action={<Button compact kind="secondary" label="Open recording" onPress={() => router.push(`/visit/${v.patientId}/${v.visitId}/record`)} />}
          />
        ))}
        <Button kind="secondary" label="Search patients, visits and notes" icon="magnify" onPress={() => router.push('/search')} />

        <Section title="Recent patients" right={<Button kind="ghost" compact label="All" onPress={() => router.push('/patients')} />}>
          {patients.length === 0 ? (
            <Card>
              <Empty icon="account-plus-outline" title="No patients yet" message="Create your first patient. For a walkthrough, create a synthetic demo patient." />
              <Button label="Create patient" icon="account-plus" onPress={() => router.push('/patient/new')} />
              <Button kind="secondary" label="Create synthetic demo patient" icon="flask-outline" busy={busy} onPress={() => void createDemo()} />
            </Card>
          ) : (
            patients.slice(0, 4).map((p) => (
              <Card key={p.patientId} onPress={() => router.push(`/patient/${p.patientId}`)} accessibilityLabel={`Patient ${p.patientReference}, ${p.visitCount} visits`}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T style={{ fontWeight: '700' }}>{p.patientReference}{p.name ? ` · ${p.name}` : ''}</T>
                  <T variant="small" muted>{p.lastVisitAt ? formatDate(p.lastVisitAt) : 'no visits'}</T>
                </Row>
                <Row wrap>
                  <T variant="small" muted>{[p.age !== undefined ? `${p.age} y` : null, p.sex?.toLowerCase(), `${p.visitCount} visit(s)`].filter(Boolean).join(' · ')}</T>
                  {p.isDemo ? <DemoBadge /> : null}
                </Row>
              </Card>
            ))
          )}
        </Section>

        {recentVisits.length ? (
          <Section title="Recent visits" right={<Button kind="ghost" compact label="All" onPress={() => router.push('/visits')} />}>
            {recentVisits.map(({ v, ref }) => {
              const n = unreviewedCount(v);
              return (
                <Card key={v.visitId} onPress={() => router.push(`/visit/${v.patientId}/${v.visitId}`)} accessibilityLabel={`Visit ${v.visitCode} for ${ref}, ${visitStatusLine(v)}`}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T style={{ fontWeight: '700' }}>{ref} · {v.visitCode}</T>
                    <T variant="small" muted>{formatDateTime(v.startedAt)}</T>
                  </Row>
                  <T variant="small" muted>{visitStatusLine(v)}</T>
                  {n ? <Chip label={`${n} not yet reviewed`} tone="warning" icon="progress-question" /> : null}
                </Card>
              );
            })}
          </Section>
        ) : null}

        <Section title="Pending follow-up" right={followUps.length ? <Button kind="ghost" compact label="All" onPress={() => router.push('/followups')} /> : undefined}>
          {followUps.length === 0 ? (
            <T muted>No pending follow-ups.</T>
          ) : (
            followUps.slice(0, 3).map(({ fact, visit }) => (
              <Card key={fact.factId} onPress={() => router.push('/followups')}>
                <T>{renderFact(fact)}</T>
                <T variant="small" muted>{patients.find((p) => p.patientId === visit.patientId)?.patientReference} · {visit.visitCode} · {formatDate(visit.startedAt)}</T>
              </Card>
            ))
          )}
        </Section>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, backgroundColor: c.bg }}>
        <Button label="Start new visit" icon="plus-circle-outline" onPress={() => router.push('/visit/start')} accessibilityHint="Choose or create a patient, then start a recorded or manual visit" />
      </View>
    </SafeAreaView>
  );
}
