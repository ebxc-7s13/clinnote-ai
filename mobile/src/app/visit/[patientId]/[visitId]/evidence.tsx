/**
 * Screen 12 — Evidence. Source-linked records only, grouped by source type in deterministic order. Every card shows
 * source, identifier, URL, retrieval time and why it was retrieved. Nothing is generated: when nothing verified is
 * found the screen says so. Searches send clinical terms only (on-device sanitizer, ADR-036).
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { unmappedNotices } from '../../../../application/evidenceService';
import { GROUP_ORDER } from '../../../../domain/evidence';
import { Banner, Button, Card, Chip, Field, Loading, Row, Screen, Section, Segmented, T } from '../../../../presentation/components';
import { EvidenceCard } from '../../../../presentation/EvidenceCard';
import { showError, useApp, useVisit } from '../../../../presentation/AppContext';
import { SOURCE_TYPE_LABEL, STAGE_LABEL } from '../../../../presentation/labels';

type Kind = 'LITERATURE' | 'PATIENT_EDUCATION' | 'TRIALS' | 'CHEMICAL';

export default function Evidence() {
  const { app, settings } = useApp();
  const { patientId, visitId } = useLocalSearchParams<{ patientId: string; visitId: string }>();
  const { patient, visit, error, mutate } = useVisit(patientId, visitId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'info' | 'warning' | 'danger'; text: string } | null>(null);
  const [term, setTerm] = useState('');
  const [kind, setKind] = useState<Kind>('LITERATURE');
  if (error) return <Screen><Banner tone="danger" message={error} /></Screen>;
  if (!patient || !visit) return <Loading />;

  const runAuto = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await mutate(async (v) => {
        const r = await app.visits.runEvidence(v, patient, settings);
        if (r.message) setMsg({ tone: r.ok ? 'warning' : 'danger', text: r.message });
      });
    } catch (e) {
      showError(e, 'Evidence search failed. Your visit data is unchanged.');
    } finally {
      setBusy(false);
    }
  };
  const runManual = async () => {
    if (!settings.cloudProcessingEnabled) return setMsg({ tone: 'info', text: 'Cloud processing is off, so nothing is sent. Turn it on in Settings to search public sources.' });
    setBusy(true);
    setMsg(null);
    try {
      await mutate(async (v) => {
        const r = await app.evidence.runManual(v, patient, term, kind);
        setMsg(r.error ? { tone: 'danger', text: r.error } : { tone: 'info', text: r.added ? `${r.added} record(s) added.` : 'No verified evidence found for this search.' });
      });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const notices = unmappedNotices(visit);
  const groups = GROUP_ORDER.map((t) => ({ t, items: visit.evidence.filter((e) => e.sourceType === t) })).filter((g) => g.items.length);
  const failed = visit.evidenceQueries.filter((q) => q.state === 'FAILED');

  return (
    <Screen>
      <Row wrap>
        <Chip label={`Evidence ${STAGE_LABEL[visit.evidenceState]}`} tone={visit.evidenceState === 'COMPLETED' ? 'success' : visit.evidenceState === 'FAILED' ? 'danger' : 'neutral'} />
        <Chip label={`${visit.evidence.length} record(s)`} tone="neutral" />
      </Row>
      <T variant="small" muted>Searches use clinical terms from stated, current facts only — never names, patient references or transcript text. Negative or not-discussed findings are never searched as if present.</T>
      {msg ? <Banner tone={msg.tone} message={msg.text} /> : null}
      <Button label={visit.evidenceState === 'NOT_STARTED' ? 'Run evidence search' : 'Re-run evidence search'} icon="magnify" busy={busy} onPress={() => void runAuto()} />
      {busy ? <T muted>Searching RxNorm, DailyMed, openFDA, PubMed, Europe PMC and MedlinePlus…</T> : null}

      {failed.length ? (
        <Banner tone="warning" title="Some sources did not respond" message={failed.map((q) => `${q.provider} (${q.concepts.map((x) => x.term).join(', ')}): ${q.errorKind?.toLowerCase().replace(/_/g, ' ') ?? 'failed'}`).join('\n')} />
      ) : null}

      {visit.evidenceState !== 'NOT_STARTED' && visit.evidence.length === 0 && !busy ? (
        <Card>
          <T style={{ fontWeight: '700' }}>NO VERIFIED EVIDENCE FOUND</T>
          <T muted>No evidence found in the searched sources. Nothing was generated in its place.</T>
        </Card>
      ) : null}

      {groups.map((g) => (
        <Section key={g.t} title={SOURCE_TYPE_LABEL[g.t]}>
          {g.items.map((e) => (
            <EvidenceCard key={e.evidenceId} e={e} />
          ))}
        </Section>
      ))}

      <Section title="Reference images">
        <T variant="small" muted>Not shown: no image source with a verified reuse license is configured. {"Open the source link to view images on the publisher's site."}</T>
      </Section>

      {notices.length ? (
        <Section title="Not searched automatically">
          {notices.map((f) => (
            <Card key={f.factId}>
              <T variant="small">Not searched automatically: “{f.value}” {"(not in ClinNote's concept list). This does not mean the finding is absent or unimportant. You can run a manual search."}</T>
              <Button compact kind="secondary" label="Run a manual search" onPress={() => setTerm(f.value)} />
            </Card>
          ))}
        </Section>
      ) : null}

      <Section title="Manual search (clinician)">
        <Card>
          <Field label="Clinical term" value={term} onChangeText={setTerm} placeholder="e.g. chronic cough" autoCapitalize="none" hint="Checked on this device before sending. Names, dates, references and sentences are refused." />
          <Segmented label="Source" value={kind} onChange={setKind} options={[{ value: 'LITERATURE', label: 'PubMed' }, { value: 'PATIENT_EDUCATION', label: 'MedlinePlus' }, { value: 'TRIALS', label: 'Trials' }, { value: 'CHEMICAL', label: 'PubChem' }]} />
          <Button label="Search" icon="magnify" disabled={!term.trim()} busy={busy} onPress={() => void runManual()} />
        </Card>
      </Section>
    </Screen>
  );
}
