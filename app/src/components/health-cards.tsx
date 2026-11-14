import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';

import { errorMessage } from '@/lib/api';
import { loadPausePrefs, nextPause, type PausePrefs } from '@/lib/notifications';
import { STEP_GOAL_DEFAULT } from '@/lib/program';
import { syncTodaySteps } from '@/lib/steps';
import { stepsSource } from '@/lib/steps-source';
import { font, useTheme } from '@/lib/theme';
import { Icon } from './icon';
import { ActivityDot, Button, Card, Chip, Progress, Row, T } from './ui';

type StepsState = { kind: 'loading' } | { kind: 'web' } | { kind: 'unavailable' } | { kind: 'no-access' } | { kind: 'ok'; steps: number; goal: number; justReached: boolean } | { kind: 'error'; message: string };

/** Pasos de hoy desde el podómetro del teléfono; al llegar a la meta da un sello (+10). */
export function StepsCard() {
  const t = useTheme();
  const [s, setS] = useState<StepsState>({ kind: 'loading' });

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') { setS({ kind: 'web' }); return; }
    try {
      if (!(await stepsSource.isAvailable())) { setS({ kind: 'unavailable' }); return; }
      const r = await syncTodaySteps();
      if (!r) { setS({ kind: 'no-access' }); return; }
      setS({ kind: 'ok', steps: r.steps, goal: r.goal, justReached: r.goalReachedNow });
    } catch (e) { setS({ kind: 'error', message: errorMessage(e) }); }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const goal = s.kind === 'ok' ? s.goal : STEP_GOAL_DEFAULT;
  return (
    <Card>
      <Row>
        <ActivityDot activity="pasos" size={40} />
        <View style={{ flex: 1 }}>
          <T v="h3">Pasos de hoy</T>
          <T v="small">Meta diaria: {goal.toLocaleString('es-EC')} pasos · +10 pts</T>
        </View>
        {s.kind === 'ok' && s.steps >= s.goal ? <Chip tone="ok" label="Meta cumplida" /> : null}
      </Row>
      {s.kind === 'ok' ? (
        <>
          <Row style={{ alignItems: 'flex-end', gap: 6 }}>
            <T style={{ fontFamily: font.black, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] }}>{s.steps.toLocaleString('es-EC')}</T>
            <T v="small" style={{ paddingBottom: 6 }}>/ {s.goal.toLocaleString('es-EC')}</T>
          </Row>
          <Progress value={s.steps / s.goal} color={s.steps >= s.goal ? t.ok : t.act.pasos} />
          <T v="small">{s.steps >= s.goal ? 'Sello "Meta de pasos" en tu pasaporte. ¡Sigue así!' : `Te faltan ${(s.goal - s.steps).toLocaleString('es-EC')} pasos. Te avisamos cuando llegues.`}</T>
        </>
      ) : s.kind === 'no-access' ? (
        <>
          <T v="small">Conecta {stepsSource.name} para contar tus pasos y participar en el reto de pasos.</T>
          <Button title="Conectar podómetro" icon="pasos" onPress={async () => { if (await stepsSource.requestAccess()) refresh(); }} />
        </>
      ) : s.kind === 'unavailable' ? (
        <T v="small">{stepsSource.installHint ?? 'Este teléfono no tiene podómetro disponible.'}</T>
      ) : s.kind === 'web' ? (
        <T v="small">El navegador no tiene acceso al podómetro del teléfono. Para el reto de pasos usa la app Muévete (Android o iPhone).</T>
      ) : s.kind === 'error' ? (
        <T v="small" color={t.warn}>{s.message}</T>
      ) : <T v="small">Leyendo tus pasos…</T>}
    </Card>
  );
}

/** Acceso a la pausa activa y al próximo recordatorio. */
export function PauseCard() {
  const t = useTheme();
  const [prefs, setPrefs] = useState<PausePrefs | null>(null);
  useFocusEffect(useCallback(() => { loadPausePrefs().then(setPrefs); }, []));
  const next = prefs ? nextPause(prefs) : null;
  return (
    <Card>
      <Row>
        <ActivityDot activity="pausa" size={40} />
        <View style={{ flex: 1 }}>
          <T v="h3">Pausa activa</T>
          <T v="small">{next ? `Próximo recordatorio: ${next.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}` : '2 min de estiramientos · +5 pts'}</T>
        </View>
        <Link href="/pausa" asChild>
          <Pressable accessibilityLabel="Configurar recordatorios" style={{ padding: 8 }}>
            <Icon name="bell" color={prefs?.enabled ? t.brandText : t.muted} />
          </Pressable>
        </Link>
      </Row>
      <Link href="/pausa" asChild>
        <Pressable accessibilityRole="button" style={{ minHeight: 48, borderRadius: 16, backgroundColor: t.act.pausa, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
          <Icon name="play" color={t.dotInk} size={18} />
          <T style={{ fontFamily: font.extrabold }} color={t.dotInk}>Hacer pausa ahora</T>
        </Pressable>
      </Link>
    </Card>
  );
}
