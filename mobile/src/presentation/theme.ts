/**
 * Design tokens (UI-UX.md §1–2, §2a liquid glass): calm, clinical, high contrast; status never by colour alone.
 * Glass = translucent surfaces over a soft gradient with drifting colour fields; text always sits on a surface
 * opaque enough for WCAG AA contrast.
 */
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
  // ---- liquid glass
  bgGradient: [string, string, string];
  orbs: [string, string, string];
  glass: string;
  glassStrong: string;
  glassBorder: string;
  glassEdge: string;
  glassHighlight: [string, string];
  shadow: string;
  primaryGradient: [string, string];
  recordingGradient: [string, string];
  dangerGradient: [string, string];
  successGradient: [string, string];
  /** opaque surface for fixed action bars: scrolled content must never show through */
  bar: string;
  header: string;
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
  bgGradient: ['#E6EFF9', '#F1EDFA', '#E5F4F0'],
  orbs: ['rgba(77,163,225,0.34)', 'rgba(150,118,232,0.24)', 'rgba(56,190,160,0.22)'],
  glass: 'rgba(255,255,255,0.66)',
  glassStrong: 'rgba(255,255,255,0.86)',
  glassBorder: 'rgba(255,255,255,0.95)',
  glassEdge: 'rgba(20,40,60,0.10)',
  glassHighlight: ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0)'],
  shadow: '#1B3A5C',
  primaryGradient: ['#1677B8', '#0B5C8A'],
  recordingGradient: ['#E53935', '#B71C1C'],
  dangerGradient: ['#D84339', '#A3221B'],
  successGradient: ['#2E8B57', '#1E6B3A'],
  bar: '#F6F9FD',
  header: '#E9F0F9',
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
  bgGradient: ['#0A111C', '#111830', '#0B1A1C'],
  orbs: ['rgba(77,163,225,0.24)', 'rgba(140,110,232,0.20)', 'rgba(56,190,160,0.14)'],
  glass: 'rgba(30,42,56,0.62)',
  glassStrong: 'rgba(20,29,40,0.90)',
  glassBorder: 'rgba(255,255,255,0.14)',
  glassEdge: 'rgba(0,0,0,0.35)',
  glassHighlight: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)'],
  shadow: '#000000',
  primaryGradient: ['#6CC0F0', '#3D97D3'],
  recordingGradient: ['#FF6B6B', '#D63B3B'],
  dangerGradient: ['#FF8A80', '#E0574C'],
  successGradient: ['#7BD49A', '#3FA567'],
  bar: '#101822',
  header: '#0B121D',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, xl: 28 };
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
