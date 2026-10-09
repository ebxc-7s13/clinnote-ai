/**
 * Shared UI components — liquid glass (UI-UX §2a). Touch targets ≥ 48dp; every status = text + icon (never colour
 * alone); press feedback is a short spring scale plus a light haptic (skipped when the device has none).
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, type, useTheme } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function haptic(kind: 'light' | 'medium' | 'select' | 'success' | 'warning' = 'light') {
  try {
    const p =
      kind === 'select'
        ? Haptics.selectionAsync()
        : kind === 'success'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : kind === 'warning'
            ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            : Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    void p?.catch?.(() => undefined);
  } catch {
    /* no haptics on this device */
  }
}

let reduceMotion = false;
void AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => (reduceMotion = !!v))
  .catch(() => undefined);

/** Spring scale on press (native driver). */
function usePressScale(to = 0.965) {
  const [scale] = useState(() => new Animated.Value(1));
  const run = (v: number) => {
    if (reduceMotion) return;
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: v === 1 ? 8 : 0 }).start();
  };
  return { scale, onPressIn: () => run(to), onPressOut: () => run(1) };
}

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { c } = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? c.textMuted} accessibilityElementsHidden importantForAccessibility="no" />;
}

/** Gradient backdrop with slowly drifting colour fields. Decorative only (hidden from accessibility). */
export function GlassBackground() {
  const { c } = useTheme();
  const [drift] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);
  const move = (x: number, y: number) => ({ transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) }] });
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={c.bgGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[{ position: 'absolute', top: -120, left: -90, width: 320, height: 320, borderRadius: 160, backgroundColor: c.orbs[0] }, move(40, 30)]} />
      <Animated.View style={[{ position: 'absolute', top: 220, right: -130, width: 300, height: 300, borderRadius: 150, backgroundColor: c.orbs[1] }, move(-30, 40)]} />
      <Animated.View style={[{ position: 'absolute', bottom: -140, left: 40, width: 340, height: 340, borderRadius: 170, backgroundColor: c.orbs[2] }, move(25, -35)]} />
    </View>
  );
}

/** Full-screen surface: glass backdrop + safe area. Use for screens that manage their own scrolling. */
export function ScreenSurface({ children, edges }: { children: ReactNode; edges?: ('top' | 'bottom' | 'left' | 'right')[] }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bgGradient[0] }} edges={edges ?? ['left', 'right', 'bottom']}>
      <GlassBackground />
      {children}
    </SafeAreaView>
  );
}

export function Screen({ children, scroll = true, padded = true, edges }: { children: ReactNode; scroll?: boolean; padded?: boolean; edges?: ('top' | 'bottom' | 'left' | 'right')[] }) {
  const inner = <View style={{ padding: padded ? space.lg : 0, gap: space.md, paddingBottom: space.xxl * 2 }}>{children}</View>;
  return (
    <ScreenSurface edges={edges}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{inner}</ScrollView> : <View style={{ flex: 1 }}>{inner}</View>}
    </ScreenSurface>
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

/** Top-edge light reflection of a glass surface. */
function Sheen({ r = radius.lg }: { r?: number }) {
  const { c } = useTheme();
  return <LinearGradient pointerEvents="none" colors={c.glassHighlight} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44, borderTopLeftRadius: r, borderTopRightRadius: r }} />;
}

export function glassStyle(c: ReturnType<typeof useTheme>['c'], strong = false): ViewStyle {
  return {
    backgroundColor: strong ? c.glassStrong : c.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.glassBorder,
    shadowColor: c.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    // no Android elevation: its shadow shows through translucent fills as an inner rectangle
  };
}

export function Card({ children, style, onPress, accessibilityLabel, strong }: { children: ReactNode; style?: ViewStyle; onPress?: () => void; accessibilityLabel?: string; strong?: boolean }) {
  const { c } = useTheme();
  const press = usePressScale(0.98);
  const base: ViewStyle = { ...glassStyle(c, strong), padding: space.lg, gap: space.sm, overflow: 'hidden' };
  if (!onPress)
    return (
      <View style={[base, style]}>
        <Sheen />
        {children}
      </View>
    );
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { haptic('select'); onPress(); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
      {({ pressed }) => (
        <Animated.View style={[base, style, { transform: [{ scale: press.scale }] }, pressed && { borderColor: c.primary }]}>
          <Sheen />
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost' | 'record' | 'success';
export function Button({ label, onPress, kind = 'primary', icon, disabled, busy, accessibilityHint, compact, style }: { label: string; onPress: () => void; kind?: BtnKind; icon?: IconName; disabled?: boolean; busy?: boolean; accessibilityHint?: string; compact?: boolean; style?: ViewStyle }) {
  const { c } = useTheme();
  const press = usePressScale(compact ? 0.95 : 0.965);
  const gradient = kind === 'primary' ? c.primaryGradient : kind === 'danger' ? c.dangerGradient : kind === 'record' ? c.recordingGradient : kind === 'success' ? c.successGradient : null;
  const fg = kind === 'primary' ? c.primaryText : kind === 'danger' || kind === 'record' || kind === 'success' ? '#FFFFFF' : c.primary;
  const off = !!disabled || !!busy;
  const shape: ViewStyle = { minHeight: 48, paddingHorizontal: compact ? space.md : space.lg, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, overflow: 'hidden' };
  const skin: ViewStyle =
    kind === 'secondary'
      ? { backgroundColor: c.glassStrong, borderWidth: 1, borderColor: c.glassBorder, shadowColor: c.shadow, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }
      : kind === 'ghost'
        ? { backgroundColor: 'transparent' }
        : { shadowColor: gradient ? gradient[1] : c.shadow, shadowOpacity: off ? 0 : 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: off ? 0 : 4 };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: off, busy: !!busy }}
      disabled={off}
      onPress={() => {
        haptic(kind === 'record' || kind === 'danger' ? 'medium' : kind === 'ghost' || kind === 'secondary' ? 'select' : 'light');
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={style}
    >
      {({ pressed }) => (
        <Animated.View style={[shape, skin, { opacity: disabled ? 0.45 : pressed && kind === 'ghost' ? 0.6 : 1, transform: [{ scale: press.scale }] }]}>
          {gradient ? <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
          {gradient ? <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%' }} /> : null}
          {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} color={fg} size={20} /> : null}
          <Text style={{ color: fg, fontSize: 15, fontWeight: '700', letterSpacing: 0.2, flexShrink: 1, textAlign: 'center' }}>{label}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

export type ChipTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary';
export function Chip({ label, tone = 'neutral', icon }: { label: string; tone?: ChipTone; icon?: IconName }) {
  const { c } = useTheme();
  const map = {
    neutral: [c.glassStrong, c.textMuted],
    info: [c.infoSoft, c.info],
    success: [c.successSoft, c.success],
    warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger],
    primary: [c.primarySoft, c.primary],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderColor: c.glassBorder, maxWidth: '100%' }}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700', flexShrink: 1 }}>{label}</Text>
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
        <Text accessibilityRole="header" style={[type.h3, { color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 1 }]}>
          {title}
        </Text>
        {right}
      </Row>
      {subtitle ? <T muted variant="small">{subtitle}</T> : null}
      {children}
    </View>
  );
}

/** Collapsible glass section with a count badge; header is a button that announces its expanded state. */
export function Expandable({ title, children, initiallyOpen = false, badge, tone = 'neutral', icon, subtitle }: { title: string; children: ReactNode; initiallyOpen?: boolean; badge?: string; tone?: ChipTone; icon?: IconName; subtitle?: string }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  const [rot] = useState(() => new Animated.Value(initiallyOpen ? 1 : 0));
  const toggle = () => {
    haptic('select');
    Animated.timing(rot, { toValue: open ? 0 : 1, duration: reduceMotion ? 0 : 180, useNativeDriver: true }).start();
    setOpen(!open);
  };
  return (
    <View style={{ ...glassStyle(c), overflow: 'hidden' }}>
      <Sheen />
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}${badge ? `, ${badge}` : ''}`} accessibilityState={{ expanded: open }} onPress={toggle} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md }}>
        {icon ? <Icon name={icon} size={22} color={c.primary} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[type.h3, { color: c.text }]}>{title}</Text>
          {subtitle ? <T variant="small" muted>{subtitle}</T> : null}
        </View>
        {badge ? <Chip label={badge} tone={tone} /> : null}
        <Animated.View style={{ transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
          <Icon name="chevron-down" size={22} />
        </Animated.View>
      </Pressable>
      {open ? <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm }}>{children}</View> : null}
    </View>
  );
}

export function Banner({ tone = 'info', title, message, action }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: string; message: string; action?: ReactNode }) {
  const { c } = useTheme();
  const map = { info: [c.infoSoft, c.info, 'information-outline'], warning: [c.warningSoft, c.warning, 'alert-outline'], danger: [c.dangerSoft, c.danger, 'alert-octagon-outline'], success: [c.successSoft, c.success, 'check-circle-outline'] } as const;
  const [bg, fg, icon] = map[tone];
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: bg, borderRadius: radius.md, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: c.glassBorder, borderLeftWidth: 4, borderLeftColor: fg }}>
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
      <View style={{ ...glassStyle(c, true), width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={34} color={c.primary} />
      </View>
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
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <Text style={[type.small, { color: c.textMuted, fontWeight: '700' }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        {...props}
        onFocus={(e) => {
          setFocus(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          props.onBlur?.(e);
        }}
        style={[{ minHeight: 48, borderWidth: focus ? 2 : 1, borderColor: focus ? c.focus : c.glassBorder, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, color: c.text, backgroundColor: c.glassStrong, fontSize: 15 }, props.multiline && { minHeight: 120, textAlignVertical: 'top' }, props.style as object]}
      />
      {hint ? <T muted variant="small">{hint}</T> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void; label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: c.glass, borderRadius: radius.md, padding: 4, gap: 4, borderWidth: 1, borderColor: c.glassBorder }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: !!o.disabled }}
            accessibilityLabel={o.label}
            disabled={o.disabled}
            onPress={() => {
              if (!on) haptic('select');
              onChange(o.value);
            }}
            style={{ flex: 1, minHeight: 44, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, backgroundColor: on ? c.glassStrong : 'transparent', borderWidth: on ? 1 : 0, borderColor: c.glassBorder, shadowColor: c.shadow, shadowOpacity: on ? 0.12 : 0, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, opacity: o.disabled ? 0.4 : 1 }}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: on ? c.primary : c.textMuted, fontWeight: on ? '800' : '500', fontSize: 14 }}>
              {o.label}
            </Text>
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
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md, backgroundColor: c.bgGradient[0] }}>
      <GlassBackground />
      <ActivityIndicator color={c.primary} size="large" />
      <T muted>{label}</T>
    </View>
  );
}

export function DemoBadge() {
  return <Chip label="DEMO DATA — NOT A REAL PATIENT" tone="warning" icon="flask-outline" />;
}

/** Pulsing status dot (recording indicator). Static when reduce-motion is on. */
export function PulseDot({ color, size = 12, active = true }: { color: string; size?: number; active?: boolean }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active || reduceMotion) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return (
    <View style={{ width: size * 2.4, height: size * 2.4, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no">
      {active ? <Animated.View style={{ position: 'absolute', width: size * 2.4, height: size * 2.4, borderRadius: size * 1.2, backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }} /> : null}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

export interface Step {
  key: string;
  label: string;
  detail?: string;
  state: 'done' | 'current' | 'todo' | 'warn' | 'off';
  onPress?: () => void;
}

/** Vertical progress tracker with a connecting rail (visit workflow, timelines). */
export function StepTracker({ steps }: { steps: Step[] }) {
  const { c } = useTheme();
  return (
    <View>
      {steps.map((s, i) => {
        const color = s.state === 'done' ? c.success : s.state === 'current' ? c.primary : s.state === 'warn' ? c.warning : c.textMuted;
        const icon: IconName = s.state === 'done' ? 'check' : s.state === 'warn' ? 'alert' : s.state === 'current' ? 'circle-medium' : s.state === 'off' ? 'minus' : 'circle-outline';
        const body = (
          <View style={{ flexDirection: 'row', gap: space.md, minHeight: 56 }}>
            <View style={{ alignItems: 'center', width: 30 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: s.state === 'done' ? c.successSoft : s.state === 'current' ? c.primarySoft : s.state === 'warn' ? c.warningSoft : c.glassStrong, borderWidth: 1.5, borderColor: color }}>
                <Icon name={icon} size={16} color={color} />
              </View>
              {i < steps.length - 1 ? <View style={{ flex: 1, width: 2, minHeight: 18, backgroundColor: s.state === 'done' ? c.success : c.border, opacity: 0.7 }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: space.md, paddingTop: 3 }}>
              <T style={{ fontWeight: '700', color: s.state === 'off' ? c.textMuted : c.text }}>{s.label}</T>
              {s.detail ? <T variant="small" muted>{s.detail}</T> : null}
            </View>
            {s.onPress ? <Icon name="chevron-right" /> : null}
          </View>
        );
        return s.onPress ? (
          <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={`${s.label}: ${s.detail ?? s.state}`} onPress={() => { haptic('select'); s.onPress?.(); }} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            {body}
          </Pressable>
        ) : (
          <View key={s.key} accessible accessibilityLabel={`${s.label}: ${s.detail ?? s.state}`}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

/** Compact metric tile. */
export function Stat({ value, label, tone = 'neutral', icon, onPress }: { value: string | number; label: string; tone?: ChipTone; icon?: IconName; onPress?: () => void }) {
  const { c } = useTheme();
  const fg = { neutral: c.text, info: c.info, success: c.success, warning: c.warning, danger: c.danger, primary: c.primary }[tone];
  const inner = (
    <View style={{ ...glassStyle(c), padding: space.md, gap: 2, minHeight: 76, overflow: 'hidden' }}>
      <Sheen />
      <Row>
        {icon ? <Icon name={icon} size={18} color={fg} /> : null}
        <Text style={{ fontSize: 22, fontWeight: '800', color: fg, fontVariant: ['tabular-nums'] }}>{value}</Text>
      </Row>
      <T variant="small" muted numberOfLines={2}>{label}</T>
    </View>
  );
  if (!onPress) return <View style={{ flex: 1 }} accessible accessibilityLabel={`${value} ${label}`}>{inner}</View>;
  return (
    <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${value} ${label}`} onPress={() => { haptic('select'); onPress(); }}>
      {({ pressed }) => <View style={{ opacity: pressed ? 0.8 : 1 }}>{inner}</View>}
    </Pressable>
  );
}

/**
 * Fixed bottom action area (glass). Adds the bottom safe-area inset so the action is never hidden behind the
 * Android navigation bar (edge-to-edge). Inside tab screens the tab bar already owns the inset: pass `inTabs`.
 */
export function BottomBar({ children, inTabs, gap }: { children: ReactNode; inTabs?: boolean; gap?: number }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, paddingBottom: space.lg + (inTabs ? 0 : insets.bottom), backgroundColor: c.bar, gap, borderTopWidth: 1, borderColor: c.glassBorder, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, shadowColor: c.shadow, shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 8 }}>
      {children}
    </View>
  );
}
