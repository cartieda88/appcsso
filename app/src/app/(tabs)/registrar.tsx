import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ActivityDot, Button, Card, Chip, Loading, Row, Screen, T } from '@/components/ui';
import { errorMessage, registerActivity, type RegisterResult } from '@/lib/api';
import { ACTIVITIES, ACTIVITY_IDS } from '@/lib/program';
import { radius, useTheme } from '@/lib/theme';

type State = { kind: 'scanning' } | { kind: 'sending' } | { kind: 'done'; result: RegisterResult } | { kind: 'error'; message: string };

export default function Registrar() {
  const t = useTheme();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>({ kind: 'scanning' });
  const lock = useRef(false);

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
  const again = () => { lock.current = false; setState({ kind: 'scanning' }); };

  if (state.kind === 'done') {
    const r = state.result;
    return (
      <Screen>
        <T v="h2">Registro exitoso</T>
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <ActivityDot activity={r.activity} size={64} />
          <T v="h2">{r.activityName}</T>
          <T v="small">{r.location}</T>
          <T v="h1" color={t.brandText} style={{ fontSize: 48, lineHeight: 54 }}>+{r.points + r.bonus}</T>
          <T v="small">puntos · total {r.totalPoints} · racha de {r.streak} día{r.streak === 1 ? '' : 's'}</T>
          {r.completedChallenges.map((c) => <Chip key={c} tone="brand" label={`Reto cumplido: ${c} (+bono)`} />)}
        </Card>
        <Button title="Escanear otro código" icon="qr" onPress={again} />
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
        {ACTIVITY_IDS.map((a) => (
          <Row key={a}>
            <ActivityDot activity={a} size={34} />
            <View style={{ flex: 1 }}>
              <T>{ACTIVITIES[a].name}</T>
              <T v="small">{ACTIVITIES[a].rule}</T>
            </View>
            <T v="num" color={t.brandText}>+{ACTIVITIES[a].points}</T>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}
