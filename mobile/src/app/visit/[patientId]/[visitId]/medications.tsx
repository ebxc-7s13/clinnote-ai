/** Medication list for the visit: raw wording, normalized name, dose/frequency/route as stated, status, RxNorm. */
import { router, useLocalSearchParams } from 'expo-router';
import { confirmFact, isCurrent, rejectFact } from '../../../../domain/facts';
import { Banner, Button, Card, Chip, Empty, KeyValue, Loading, Row, Screen, T } from '../../../../presentation/components';
import { showError, useVisit } from '../../../../presentation/AppContext';
import { FactChips } from '../../../../presentation/FactRow';
import { STATE_LABEL } from '../../../../presentation/labels';

export default function Medications() {
  const { patientId, visitId } = useLocalSearchParams<{ patientId: string; visitId: string }>();
  const { visit, error, mutate } = useVisit(patientId, visitId);
  if (error) return <Screen><Banner tone="danger" message={error} /></Screen>;
  if (!visit) return <Loading />;
  const meds = visit.facts.filter((f) => f.category === 'MEDICATION' && isCurrent(f));
  const act = (fn: Parameters<typeof mutate>[0]) => mutate(fn).catch((e) => showError(e));
  return (
    <Screen>
      <T variant="small" muted>Doses are shown exactly as stated and never changed automatically. Label information is reference only — not a dosing recommendation.</T>
      {meds.length === 0 ? <Empty icon="pill" title="No medications mentioned" message="Medications stated in the transcript or entered manually appear here." /> : null}
      {meds.map((f) => (
        <Card key={f.factId} onPress={f.conceptKey !== 'ANY' ? () => router.push(`/visit/${patientId}/${visitId}/medication/${f.factId}`) : undefined} accessibilityLabel={`Medication ${f.attributes.rawName ?? f.value}`}>
          <T variant="h2">{f.attributes.rawName ?? f.value}</T>
          <KeyValue k="Said" v={f.value} />
          <KeyValue k="Normalized" v={f.attributes.normalizedName ? `${f.attributes.normalizedName} (U.S. drug terminology (RxNorm))` : f.attributes.normalizationCandidates?.length ? `${f.attributes.normalizationCandidates.length} candidates — choose` : 'not normalized'} />
          <KeyValue k="RxCUI" v={f.attributes.rxcui} />
          <KeyValue k="Dose" v={f.attributes.dose ?? 'not stated'} />
          <KeyValue k="Frequency" v={f.attributes.frequency ?? 'not stated'} />
          <KeyValue k="Route" v={f.attributes.route ?? 'not stated'} />
          <KeyValue k="Status" v={`${(f.attributes.takingStatus ?? 'UNKNOWN').toLowerCase()} · ${STATE_LABEL[f.informationState]}`} />
          <FactChips f={f} />
          <Row wrap>
            {f.conceptKey !== 'ANY' ? <Chip label="Open label / RxNorm / openFDA" tone="primary" icon="chevron-right" /> : null}
          </Row>
          {f.status === 'PROVISIONAL' ? (
            <Row>
              <Button compact kind="secondary" label="Confirm" icon="check" style={{ flex: 1 }} disabled={f.needsClarification && f.clarificationReason === 'CONFLICT'} onPress={() => void act((v) => void confirmFact(v, f.factId))} />
              <Button compact kind="secondary" label="Edit" icon="pencil-outline" style={{ flex: 1 }} onPress={() => router.push(`/visit/${patientId}/${visitId}/fact/${f.factId}`)} />
              <Button compact kind="ghost" label="Dismiss" icon="close" style={{ flex: 1 }} onPress={() => void act((v) => rejectFact(v, f.factId))} />
            </Row>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
