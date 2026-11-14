import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useCatalog } from '@/lib/catalog';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Stamp } from '@/components/stamp';
import { ActivityDot, Button, Card, Chip, Loading, Row, Screen, T } from '@/components/ui';
import { errorMessage, registerActivity, type RegisterResult } from '@/lib/api';
import { radius, useTheme } from '@/lib/theme';

type State = { kind: 'scanning' } | { kind: 'sending' } | { kind: 'done'; result: RegisterResult } | { kind: 'error'; message: string };

export default function Registrar() {
  const cat = useCatalog();
  const t = useTheme();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>({ kind: 'scanning' });
  const lock = useRef(false);
  // Llegó desde un enlace de QR (cámara del teléfono / versión web): pedir confirmación y registrar.
  const { qr } = useLocalSearchParams<{ qr?: string }>();
  const fromLink = typeof qr === 'string' && qr.length > 0 ? qr : null;

  async function onScan({ data }: BarcodeScanningResult) {
    if (lock.current) return;
    lock.current = true;
    setState({ kind: 'sending' });
    try {
      const { data: result } = await registerActivity({ qr: data });
      setState({ kind: 'done', result });
    } catch (e) {
      setState({ kind: 'error', message: errorMessage(e) });
    }
  }
  const again = () => {
    lock.current = false;
    setState({ kind: 'scanning' });
    if (fromLink) router.replace('/registrar');
  };

  if (state.kind === 'done') {
    const r = state.result;
    return (
      <Screen>
        <T v="h2">{r.status === 'pending' ? 'Sello pendiente' : 'Registro confirmado'}</T>
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
          <StampDrop>
            <Stamp activity={r.activity} at={r.stampedAt} number={r.stampNumber} status={r.status} size={200} />
          </StampDrop>
          <T v="label">Sello N° {r.stampNumber} en tu pasaporte</T>
          <T v="h2">{r.activityName}</T>
          <T v="small">{r.location}</T>
          {r.status === 'pending' ? (
            <T style={{ textAlign: 'center' }}>La mesa de control debe confirmar tu participación. Recibirás +{r.pendingPoints} puntos cuando lo valide.</T>
          ) : (
            <>
              <T v="h1" color={t.brandText} style={{ fontSize: 44, lineHeight: 50 }}>+{r.points + r.bonus}</T>
              <T v="small">puntos · total {r.totalPoints} · racha de {r.streak} día{r.streak === 1 ? '' : 's'}</T>
            </>
          )}
          {r.achievements.map((a) => <Chip key={a} tone="brand" label={`¡${a}! +50 pts`} />)}
          {r.completedChallenges.map((c) => <Chip key={c} tone="brand" label={`Reto cumplido: ${c} (+bono)`} />)}
        </Card>
        <Button title="Ver mi pasaporte" icon="passport" onPress={() => { again(); router.navigate('/pasaporte'); }} />
        <Button title="Escanear otro código" icon="qr" variant="ghost" onPress={again} />
      </Screen>
    );
  }

  if (fromLink && state.kind !== 'error') {
    const code = fromLink.startsWith('MUEVETE:') ? fromLink.split(':')[1] : fromLink.split('/r/')[1]?.split('/')[0] ?? '';
    return (
      <Screen>
        <T v="h2">Registrar actividad</T>
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
          <Icon name="qr" color={t.brandText} size={48} />
          <T v="h3">Código {code}</T>
          <T v="small" style={{ textAlign: 'center' }}>Escaneaste el QR de un acceso. Confirma para registrar tu actividad y recibir tu sello.</T>
          <View style={{ alignSelf: 'stretch', gap: 8 }}>
            <Button title="Registrar mi actividad" icon="check" loading={state.kind === 'sending'} onPress={() => onScan({ data: fromLink } as BarcodeScanningResult)} />
            <Button title="Cancelar" variant="ghost" onPress={() => router.replace('/registrar')} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <T v="h2">Registrar actividad</T>
      <View style={{ aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        {!permission ? <Loading /> : !permission.granted ? (
          <View style={{ padding: 24, gap: 14, alignItems: 'center' }}>
            <Icon name="qr" color="#F5AD20" size={48} />
            <T color="#F5F3EE" style={{ textAlign: 'center' }}>Para registrar tu actividad, la app necesita usar la cámara y leer el código QR del acceso.</T>
            {permission.canAskAgain
              ? <Button title="Permitir cámara" onPress={requestPermission} />
              : <T v="small" color="#E4E1DA" style={{ textAlign: 'center' }}>Activa el permiso de cámara para Muévete en los ajustes del teléfono.</T>}
          </View>
        ) : (
          <>
            {focused && state.kind === 'scanning' ? (
              <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
            ) : null}
            <View pointerEvents="none" style={{ width: '62%', aspectRatio: 1, borderWidth: 4, borderColor: '#F5AD20', borderRadius: 24 }} />
            <View pointerEvents="none" style={{ position: 'absolute', bottom: 16 }}>
              {state.kind === 'sending' ? <Loading /> : <T v="small" color="#E4E1DA">Apunta al código QR del acceso</T>}
            </View>
          </>
        )}
      </View>

      {state.kind === 'error' ? (
        <Card style={{ borderColor: t.warn }}>
          <T color={t.warn}>{state.message}</T>
          <Button title="Intentar otra vez" variant="ghost" onPress={again} />
        </Card>
      ) : null}

      <Card>
        <T v="label">Puntos por actividad</T>
        {cat.qr.map((x) => x.id).map((a) => (
          <Row key={a}>
            <ActivityDot activity={a} size={34} />
            <View style={{ flex: 1 }}>
              <T>{cat.get(a).name}</T>
              <T v="small">{cat.get(a).rule}</T>
            </View>
            <T v="num" color={t.brandText}>+{cat.get(a).points}</T>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}

/** Animación de sello: cae desde más grande y se asienta en la página. */
function StampDrop({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) { v.setValue(1); return; }
      Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(2.2)), useNativeDriver: true }).start();
    });
  }, [v]);
  return (
    <Animated.View style={{ opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.9, 1] }) }] }}>
      {children}
    </Animated.View>
  );
}
