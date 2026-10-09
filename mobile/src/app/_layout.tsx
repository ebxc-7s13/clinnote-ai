import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Banner, Loading, T } from '../presentation/components';
import { AppProvider, useApp } from '../presentation/AppContext';
import { light, space, ThemeContext, useResolvedPalette } from '../presentation/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function BootFallback({ err }: { err: string | null }) {
  if (!err) return <Loading label="Opening secure storage…" />;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, gap: space.md, backgroundColor: light.bg }}>
      <T variant="title">ClinNote cannot open</T>
      <Banner tone="danger" title="Local data unavailable" message={err} />
      <T muted>Nothing was deleted. Restart the app to try again.</T>
    </View>
  );
}

function ThemedStack() {
  const { settings } = useApp();
  const theme = useResolvedPalette(settings.theme);
  const { c } = theme;
  const onboarded = !!settings.onboardingAcknowledgedAt;
  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ title: 'Search' }} />
          <Stack.Screen name="followups" options={{ title: 'Follow-up' }} />
          <Stack.Screen name="patient/new" options={{ title: 'Patient' }} />
          <Stack.Screen name="patient/[patientId]/index" options={{ title: 'Patient' }} />
          <Stack.Screen name="patient/[patientId]/timeline" options={{ title: 'Timeline' }} />
          <Stack.Screen name="visit/start" options={{ title: 'Start visit' }} />
          <Stack.Screen name="visit/[patientId]/[visitId]/index" options={{ title: 'Visit' }} />
          <Stack.Screen name="visit/[patientId]/[visitId]/consent" options={{ title: 'Consent' }} />
          <Stack.Screen name="visit/[patientId]/[visitId]/record" options={{ title: 'Recording', gestureEnabled: false }} />
          <Stack.Screen name="visit/[patientId]/[visitId]/transcript" options={{ title: 'Transcript' }} />
          <Stack.Screen name="visit/[patientId]/[visitId]/facts" options={{ title: 'Clinical facts' }} />
          <Stack.Screen name="visit/[patientId]/[visitId]/fact/[factId]" options={{ title: 'Fact' }} />
          <Stack.Screen name="visit/[patientId]/[visitId]/review" options={{ title: 'Clinical review' }} />
          <Stack.Screen name="visit/[patientId]/[visitId]/evidence" options={{ title: 'Evidence' }} />
          <Stack.Screen name="visit/[patientId]/[visitId]/medications" options={{ title: 'Medications' }} />
          <Stack.Screen name="visit/[patientId]/[visitId]/medication/[factId]" options={{ title: 'Medication information' }} />
          <Stack.Screen name="visit/[patientId]/[visitId]/note" options={{ title: 'Note' }} />
          <Stack.Screen name="visit/[patientId]/[visitId]/compare" options={{ title: 'What changed' }} />
          <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
          <Stack.Screen name="about" options={{ title: 'About' }} />
        </Stack.Protected>
      </Stack>
    </ThemeContext.Provider>
  );
}

export default function RootLayout() {
  const hide = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <SafeAreaProvider>
      <AppProvider onReady={hide} fallback={(err) => <BootFallback err={err} />}>
        <ThemedStack />
      </AppProvider>
    </SafeAreaProvider>
  );
}
