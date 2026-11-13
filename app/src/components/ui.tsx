import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ActivityId } from '@/lib/program';
import { font, radius, useTheme } from '@/lib/theme';
import { Icon, type IconName } from './icon';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const t = useTheme();
  const body = <View style={{ gap: 16, padding: 16, paddingBottom: 32, width: '100%', maxWidth: 560, alignSelf: 'center' }}>{children}</View>;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? <ScrollView contentInsetAdjustmentBehavior="automatic">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'num';
export function T({ v = 'body', color, style, children, numberOfLines }: { v?: Variant; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number }) {
  const t = useTheme();
  const base: Record<Variant, TextStyle> = {
    h1: { fontFamily: font.black, fontSize: 30, lineHeight: 34 },
    h2: { fontFamily: font.extrabold, fontSize: 21, lineHeight: 26 },
    h3: { fontFamily: font.extrabold, fontSize: 17, lineHeight: 22 },
    body: { fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
    small: { fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: t.muted },
    label: { fontFamily: font.bold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: t.muted },
    num: { fontFamily: font.extrabold, fontSize: 17, fontVariant: ['tabular-nums'] },
  };
  return <Text numberOfLines={numberOfLines} style={[{ color: t.ink }, base[v], color ? { color } : null, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.surface, borderColor: t.line, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: 16, gap: 12 }, style]}>{children}</View>;
}

export function Button({ title, onPress, variant = 'primary', icon, disabled, loading }: { title: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'dark'; icon?: IconName; disabled?: boolean; loading?: boolean }) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.brand : variant === 'dark' ? t.hero : 'transparent';
  const fg = variant === 'primary' ? t.brandInk : variant === 'dark' ? t.heroInk : t.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        minHeight: 50, borderRadius: radius.md, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: bg, borderWidth: variant === 'ghost' ? 1.5 : 0, borderColor: t.line, opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} color={fg} size={20} /> : null}
      <Text style={{ fontFamily: font.extrabold, fontSize: 16, color: fg }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'ok' | 'warn' | 'brand' }) {
  const t = useTheme();
  const color = tone === 'ok' ? t.ok : tone === 'warn' ? t.warn : tone === 'brand' ? t.brandText : t.ink;
  const bg = tone === 'neutral' ? t.surface2 : tone === 'brand' ? t.brandSoft : color + '22';
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: font.extrabold, fontSize: 12, color }}>{label}</Text>
    </View>
  );
}

export function Progress({ value, color, height = 10 }: { value: number; color?: string; height?: number }) {
  const t = useTheme();
  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: t.surface2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', borderRadius: radius.pill, backgroundColor: color ?? t.brand }} />
    </View>
  );
}

export function ActivityDot({ activity, size = 40 }: { activity: ActivityId; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: t.act[activity], alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={activity} color={t.dotInk} size={size * 0.55} />
    </View>
  );
}

export function Segmented<K extends string>({ options, value, onChange }: { options: [K, string][]; value: K; onChange: (k: K) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.surface2, borderRadius: radius.pill, padding: 4, gap: 4 }}>
      {options.map(([k, label]) => {
        const on = k === value;
        return (
          <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(k)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center', backgroundColor: on ? t.brand : 'transparent' }}>
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: on ? t.brandInk : t.muted }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>{children}</View>;
}

export function Loading() {
  const t = useTheme();
  return <ActivityIndicator color={t.brandText} style={{ paddingVertical: 24 }} />;
}

export function Empty({ text }: { text: string }) {
  return <T v="small" style={{ textAlign: 'center', paddingVertical: 16 }}>{text}</T>;
}
