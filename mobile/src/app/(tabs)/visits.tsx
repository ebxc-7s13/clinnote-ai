/** Screen 21 — Visits across patients, with stage status in words and a "needs review" filter. */
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { formatDateTime } from '../../domain/util';
import { unreviewedCount } from '../../domain/views';
import { BottomBar, Banner, Button, Card, Chip, Empty, Loading, Row, Segmented, T } from '../../presentation/components';
import { useWorkspace } from '../../presentation/AppContext';
import { visitStatusLine } from '../../presentation/labels';
import { space, useTheme } from '../../presentation/theme';

type Filter = 'ALL' | 'REVIEW' | 'DRAFT';

export default function Visits() {
  const { c } = useTheme();
  const ws = useWorkspace();
  const [filter, setFilter] = useState<Filter>('ALL');
  if (!ws.patients && !ws.error) return <Loading />;
  const refOf = (id: string) => ws.patients?.find((p) => p.patientId === id)?.patientReference ?? '';
  const visits = Object.values(ws.visitsByPatient ?? {})
    .flat()
    .filter((v) => (filter === 'REVIEW' ? unreviewedCount(v) > 0 || v.conflicts.some((x) => x.status === 'OPEN') : filter === 'DRAFT' ? v.noteState !== 'FINALIZED' : true))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm }}>
        <Segmented label="Filter visits" value={filter} onChange={setFilter} options={[{ value: 'ALL', label: 'All' }, { value: 'REVIEW', label: 'Needs review' }, { value: 'DRAFT', label: 'Not finalized' }]} />
        {ws.error ? <Banner tone="danger" message={ws.error} action={<Button compact kind="secondary" label="Retry" onPress={() => void ws.reload()} />} /> : null}
      </View>
      <FlatList
        data={visits}
        keyExtractor={(v) => v.visitId}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.sm, paddingBottom: 120 }}
        ListEmptyComponent={<Empty icon="clipboard-text-outline" title="No visits yet — start a visit" message="Visits appear here with their processing and note status." />}
        renderItem={({ item: v }) => {
          const n = unreviewedCount(v);
          const conflicts = v.conflicts.filter((x) => x.status === 'OPEN').length;
          return (
            <Card onPress={() => router.push(`/visit/${v.patientId}/${v.visitId}`)} accessibilityLabel={`${formatDateTime(v.startedAt)}, ${refOf(v.patientId)}, ${v.noteState.toLowerCase()} note, ${n} unreviewed, ${conflicts} open conflicts`}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T style={{ fontWeight: '700' }}>{refOf(v.patientId)} · {v.visitCode}</T>
                <T variant="small" muted>{formatDateTime(v.startedAt)}</T>
              </Row>
              <T variant="small" muted>{v.mode === 'AMBIENT' ? 'Recorded' : 'Manual'} · {visitStatusLine(v)}</T>
              <Row wrap>
                {n ? <Chip label={`${n} not yet reviewed`} tone="warning" icon="progress-question" /> : null}
                {conflicts ? <Chip label={`${conflicts} conflict(s) — review`} tone="danger" icon="alert-outline" /> : null}
                {v.noteState === 'FINALIZED' ? <Chip label="Note finalized" tone="success" icon="check-circle" /> : null}
              </Row>
            </Card>
          );
        }}
      />
      <BottomBar inTabs>
        <Button label="Start new visit" icon="plus-circle-outline" onPress={() => router.push('/visit/start')} />
      </BottomBar>
    </View>
  );
}
