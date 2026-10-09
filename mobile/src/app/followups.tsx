/** Screen 15 — Follow-Up. Only the clinician marks a follow-up completed or cancelled (new confirmed version). */
import { router } from 'expo-router';
import { editFact, isEligible } from '../domain/facts';
import { renderFact } from '../domain/note';
import type { ClinicalFact, Visit } from '../domain/types';
import { formatDate } from '../domain/util';
import { Banner, Button, Card, Chip, Empty, Loading, Row, Screen, Section, T } from '../presentation/components';
import { showError, useApp, useWorkspace } from '../presentation/AppContext';

export default function FollowUps() {
  const { app } = useApp();
  const ws = useWorkspace();
  if (!ws.patients && !ws.error) return <Loading />;
  const refOf = (id: string) => ws.patients?.find((p) => p.patientId === id)?.patientReference ?? '';
  const items = Object.values(ws.visitsByPatient ?? {}).flatMap((vs) => vs.flatMap((v) => v.facts.filter((f) => f.category === 'FOLLOW_UP' && isEligible(f)).map((fact) => ({ fact, visit: v }))));
  const status = (f: ClinicalFact) => f.attributes.followUpStatus ?? 'PENDING';
  const pending = items.filter((x) => status(x.fact) === 'PENDING').sort((a, b) => (a.fact.attributes.dueDate ?? a.visit.startedAt).localeCompare(b.fact.attributes.dueDate ?? b.visit.startedAt));
  const done = items.filter((x) => status(x.fact) !== 'PENDING');

  const mark = async (visit: Visit, f: ClinicalFact, s: 'COMPLETED' | 'CANCELLED') => {
    try {
      const v: Visit = JSON.parse(JSON.stringify(visit));
      editFact(v, f.factId, { attributes: { followUpStatus: s } });
      await app.store.saveVisit(v);
      await ws.reload();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Screen>
      {ws.error ? <Banner tone="danger" message={ws.error} /> : null}
      <Section title="Pending">
        {pending.length === 0 ? <Empty icon="calendar-check-outline" title="No pending follow-ups" message="Follow-up stated in a visit appears here." /> : null}
        {pending.map(({ fact, visit }) => {
          const overdue = fact.attributes.dueDate && fact.attributes.dueDate < new Date().toISOString().slice(0, 10);
          return (
            <Card key={fact.factId}>
              <Row wrap>
                <T style={{ fontWeight: '700' }}>{refOf(visit.patientId)}</T>
                {overdue ? <Chip label="Overdue" tone="danger" icon="clock-alert-outline" /> : null}
                {fact.status !== 'CONFIRMED' ? <Chip label="Provisional" tone="warning" /> : null}
              </Row>
              <T>{renderFact(fact)}</T>
              <T variant="small" muted>From {visit.visitCode} · {formatDate(visit.startedAt)}{fact.attributes.dueDate ? ` · due ${fact.attributes.dueDate}` : fact.attributes.interval ? ` · in ${fact.attributes.interval}` : ''}</T>
              <Row>
                <Button compact kind="secondary" label="Completed" icon="check" onPress={() => void mark(visit, fact, 'COMPLETED')} style={{ flex: 1 }} />
                <Button compact kind="ghost" label="Cancelled" onPress={() => void mark(visit, fact, 'CANCELLED')} style={{ flex: 1 }} />
              </Row>
              <Button compact kind="ghost" label="Open patient" onPress={() => router.push(`/patient/${visit.patientId}`)} />
            </Card>
          );
        })}
      </Section>
      {done.length ? (
        <Section title="Completed or cancelled">
          {done.map(({ fact, visit }) => (
            <Card key={fact.factId}>
              <T>{renderFact(fact)}</T>
              <T variant="small" muted>{refOf(visit.patientId)} · {status(fact).toLowerCase()}</T>
            </Card>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
