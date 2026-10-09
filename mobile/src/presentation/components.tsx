/** Shared UI components. Touch targets ≥ 48dp; every status = text + icon (never colour alone). */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, type, useTheme } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { c } = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? c.textMuted} accessibilityElementsHidden importantForAccessibility="no" />;
}

export function Screen({ children, scroll = true, padded = true, edges }: { children: ReactNode; scroll?: boolean; padded?: boolean; edges?: ('top' | 'bottom' | 'left' | 'right')[] }) {
  const { c } = useTheme();
  const inner = <View style={{ padding: padded ? space.lg : 0, gap: space.md, paddingBottom: space.xxl * 2 }}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges ?? ['left', 'right', 'bottom']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{inner}</ScrollView> : <View style={{ flex: 1 }}>{inner}</View>}
    </SafeAreaView>
  );
}

export function T({ children, style, muted, variant = 'body', numberOfLines, selectable }: { children: ReactNode; style?: object; muted?: boolean; variant?: keyof typeof type; numberOfLines?: number; selectable?: boolean }) {
  const { c } = useTheme();
  return (
    <Text selectable={selectable} numberOfLines={numberOfLines} style={[type[variant], { color: muted ? c.textMuted : c.text }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: ViewStyle; onPress?: () => void; accessibilityLabel?: string }) {
  const { c } = useTheme();
  const base: ViewStyle = { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, padding: space.lg, gap: space.sm };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [base, style, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost' | 'record';
export function Button({ label, onPress, kind = 'primary', icon, disabled, busy, accessibilityHint, compact, style }: { label: string; onPress: () => void; kind?: BtnKind; icon?: IconName; disabled?: boolean; busy?: boolean; accessibilityHint?: string; compact?: boolean; style?: ViewStyle }) {
  const { c } = useTheme();
  const bg = kind === 'primary' ? c.primary : kind === 'danger' ? c.danger : kind === 'record' ? c.recording : kind === 'secondary' ? c.surfaceAlt : 'transparent';
  const fg = kind === 'primary' ? c.primaryText : kind === 'danger' || kind === 'record' ? '#FFFFFF' : c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        { minHeight: 48, paddingHorizontal: compact ? space.md : space.lg, borderRadius: radius.md, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, borderWidth: kind === 'secondary' ? StyleSheet.hairlineWidth : 0, borderColor: c.border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} color={fg} size={20} /> : null}
      <Text style={{ color: fg, fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export type ChipTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary';
export function Chip({ label, tone = 'neutral', icon }: { label: string; tone?: ChipTone; icon?: IconName }) {
  const { c } = useTheme();
  const map = {
    neutral: [c.surfaceAlt, c.textMuted],
    info: [c.infoSoft, c.info],
    success: [c.successSoft, c.success],
    warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger],
    primary: [c.primarySoft, c.primary],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Row({ children, style, wrap }: { children: ReactNode; style?: ViewStyle; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Section({ title, children, right, subtitle }: { title: string; children?: ReactNode; right?: ReactNode; subtitle?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.sm, marginTop: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={[type.h3, { color: c.textMuted, textTransform: 'uppercase' }]}>
          {title}
        </Text>
        {right}
      </Row>
      {subtitle ? <T muted variant="small">{subtitle}</T> : null}
      {children}
    </View>
  );
}

export function Banner({ tone = 'info', title, message, action }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: string; message: string; action?: ReactNode }) {
  const { c } = useTheme();
  const map = { info: [c.infoSoft, c.info, 'information-outline'], warning: [c.warningSoft, c.warning, 'alert-outline'], danger: [c.dangerSoft, c.danger, 'alert-octagon-outline'], success: [c.successSoft, c.success, 'check-circle-outline'] } as const;
  const [bg, fg, icon] = map[tone];
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: bg, borderRadius: radius.md, padding: space.md, gap: space.sm, borderLeftWidth: 4, borderLeftColor: fg }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Icon name={icon} color={fg} />
        <View style={{ flex: 1, gap: 2 }}>
          {title ? <Text style={[type.body, { color: fg, fontWeight: '700' }]}>{title}</Text> : null}
          <Text style={[type.small, { color: c.text }]}>{message}</Text>
        </View>
      </Row>
      {action}
    </View>
  );
}

export function Empty({ icon, title, message, action }: { icon: IconName; title: string; message: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
      <Icon name={icon} size={36} color={c.textMuted} />
      <T variant="h2" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T muted style={{ textAlign: 'center' }}>
        {message}
      </T>
      {action}
    </View>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[type.small, { color: c.textMuted, fontWeight: '700' }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        {...props}
        style={[{ minHeight: 48, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, color: c.text, backgroundColor: c.surface, fontSize: 15 }, props.multiline && { minHeight: 120, textAlignVertical: 'top' }, props.style as object]}
      />
      {hint ? <T muted variant="small">{hint}</T> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: 3, gap: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label} onPress={() => onChange(o.value)} style={{ flex: 1, minHeight: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.surface : 'transparent', borderWidth: on ? StyleSheet.hairlineWidth : 0, borderColor: c.border }}>
            <Text style={{ color: on ? c.text : c.textMuted, fontWeight: on ? '700' : '500', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function KeyValue({ k, v }: { k: string; v?: string | number | null }) {
  const { c } = useTheme();
  return (
    <Row style={{ alignItems: 'flex-start' }}>
      <Text style={[type.small, { color: c.textMuted, width: 120 }]}>{k}</Text>
      <Text selectable style={[type.small, { color: c.text, flex: 1 }]}>
        {v === undefined || v === null || v === '' ? '—' : String(v)}
      </Text>
    </Row>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: space.xs }} />;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md, backgroundColor: c.bg }}>
      <ActivityIndicator color={c.primary} size="large" />
      <T muted>{label}</T>
    </View>
  );
}

export function DemoBadge() {
  return <Chip label="DEMO DATA — NOT A REAL PATIENT" tone="warning" icon="flask-outline" />;
}

/**
 * Fixed bottom action area. Adds the bottom safe-area inset so the action is never hidden behind the Android
 * navigation bar (edge-to-edge). Inside tab screens the tab bar already owns the inset: pass `inTabs`.
 */
export function BottomBar({ children, inTabs, gap }: { children: ReactNode; inTabs?: boolean; gap?: number }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, paddingBottom: space.lg + (inTabs ? 0 : insets.bottom), backgroundColor: c.bg, gap }}>{children}</View>;
}
