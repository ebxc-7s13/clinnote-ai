/** Screen 20 — About. No regulatory or validation claims. */
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { APP_VARIANT } from '../application/container';
import { PROJECT_LINKS } from '../application/links';
import { Button, Card, KeyValue, Screen, Section, T } from '../presentation/components';
import { useApp } from '../presentation/AppContext';

export default function About() {
  const { updateSettings } = useApp();
  return (
    <Screen>
      <T variant="title">ClinNote</T>
      <Card>
        <T>ClinNote is a documentation and evidence-review assistant. It does not diagnose or prescribe. It is not clinically validated and has no regulatory approval.</T>
        <T variant="small" muted>ClinNote is not a medical device and does not diagnose, treat, cure or prevent any medical condition. It is intended for healthcare professionals. For medical advice, diagnosis or treatment, consult a qualified healthcare professional.</T>
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
          <T variant="small">ClinNote is open-source software under the MIT License, provided without warranty. Built with React Native, Expo, Expo Router, zod and @noble/ciphers (MIT licensed), and Material Design Icons (Apache 2.0). Public data from the U.S. National Library of Medicine (RxNorm, DailyMed, PubMed, MedlinePlus, ClinicalTrials.gov, PubChem), openFDA and Europe PMC; each record links to its source.</T>
          <Button kind="ghost" compact icon="open-in-new" label="Third-party notices" onPress={() => void Linking.openURL(PROJECT_LINKS.notices).catch(() => undefined)} />
        </Card>
      </Section>
      <Section title="Support">
        <Card>
          <T variant="small">Report bugs and request improvements on GitHub Issues. Never include real patient information. Report security problems privately (see the security policy).</T>
          <Button kind="ghost" compact icon="open-in-new" label="Report an issue" onPress={() => void Linking.openURL(PROJECT_LINKS.issues).catch(() => undefined)} />
          <Button kind="ghost" compact icon="open-in-new" label="Security policy" onPress={() => void Linking.openURL(PROJECT_LINKS.security).catch(() => undefined)} />
          <Button kind="ghost" compact icon="open-in-new" label="Releases and source code" onPress={() => void Linking.openURL(PROJECT_LINKS.releases).catch(() => undefined)} />
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
