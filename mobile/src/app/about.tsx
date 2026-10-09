/** Screen 20 — About. No regulatory or validation claims. */
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { APP_VARIANT } from '../application/container';
import { Button, Card, KeyValue, Screen, Section, T } from '../presentation/components';
import { useApp } from '../presentation/AppContext';

export default function About() {
  const { updateSettings } = useApp();
  return (
    <Screen>
      <T variant="title">ClinNote</T>
      <Card>
        <T>ClinNote is a documentation and evidence-review assistant. It does not diagnose or prescribe. It is not clinically validated and has no regulatory approval.</T>
      </Card>
      <Section title="Version">
        <Card>
          <KeyValue k="App version" v={Constants.expoConfig?.version} />
          <KeyValue k="Build variant" v={APP_VARIANT} />
          <KeyValue k="Runtime" v={`Expo SDK ${Constants.expoConfig?.sdkVersion ?? '—'}`} />
        </Card>
      </Section>
      <Section title="Open-source notices">
        <Card>
          <T variant="small">Built with React Native, Expo, Expo Router, zod and @noble/ciphers (MIT licensed), and Material Design Icons (Apache 2.0). Public data from the U.S. National Library of Medicine (RxNorm, DailyMed, PubMed, MedlinePlus, ClinicalTrials.gov, PubChem), openFDA and Europe PMC; each record links to its source.</T>
        </Card>
      </Section>
      <Section title="Support">
        <Card>
          <T variant="small">Support contact: to be published by the project owner before release.</T>
        </Card>
      </Section>
      <Button
        kind="secondary"
        label="Show onboarding again"
        icon="school-outline"
        onPress={() => {
          void updateSettings({ onboardingAcknowledgedAt: undefined });
          router.replace('/onboarding');
        }}
      />
    </Screen>
  );
}
