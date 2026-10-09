/** Screen 19 — Privacy. Plain language; no legal compliance claims. */
import { router } from 'expo-router';
import { Button, Card, Screen, Section, T } from '../presentation/components';

const ITEMS: { title: string; body: string }[] = [
  { title: 'What stays on this device', body: 'Patient records, transcripts, facts, notes and the evidence cache are stored on this device only, encrypted with a key kept in Android secure storage. ClinNote has no clinical database in the cloud.' },
  { title: 'What is sent, and where', body: 'Only when cloud processing is on: (1) live speech is recognized by the Android speech service on this device, which may use Google services depending on the device; (2) if a ClinNote backend is configured, temporary audio and transcript text are sent to it for the final transcript and AI extraction (free-tier Google Gemini via the backend; the app holds no private keys); (3) clinical terms — never names, dates of birth, patient references or transcript sentences — are sent to public sources: NLM RxNorm, DailyMed, openFDA, PubMed, Europe PMC, MedlinePlus, ClinicalTrials.gov and PubChem.' },
  { title: 'Audio', body: 'Audio is temporary. It is kept in the app cache only until the final transcript is created and is deleted afterwards, never kept longer than 24 hours. No voiceprints are created or stored.' },
  { title: 'No analytics or tracking', body: 'ClinNote contains no analytics, advertising or crash-reporting SDK. Clinical text is never written to logs.' },
  { title: 'Exports', body: 'Exported files leave ClinNote’s protected storage. ClinNote cannot delete copies shared with other apps.' },
  { title: 'Deletion', body: 'Delete a visit or patient from its screen, or delete all local data in Settings. Deleting all data also destroys the encryption key.' },
  { title: 'Development', body: 'Development and testing use synthetic patients only. Demo records are labeled “DEMO DATA — NOT A REAL PATIENT”.' },
];

export default function Privacy() {
  return (
    <Screen>
      {ITEMS.map((i) => (
        <Section key={i.title} title={i.title}>
          <Card>
            <T>{i.body}</T>
          </Card>
        </Section>
      ))}
      <T variant="small" muted>This summary describes how the app works. It is not a statement of legal compliance. A public privacy policy will be linked here when published.</T>
      <Button kind="secondary" label="Open Settings" onPress={() => router.push('/settings')} />
    </Screen>
  );
}
