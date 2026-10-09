/** Screen 18 — Settings (FR-28). Cloud processing off = manual mode: no data leaves the device. */
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, Switch } from 'react-native';
import { destroyDataKey, R2_SELECTABLE, APP_VARIANT } from '../../application/container';
import { purgeOldAudio } from '../../infrastructure/storage/expoFileBackend';
import { backendConfig, FREE_ONLY_MODE } from '../../providers/backend';
import { Banner, Button, Card, Chip, Row, Screen, Section, Segmented, T } from '../../presentation/components';
import { showError, useApp } from '../../presentation/AppContext';
import { useTheme } from '../../presentation/theme';

function Toggle({ label, value, onChange, hint, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', minHeight: 48 }}>
      <Card style={{ flex: 1, padding: 0, borderWidth: 0, backgroundColor: 'transparent' }}>
        <T style={{ fontWeight: '600' }}>{label}</T>
        {hint ? <T variant="small" muted>{hint}</T> : null}
      </Card>
      <Switch accessibilityLabel={`${label}: ${value ? 'on' : 'off'}`} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: c.primary, false: c.border }} />
    </Row>
  );
}

export default function Settings() {
  const { app, settings, updateSettings } = useApp();
  const cfg = backendConfig();

  const deleteAll = () =>
    Alert.alert('Delete all local data?', 'Every patient, visit, note and cached evidence record on this device is deleted and the encryption key is destroyed. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything',
        style: 'destructive',
        onPress: async () => {
          try {
            await app.store.deleteAll();
            purgeOldAudio(0);
            await destroyDataKey();
            Alert.alert('Deleted', 'All local data was deleted. Restart ClinNote to begin again.');
          } catch (e) {
            showError(e);
          }
        },
      },
    ]);

  return (
    <Screen>
      <Section title="Processing">
        <Card>
          <Toggle
            label="Cloud processing (transcription, AI and evidence search)"
            hint={settings.cloudProcessingEnabled ? 'On: audio/transcript text go to the configured backend; clinical terms go to public evidence sources. Names and patient references are never sent.' : 'Off: manual mode. Nothing leaves this device.'}
            value={settings.cloudProcessingEnabled}
            onChange={(v) => void updateSettings({ cloudProcessingEnabled: v })}
          />
          <Row wrap>
            <Chip label={cfg.url ? 'Cloud AI backend configured' : 'Cloud AI backend not configured'} tone={cfg.url ? 'success' : 'neutral'} icon={cfg.url ? 'cloud-check-outline' : 'cloud-off-outline'} />
            <Chip label={FREE_ONLY_MODE ? 'Free-only mode: no paid services or fallbacks' : 'Paid mode'} tone="info" icon="currency-usd-off" />
          </Row>
          {!cfg.url ? <T variant="small" muted>Without a backend, live on-device transcription, rule-based extraction and public evidence sources still work when cloud processing is on.</T> : <T variant="small" muted>Cloud AI (free tier) is used for synthetic demo patients only; its terms allow submitted content to improve the provider’s products.</T>}
        </Card>
      </Section>

      <Section title="Notes and display">
        <Card>
          <T variant="small" muted>Default note type</T>
          <Segmented label="Default note type" value={settings.defaultNoteType} onChange={(v) => void updateSettings({ defaultNoteType: v })} options={[{ value: 'SOAP', label: 'SOAP' }, { value: 'GENERAL', label: 'General' }, { value: 'PROGRESS', label: 'Progress' }]} />
          <T variant="small" muted>Appearance</T>
          <Segmented label="Appearance" value={settings.theme} onChange={(v) => void updateSettings({ theme: v })} options={[{ value: 'SYSTEM', label: 'System' }, { value: 'LIGHT', label: 'Light' }, { value: 'DARK', label: 'Dark' }]} />
        </Card>
      </Section>

      {R2_SELECTABLE ? (
        <Section title="Development features">
          <Card>
            <Toggle
              label="Possibilities to review (R2, development only)"
              hint="Default off. Not released before a formal regulatory assessment (ADR-025). Runs only with cited evidence; never enters notes or exports. Synthetic data only."
              value={settings.devPossibilitiesEnabled}
              onChange={(v) => void updateSettings({ devPossibilitiesEnabled: v })}
            />
            <T variant="small" muted>Build variant: {APP_VARIANT}</T>
          </Card>
        </Section>
      ) : null}

      <Section title="Data">
        <Card>
          <T variant="small">Temporary audio is kept in the app cache only until the final transcript is made, and never longer than 24 hours. No voiceprints are stored.</T>
          <Button
            kind="secondary"
            label="Delete temporary audio now"
            icon="delete-sweep-outline"
            onPress={() => {
              const n = purgeOldAudio(0);
              Alert.alert('Temporary audio', n ? `${n} temporary audio file(s) deleted.` : 'No temporary audio is stored.');
            }}
          />
          <Button kind="danger" label="Delete all local data" icon="delete-forever-outline" onPress={deleteAll} />
        </Card>
      </Section>

      <Section title="Information">
        <Button kind="secondary" label="Privacy" icon="shield-lock-outline" onPress={() => router.push('/privacy')} />
        <Button kind="secondary" label="About ClinNote" icon="information-outline" onPress={() => router.push('/about')} />
        <T variant="small" muted>Version {Constants.expoConfig?.version ?? '—'}</T>
      </Section>
      {!settings.cloudProcessingEnabled ? <Banner tone="info" message="Manual mode is active. Patients, visits, timeline, notes, search and export work fully offline." /> : null}
    </Screen>
  );
}
