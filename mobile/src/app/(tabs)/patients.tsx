/** Screen 3 — Patients. Sticky search, virtualized list, local only. */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import type { PatientIndexEntry } from '../../domain/types';
import { formatDate } from '../../domain/util';
import { Banner, Button, Card, DemoBadge, Empty, Field, Loading, Row, T } from '../../presentation/components';
import { useApp } from '../../presentation/AppContext';
import { space, useTheme } from '../../presentation/theme';

export default function Patients() {
  const { c } = useTheme();
  const { app } = useApp();
  const [list, setList] = useState<PatientIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      setList(await app.store.listPatients());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read patients.');
    }
  }, [app]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list ?? []).filter((p) => !s || `${p.patientReference} ${p.name ?? ''}`.toLowerCase().includes(s));
  }, [list, q]);

  if (!list && !error) return <Loading />;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.sm }}>
        <Field label="Search patients" placeholder="Reference (P-000001) or name" value={q} onChangeText={setQ} autoCorrect={false} autoCapitalize="none" />
        {error ? <Banner tone="danger" message={error} action={<Button compact kind="secondary" label="Retry" onPress={() => void load()} />} /> : null}
        <T variant="small" muted>{filtered.length} patient(s)</T>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.patientId}
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.sm, paddingBottom: 120 }}
        ListEmptyComponent={<Empty icon="account-search-outline" title={list?.length ? 'No matching patients' : 'No patients'} message={list?.length ? 'Try another reference or name.' : 'Create a patient to start documenting visits.'} />}
        renderItem={({ item: p }) => (
          <Card onPress={() => router.push(`/patient/${p.patientId}`)} accessibilityLabel={`Patient ${p.patientReference}${p.age !== undefined ? `, ${p.age} years` : ''}${p.sex ? `, ${p.sex.toLowerCase()}` : ''}, last visit ${p.lastVisitAt ? formatDate(p.lastVisitAt) : 'none'}`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T style={{ fontWeight: '700' }}>{p.patientReference}{p.name ? ` · ${p.name}` : ''}</T>
              <T variant="small" muted>{p.lastVisitAt ? formatDate(p.lastVisitAt) : 'no visits'}</T>
            </Row>
            <Row wrap>
              <T variant="small" muted>{[p.age !== undefined ? `${p.age} y` : null, p.sex?.toLowerCase(), `${p.visitCount} visit(s)`].filter(Boolean).join(' · ')}</T>
              {p.isDemo ? <DemoBadge /> : null}
            </Row>
          </Card>
        )}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, backgroundColor: c.bg }}>
        <Button label="New patient" icon="account-plus" onPress={() => router.push('/patient/new')} />
      </View>
    </View>
  );
}
