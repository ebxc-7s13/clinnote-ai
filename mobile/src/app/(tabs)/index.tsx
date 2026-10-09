/** Screen 2 — Home. Start New Visit first in focus order and at the thumb-reachable bottom. */
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { renderFact } from '../../domain/note';
import { buildReminders, type ReminderKind } from '../../domain/reminders';
import { formatDate, formatDateTime } from '../../domain/util';
import { pendingFollowUps, unreviewedCount } from '../../domain/views';
import { BottomBar, Banner, Button, Card, Chip, DemoBadge, Empty, Icon, Loading, Row, ScreenSurface, Section, Stat, T, type IconName } from '../../presentation/components';
import { showError, useApp, useWorkspace } from '../../presentation/AppContext';
import { visitStatusLine } from '../../presentation/labels';
import { space, useTheme } from '../../presentation/theme';

const REMINDER_ICON: Record<ReminderKind, [IconName, 'danger' | 'warning' | 'info' | 'neutral']> = {
  RECORDING_INTERRUPTED: ['record-rec', 'danger'],
  FOLLOW_UP_OVERDUE: ['calendar-alert', 'danger'],
  RECONCILE: ['source-merge', 'warning'],
  CONFLICTS: ['alert-outline', 'danger'],
  FOLLOW_UP_SOON: ['calendar-clock', 'info'],
  CONSULTATION_OPEN: ['microphone-outline', 'info'],
  UNREVIEWED: ['progress-question', 'warning'],
  NOTE_DRAFT: ['note-edit-outline', 'neutral'],
  FOLLOW_UP_UNDATED: ['calendar-blank-outline', 'neutral'],
};

export default function Home() {
  const { c } = useTheme();
  const [allReminders, setAllReminders] = useState(false);
  const { app, settings } = useApp();
  const ws = useWorkspace();
  const [busy, setBusy] = useState(false);

  if (!ws.patients && !ws.error) return <Loading />;

  const patients = ws.patients ?? [];
  const all = Object.entries(ws.visitsByPatient ?? {}).flatMap(([pid, vs]) => vs.map((v) => ({ v, ref: patients.find((p) => p.patientId === pid)?.patientReference ?? '' })));
  const recentVisits = all.sort((a, b) => b.v.startedAt.localeCompare(a.v.startedAt)).slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);
  const reminders = buildReminders(patients, ws.visitsByPatient ?? {}, today);
  const visitsToday = all.filter(({ v }) => v.startedAt.slice(0, 10) === today).length;
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
    <ScreenSurface edges={['left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 120 }}>
        {ws.error ? <Banner tone="danger" title="Local data could not be read" message={ws.error} action={<Button kind="secondary" compact label="Retry" onPress={() => void ws.reload()} />} /> : null}
        {!settings.cloudProcessingEnabled ? <Banner tone="info" title="Manual mode" message="Cloud processing is off: nothing leaves this device. Recording, AI extraction and evidence search are unavailable. Change in Settings." /> : null}
        <Row>
          <Stat value={patients.length} label="patients" icon="account-multiple-outline" tone="primary" onPress={() => router.push('/patients')} />
          <Stat value={visitsToday} label="visits today" icon="calendar-today" tone="info" onPress={() => router.push('/visits')} />
          <Stat value={reminders.length} label="reminders" icon="bell-outline" tone={reminders.some((r) => r.priority <= 3) ? 'danger' : reminders.length ? 'warning' : 'neutral'} />
        </Row>
        {reminders.length ? (
          <Section title="Reminders" subtitle="From your records on this device. No notifications are sent." right={reminders.length > 4 ? <Button kind="ghost" compact label={allReminders ? 'Fewer' : `All (${reminders.length})`} onPress={() => setAllReminders(!allReminders)} /> : undefined}>
            {(allReminders ? reminders : reminders.slice(0, 4)).map((r) => {
              const [icon, tone] = REMINDER_ICON[r.kind];
              const color = tone === 'danger' ? c.danger : tone === 'warning' ? c.warning : tone === 'info' ? c.info : c.textMuted;
              return (
                <Card key={r.id} onPress={() => router.push(r.href as never)} accessibilityLabel={`${r.title}, ${r.detail}${r.due ? `, due ${formatDate(r.due)}` : ''}`} style={{ padding: space.md, borderLeftWidth: 4, borderLeftColor: color }}>
                  <Row>
                    <Icon name={icon} color={color} size={22} />
                    <T style={{ fontWeight: '700', flex: 1 }}>{r.title}</T>
                    {r.due ? <Chip label={`${r.kind === 'FOLLOW_UP_OVERDUE' ? 'was due' : 'due'} ${formatDate(r.due)}`} tone={tone === 'danger' ? 'danger' : 'info'} /> : null}
                  </Row>
                  <T variant="small" muted>{r.detail}</T>
                </Card>
              );
            })}
          </Section>
        ) : null}
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
      <BottomBar inTabs>
        <Button label="Start new visit" icon="plus-circle-outline" onPress={() => router.push('/visit/start')} accessibilityHint="Choose or create a patient, then start a recorded or manual visit" />
      </BottomBar>
    </ScreenSurface>
  );
}
