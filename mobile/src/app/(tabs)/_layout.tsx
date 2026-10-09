import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../presentation/theme';

export default function TabsLayout() {
  const { c } = useTheme();
  // the tab bar must sit above the Android navigation bar (3-button navigation has a tall inset)
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.header },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.bar, borderTopColor: c.glassBorder, borderTopWidth: 1, height: 64 + insets.bottom, paddingBottom: 8 + insets.bottom, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        sceneStyle: { backgroundColor: c.bgGradient[0] },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: 'ClinNote', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home-outline" size={24} color={color} /> }} />
      <Tabs.Screen name="patients" options={{ title: 'Patients', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account-multiple-outline" size={24} color={color} /> }} />
      <Tabs.Screen name="visits" options={{ title: 'Visits', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="clipboard-text-clock-outline" size={24} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cog-outline" size={24} color={color} /> }} />
    </Tabs>
  );
}
