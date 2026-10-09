/**
 * Screen 4 — Patient Overview, including Screen 16 — Returning Patient (last visit, what changed, current
 * medications, allergies, investigations, pending items, follow-up). All lists are derived views (DATA_MODEL §10);
 * the comparison is deterministic code (FR-25), never AI.
 */
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { compareVisits } from '../../../domain/diff';
import { exportPatientSummary } from '../../../domain/export';
import { audit, isEligible } from '../../../domain/facts';
import { renderFact } from '../../../domain/note';
import { addManualProblem, setProblemStatus } from '../../../domain/problems';
import { symptomCourse } from '../../../domain/timeline';
import { formatDate, formatDateTime } from '../../../domain/util';
import { activeProblems, allergyStatus, currentMedications, pendingFollowUps, proposedForReview } from '../../../domain/views';
import { Banner, Button, Card, Chip, DemoBadge, Divider, Field, Loading, Row, Section, T } from '../../../presentation/components';
import { showError, useApp, usePatient } from '../../../presentation/AppContext';
import { FactChips } from '../../../presentation/FactRow';
import { askExport } from '../../../presentation/exportUi';
import { NOTE_STATE_LABEL, visitStatusLine } from '../../../presentation/labels';
import { space, useTheme } from '../../../presentation/theme';

export default function PatientOverview() {
  const { c } = useTheme();
  const { app } = useApp();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const { patient, visits, error, reload } = usePatient(patientId);
  const [problem, setProblem] = useState('');
  const [showProposed, setShowProposed] = useState(false);

  if (error) return <View style={{ flex: 1, padding: space.lg, backgroundColor: c.bg }}><Banner tone="danger" message={error} action={<Button compact kind="secondary" label="Retry" onPress={() => void reload()} />} /></View>;
  if (!patient || !visits) return <Loading />;

  const sorted = [...visits].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const diff = prev && last ? compareVisits(prev, last).filter((d) => d.kind !== 'UNCHANGED') : [];
  const meds = currentMedications(visits);
  const allergies = allergyStatus(visits);
  const proposed = proposedForReview(visits, last?.visitId);
  const followUps = pendingFollowUps(visits);
  const investigations = sorted.slice(-3).flatMap((v) => v.facts.filter((f) => f.category === 'INVESTIGATION' && isEligible(f)).map((f) => ({ f, v })));
  const course = symptomCourse(visits);
  const problems = activeProblems(patient);

  const savePatient = async (fn: () => void) => {
    try {
      fn();
      await app.store.savePatient(patient);
      await reload();
    } catch (e) {
      showError(e);
    }
  };

  const del = () =>
    Alert.alert(`Delete ${patient.patientReference}?`, 'The patient and all visits, transcripts and notes are deleted from this device. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await app.store.deletePatient(patient.patientId);
            router.replace('/patients');
          } catch (e) {
            showError(e);
          }
        },
      },
    ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: patient.patientReference }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 120 }}>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="title">{patient.patientReference}</T>
            <Button kind="ghost" compact label="Edit" icon="pencil-outline" onPress={() => router.push(`/patient/new?patientId=${patient.patientId}`)} />
          </Row>
          {patient.name ? <T>{patient.name}</T> : null}
          <T muted>{[patient.age !== undefined ? `${patient.age} years` : 'age not recorded', patient.sex ? patient.sex.toLowerCase() : 'sex not recorded', `${visits.length} visit(s)`].join(' · ')}</T>
          {patient.isDemo ? <DemoBadge /> : null}
        </Card>

        {last ? (
          <Section title="Last visit">
            <Card onPress={() => router.push(`/visit/${patient.patientId}/${last.visitId}`)} accessibilityLabel={`Open last visit ${last.visitCode}`}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T style={{ fontWeight: '700' }}>{last.visitCode}</T>
                <T variant="small" muted>{formatDateTime(last.startedAt)}</T>
              </Row>
              <T variant="small" muted>{visitStatusLine(last)}</T>
            </Card>
          </Section>
        ) : null}

        {prev ? (
          <Section title="What changed since last visit" subtitle={`${prev.visitCode} (${formatDate(prev.startedAt)}) → ${last.visitCode} (${formatDate(last.startedAt)}). Computed from documented facts only.`}>
            <Card>
              {diff.length === 0 ? <T muted>No differences in documented facts.</T> : null}
              {diff.slice(0, 8).map((d, i) => (
                <View key={i} style={{ gap: 4 }}>
                  <T>{d.text}</T>
                  <Row wrap>
                    <Chip label={d.kind === 'NOT_DISCUSSED_NOW' ? 'Not discussed this visit' : d.kind === 'NEW' ? 'New' : 'Changed'} tone={d.kind === 'NOT_DISCUSSED_NOW' ? 'neutral' : 'info'} />
                    {d.provisional ? <Chip label="Provisional — not reviewed" tone="warning" icon="progress-question" /> : null}
                  </Row>
                </View>
              ))}
              <Button kind="secondary" label="Full comparison" icon="compare-horizontal" onPress={() => router.push(`/visit/${patient.patientId}/${last.visitId}/compare`)} />
            </Card>
          </Section>
        ) : null}

        <Section title="Active problems" subtitle="Clinician-curated list only.">
          <Card>
            {problems.length === 0 ? <T muted>Nothing recorded yet.</T> : null}
            {problems.map((p) => (
              <Row key={p.problemId} style={{ justifyContent: 'space-between' }}>
                <T style={{ flex: 1 }}>{p.label}</T>
                <Button kind="ghost" compact label="Mark resolved" onPress={() => void savePatient(() => setProblemStatus(patient, p.problemId, 'RESOLVED'))} />
              </Row>
            ))}
            <Divider />
            <Field label="Add problem (clinician entry)" value={problem} onChangeText={setProblem} />
            <Button kind="secondary" compact label="Add to problem list" disabled={!problem.trim()} onPress={() => void savePatient(() => { addManualProblem(patient, problem); setProblem(''); })} />
          </Card>
        </Section>

        <Section title="Current medications" subtitle="Confirmed records only. Absence at a visit never means discontinued.">
          <Card>
            {meds.length === 0 ? <T muted>No confirmed current medications.</T> : null}
            {meds.map((m) => (
              <View key={m.fact.factId} style={{ gap: 4 }}>
                <T>{renderFact(m.fact)}</T>
                <Row wrap>
                  {m.notDiscussedSince ? <Chip label={`Not discussed since ${formatDate(m.notDiscussedSince)}`} tone="neutral" /> : null}
                  {m.conflict ? <Chip label="Conflict — review" tone="danger" icon="alert-outline" /> : null}
                </Row>
              </View>
            ))}
          </Card>
        </Section>

        <Section title="Allergies">
          <Card>
            {allergies.positives.map((p) => (
              <View key={p.fact.factId} style={{ gap: 4 }}>
                <T style={{ fontWeight: '700', color: c.danger }}>⚠ {p.fact.attributes.substance ?? p.fact.value}{p.fact.attributes.reaction ? ` (${p.fact.attributes.reaction})` : ''}</T>
                <FactChips f={p.fact} />
                {p.conflict ? <Chip label="Conflict — review" tone="danger" icon="alert-outline" /> : null}
              </View>
            ))}
            <T style={{ fontWeight: '600' }}>{allergies.statusLine}</T>
          </Card>
        </Section>

        <Section title="Recent investigations">
          <Card>
            {investigations.length === 0 ? <T muted>Nothing recorded yet.</T> : null}
            {investigations.map(({ f, v }) => (
              <T key={f.factId}>
                {renderFact(f)} · {v.visitCode}
              </T>
            ))}
          </Card>
        </Section>

        <Section title="Follow-up">
          <Card>
            {followUps.length === 0 ? <T muted>No pending follow-ups.</T> : null}
            {followUps.map(({ fact, visit }) => (
              <T key={fact.factId}>
                {renderFact(fact)} · {visit.visitCode}
              </T>
            ))}
          </Card>
        </Section>

        {course.length ? (
          <Section title="Symptom course" subtitle="As stated at each visit. Absence is shown as not discussed.">
            {course.map((s) => (
              <Card key={s.key}>
                <T style={{ fontWeight: '700' }}>{s.label}</T>
                {s.entries.map((e) => (
                  <T key={e.visit.visitId} variant="small">
                    {formatDate(e.visit.startedAt)} · {e.text}
                  </T>
                ))}
              </Card>
            ))}
          </Section>
        ) : null}

        <Section title="Proposed — needs review" right={<Button kind="ghost" compact label={showProposed ? 'Hide' : `Show (${proposed.thisVisit.length + proposed.earlier.length})`} onPress={() => setShowProposed(!showProposed)} />}>
          {showProposed ? (
            <>
              {[...proposed.thisVisit.map((x) => ({ ...x, group: 'This visit' })), ...proposed.earlier.map((x) => ({ ...x, group: 'From earlier visits — not reviewed' }))].map(({ fact, visit, group }) => (
                <Card key={fact.factId} onPress={() => router.push(`/visit/${patient.patientId}/${visit.visitId}/fact/${fact.factId}`)}>
                  <T variant="small" muted>{group} · {visit.visitCode} · {formatDate(visit.startedAt)}</T>
                  <T>{renderFact(fact)}</T>
                </Card>
              ))}
            </>
          ) : null}
        </Section>

        <Section title="Record">
          <Button kind="secondary" label="Timeline" icon="timeline-text-outline" onPress={() => router.push(`/patient/${patient.patientId}/timeline`)} />
          <Button
            kind="secondary"
            label="Export patient summary"
            icon="export-variant"
            onPress={() =>
              askExport(async () => {
                const doc = exportPatientSummary(patient, visits);
                if (last) {
                  const v = JSON.parse(JSON.stringify(last));
                  audit(v, 'PATIENT', patient.patientId, 'EXPORTED', 'CLINICIAN', 'patient summary');
                  await app.store.saveVisit(v);
                }
                return doc;
              })
            }
          />
          {sorted.length ? <Section title="Visits">{[...sorted].reverse().map((v) => (
            <Card key={v.visitId} onPress={() => router.push(`/visit/${patient.patientId}/${v.visitId}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T style={{ fontWeight: '700' }}>{v.visitCode}</T>
                <T variant="small" muted>{formatDateTime(v.startedAt)}</T>
              </Row>
              <T variant="small" muted>{NOTE_STATE_LABEL[v.noteState]}</T>
            </Card>
          ))}</Section> : null}
          <Button kind="danger" label="Delete patient" icon="delete-outline" onPress={del} />
        </Section>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, backgroundColor: c.bg }}>
        <Button label={visits.length ? 'Start new visit (returning patient)' : 'Start new visit'} icon="plus-circle-outline" onPress={() => router.push(`/visit/start?patientId=${patient.patientId}`)} />
      </View>
    </SafeAreaView>
  );
}
