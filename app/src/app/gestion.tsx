import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Modal, Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { NetlifeLogo } from '@/components/brand';
import { ACTIVITY_ICONS, Icon } from '@/components/icon';
import { QrCode } from '@/components/qr-code';
import { ActivityDot, Button, Card, Chip, Empty, Loading, Row, Screen, Segmented, T } from '@/components/ui';
import { errorMessage, saveActivity, saveDepartment, savePerson, saveQrPoint, type Role } from '@/lib/api';
import { useCatalog, type ActivityInfo } from '@/lib/catalog';
import { useDepartments, usePeople, useQrPoints, type Person, type QrPoint } from '@/lib/data';
import { app } from '@/lib/firebase-config';
import { useSession } from '@/lib/session';
import { ACTIVITY_COLORS, font, radius, useTheme } from '@/lib/theme';

type Tab = 'actividades' | 'qr' | 'personas' | 'deptos';

/** Gestión de Talento Humano / Comité: actividades, puntos QR, personas y departamentos. */
export default function Gestion() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('actividades');
  return (
    <Screen>
      <Row>
        <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={backBtn(t)}>
          <Icon name="back" color={t.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="h2">Gestión</T>
          <T v="small">Solo administradores</T>
        </View>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {([['actividades', 'Actividades'], ['qr', 'Puntos QR'], ['personas', 'Personas'], ['deptos', 'Departamentos']] as [Tab, string][]).map(([k, l]) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)}
            style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 99, backgroundColor: tab === k ? t.brand : t.surface2 }}>
            <T style={{ fontFamily: font.bold, fontSize: 14 }} color={tab === k ? t.brandInk : t.ink}>{l}</T>
          </Pressable>
        ))}
      </ScrollView>
      {tab === 'actividades' ? <Actividades /> : tab === 'qr' ? <PuntosQr /> : tab === 'personas' ? <Personas /> : <Departamentos />}
    </Screen>
  );
}

const backBtn = (t: ReturnType<typeof useTheme>) => ({
  width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, alignItems: 'center' as const, justifyContent: 'center' as const,
});

function useInput() {
  const t = useTheme();
  return { fontFamily: font.medium, fontSize: 15, color: t.ink, borderWidth: 1.5, borderColor: t.line, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 48, backgroundColor: t.surface } as const;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ gap: 6 }}><T v="small" color={t.ink}>{label}</T>{children}</View>;
}

function Toggle({ label, help, value, onChange }: { label: string; help?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Row style={{ alignItems: 'flex-start' }}>
      <View style={{ flex: 1 }}><T style={{ fontFamily: font.semibold }}>{label}</T>{help ? <T v="small">{help}</T> : null}</View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: t.brand, false: t.line }} thumbColor="#FFFFFF" />
    </Row>
  );
}

function Stepper({ value, onChange, min, max, step = 1, suffix = '' }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  const t = useTheme();
  const btn = { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: t.line, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <Row>
      <Pressable accessibilityLabel="Menos" onPress={() => onChange(Math.max(min, value - step))} style={btn}><T v="h3">−</T></Pressable>
      <T v="num" style={{ minWidth: 70, textAlign: 'center' }}>{value}{suffix}</T>
      <Pressable accessibilityLabel="Más" onPress={() => onChange(Math.min(max, value + step))} style={btn}><T v="h3">+</T></Pressable>
    </Row>
  );
}

/* ============================== Actividades ============================== */

function Actividades() {
  const t = useTheme();
  const cat = useCatalog();
  const [editing, setEditing] = useState<ActivityInfo | 'new' | null>(null);
  if (editing) return <ActivityForm initial={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;
  return (
    <>
      <T v="small">Crea actividades nuevas (por ejemplo Yoga, Bailoterapia, Ciclismo) y define cuántos puntos dan. Después crea su punto QR en "Puntos QR".</T>
      <Button title="Nueva actividad" icon="plus" onPress={() => setEditing('new')} />
      {cat.all.map((a) => (
        <Card key={a.id} style={{ opacity: a.active ? 1 : 0.6 }}>
          <Row>
            <ActivityDot activity={a.id} />
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: font.bold }}>{a.name}</T>
              <T v="small">+{a.points} pts · {a.rule}</T>
            </View>
            {!a.active ? <Chip tone="warn" label="Inactiva" /> : a.kind === 'app' ? <Chip label="En la app" /> : <Chip label="QR" />}
          </Row>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {a.passport ? <Chip tone="brand" label="Cuenta para Pasaporte completo" /> : null}
            {a.requiresApproval ? <Chip tone="neutral" label="Requiere validación" /> : null}
          </Row>
          <Button title="Editar" variant="ghost" onPress={() => setEditing(a)} />
        </Card>
      ))}
      <T v="small" color={t.muted}>Pausa activa y Meta de pasos se registran dentro de la app; puedes cambiar sus puntos y límites, pero no crearles QR.</T>
    </>
  );
}

function ActivityForm({ initial, onDone }: { initial: ActivityInfo | null; onDone: () => void }) {
  const t = useTheme();
  const input = useInput();
  const [name, setName] = useState(initial?.name ?? '');
  const [points, setPoints] = useState(initial?.points ?? 10);
  const [maxPerDay, setMaxPerDay] = useState(initial?.maxPerDay ?? 1);
  const [cooldown, setCooldown] = useState(initial?.cooldownMinutes ?? 0);
  const [requiresApproval, setRequiresApproval] = useState(initial?.requiresApproval ?? false);
  const [passport, setPassport] = useState(initial?.passport ?? false);
  const [active, setActive] = useState(initial?.active ?? true);
  const [icon, setIcon] = useState(initial?.icon ?? 'star');
  const [color, setColor] = useState(initial?.color ?? 'cielo');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setMsg(null);
    try {
      await saveActivity({ id: initial?.id, name, points, maxPerDay, cooldownMinutes: cooldown, kind: initial?.kind ?? 'qr', requiresApproval, passport, active, icon, color, order: initial?.order });
      onDone();
    } catch (e) { setMsg(errorMessage(e)); setBusy(false); }
  }

  return (
    <Card>
      <T v="h3">{initial ? `Editar ${initial.name}` : 'Nueva actividad'}</T>
      <Field label="Nombre">
        <TextInput nativeID="act-name" accessibilityLabel="Nombre de la actividad" value={name} onChangeText={setName} placeholder="Ej. Yoga" placeholderTextColor={t.muted} style={input} maxLength={40} />
      </Field>
      <Field label="Puntos por registro"><Stepper value={points} onChange={setPoints} min={1} max={100} /></Field>
      <Field label="Registros por persona al día"><Stepper value={maxPerDay} onChange={setMaxPerDay} min={1} max={10} /></Field>
      <Field label="Tiempo mínimo entre registros">
        <Segmented<string> options={[['0', 'Sin límite'], ['30', '30 min'], ['60', '1 hora'], ['120', '2 horas']]} value={String(cooldown)} onChange={(v) => setCooldown(Number(v))} />
      </Field>
      <Toggle label="Requiere validación" help="El sello queda pendiente hasta que la mesa de control lo apruebe." value={requiresApproval} onChange={setRequiresApproval} />
      <Toggle label="Cuenta para Pasaporte completo" help="El logro mensual pedirá un sello de esta actividad." value={passport} onChange={setPassport} />
      <Toggle label="Activa" help="Si la desactivas, sus QR dejan de registrar; los sellos ya ganados se conservan." value={active} onChange={setActive} />
      <Field label="Ícono">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ACTIVITY_ICONS.map((i) => (
            <Pressable key={i} accessibilityLabel={`Ícono ${i}`} accessibilityState={{ selected: icon === i }} onPress={() => setIcon(i)}
              style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: icon === i ? t.brand : t.line, backgroundColor: icon === i ? t.brandSoft : t.surface }}>
              <Icon name={i} color={t.ink} />
            </Pressable>
          ))}
        </View>
      </Field>
      <Field label="Color">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ACTIVITY_COLORS.map((c) => (
            <Pressable key={c} accessibilityLabel={`Color ${c}`} accessibilityState={{ selected: color === c }} onPress={() => setColor(c)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.act[c], borderWidth: 3, borderColor: color === c ? t.ink : 'transparent' }} />
          ))}
        </View>
      </Field>
      <Row>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: t.act[color as keyof typeof t.act] ?? t.act.gradas, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} color={t.dotInk} size={28} />
        </View>
        <T v="small" style={{ flex: 1 }}>Así se verá en la app y en los sellos del pasaporte.</T>
      </Row>
      {msg ? <T v="small" color={t.warn}>{msg}</T> : null}
      <Row>
        <View style={{ flex: 1 }}><Button title="Cancelar" variant="ghost" onPress={onDone} /></View>
        <View style={{ flex: 1 }}><Button title="Guardar" loading={busy} disabled={name.trim().length < 3} onPress={submit} /></View>
      </Row>
    </Card>
  );
}

/* ============================== Puntos QR ============================== */

const webBase = () =>
  process.env.EXPO_PUBLIC_WEB_URL ?? (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : `https://${app.options.projectId}.web.app`);
const qrLink = (p: { id: string; token: string }) => `${webBase().replace(/\/+$/, '')}/r/${p.id}/${p.token}`;

function PuntosQr() {
  const t = useTheme();
  const cat = useCatalog();
  const input = useInput();
  const { rows, error } = useQrPoints();
  const qrActs = cat.qr;
  const [activity, setActivity] = useState<string>(qrActs[0]?.id ?? '');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [show, setShow] = useState<QrPoint | null>(null);

  async function create() {
    setBusy(true); setMsg(null);
    try {
      const { data } = await saveQrPoint({ activity, location });
      setLocation('');
      setShow({ id: data.id, token: data.token, activity, location, active: true, requiresApproval: false });
    } catch (e) { setMsg(errorMessage(e)); } finally { setBusy(false); }
  }

  const grouped = useMemo(() => {
    const g = new Map<string, QrPoint[]>();
    (rows ?? []).forEach((r) => g.set(r.activity, [...(g.get(r.activity) ?? []), r]));
    return [...g.entries()].sort(([a], [b]) => cat.get(a).order - cat.get(b).order);
  }, [rows, cat]);

  return (
    <>
      <Card>
        <T v="h3">Nuevo punto QR</T>
        <T v="small">Un QR por cada lugar: por ejemplo cada piso de gradas o la entrada del salón de yoga.</T>
        <Field label="Actividad">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {qrActs.map((a) => <Button key={a.id} title={a.name} variant={a.id === activity ? 'primary' : 'ghost'} onPress={() => setActivity(a.id)} />)}
          </View>
        </Field>
        <Field label="Lugar">
          <TextInput nativeID="qr-location" accessibilityLabel="Lugar del QR" value={location} onChangeText={setLocation} placeholder="Ej. Terraza · Edificio A" placeholderTextColor={t.muted} style={input} maxLength={80} />
        </Field>
        {msg ? <T v="small" color={t.warn}>{msg}</T> : null}
        <Button title="Crear punto QR" icon="qr" loading={busy} disabled={!activity || location.trim().length < 3} onPress={create} />
      </Card>

      {error ? <Card><T color={t.warn}>{error}</T></Card> : !rows ? <Loading /> : grouped.length === 0 ? <Card><Empty text="Aún no hay puntos QR." /></Card> : grouped.map(([act, pts]) => (
        <Card key={act}>
          <Row><ActivityDot activity={act} size={34} /><T v="h3" style={{ flex: 1 }}>{cat.get(act).name}</T><T v="small">{pts.length} punto{pts.length === 1 ? '' : 's'}</T></Row>
          {pts.map((p) => (
            <Row key={p.id} style={{ borderTopWidth: 1, borderTopColor: t.line, paddingTop: 10, opacity: p.active ? 1 : 0.55 }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: font.semibold }}>{p.location}</T>
                <T v="small">{p.id}{p.active ? '' : ' · desactivado'}{p.requiresApproval ? ' · requiere validación' : ''}</T>
              </View>
              <Button title="Ver QR" variant="ghost" onPress={() => setShow(p)} />
            </Row>
          ))}
        </Card>
      ))}
      <QrModal point={show} onClose={() => setShow(null)} onChanged={(p) => setShow(p)} />
    </>
  );
}

function QrModal({ point, onClose, onChanged }: { point: QrPoint | null; onClose: () => void; onChanged: (p: QrPoint) => void }) {
  const t = useTheme();
  const cat = useCatalog();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  if (!point) return null;
  const a = cat.get(point.activity);
  const link = qrLink(point);

  async function share() {
    setBusy('share'); setMsg(null);
    try {
      const target = ref as unknown as Parameters<typeof captureRef>[0];
      if (Platform.OS === 'web') {
        const uri = await captureRef(target, { format: 'png', quality: 1, result: 'data-uri' });
        const el = document.createElement('a'); el.href = uri; el.download = `QR-${point!.id}.png`; el.click();
      } else {
        const uri = await captureRef(target, { format: 'png', quality: 1, result: 'tmpfile', fileName: `QR-${point!.id}` });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Imprimir o compartir QR', UTI: 'public.png' });
      }
    } catch { setMsg('No se pudo crear la imagen.'); } finally { setBusy(null); }
  }
  async function update(patch: { active?: boolean; rotate?: boolean }) {
    setBusy(patch.rotate ? 'rotate' : 'active'); setMsg(null);
    try {
      const { data } = await saveQrPoint({ id: point!.id, ...patch });
      onChanged({ ...point!, token: data.token, active: patch.active ?? point!.active });
      if (patch.rotate) { setMsg('Clave cambiada: imprime y reemplaza este QR; el anterior ya no sirve.'); setConfirmRotate(false); }
    } catch (e) { setMsg(errorMessage(e)); } finally { setBusy(null); }
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: 20 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Card style={{ maxWidth: 440, width: '100%', alignSelf: 'center', gap: 12 }}>
            {/* Lo que está dentro se imprime / comparte */}
            <View ref={ref} collapsable={false} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, borderWidth: 6, borderColor: '#F5AD20' }}>
              <NetlifeLogo height={30} />
              <T style={{ fontFamily: font.black, fontSize: 28, color: '#141416' }}>{a.name}</T>
              <QrCode value={link} size={230} />
              <T style={{ fontFamily: font.bold, fontSize: 16, color: '#141416', textAlign: 'center' }}>{point.location}</T>
              <T style={{ fontSize: 13, color: '#3D4046', textAlign: 'center' }}>Escanéalo con la cámara del teléfono y suma {a.points} puntos</T>
              <T style={{ fontSize: 11, color: '#6B6F76' }}>{point.id}</T>
            </View>
            <T v="small" selectable style={{ textAlign: 'center' }}>{link}</T>
            {msg ? <T v="small" color={msg.startsWith('Clave') ? t.ok : t.warn} style={{ textAlign: 'center' }}>{msg}</T> : null}
            <Button title={Platform.OS === 'web' ? 'Descargar imagen para imprimir' : 'Compartir / imprimir'} icon="share" loading={busy === 'share'} onPress={share} />
            {confirmRotate ? (
              <Card style={{ borderColor: t.warn }}>
                <T v="small" color={t.ink}>El QR impreso actual dejará de funcionar. Úsalo si alguien difundió una foto del código.</T>
                <Row>
                  <View style={{ flex: 1 }}><Button title="No" variant="ghost" onPress={() => setConfirmRotate(false)} /></View>
                  <View style={{ flex: 1 }}><Button title="Cambiar clave" variant="dark" loading={busy === 'rotate'} onPress={() => update({ rotate: true })} /></View>
                </Row>
              </Card>
            ) : (
              <Row>
                <View style={{ flex: 1 }}><Button title="Cambiar clave" variant="ghost" onPress={() => setConfirmRotate(true)} /></View>
                <View style={{ flex: 1 }}><Button title={point.active ? 'Desactivar' : 'Activar'} variant="ghost" loading={busy === 'active'} onPress={() => update({ active: !point.active })} /></View>
              </Row>
            )}
            <Button title="Cerrar" variant="ghost" onPress={onClose} />
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ============================== Personas ============================== */

const ROLE_LABEL: Record<Role, string> = { colaborador: 'Colaborador', validador: 'Validador', admin: 'Administrador' };

function Personas() {
  const t = useTheme();
  const input = useInput();
  const { rows, error } = usePeople();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Person | 'new' | null>(null);
  if (editing) return <PersonForm initial={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;
  const list = (rows ?? []).filter((p) => !q || `${p.name} ${p.email} ${p.dept}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  const admins = (rows ?? []).filter((p) => p.role === 'admin' && p.active).length;
  return (
    <>
      <T v="small">Solo las personas de esta lista pueden ingresar. Los administradores ven el Panel y Gestión; los validadores aprueban sellos pendientes.</T>
      <Button title="Agregar persona" icon="plus" onPress={() => setEditing('new')} />
      <TextInput nativeID="people-search" accessibilityLabel="Buscar persona" value={q} onChangeText={setQ} placeholder="Buscar por nombre, correo o departamento" placeholderTextColor={t.muted} style={input} />
      {error ? <Card><T color={t.warn}>{error}</T></Card> : !rows ? <Loading /> : (
        <Card style={{ gap: 0 }}>
          <T v="small" style={{ paddingBottom: 8 }}>{rows.length} personas · {admins} administrador{admins === 1 ? '' : 'es'}</T>
          {list.length === 0 ? <Empty text="Sin resultados." /> : list.map((p, i) => (
            <Pressable key={p.email} accessibilityRole="button" onPress={() => setEditing(p)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, opacity: p.active ? 1 : 0.5 }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: font.semibold }} numberOfLines={1}>{p.name}</T>
                <T v="small" numberOfLines={1}>{p.email} · {p.dept}</T>
              </View>
              {!p.active ? <Chip tone="warn" label="De baja" /> : p.role !== 'colaborador' ? <Chip tone="brand" label={ROLE_LABEL[p.role]} /> : null}
            </Pressable>
          ))}
        </Card>
      )}
    </>
  );
}

function PersonForm({ initial, onDone }: { initial: Person | null; onDone: () => void }) {
  const t = useTheme();
  const input = useInput();
  const { user } = useSession();
  const depts = useDepartments();
  const [email, setEmail] = useState(initial?.email ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [dept, setDept] = useState(initial?.dept ?? '');
  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? '');
  const [role, setRole] = useState<Role>(initial?.role ?? 'colaborador');
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const isMe = !!initial && initial.email === user?.email;

  async function submit() {
    setBusy(true); setMsg(null);
    try { await savePerson({ email, name, dept, employeeId, role, active }); onDone(); }
    catch (e) { setMsg(errorMessage(e)); setBusy(false); }
  }

  return (
    <Card>
      <T v="h3">{initial ? initial.name : 'Agregar persona'}</T>
      <Field label="Correo institucional">
        <TextInput nativeID="p-email" accessibilityLabel="Correo" value={email} onChangeText={setEmail} editable={!initial} autoCapitalize="none" keyboardType="email-address" placeholder="nombre@netlife.net.ec" placeholderTextColor={t.muted} style={[input, initial ? { opacity: 0.6 } : null]} />
      </Field>
      <Field label="Nombre y apellido">
        <TextInput nativeID="p-name" accessibilityLabel="Nombre" value={name} onChangeText={setName} placeholder="Nombre Apellido" placeholderTextColor={t.muted} style={input} maxLength={80} />
      </Field>
      <Field label="Departamento">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(depts.rows ?? []).sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
            <Pressable key={d.id} onPress={() => setDept(d.name)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: dept === d.name ? t.brand : t.surface2 }}>
              <T style={{ fontFamily: font.bold, fontSize: 13 }} color={dept === d.name ? t.brandInk : t.ink}>{d.name}</T>
            </Pressable>
          ))}
        </View>
      </Field>
      <Field label="Cédula (opcional)">
        <TextInput nativeID="p-id" accessibilityLabel="Cédula" value={employeeId} onChangeText={setEmployeeId} keyboardType="number-pad" placeholder="0000000000" placeholderTextColor={t.muted} style={input} maxLength={13} />
      </Field>
      <Field label="Rol">
        <Segmented<Role> options={[['colaborador', 'Colaborador'], ['validador', 'Validador'], ['admin', 'Admin']]} value={role} onChange={setRole} />
      </Field>
      <T v="small">{role === 'admin' ? 'Ve el Panel de Talento Humano y Gestión: actividades, QR, personas y eventos.' : role === 'validador' ? 'Aprueba o rechaza sellos pendientes (por ejemplo, fútbol).' : 'Registra actividades y participa en retos y ranking.'}</T>
      <Toggle label="Activo" help="Si lo das de baja, no podrá ingresar; su historial se conserva." value={active} onChange={setActive} />
      {isMe ? <T v="small" color={t.muted}>No puedes quitarte tu propio rol de administrador ni darte de baja.</T> : null}
      {msg ? <T v="small" color={t.warn}>{msg}</T> : null}
      <Row>
        <View style={{ flex: 1 }}><Button title="Cancelar" variant="ghost" onPress={onDone} /></View>
        <View style={{ flex: 1 }}><Button title="Guardar" loading={busy} disabled={!email || !name || !dept} onPress={submit} /></View>
      </Row>
    </Card>
  );
}

/* ============================== Departamentos ============================== */

function Departamentos() {
  const t = useTheme();
  const input = useInput();
  const { rows, error } = useDepartments();
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  async function save(n: string, headcount: number) {
    setMsg(null);
    try { await saveDepartment({ name: n, headcount }); } catch (e) { setMsg(errorMessage(e)); }
  }
  return (
    <>
      <T v="small">El número de personas de cada departamento se usa para el ranking por departamentos (puntos promedio por persona) y para el % de participación.</T>
      {error ? <Card><T color={t.warn}>{error}</T></Card> : !rows ? <Loading /> : (
        <Card>
          {rows.sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
            <Row key={d.id} style={{ justifyContent: 'space-between' }}>
              <T style={{ flex: 1, fontFamily: font.semibold }}>{d.name}</T>
              <Stepper value={d.headcount} onChange={(n) => save(d.name, n)} min={0} max={5000} suffix=" pers." />
            </Row>
          ))}
        </Card>
      )}
      <Card>
        <T v="h3">Nuevo departamento</T>
        <TextInput nativeID="dept-name" accessibilityLabel="Nombre del departamento" value={name} onChangeText={setName} placeholder="Ej. Atención al Cliente" placeholderTextColor={t.muted} style={input} maxLength={60} />
        <Button title="Agregar" icon="plus" disabled={name.trim().length < 2} onPress={async () => { await save(name.trim(), 0); setName(''); }} />
      </Card>
      {msg ? <T v="small" color={t.warn}>{msg}</T> : null}
    </>
  );
}
