/** Screen 17 — Search across patients, visits and notes. Offline; queries are never logged or sent. */
import { router } from 'expo-router';
import { useState } from 'react';
import { searchLocal, type SearchScope } from '../domain/search';
import { Banner, Card, Empty, Field, Loading, Screen, Segmented, T } from '../presentation/components';
import { useWorkspace } from '../presentation/AppContext';

export default function Search() {
  const ws = useWorkspace();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<SearchScope>('PATIENTS');
  if (!ws.patients && !ws.error) return <Loading />;
  const hits = ws.patients ? searchLocal(q, ws.patients, ws.visitsByPatient ?? {}, scope) : [];
  return (
    <Screen>
      <Field label="Search" value={q} onChangeText={setQ} placeholder="Reference, name, visit code or note text" autoFocus autoCapitalize="none" autoCorrect={false} />
      <Segmented label="Search scope" value={scope} onChange={setScope} options={[{ value: 'PATIENTS', label: 'Patients' }, { value: 'VISITS', label: 'Visits' }, { value: 'NOTES', label: 'Notes' }]} />
      {ws.error ? <Banner tone="danger" message={ws.error} /> : null}
      {q.trim() ? <T variant="small" muted>{hits.length} result(s)</T> : <T variant="small" muted>Searches only the records on this device.</T>}
      {q.trim() && !hits.length ? <Empty icon="magnify-close" title="No results" message="Try a patient reference such as P-000001, a visit code or a word from a note." /> : null}
      {hits.map((h, i) => (
        <Card key={`${h.kind}-${h.visitId ?? h.patientId}-${i}`} onPress={() => router.push(h.visitId ? (h.kind === 'NOTES' ? `/visit/${h.patientId}/${h.visitId}/note` : `/visit/${h.patientId}/${h.visitId}`) : `/patient/${h.patientId}`)}>
          <T style={{ fontWeight: '700' }}>{h.title}</T>
          <T variant="small" muted>{h.detail}</T>
        </Card>
      ))}
    </Screen>
  );
}
