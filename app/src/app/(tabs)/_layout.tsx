import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Tabs, { type BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { font, useTheme } from '@/lib/theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Inicio', icon: 'home' },
  pasaporte: { label: 'Pasaporte', icon: 'passport' },
  registrar: { label: 'Registrar', icon: 'qr' },
  ranking: { label: 'Ranking', icon: 'trophy' },
  retos: { label: 'Retos', icon: 'flag' },
};

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderTopColor: t.line, borderTopWidth: 1, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) }}>
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === i;
        const center = route.name === 'registrar';
        const color = focused ? t.brandText : t.muted;
        const onPress = () => { if (!focused) navigateToTab(route.key); };
        return (
          <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tab.label}
            style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 }}>
            {center ? (
              <View style={{ width: 54, height: 54, marginTop: -26, borderRadius: 18, backgroundColor: t.brand, borderWidth: 4, borderColor: t.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={tab.icon} color={t.brandInk} size={24} />
              </View>
            ) : (
              <Icon name={tab.icon} color={color} />
            )}
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: center ? t.ink : color }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  // QR escaneado con la cámara antes de iniciar sesión: al entrar, abrir su registro.
  useEffect(() => {
    AsyncStorage.getItem('muevete.pendingQr').then((qr) => {
      if (!qr) return;
      AsyncStorage.removeItem('muevete.pendingQr').catch(() => {});
      router.navigate(`/registrar?qr=${encodeURIComponent(qr)}` as never);
    }).catch(() => {});
  }, []);
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="pasaporte" />
      <Tabs.Screen name="registrar" />
      <Tabs.Screen name="ranking" />
      <Tabs.Screen name="retos" />
    </Tabs>
  );
}
