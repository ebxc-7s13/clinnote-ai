/** Design tokens (UI-UX.md §1–2): calm, clinical, high contrast; status never by colour alone. */
import { useColorScheme } from 'react-native';
import { createContext, useContext } from 'react';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
  info: string;
  infoSoft: string;
  recording: string;
  focus: string;
}

export const light: Palette = {
  bg: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F5',
  border: '#D5DCE3',
  text: '#14202B',
  textMuted: '#4F5D6B',
  primary: '#0B5C8A',
  primaryText: '#FFFFFF',
  primarySoft: '#E1EEF6',
  danger: '#B3261E',
  dangerSoft: '#FBE9E7',
  warning: '#8A5300',
  warningSoft: '#FFF3DC',
  success: '#1E6B3A',
  successSoft: '#E3F3E8',
  info: '#2F4F8F',
  infoSoft: '#E8EDF8',
  recording: '#C62828',
  focus: '#1B6FB3',
};

export const dark: Palette = {
  bg: '#0E1419',
  surface: '#161E25',
  surfaceAlt: '#1D2731',
  border: '#2E3B47',
  text: '#E8EEF3',
  textMuted: '#A7B4C0',
  primary: '#5DB0E6',
  primaryText: '#04121C',
  primarySoft: '#16334A',
  danger: '#FF8A80',
  dangerSoft: '#3A1A18',
  warning: '#FFC66D',
  warningSoft: '#3A2B10',
  success: '#7BD49A',
  successSoft: '#13301F',
  info: '#9DB4F0',
  infoSoft: '#1B2440',
  recording: '#FF6B6B',
  focus: '#7CC4F5',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, lg: 14 };
export const type = {
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.2 },
  h2: { fontSize: 18, fontWeight: '700' as const },
  h3: { fontSize: 15, fontWeight: '700' as const, letterSpacing: 0.2 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  mono: { fontSize: 13, fontFamily: 'monospace' },
};

export const ThemeContext = createContext<{ c: Palette; mode: 'light' | 'dark' }>({ c: light, mode: 'light' });

export function useResolvedPalette(pref: 'SYSTEM' | 'LIGHT' | 'DARK'): { c: Palette; mode: 'light' | 'dark' } {
  const sys = useColorScheme();
  const mode = pref === 'SYSTEM' ? (sys === 'dark' ? 'dark' : 'light') : pref === 'DARK' ? 'dark' : 'light';
  return { c: mode === 'dark' ? dark : light, mode };
}

export const useTheme = () => useContext(ThemeContext);
