import {
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold, Figtree_900Black, useFonts,
} from '@expo-google-fonts/figtree';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import Stack from 'expo-router/stack';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { SessionProvider, useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { ready, user, isAdmin, isValidator } = useSession();
  const t = useTheme();
  const scheme = useColorScheme();
  useEffect(() => { if (ready) SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
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
