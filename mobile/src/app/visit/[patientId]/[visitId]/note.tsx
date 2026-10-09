/**
 * Screen 14 — Note Editor. Drafts are rendered by code from eligible facts (ADR-043); every edit is a version;
 * "Finalize note" never confirms facts (CS-25) and shows the unreviewed count. Autosave; export with draft marker.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { needsReconciliation } from '../../../../domain/consultation';
import { exportNote } from '../../../../domain/export';
import { addNoteVersion, finalizeNote } from '../../../../domain/note';
import type { NoteType } from '../../../../domain/types';
import { formatDateTime } from '../../../../domain/util';
import { unreviewedCount } from '../../../../domain/views';
import { Banner, Button, Card, Chip, Loading, Row, Screen, Section, Segmented, T } from '../../../../presentation/components';
import { showError, useApp, useVisit } from '../../../../presentation/AppContext';
import { askExport } from '../../../../presentation/exportUi';
import { radius, space, useTheme } from '../../../../presentation/theme';

const SOURCE_LABEL: Record<string, string> = {
  SYSTEM_DRAFT: 'Draft rendered from documented facts — review before finalizing',
  AI_DRAFT: 'AI draft — review before finalizing',
  MANUAL_DRAFT: 'Manual draft',
  CLINICIAN_EDIT: 'Edited by clinician',
  CLINICIAN_FINALIZED: 'Finalized by clinician',
};

export default function NoteEditor() {
  const { c } = useTheme();
  const { app, settings } = useApp();
  const { patientId, visitId } = useLocalSearchParams<{ patientId: string; visitId: string }>();
  const { patient, visit, all, error, mutate } = useVisit(patientId, visitId);
  const [typeChoice, setType] = useState<NoteType | null>(null);
  const [edited, setText] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const latest = visit?.noteVersions[visit.noteVersions.length - 1];
  // the editor shows the clinician's unsaved text, else the latest saved version
  const text = edited ?? latest?.content ?? null;
  const type = typeChoice ?? latest?.noteType ?? settings.defaultNoteType;

  const save = async (content: string) => {
    await mutate((v) => {
      const l = v.noteVersions[v.noteVersions.length - 1];
      if (l && l.source === 'CLINICIAN_EDIT' && v.noteState !== 'FINALIZED') {
        l.content = content;
        l.createdAt = new Date().toISOString();
      } else addNoteVersion(v, l?.noteType ?? type, content, 'CLINICIAN_EDIT');
    });
    setDirty(false);
    setSaved(`Saved ${formatDateTime(new Date().toISOString())}`);
  };

  useEffect(() => {
    if (!dirty || text === null) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(text).catch(() => setSaved('Autosave failed — your text is still here; tap Save.')), 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, dirty]);

  if (error) return <Screen><Banner tone="danger" message={error} /></Screen>;
  if (!patient || !visit || !all) return <Loading />;
  const n = unreviewedCount(visit);
  const conflicts = visit.conflicts.filter((x) => x.status === 'OPEN').length;
  const finalized = visit.noteState === 'FINALIZED';

  const generate = async () => {
    try {
      const v2 = await mutate((v, ctx) => {
        app.visits.draftNote(v, ctx.patient, ctx.all, type);
      });
      const l = v2?.noteVersions[v2.noteVersions.length - 1];
      if (l) setText(l.content);
      setDirty(false);
    } catch (e) {
      showError(e, 'The draft could not be generated. You can write the note manually.');
    }
  };

  const manual = async () => {
    const content = `${type === 'SOAP' ? 'SOAP note' : type === 'PROGRESS' ? 'Progress note' : 'Clinical note'} · ${patient.patientReference}\n\n`;
    await mutate((v) => void addNoteVersion(v, type, content, 'MANUAL_DRAFT')).catch(showError);
    setText(content);
  };

  const finalize = () =>
    Alert.alert('Finalize note?', `${n ? `${n} fact(s) are not yet reviewed — finalizing does not confirm them. ` : ''}${conflicts ? `${conflicts} conflict(s) remain open and stay marked in the note. ` : ''}The visit and note are saved on this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finalize note',
        onPress: async () => {
          try {
            if (timer.current) clearTimeout(timer.current);
            const v2 = await mutate((v) => void finalizeNote(v, text ?? ''));
            const l = v2?.noteVersions[v2.noteVersions.length - 1];
            if (l) setText(l.content);
            setDirty(false);
            setSaved('Note finalized and visit saved.');
          } catch (e) {
            showError(e);
          }
        },
      },
    ]);

  return (
    <Screen>
      {!latest ? (
        <Card>
          <T variant="h3">Create the note</T>
          <Segmented label="Note type" value={type} onChange={setType} options={[{ value: 'SOAP', label: 'SOAP' }, { value: 'GENERAL', label: 'General' }, { value: 'PROGRESS', label: 'Progress' }]} />
          <Button label="Generate draft from documented facts" icon="file-document-edit-outline" onPress={() => void generate()} />
          <Button kind="secondary" label="Write manually" icon="pencil-outline" onPress={() => void manual()} />
        </Card>
      ) : (
        <>
          <Row wrap>
            <Chip label={SOURCE_LABEL[latest.source]} tone={finalized ? 'success' : 'warning'} icon={finalized ? 'check-decagram' : 'file-document-edit-outline'} />
            <Chip label={`Version ${latest.versionNumber}`} tone="neutral" />
            {patient.isDemo ? <Chip label="DEMO DATA" tone="warning" /> : null}
          </Row>
          {n ? <Banner tone="warning" message={`${n} fact(s) not yet reviewed — finalizing does not confirm them.`} action={<Button compact kind="secondary" label="Review facts" onPress={() => router.push(`/visit/${patientId}/${visitId}/facts`)} />} /> : null}
          {conflicts ? <Banner tone="danger" message={`${conflicts} open conflict(s) — shown as conflicts in the note.`} /> : null}
          {needsReconciliation(visit) ? <Banner tone="warning" title="Conversation added since the facts were extracted" message={finalized ? 'This finalized note does not include it. Reconcile the visit, then amend the note (a new version).' : 'Reconcile the visit, then regenerate the draft to include it.'} action={<Button compact kind="secondary" label="Reconcile visit" icon="source-merge" onPress={() => router.push(`/visit/${patientId}/${visitId}/transcript?reconcile=1`)} />} /> : null}
          <TextInput
            accessibilityLabel="Note text"
            editable={!finalized}
            multiline
            value={text ?? ''}
            onChangeText={(t) => {
              setText(t);
              setDirty(true);
            }}
            style={{ minHeight: 360, borderWidth: 1, borderColor: c.glassBorder, borderRadius: radius.md, padding: space.md, color: c.text, backgroundColor: finalized ? c.glass : c.glassStrong, fontSize: 15, lineHeight: 22, textAlignVertical: 'top' }}
          />
          {saved ? <T variant="small" muted>{dirty ? 'Unsaved changes…' : saved}</T> : null}
          {!finalized ? (
            <>
              <Row>
                <Button kind="secondary" label="Save" icon="content-save-outline" disabled={!dirty} onPress={() => void save(text ?? '').catch(showError)} style={{ flex: 1 }} />
                <Button kind="secondary" label="Regenerate draft" icon="refresh" onPress={() => void generate()} style={{ flex: 1 }} />
              </Row>
              <Segmented label="Note type for regeneration" value={type} onChange={setType} options={[{ value: 'SOAP', label: 'SOAP' }, { value: 'GENERAL', label: 'General' }, { value: 'PROGRESS', label: 'Progress' }]} />
              <Button label="Finalize note" icon="check-decagram" onPress={finalize} accessibilityHint="Finalizing saves the note as final. It does not confirm any fact." />
            </>
          ) : (
            <>
              <Banner tone="success" title="Note finalized — visit saved" message={`Finalized ${formatDateTime(visit.finalizedAt)}. Unreviewed facts at finalize: ${visit.unreviewedFactCountAtFinalize ?? 0}.`} />
              <Button
                kind="secondary"
                label="Amend (new version)"
                icon="pencil-outline"
                onPress={() =>
                  void mutate((v) => void addNoteVersion(v, latest.noteType, latest.content.replace(/^FINALIZED BY CLINICIAN · [^\n]*\n/, 'DRAFT — review before finalizing\n'), 'CLINICIAN_EDIT')).then((v2) => {
                    const l = v2?.noteVersions[v2.noteVersions.length - 1];
                    if (l) setText(l.content);
                  })
                }
              />
              <Button kind="secondary" label="Back to patient" icon="account-outline" onPress={() => router.push(`/patient/${patientId}`)} />
            </>
          )}
          <Button
            kind="secondary"
            label={finalized ? 'Export note' : 'Export draft (marked DRAFT)'}
            icon="export-variant"
            onPress={() =>
              askExport(async () => {
                if (dirty && text !== null) await save(text);
                let doc = null as ReturnType<typeof exportNote> | null;
                await mutate((v) => {
                  doc = exportNote(patient, v);
                });
                if (!doc) throw new Error('Nothing to export.');
                return doc;
              })
            }
          />
          <Section title="Version history" right={<Button kind="ghost" compact label={showVersions ? 'Hide' : `Show (${visit.noteVersions.length})`} onPress={() => setShowVersions(!showVersions)} />}>
            {showVersions
              ? [...visit.noteVersions].reverse().map((nv) => (
                  <Card key={nv.versionId}>
                    <T variant="small" style={{ fontWeight: '700' }}>Version {nv.versionNumber} · {SOURCE_LABEL[nv.source]}</T>
                    <T variant="small" muted>{formatDateTime(nv.createdAt)} · {nv.noteType}</T>
                    <View>
                      <T variant="small" numberOfLines={4}>{nv.content}</T>
                    </View>
                  </Card>
                ))
              : null}
          </Section>
        </>
      )}
    </Screen>
  );
}
