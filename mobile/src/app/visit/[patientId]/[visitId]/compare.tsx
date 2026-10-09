/**
 * Visit Comparison (FR-25, ARCHITECTURE §6.6). Deterministic diff of eligible facts against the previous visit;
 * changed values always show both stated values with dates; absence is "not discussed this visit"; open
 * conflicts are listed as conflicts. No AI is involved.
 */
import { useLocalSearchParams } from 'expo-router';
import { compareVisits, type DiffKind } from '../../../../domain/diff';
import { categoryLabel } from '../../../../domain/note';
import { formatDate } from '../../../../domain/util';
import { Banner, Card, Chip, Empty, Loading, Row, Screen, Section, T } from '../../../../presentation/components';
import { useVisit } from '../../../../presentation/AppContext';

const TITLES: Record<DiffKind, string> = {
  CHANGED: 'Changed',
  STATE_CHANGED: 'Stated differently',
  NEW: 'New this visit',
  NOT_DISCUSSED_NOW: 'Not discussed this visit',
  UNCHANGED: 'Documented again',
};

export default function Compare() {
  const { patientId, visitId } = useLocalSearchParams<{ patientId: string; visitId: string }>();
  const { visit, all, error } = useVisit(patientId, visitId);
  if (error) return <Screen><Banner tone="danger" message={error} /></Screen>;
  if (!visit || !all) return <Loading />;
  const prev = all.filter((v) => v.startedAt < visit.startedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt)).pop();
  if (!prev) return <Screen><Empty icon="compare-horizontal" title="No previous visit" message="Comparison is available from the second visit." /></Screen>;
  const diff = compareVisits(prev, visit);
  const crossConflicts = visit.conflicts.filter((c) => c.status === 'OPEN' && c.conflictType === 'CROSS_VISIT');
  const kinds: DiffKind[] = ['CHANGED', 'STATE_CHANGED', 'NEW', 'NOT_DISCUSSED_NOW', 'UNCHANGED'];
  return (
    <Screen>
      <Card>
        <T variant="h2">What changed since last visit?</T>
        <T muted>{prev.visitCode} ({formatDate(prev.startedAt)}) → {visit.visitCode} ({formatDate(visit.startedAt)})</T>
        <T variant="small" muted>Computed by code from documented facts only. No change is inferred; absence means not discussed.</T>
      </Card>
      {crossConflicts.length ? <Banner tone="danger" title="Conflict — review" message={`${crossConflicts.length} statement(s) conflict with the earlier visit. Both are kept; review them in Clinical facts.`} /> : null}
      {diff.length === 0 ? <Empty icon="equal" title="No documented facts to compare" message="Extract or enter facts in both visits." /> : null}
      {kinds.map((k) => {
        const items = diff.filter((d) => d.kind === k);
        if (!items.length) return null;
        return (
          <Section key={k} title={TITLES[k]}>
            {items.map((d, i) => (
              <Card key={i}>
                <T variant="small" muted>{categoryLabel(d.category).toUpperCase()}</T>
                <T>{d.text}</T>
                <Row wrap>{d.provisional ? <Chip label="Provisional — not reviewed" tone="warning" icon="progress-question" /> : <Chip label="Confirmed" tone="success" icon="check-circle" />}</Row>
              </Card>
            ))}
          </Section>
        );
      })}
    </Screen>
  );
}
