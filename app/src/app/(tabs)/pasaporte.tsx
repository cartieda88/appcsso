import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { NetlifeLogo } from '@/components/brand';
import { Icon } from '@/components/icon';
import { LogrosView } from '@/components/logros-view';
import { Stamp, StampSlot, stampDate } from '@/components/stamp';
import { Button, Card, Chip, Loading, Progress, Row, Screen, Segmented, T } from '@/components/ui';
import { usePassport, type ActivityLog } from '@/lib/data';
import { ACTIVITIES, ACTIVITY_IDS, dayKey, PAGE_SIZE, PASSPORT_BONUS } from '@/lib/program';
import { useSession } from '@/lib/session';
import { font, radius, useTheme } from '@/lib/theme';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const SLOTS_PER_PAGE = PAGE_SIZE;

function currentMonth() {
  const [y, m] = dayKey().split('-').map(Number);
  return { y, m };
}

export default function Pasaporte() {
  const [view, setView] = useState<'sellos' | 'logros'>('sellos');
  return (
    <Screen>
      <T v="h2">Mi pasaporte</T>
      <Segmented<'sellos' | 'logros'> options={[['sellos', 'Sellos'], ['logros', 'Nivel e insignias']]} value={view} onChange={setView} />
      {view === 'sellos' ? <Sellos /> : <LogrosView />}
    </Screen>
  );
}

function Sellos() {
  const t = useTheme();
  const { profile, user } = useSession();
  const now = currentMonth();
  const [page, setPage] = useState(now);
  const [open, setOpen] = useState<ActivityLog | null>(null);
  const { rows, error } = usePassport(page.y, page.m);
  const isCurrent = page.y === now.y && page.m === now.m;
  const move = (d: number) => setPage(({ y, m }) => {
    const i = y * 12 + (m - 1) + d;
    return { y: Math.floor(i / 12), m: (i % 12) + 1 };
  });

  const pageRef = useRef<ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const approved = rows?.filter((r) => r.status === 'approved') ?? [];
  const pending = rows?.filter((r) => r.status === 'pending').length ?? 0;
  const monthKinds = new Set(approved.map((r) => r.activity)).size;
  const monthData = profile?.stats.months?.[`${page.y}-${String(page.m).padStart(2, '0')}`];

  async function sharePage() {
    if (!pageRef.current) return;
    setSharing(true); setShareMsg(null);
    try {
      const name = `pasaporte-muevete-${page.y}-${String(page.m).padStart(2, '0')}`;
      if (Platform.OS === 'web') {
        const uri = await captureRef(pageRef as unknown as Parameters<typeof captureRef>[0], { format: 'png', quality: 1, result: 'data-uri' });
        const a = document.createElement('a'); a.href = uri; a.download = `${name}.png`; a.click();
      } else {
        const uri = await captureRef(pageRef as unknown as Parameters<typeof captureRef>[0], { format: 'png', quality: 1, result: 'tmpfile', fileName: name });
        if (!(await Sharing.isAvailableAsync())) { setShareMsg('Este teléfono no permite compartir imágenes.'); return; }
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir mi pasaporte', UTI: 'public.png' });
      }
    } catch {
      setShareMsg('No se pudo crear la imagen. Inténtalo otra vez.');
    } finally { setSharing(false); }
  }

  const stats = profile?.stats;
  const kinds = stats ? ACTIVITY_IDS.filter((a) => (stats.counts[a] ?? 0) > 0).length : 0;
  const slots = rows ? Math.max(SLOTS_PER_PAGE, Math.ceil(rows.length / 3) * 3) - rows.length : 0;

  return (
    <>
      {/* Portada del pasaporte */}
      <View style={{ backgroundColor: t.hero, borderRadius: radius.lg, padding: 18, gap: 14 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 2, flex: 1 }}>
            <T v="label" color={t.brand}>Pasaporte Muévete</T>
            <T v="h2" color={t.heroInk} numberOfLines={1}>{profile?.name ?? ''}</T>
            <T v="small" color={t.heroInk}>{profile?.dept ?? ''}</T>
          </View>
          <NetlifeLogo height={26} />
        </Row>
        <Row style={{ gap: 8 }}>
          {[
            [String(stats?.totalActivities ?? 0), 'sellos'],
            [`${kinds}/${ACTIVITY_IDS.length}`, 'actividades'],
            [String(stats?.activeDays ?? 0), 'días activos'],
          ].map(([v, l]) => (
            <View key={l} style={{ flex: 1, backgroundColor: t.heroTile, borderRadius: 14, padding: 10 }}>
              <T v="num" color={t.brand} style={{ fontSize: 22 }}>{v}</T>
              <T v="small" color={t.heroInk}>{l}</T>
            </View>
          ))}
        </Row>
        <T v="small" color={t.heroInk} style={{ fontFamily: font.semibold, letterSpacing: 1 }}>
          N° {(profile?.employeeId ?? user?.uid.slice(0, 10) ?? '').toUpperCase()}
        </T>
      </View>

      {/* Página del mes */}
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable accessibilityLabel="Mes anterior" onPress={() => move(-1)} style={navBtn(t)}>
          <Icon name="back" color={t.ink} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <T v="h3">{MONTH_NAMES[page.m - 1]} {page.y}</T>
          <T v="small">{rows ? `${rows.length} sello${rows.length === 1 ? '' : 's'}${pending ? ` · ${pending} pendiente${pending === 1 ? '' : 's'}` : ''}` : ' '}</T>
        </View>
        <Pressable accessibilityLabel="Mes siguiente" disabled={isCurrent} onPress={() => move(1)} style={[navBtn(t), { opacity: isCurrent ? 0.3 : 1 }]}>
          <View style={{ transform: [{ scaleX: -1 }] }}><Icon name="back" color={t.ink} /></View>
        </Pressable>
      </Row>

      {error ? <Card><T color={t.warn}>No se pudo cargar el pasaporte. {error}</T></Card> : !rows ? <Card><Loading /></Card> : (
        <>
          {/* Lo que está dentro de esta vista es lo que se comparte como imagen */}
          <View ref={pageRef} collapsable={false} style={{ backgroundColor: t.surface, borderRadius: radius.md, borderWidth: 1, borderColor: t.line, padding: 12, gap: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T v="label">Pasaporte Muévete · {MONTH_NAMES[page.m - 1]} {page.y}</T>
                <T style={{ fontFamily: font.bold }} numberOfLines={1}>{profile?.name ?? ''} · {profile?.dept ?? ''}</T>
              </View>
              <NetlifeLogo height={22} />
            </Row>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 }}>
              {rows.map((r) => (
                <Pressable key={r.id} accessibilityRole="button" onPress={() => setOpen(r)} style={{ width: '32%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Stamp activity={r.activity} at={r.at} number={r.stampNumber} status={r.status} size={100} />
                </Pressable>
              ))}
              {Array.from({ length: slots }, (_, i) => (
                <View key={`s${i}`} style={{ width: '32%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <StampSlot size={92} />
                </View>
              ))}
            </View>
            {rows.length === 0 ? (
              <T v="small" style={{ textAlign: 'center' }}>
                {isCurrent ? 'Escanea el QR de un acceso y recibe tu primer sello del mes.' : 'Sin sellos este mes.'}
              </T>
            ) : (
              <Row style={{ flexWrap: 'wrap', gap: 6 }}>
                {ACTIVITY_IDS.map((a) => {
                  const n = approved.filter((r) => r.activity === a).length;
                  return n ? <Chip key={a} label={`${ACTIVITIES[a].name} · ${n}`} /> : null;
                })}
                {monthData?.page ? <Chip tone="brand" label="Página completa" /> : null}
                {monthData?.full ? <Chip tone="brand" label="Pasaporte completo" /> : null}
              </Row>
            )}
          </View>

          {rows.length > 0 ? (
            <Button title={sharing ? 'Preparando imagen…' : 'Compartir esta página'} icon="share" variant="ghost" loading={sharing} onPress={sharePage} />
          ) : null}
          {shareMsg ? <T v="small" color={t.warn} style={{ textAlign: 'center' }}>{shareMsg}</T> : null}

          {/* Logros del mes */}
          <Card>
            <T v="h3">Logros del mes</T>
            {[
              { key: 'page', title: 'Página completa', desc: `${PAGE_SIZE} sellos validados en el mes`, value: approved.length, goal: PAGE_SIZE, done: !!monthData?.page },
              { key: 'full', title: 'Pasaporte completo', desc: 'Un sello de cada actividad en el mes', value: monthKinds, goal: ACTIVITY_IDS.length, done: !!monthData?.full },
            ].map((g) => (
              <View key={g.key} style={{ gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontFamily: font.bold }}>{g.title}</T>
                    <T v="small">{g.desc}</T>
                  </View>
                  {g.done ? <Chip tone="ok" label={`Logrado · +${PASSPORT_BONUS[g.key as 'page' | 'full']} pts`} /> : <T v="num">{Math.min(g.value, g.goal)}/{g.goal}</T>}
                </Row>
                <Progress value={g.value / g.goal} color={g.done ? t.ok : undefined} />
              </View>
            ))}
            {!isCurrent ? null : <T v="small">Cada logro suma +{PASSPORT_BONUS.page} puntos una vez por mes. Los sellos pendientes cuentan cuando la mesa de control los valida.</T>}
          </Card>
        </>
      )}

      <StampDetail log={open} onClose={() => setOpen(null)} />
    </>
  );
}

const navBtn = (t: ReturnType<typeof useTheme>) => ({
  width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, alignItems: 'center' as const, justifyContent: 'center' as const,
});

function StampDetail({ log, onClose }: { log: ActivityLog | null; onClose: () => void }) {
  const t = useTheme();
  if (!log) return null;
  const { time } = stampDate(log.at);
  const full = new Date(log.at).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Guayaquil' });
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable accessibilityLabel="Cerrar" onPress={onClose} style={{ flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: 24 }}>
        <Pressable onPress={() => {}} style={{ maxWidth: 420, width: '100%', alignSelf: 'center' }}>
          <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
            <Stamp activity={log.activity} at={log.at} number={log.stampNumber} status={log.status} size={190} />
            <T v="label">{log.stampNumber ? `Sello N° ${log.stampNumber}` : 'Sello'}</T>
            <T v="h2">{ACTIVITIES[log.activity].name}</T>
            <View style={{ alignSelf: 'stretch', gap: 8 }}>
              {[
                ['Fecha', full.charAt(0).toUpperCase() + full.slice(1)],
                ['Hora', time],
                ['Lugar', log.location || '—'],
                ['Estado', log.status === 'approved' ? 'Validado' : log.status === 'pending' ? 'Pendiente de validación' : 'No validado'],
                ...(log.reviewerName ? [['Validó', log.reviewerName]] : []),
                ...(log.note ? [['Nota', log.note]] : []),
                ['Puntos', log.status === 'approved' ? `+${log.points + log.bonus}${log.bonus ? ` (incluye bono ${log.bonus})` : ''}` : log.status === 'pending' ? `+${ACTIVITIES[log.activity].points} al validarse` : '0'],
              ].map(([k, v]) => (
                <Row key={k} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <T v="small">{k}</T>
                  <T style={{ flexShrink: 1, textAlign: 'right' }}>{v}</T>
                </Row>
              ))}
            </View>
            <T v="small" style={{ textAlign: 'center' }}>{log.status === 'pending' ? 'La mesa de control debe confirmar esta actividad.' : log.status === 'rejected' ? 'La mesa de control no confirmó esta actividad.' : 'Sello validado'}</T>
            <View style={{ alignSelf: 'stretch' }}><Button title="Cerrar" variant="ghost" onPress={onClose} /></View>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
