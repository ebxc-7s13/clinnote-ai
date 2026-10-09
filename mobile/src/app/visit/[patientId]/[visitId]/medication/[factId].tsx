/**
 * Screen 13 — Medication Information. RxNorm normalization (exact match or clinician-selected candidate only,
 * CS-11), then DailyMed / openFDA / Drugs@FDA / recall records with source links. Raw wording is never sent
 * (only the sanitized term) and is always retained. Doses are never altered.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { sanitizeTerm } from '../../../../../domain/evidence';
import { confirmFact, rejectFact } from '../../../../../domain/facts';
import { rxnormNormalize } from '../../../../../providers/evidence/adapters';
import { Banner, Button, Card, Icon, KeyValue, Loading, Row, Screen, Section, T } from '../../../../../presentation/components';
import { showError, useApp, useVisit } from '../../../../../presentation/AppContext';
import { FactChips } from '../../../../../presentation/FactRow';
import { space, useTheme } from '../../../../../presentation/theme';
import { EvidenceCard } from '../../../../../presentation/EvidenceCard';

export default function MedicationInfo() {
  const { c } = useTheme();
  const { app, settings } = useApp();
  const { patientId, visitId, factId } = useLocalSearchParams<{ patientId: string; visitId: string; factId: string }>();
  const { patient, visit, error, mutate } = useVisit(patientId, visitId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (error) return <Screen><Banner tone="danger" message={error} /></Screen>;
  if (!patient || !visit) return <Loading />;
  const f = visit.facts.find((x) => x.factId === factId);
  if (!f) return <Screen><Banner tone="warning" message="Medication not found." /></Screen>;
  const a = f.attributes;
  const records = visit.evidence.filter((e) => e.sourceFactIds.includes(f.factId) || (a.rxcui && e.retrievedFor.includes(`RxCUI ${a.rxcui}`)));

  const lookup = async () => {
    if (!settings.cloudProcessingEnabled) return setMsg('Cloud processing is off, so nothing is sent. The medication is kept as entered.');
    const s = sanitizeTerm(a.rawName ?? f.value, patient);
    if (!s.ok) return setMsg(s.reason);
    setBusy(true);
    setMsg(null);
    try {
      const norm = await rxnormNormalize(s.term);
      await mutate(async (v) => {
        const ff = v.facts.find((x) => x.factId === f.factId)!;
        if (norm.exact) {
          const n = await app.evidence.selectRxcui(v, ff, norm.exact.rxcui, norm.exact.name);
          setMsg(n ? `${n} record(s) found.` : 'Exact RxNorm match; no label records found.');
        } else if (norm.candidates.length) {
          ff.attributes.normalizationCandidates = norm.candidates;
          ff.needsClarification = true;
          ff.clarificationReason = norm.candidates.length > 1 ? 'AMBIGUOUS_MEDICATION' : ff.clarificationReason;
          setMsg('Several possible matches. Select the correct one; nothing is chosen automatically.');
        } else setMsg('No match found — kept as entered.');
      });
    } catch {
      setMsg('Looking up failed (offline or the source is busy). The medication is kept as entered; retry later.');
    } finally {
      setBusy(false);
    }
  };

  const select = async (rxcui: string, name: string) => {
    setBusy(true);
    try {
      await mutate(async (v) => {
        const ff = v.facts.find((x) => x.factId === f.factId)!;
        const n = await app.evidence.selectRxcui(v, ff, rxcui, name);
        setMsg(n ? `${n} record(s) found.` : 'No label records found for this selection.');
      });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <T variant="title">{a.rawName ?? f.value}</T>
      <FactChips f={f} />
      <Card>
        <KeyValue k="Raw wording" v={f.value} />
        <KeyValue k="Normalized" v={a.normalizedName} />
        <KeyValue k="RxCUI" v={a.rxcui} />
        <KeyValue k="Dose (as stated)" v={a.dose ?? 'not stated'} />
        <KeyValue k="Frequency" v={a.frequency ?? 'not stated'} />
        <KeyValue k="Route" v={a.route ?? 'not stated'} />
        <KeyValue k="Status" v={(a.takingStatus ?? 'UNKNOWN').toLowerCase()} />
        {a.rxcui ? <T variant="small" muted>U.S. drug terminology (RxNorm)</T> : null}
      </Card>
      {msg ? <Banner tone="info" message={msg} /> : null}
      <Row>
        {f.status === 'PROVISIONAL' ? <Button compact label="Confirm" icon="check" style={{ flex: 1 }} disabled={f.needsClarification && f.clarificationReason === 'CONFLICT'} onPress={() => void mutate((v) => void confirmFact(v, f.factId)).catch(showError)} /> : null}
        <Button compact kind="secondary" label="Edit" icon="pencil-outline" style={{ flex: 1 }} onPress={() => router.push(`/visit/${patientId}/${visitId}/fact/${f.factId}`)} />
        {f.status !== 'REJECTED' ? <Button compact kind="ghost" label="Dismiss" icon="close" style={{ flex: 1 }} onPress={() => void mutate((v) => rejectFact(v, f.factId)).catch(showError)} /> : null}
      </Row>
      {!a.rxcui ? <Button label="Look up in RxNorm" icon="magnify" busy={busy} onPress={() => void lookup()} /> : <Button kind="secondary" label="Refresh label records" icon="refresh" busy={busy} onPress={() => void select(a.rxcui!, a.normalizedName ?? f.value)} />}

      {a.normalizationCandidates?.length && !a.rxcui ? (
        <Section title="Select the matching medication">
          {a.normalizationCandidates.map((cand) => (
            <Pressable key={cand.rxcui} accessibilityRole="radio" accessibilityLabel={`${cand.name}, RxCUI ${cand.rxcui}`} onPress={() => void select(cand.rxcui, cand.name)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, padding: space.md, borderWidth: 1, borderColor: c.border, borderRadius: 10, backgroundColor: c.surface }}>
              <Icon name="radiobox-blank" />
              <View style={{ flex: 1 }}>
                <T>{cand.name}</T>
                <T variant="small" muted>RxCUI {cand.rxcui}</T>
              </View>
            </Pressable>
          ))}
        </Section>
      ) : null}

      <Section title="Label and regulatory records" subtitle="U.S. regulatory information. Label information — not a dosing recommendation.">
        {records.length === 0 ? <T muted>{busy ? 'Looking up…' : 'No records retrieved yet.'}</T> : null}
        {records.map((e) => (
          <EvidenceCard key={e.evidenceId} e={e} />
        ))}
      </Section>
    </Screen>
  );
}
