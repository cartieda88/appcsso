import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { cancelEvent, errorMessage, saveEvent, setAttendance, type EventType } from '@/lib/api';
import { useAttending, useUpcomingEvents, type EventItem } from '@/lib/data';
import { useSession } from '@/lib/session';
import { font, radius, useTheme } from '@/lib/theme';
import { Icon } from './icon';
import { Button, Card, Chip, Empty, Loading, Row, Segmented, T } from './ui';

const TZ = 'America/Guayaquil';
const TYPES: [EventType, string][] = [['carrera', 'Carrera'], ['campeonato', 'Campeonato'], ['caminata', 'Caminata'], ['charla', 'Charla'], ['otro', 'Otro']];
const typeLabel = (t: EventType) => TYPES.find(([k]) => k === t)?.[1] ?? 'Actividad';

const fmtDate = (ms: number) => {
  const s = new Date(ms).toLocaleDateString('es-EC', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('es-EC', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
function countdown(ms: number) {
  const h = (ms - Date.now()) / 3600_000;
  if (h <= 0) return 'En curso';
  if (h < 24) return `En ${Math.max(1, Math.round(h))} h`;
  return `En ${Math.round(h / 24)} día${Math.round(h / 24) === 1 ? '' : 's'}`;
}

/** Agenda del Comité: carreras, campeonatos, caminatas… con inscripción y recordatorios. */
export function Agenda() {
  const t = useTheme();
  const { isAdmin } = useSession();
  const { rows, error } = useUpcomingEvents();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <Card style={{ backgroundColor: t.brandSoft, borderColor: 'transparent' }}>
        <Row style={{ alignItems: 'flex-start' }}>
          <Icon name="bell" color={t.brandText} />
          <T v="small" color={t.ink} style={{ flex: 1 }}>Al inscribirte te avisamos con una notificación 24 horas antes y el mismo día, con fecha, hora y lugar, para que te prepares.</T>
        </Row>
      </Card>
      {isAdmin ? (creating ? <EventForm onDone={() => setCreating(false)} /> : <Button title="Publicar actividad" icon="plus" variant="ghost" onPress={() => setCreating(true)} />) : null}
      {error ? <Card><T color={t.warn}>{error}</T></Card> : !rows ? <Loading /> : rows.length === 0 ? (
        <Card><Empty text="No hay actividades programadas. Cuando el Comité publique una carrera o campeonato te llegará una notificación." /></Card>
      ) : rows.map((e) => <EventCard key={e.id} e={e} />)}
    </>
  );
}

function EventCard({ e }: { e: EventItem }) {
  const t = useTheme();
  const { isAdmin } = useSession();
  const going = useAttending(e.id);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function toggle() {
    setBusy(true); setMsg(null);
    try { await setAttendance({ eventId: e.id, going: !going }); } catch (err) { setMsg(errorMessage(err)); } finally { setBusy(false); }
  }
  if (editing) return <EventForm initial={e} onDone={() => setEditing(false)} />;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Chip tone="brand" label={typeLabel(e.type)} />
        <T v="small">{countdown(e.startsAt)}</T>
      </Row>
      <T v="h3">{e.title}</T>
      <View style={{ gap: 6 }}>
        <Row><Icon name="calendar" color={t.muted} size={18} /><T style={{ flex: 1 }}>{fmtDate(e.startsAt)}, {fmtTime(e.startsAt)}</T></Row>
        <Row><Icon name="pin" color={t.muted} size={18} /><T style={{ flex: 1 }}>{e.location}</T></Row>
      </View>
      {e.description ? <T v="small">{e.description}</T> : null}
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="small">{e.attendees} inscrito{e.attendees === 1 ? '' : 's'}</T>
        {going ? <Chip tone="ok" label="Estás inscrito" /> : null}
      </Row>
      <Button title={going ? 'Cancelar inscripción' : 'Me apunto'} icon={going ? 'close' : 'check'} variant={going ? 'ghost' : 'primary'} loading={busy || going === null} onPress={toggle} />
      {isAdmin ? (
        <Row>
          <View style={{ flex: 1 }}><Button title="Editar" variant="ghost" onPress={() => setEditing(true)} /></View>
          <View style={{ flex: 1 }}><Button title="Anular" variant="ghost" onPress={async () => { try { await cancelEvent({ id: e.id }); } catch (err) { setMsg(errorMessage(err)); } }} /></View>
        </Row>
      ) : null}
      {msg ? <T v="small" color={t.warn}>{msg}</T> : null}
    </Card>
  );
}

/** Formulario de Talento Humano / Comité para publicar o editar una actividad. */
function EventForm({ initial, onDone }: { initial?: EventItem; onDone: () => void }) {
  const t = useTheme();
  const local = initial ? new Date(initial.startsAt - 5 * 3600_000).toISOString() : '';
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState<EventType>(initial?.type ?? 'carrera');
  const [date, setDate] = useState(local.slice(0, 10));
  const [time, setTime] = useState(local.slice(11, 16));
  const [location, setLocation] = useState(initial?.location ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [audience, setAudience] = useState<'all' | 'attendees'>(initial?.audience ?? 'all');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const input = { fontFamily: font.medium, fontSize: 15, color: t.ink, borderWidth: 1.5, borderColor: t.line, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 48, backgroundColor: t.surface } as const;

  async function submit() {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
    const h = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!d || !h) { setMsg('Escribe la fecha como AAAA-MM-DD y la hora como HH:MM (24 h).'); return; }
    const startsAt = Date.UTC(+d[1], +d[2] - 1, +d[3], +h[1] + 5, +h[2]); // hora de Ecuador (UTC-5)
    setBusy(true); setMsg(null);
    try {
      const { data } = await saveEvent({ id: initial?.id, title, type, location, description, startsAt, audience });
      setMsg(data.notified ? `Publicado. Notificación enviada a ${data.notified} teléfonos.` : 'Guardado.');
      setTimeout(onDone, 900);
    } catch (e) { setMsg(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <Card>
      <T v="h3">{initial ? 'Editar actividad' : 'Nueva actividad'}</T>
      <TextInput nativeID="ev-title" accessibilityLabel="Título" value={title} onChangeText={setTitle} placeholder="Título, p. ej. Carrera 5K Netlife" placeholderTextColor={t.muted} style={input} maxLength={80} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {TYPES.map(([k, l]) => (
          <Button key={k} title={l} variant={k === type ? 'primary' : 'ghost'} onPress={() => setType(k)} />
        ))}
      </View>
      <Row>
        <TextInput nativeID="ev-date" accessibilityLabel="Fecha (AAAA-MM-DD)" value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" placeholderTextColor={t.muted} style={[input, { flex: 1.4, minWidth: 0, width: 0 }]} maxLength={10} />
        <TextInput nativeID="ev-time" accessibilityLabel="Hora (HH:MM)" value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={t.muted} style={[input, { flex: 1, minWidth: 0, width: 0 }]} maxLength={5} />
      </Row>
      <TextInput nativeID="ev-location" accessibilityLabel="Lugar" value={location} onChangeText={setLocation} placeholder="Lugar" placeholderTextColor={t.muted} style={input} maxLength={120} />
      <TextInput nativeID="ev-desc" accessibilityLabel="Descripción" value={description} onChangeText={setDescription} placeholder="Descripción (recorrido, qué llevar…)" placeholderTextColor={t.muted} style={[input, { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }]} multiline maxLength={600} />
      <T v="small" color={t.ink}>Recordatorios de 24 h y del mismo día para</T>
      <Segmented<'all' | 'attendees'> options={[['all', 'Todo el personal'], ['attendees', 'Solo inscritos']]} value={audience} onChange={setAudience} />
      {msg ? <T v="small" color={msg.startsWith('Publicado') || msg === 'Guardado.' ? t.ok : t.warn}>{msg}</T> : null}
      <Row>
        <View style={{ flex: 1 }}><Button title="Cancelar" variant="ghost" onPress={onDone} /></View>
        <View style={{ flex: 1 }}><Button title={initial ? 'Guardar' : 'Publicar'} loading={busy} onPress={submit} /></View>
      </Row>
    </Card>
  );
}
