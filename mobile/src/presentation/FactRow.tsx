import { router } from 'expo-router';
import { View } from 'react-native';
import { isCurrent, isFlaggedIneligible } from '../domain/facts';
import { categoryLabel, renderFact } from '../domain/note';
import type { ClinicalFact, Visit } from '../domain/types';
import { formatDuration } from '../domain/util';
import { Button, Card, Chip, Row, T } from './components';
import { CLARIFICATION_LABEL, provenanceText, STATE_LABEL, STATUS_LABEL } from './labels';

export function FactChips({ f }: { f: ClinicalFact }) {
  return (
    <Row wrap>
      <Chip label={STATUS_LABEL[f.status]} tone={f.status === 'CONFIRMED' ? 'success' : f.status === 'REJECTED' ? 'danger' : 'neutral'} icon={f.status === 'CONFIRMED' ? 'check-circle' : f.status === 'REJECTED' ? 'close-circle' : 'progress-question'} />
      <Chip label={provenanceText(f)} tone={f.provenance === 'AI_EXTRACTED' ? 'warning' : 'info'} icon={f.provenance === 'AI_EXTRACTED' ? 'robot-outline' : f.provenance === 'PATIENT_REPORTED' ? 'account-voice' : f.provenance === 'MEASURED' ? 'ruler' : 'stethoscope'} />
      {f.needsClarification && f.clarificationReason ? <Chip label={CLARIFICATION_LABEL[f.clarificationReason] ?? 'Needs clarification'} tone={f.clarificationReason === 'CONFLICT' ? 'danger' : 'warning'} icon="alert-outline" /> : null}
      {!isCurrent(f) ? <Chip label={f.status === 'REJECTED' ? 'Rejected (kept as history)' : 'Superseded (kept as history)'} tone="neutral" icon="history" /> : null}
    </Row>
  );
}

/** Segment codes for a fact ("T-0043"), in transcript order. */
export function sourceCodes(f: ClinicalFact, v?: Visit): string {
  if (!v || !f.sourceSegmentIds.length) return f.derivationMethod === 'MANUAL_ENTRY' ? 'manual entry' : '';
  return v.segments.filter((s) => f.sourceSegmentIds.includes(s.segmentId)).map((s) => s.displayCode).join(', ');
}

export function FactRow({ f, patientId, visitId, visit, onConfirm, onReject }: { f: ClinicalFact; patientId: string; visitId: string; visit?: Visit; onConfirm?: () => void; onReject?: () => void }) {
  const flagged = isFlaggedIneligible(f);
  const codes = sourceCodes(f, visit);
  return (
    <Card onPress={() => router.push(`/visit/${patientId}/${visitId}/fact/${f.factId}`)} accessibilityLabel={`${categoryLabel(f.category)}: ${f.value}, ${STATE_LABEL[f.informationState]}, ${provenanceText(f)}, ${STATUS_LABEL[f.status]}. Opens details.`}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="small" muted>
          {categoryLabel(f.category).toUpperCase()} · {STATE_LABEL[f.informationState]}
        </T>
        <T variant="small" muted>
          {[f.sourceStartTime !== undefined ? formatDuration(f.sourceStartTime) : null, codes ? `Transcript ${codes}` : null].filter(Boolean).join(' · ')}
        </T>
      </Row>
      <T style={{ fontWeight: '600', textDecorationLine: isCurrent(f) ? 'none' : 'line-through' }}>{flagged ? f.value : renderFact(f).replace(/ \([^)]*\)$/, '')}</T>
      <T variant="small" muted>{f.provenance}</T>
      <FactChips f={f} />
      {flagged ? (
        <View>
          <T variant="small" muted>
            Not used in notes, evidence or views until you review it.
          </T>
        </View>
      ) : null}
      {isCurrent(f) && f.status === 'PROVISIONAL' && (onConfirm || onReject) ? (
        <Row>
          {onConfirm ? <Button compact kind="secondary" label="Confirm" icon="check" onPress={onConfirm} style={{ flex: 1 }} /> : null}
          {onReject ? <Button compact kind="ghost" label="Reject" icon="close" onPress={onReject} style={{ flex: 1 }} /> : null}
        </Row>
      ) : null}
    </Card>
  );
}
