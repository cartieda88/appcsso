import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Stamp } from '@/components/stamp';
import { Button, Card, Empty, Loading, Row, Screen, T } from '@/components/ui';
import { errorMessage, reviewActivity } from '@/lib/api';
import { usePendingApprovals, type PendingStamp } from '@/lib/data';
import { ACTIVITIES, relativeDay } from '@/lib/program';
import { useSession } from '@/lib/session';
import { font, radius, useTheme } from '@/lib/theme';

/** Mesa de control: confirma o rechaza los sellos que necesitan validación (p. ej. fútbol). */
export default function Validar() {
  const t = useTheme();
  const { rows, error } = usePendingApprovals();
  const [done, setDone] = useState<{ name: string; ok: boolean } | null>(null);

  return (
    <Screen>
      <Row>
        <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" color={t.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="h2">Validar sellos</T>
          <T v="small">{rows ? `${rows.length} pendiente${rows.length === 1 ? '' : 's'}` : 'Cargando…'}</T>
        </View>
      </Row>
      <T v="small">Confirma solo a quienes viste participar. Al aprobar, el colaborador recibe sus puntos; si rechazas, puede volver a registrarse hoy.</T>
      {done ? (
        <Card style={{ backgroundColor: done.ok ? t.ok + '1A' : t.warn + '1A', borderColor: 'transparent' }}>
          <T color={done.ok ? t.ok : t.warn}>{done.ok ? `Sello de ${done.name} aprobado.` : `Sello de ${done.name} rechazado.`}</T>
        </Card>
      ) : null}
      {error ? <Card><T color={t.warn}>{error}</T></Card> : !rows ? <Loading /> : rows.length === 0 ? (
        <Card><Empty text="No hay sellos pendientes. Cuando alguien escanee un QR que requiere validación, aparecerá aquí." /></Card>
      ) : rows.map((p) => <PendingCard key={p.id} p={p} onDone={(ok) => setDone({ name: p.name, ok })} />)}
    </Screen>
  );
}

function PendingCard({ p, onDone }: { p: PendingStamp; onDone: (ok: boolean) => void }) {
  const t = useTheme();
  const { user } = useSession();
  const [busy, setBusy] = useState<'ok' | 'no' | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const own = p.uid === user?.uid;

  async function review(approve: boolean) {
    setBusy(approve ? 'ok' : 'no'); setErr(null);
    try { await reviewActivity({ approvalId: p.id, approve, note: approve ? undefined : note.trim() || undefined }); onDone(approve); }
    catch (e) { setErr(errorMessage(e)); setBusy(null); }
  }

  return (
    <Card>
      <Row style={{ alignItems: 'center', gap: 12 }}>
        <Stamp activity={p.activity} at={p.at} number={p.stampNumber} status="pending" size={84} />
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontFamily: font.bold }} numberOfLines={1}>{p.name}</T>
          <T v="small">{p.dept}</T>
          <T v="small">{ACTIVITIES[p.activity].name} · {relativeDay(p.at)}, {new Date(p.at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' })}</T>
          <T v="small" numberOfLines={1}>{p.location}</T>
        </View>
      </Row>
      {own ? <T v="small">Es tu propio sello: otra persona de la mesa de control debe validarlo.</T> : rejecting ? (
        <View style={{ gap: 8 }}>
          <TextInput
            nativeID={`nota-${p.id}`} accessibilityLabel="Motivo del rechazo" value={note} onChangeText={setNote} maxLength={200}
            placeholder="Motivo (opcional), p. ej. no estaba en el partido" placeholderTextColor={t.muted}
            style={{ fontFamily: font.medium, fontSize: 15, color: t.ink, borderWidth: 1.5, borderColor: t.line, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 48 }}
          />
          <Row>
            <View style={{ flex: 1 }}><Button title="Cancelar" variant="ghost" onPress={() => setRejecting(false)} /></View>
            <View style={{ flex: 1 }}><Button title="Rechazar" variant="dark" loading={busy === 'no'} onPress={() => review(false)} /></View>
          </Row>
        </View>
      ) : (
        <Row>
          <View style={{ flex: 1 }}><Button title="Rechazar" variant="ghost" icon="close" onPress={() => setRejecting(true)} /></View>
          <View style={{ flex: 1 }}><Button title="Aprobar" icon="check" loading={busy === 'ok'} onPress={() => review(true)} /></View>
        </Row>
      )}
      {err ? <T v="small" color={t.warn}>{err}</T> : null}
    </Card>
  );
}
