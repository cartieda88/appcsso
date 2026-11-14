import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Stamp } from '@/components/stamp';
import { Button, Card, Chip, Progress, Row, Screen, Segmented, T } from '@/components/ui';
import { errorMessage, registerPause, type RegisterResult } from '@/lib/api';
import { loadPausePrefs, nextPause, pauseTimes, savePausePrefs, type PausePrefs } from '@/lib/notifications';
import { font, radius, useTheme } from '@/lib/theme';

/** Rutina de pausa activa: 5 ejercicios de 30 s (2 min 30 s). */
const ROUTINE = [
  { title: 'Cuello', how: 'Inclina la cabeza hacia un hombro, luego al otro. Movimientos lentos, sin forzar.' },
  { title: 'Hombros', how: 'Haz círculos con los hombros hacia atrás y luego hacia adelante.' },
  { title: 'Muñecas y dedos', how: 'Abre y cierra las manos; gira las muñecas en ambos sentidos.' },
  { title: 'Espalda', how: 'De pie, entrelaza las manos arriba y estírate hacia el techo. Respira profundo.' },
  { title: 'Piernas', how: 'Marcha en el sitio o sube y baja los talones. Mira lejos de la pantalla.' },
];
const STEP_SECONDS = 30;

type Phase = { kind: 'idle' } | { kind: 'running'; step: number; left: number; paused: boolean } | { kind: 'sending' } | { kind: 'done'; result: RegisterResult } | { kind: 'error'; message: string };

export default function Pausa() {
  const t = useTheme();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const startedAt = useRef(0);

  useEffect(() => {
    if (phase.kind !== 'running' || phase.paused) return;
    const id = setInterval(() => {
      setPhase((p) => {
        if (p.kind !== 'running' || p.paused) return p;
        if (p.left > 1) return { ...p, left: p.left - 1 };
        if (p.step < ROUTINE.length - 1) return { ...p, step: p.step + 1, left: STEP_SECONDS };
        return { kind: 'sending' };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase.kind !== 'sending') return;
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    registerPause({ seconds })
      .then(({ data }) => setPhase({ kind: 'done', result: data }))
      .catch((e) => setPhase({ kind: 'error', message: errorMessage(e) }));
  }, [phase.kind]);

  const start = () => { startedAt.current = Date.now(); setPhase({ kind: 'running', step: 0, left: STEP_SECONDS, paused: false }); };
  const total = ROUTINE.length * STEP_SECONDS;

  return (
    <Screen>
      <Row>
        <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" color={t.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="h2">Pausa activa</T>
          <T v="small">2 min 30 s · +5 puntos · hasta 4 al día</T>
        </View>
      </Row>

      {phase.kind === 'running' ? (
        <View style={{ backgroundColor: t.hero, borderRadius: radius.lg, padding: 20, gap: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="label" color={t.brand}>Ejercicio {phase.step + 1} de {ROUTINE.length}</T>
            <T v="small" color={t.heroInk}>{(() => { const r = (ROUTINE.length - phase.step - 1) * STEP_SECONDS + phase.left; return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')} restantes`; })()}</T>
          </Row>
          <T v="h1" color={t.heroInk}>{ROUTINE[phase.step].title}</T>
          <T color={t.heroInk} style={{ fontSize: 17, lineHeight: 24 }}>{ROUTINE[phase.step].how}</T>
          <T style={{ fontFamily: font.black, fontSize: 64, lineHeight: 70, textAlign: 'center', fontVariant: ['tabular-nums'] }} color={t.brand}>{phase.left}</T>
          <Progress value={(phase.step * STEP_SECONDS + (STEP_SECONDS - phase.left)) / total} />
          <Row>
            <View style={{ flex: 1 }}><Button title={phase.paused ? 'Continuar' : 'Pausar'} variant="ghost" onPress={() => setPhase({ ...phase, paused: !phase.paused })} /></View>
            <View style={{ flex: 1 }}><Button title="Cancelar" variant="ghost" onPress={() => setPhase({ kind: 'idle' })} /></View>
          </Row>
        </View>
      ) : phase.kind === 'done' ? (
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
          <Stamp activity="pausa" at={phase.result.stampedAt} number={phase.result.stampNumber} size={180} />
          <T v="h2">¡Pausa completada!</T>
          <T v="h1" color={t.brandText} style={{ fontSize: 40, lineHeight: 46 }}>+{phase.result.points + phase.result.bonus}</T>
          <T v="small">Sello N° {phase.result.stampNumber} en tu pasaporte</T>
          {phase.result.completedChallenges.map((c) => <Chip key={c} tone="brand" label={`Reto cumplido: ${c}`} />)}
          <View style={{ alignSelf: 'stretch' }}><Button title="Listo" onPress={() => router.back()} /></View>
        </Card>
      ) : (
        <Card>
          <T v="h3">Rutina guiada</T>
          {ROUTINE.map((r, i) => (
            <Row key={r.title} style={{ alignItems: 'flex-start' }}>
              <T v="num" color={t.brandText} style={{ width: 22 }}>{i + 1}</T>
              <View style={{ flex: 1 }}><T style={{ fontFamily: font.bold }}>{r.title}</T><T v="small">{r.how}</T></View>
            </Row>
          ))}
          {phase.kind === 'error' ? <T color={t.warn}>{phase.message}</T> : null}
          <Button title={phase.kind === 'sending' ? 'Registrando…' : 'Empezar pausa'} icon="play" loading={phase.kind === 'sending'} onPress={start} />
        </Card>
      )}

      <Reminders />
    </Screen>
  );
}

const RANGES: [string, [number, number]][] = [['7:00–16:00', [7, 16]], ['8:00–17:00', [8, 17]], ['9:00–18:00', [9, 18]]];

function Reminders() {
  const t = useTheme();
  const [prefs, setPrefs] = useState<PausePrefs | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { loadPausePrefs().then(setPrefs); }, []);
  if (!prefs) return null;

  async function update(p: PausePrefs) {
    setPrefs(p); setMsg(null);
    const r = await savePausePrefs(p);
    if (r === 'denied') { setPrefs({ ...p, enabled: false }); setMsg('Activa las notificaciones de Muévete en los ajustes del teléfono para recibir los recordatorios.'); }
  }
  const next = nextPause(prefs);
  const range = RANGES.find(([, [a, b]]) => a === prefs.start && b === prefs.end)?.[0] ?? RANGES[1][0];

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T v="h3">Recordatorios</T>
          <T v="small">{prefs.enabled ? `Lunes a viernes, ${pauseTimes(prefs).length} al día` : 'Te avisamos cuándo hacer tu pausa activa'}</T>
        </View>
        <Switch accessibilityLabel="Activar recordatorios de pausas activas" value={prefs.enabled} onValueChange={(enabled) => update({ ...prefs, enabled })} trackColor={{ true: t.brand, false: t.line }} thumbColor="#FFFFFF" />
      </Row>
      {prefs.enabled ? (
        <>
          <T v="small" color={t.ink}>Cada</T>
          <Segmented<string> options={[['60', '1 hora'], ['90', '1 h 30'], ['120', '2 horas']]} value={String(prefs.every)} onChange={(v) => update({ ...prefs, every: Number(v) as PausePrefs['every'] })} />
          <T v="small" color={t.ink}>Horario</T>
          <Segmented<string> options={RANGES.map(([l]) => [l, l])} value={range} onChange={(v) => { const [, [start, end]] = RANGES.find(([l]) => l === v)!; update({ ...prefs, start, end }); }} />
          <T v="small">{next ? `Próximo recordatorio: ${next.toLocaleDateString('es-EC', { weekday: 'long' })} a las ${next.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}` : ''}</T>
          <T v="small">Horas: {pauseTimes(prefs).map(({ h, m }) => `${h}:${String(m).padStart(2, '0')}`).join(' · ')}</T>
        </>
      ) : null}
      {msg ? <T v="small" color={t.warn}>{msg}</T> : null}
    </Card>
  );
}
