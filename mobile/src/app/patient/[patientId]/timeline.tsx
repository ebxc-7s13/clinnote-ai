/** Screen 5 — Timeline. Vertical rail grouped by visit (newest first), category filters, provisional items labeled. */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { categoryLabel } from '../../../domain/note';
import { patientTimeline, type TimelineFilter } from '../../../domain/timeline';
import type { FactCategory } from '../../../domain/types';
import { formatDate, formatDateTime, formatDuration } from '../../../domain/util';
import { Banner, Card, Chip, Empty, glassStyle, haptic, Icon, Loading, Row, Screen, T, type IconName } from '../../../presentation/components';
import { usePatient } from '../../../presentation/AppContext';
import { NOTE_STATE_LABEL, provenanceText, STATE_LABEL } from '../../../presentation/labels';
import { space, useTheme } from '../../../presentation/theme';

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

const CAT_ICON: Partial<Record<FactCategory, IconName>> = {
  SYMPTOM: 'stethoscope',
  MEDICATION: 'pill',
  INVESTIGATION: 'test-tube',
  VITAL_SIGN: 'heart-pulse',
  ASSESSMENT: 'clipboard-text-outline',
  ALLERGY: 'alert-decagram-outline',
  FOLLOW_UP: 'calendar-check-outline',
  HISTORY_MEDICAL: 'history',
  HISTORY_SURGICAL: 'history',
  HISTORY_FAMILY: 'account-group-outline',
  HISTORY_SOCIAL: 'account-outline',
};

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
            <Pressable key={f.value} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { haptic('select'); setFilter(f.value); }} style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? c.primary : c.glassStrong, borderWidth: 1, borderColor: on ? c.primary : c.glassBorder }}>
              <Text style={{ color: on ? c.primaryText : c.text, fontWeight: '700' }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {tl.length === 0 ? <Empty icon="timeline-outline" title="No visits yet" message="Events appear here after the first visit." /> : null}
      {tl.map(({ visit, events }, vi) => (
        <View key={visit.visitId} style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ alignItems: 'center', width: 34 }}>
            <View style={{ ...glassStyle(c, true), width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderColor: c.primary }}>
              <Icon name="calendar-month-outline" size={18} color={c.primary} />
            </View>
            {vi < tl.length - 1 || events.length ? <View style={{ flex: 1, width: 2, backgroundColor: c.primary, opacity: 0.25, minHeight: 24 }} /> : null}
          </View>
          <View style={{ flex: 1, gap: space.sm, paddingBottom: space.lg }}>
            <Pressable accessibilityRole="button" onPress={() => router.push(`/visit/${patientId}/${visit.visitId}`)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T variant="h3" style={{ color: c.primary }}>
                {formatDate(visit.startedAt)} · {visit.visitCode} ›
              </T>
              <T variant="small" muted>
                {formatDateTime(visit.startedAt).slice(-5)} · {visit.mode === 'AMBIENT' ? `${visit.recordingSegments.length} segment(s) · ${formatDuration(visit.recordingDurationSec)}` : 'manual'} · {NOTE_STATE_LABEL[visit.noteState]}
              </T>
            </Pressable>
            {events.length === 0 ? <T muted variant="small">No documented events in this category.</T> : null}
            {events.map(({ fact, text, provisional }) => (
              <Card
                key={fact.factId}
                onPress={() => router.push(`/visit/${patientId}/${visit.visitId}/fact/${fact.factId}`)}
                accessibilityLabel={`${formatDate(visit.startedAt)}, ${categoryLabel(fact.category)}, ${STATE_LABEL[fact.informationState]}, ${provenanceText(fact)}${provisional ? ', provisional' : ''}`}
                style={{ padding: space.md, borderLeftWidth: 4, borderLeftColor: provisional ? c.warning : c.success }}
              >
                <Row>
                  <Icon name={CAT_ICON[fact.category] ?? 'circle-small'} size={16} color={provisional ? c.warning : c.success} />
                  <T variant="small" muted style={{ flex: 1 }}>
                    {categoryLabel(fact.category).toUpperCase()}
                    {fact.sourceStartTime !== undefined ? ` · ${formatDuration(fact.sourceStartTime)}` : ''}
                  </T>
                </Row>
                <T>{text}</T>
                <Row wrap>{provisional ? <Chip label="Provisional" tone="warning" icon="progress-question" /> : <Chip label="Confirmed" tone="success" icon="check-circle" />}</Row>
              </Card>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}
