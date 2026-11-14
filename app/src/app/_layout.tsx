import {
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold, Figtree_900Black, useFonts,
} from '@expo-google-fonts/figtree';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Stack from 'expo-router/stack';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import '@/lib/background';
import { enableBackgroundSteps } from '@/lib/background';
import { configureNotifications, onNotificationOpen, registerForPush } from '@/lib/notifications';
import { SessionProvider, useSession } from '@/lib/session';
import { setupWebHead } from '@/lib/web-head';
import { useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();
configureNotifications();
setupWebHead();

function RootNavigator() {
  const { ready, user, isAdmin, isValidator } = useSession();
  const t = useTheme();
  const scheme = useColorScheme();
  useEffect(() => { if (ready) SplashScreen.hideAsync(); }, [ready]);
  // Con sesión: avisos push de eventos, pasos en segundo plano y abrir la pantalla de la notificación.
  useEffect(() => {
    if (!user) return;
    registerForPush().catch(() => {});

    enableBackgroundSteps().catch(() => {});
    return onNotificationOpen((url) => router.push(url as never));
  }, [user]);
  if (!ready) return null;
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pausa" />
          <Stack.Protected guard={isAdmin}>
            <Stack.Screen name="admin" />
          </Stack.Protected>
          <Stack.Protected guard={isValidator}>
            <Stack.Screen name="validar" />
          </Stack.Protected>
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Screen name="r/[id]/[token]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold, Figtree_900Black });
  if (!loaded) return null;
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}
