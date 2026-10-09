/** Screen 5 — Timeline. Grouped by visit, category filter chips, provisional items labeled. */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { categoryLabel } from '../../../domain/note';
import { patientTimeline, type TimelineFilter } from '../../../domain/timeline';
import { formatDate, formatDuration } from '../../../domain/util';
import { Banner, Card, Chip, Empty, Loading, Row, Screen, T } from '../../../presentation/components';
import { usePatient } from '../../../presentation/AppContext';
import { provenanceText, STATE_LABEL } from '../../../presentation/labels';
import { radius, space, useTheme } from '../../../presentation/theme';

const FILTERS: { value: TimelineFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SYMPTOM', label: 'Symptoms' },
  { value: 'MEDICATION', label: 'Medications' },
  { value: 'INVESTIGATION', label: 'Investigations' },
  { value: 'VITAL_SIGN', label: 'Vitals' },
  { value: 'ASSESSMENT', label: 'Assessments (confirmed)' },
  { value: 'HISTORY', label: 'History' },
  { value: 'ALLERGY', label: 'Allergies' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
];

export default function Timeline() {
  const { c } = useTheme();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const { patient, visits, error } = usePatient(patientId);
  const [filter, setFilter] = useState<TimelineFilter>('ALL');
  if (error) return <Screen><Banner tone="danger" message={error} /></Screen>;
  if (!patient || !visits) return <Loading />;
  const tl = patientTimeline(visits, filter);
  return (
    <Screen>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {FILTERS.map((f) => {
          const on = f.value === filter;
          return (
            <Pressable key={f.value} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFilter(f.value)} style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.lg, justifyContent: 'center', backgroundColor: on ? c.primary : c.surface, borderWidth: 1, borderColor: on ? c.primary : c.border }}>
              <Text style={{ color: on ? c.primaryText : c.text, fontWeight: '600' }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {tl.length === 0 ? <Empty icon="timeline-outline" title="No visits yet" message="Events appear here after the first visit." /> : null}
      {tl.map(({ visit, events }) => (
        <View key={visit.visitId} style={{ gap: space.sm }}>
          <Pressable accessibilityRole="button" onPress={() => router.push(`/visit/${patientId}/${visit.visitId}`)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T variant="h3" style={{ color: c.primary }}>
              {formatDate(visit.startedAt)} · {visit.visitCode} ›
            </T>
          </Pressable>
          {events.length === 0 ? <T muted variant="small">No documented events in this category.</T> : null}
          {events.map(({ fact, text, provisional }) => (
            <Card
              key={fact.factId}
              onPress={() => router.push(`/visit/${patientId}/${visit.visitId}/fact/${fact.factId}`)}
              accessibilityLabel={`${formatDate(visit.startedAt)}, ${categoryLabel(fact.category)}, ${STATE_LABEL[fact.informationState]}, ${provenanceText(fact)}${provisional ? ', provisional' : ''}`}
              style={{ borderLeftWidth: 4, borderLeftColor: provisional ? c.warning : c.success }}
            >
              <T variant="small" muted>
                {categoryLabel(fact.category).toUpperCase()}
                {fact.sourceStartTime !== undefined ? ` · ${formatDuration(fact.sourceStartTime)}` : ''}
              </T>
              <T>{text}</T>
              <Row wrap>{provisional ? <Chip label="Provisional" tone="warning" icon="progress-question" /> : <Chip label="Confirmed" tone="success" icon="check-circle" />}</Row>
            </Card>
          ))}
        </View>
      ))}
    </Screen>
  );
}
