import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { BrandHeader } from '@/components/brand';
import { PauseCard, StepsCard } from '@/components/health-cards';
import { WebNotifyBanner } from '@/components/web-notify';
import { Icon } from '@/components/icon';
import { ActivityDot, Button, Card, Chip, Empty, Loading, Row, Screen, T } from '@/components/ui';
import { useRecentActivities } from '@/lib/data';
import { ACTIVITIES, dayKey, QR_ACTIVITY_IDS, initials, levelFor, relativeDay } from '@/lib/program';
import { useSession } from '@/lib/session';
import { font, radius, useTheme } from '@/lib/theme';

export default function Inicio() {
  const t = useTheme();
  const { profile, isAdmin, isValidator, signOut } = useSession();
  const recent = useRecentActivities(8);
  if (!profile) return <Screen><Loading /></Screen>;

  const s = profile.stats;
  const lv = levelFor(s.totalPoints);
  const today = s.today?.day === dayKey() ? s.today.counts : {};
  const todayTotal = Object.values(today).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <BrandHeader />
        <Row style={{ gap: 8 }}>
          {isValidator ? (
            <Link href="/validar" asChild>
              <Pressable accessibilityLabel="Validar sellos pendientes" style={headerBtn(t)}>
                <Icon name="check" color={t.ink} />
              </Pressable>
            </Link>
          ) : null}
          {isAdmin ? (
            <Link href="/admin" asChild>
              <Pressable accessibilityLabel="Panel de Talento Humano" style={headerBtn(t)}>
                <Icon name="chart" color={t.ink} />
              </Pressable>
            </Link>
          ) : null}
        </Row>
      </Row>

      <View style={{ backgroundColor: t.hero, borderRadius: radius.lg, padding: 18, gap: 14, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -64, top: -64, width: 140, height: 140, borderRadius: 70, borderWidth: 16, borderColor: t.brand }} />
        <Row style={{ gap: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.brand, alignItems: 'center', justifyContent: 'center' }}>
            <T v="h3" color={t.brandInk}>{initials(profile.name)}</T>
          </View>
          <View style={{ flex: 1, paddingRight: 44 }}>
            <T v="h2" color={t.heroInk} numberOfLines={1}>{profile.name}</T>
            <T v="small" color={t.heroInk}>{profile.dept} · Nivel {lv.cur.name}</T>
          </View>
        </Row>
        <Row style={{ gap: 8 }}>
          {[[s.totalPoints, 'puntos'], [s.streak, 'días de racha'], [s.activeDays, 'días activos']].map(([v, l]) => (
            <View key={l} style={{ flex: 1, backgroundColor: t.heroTile, borderRadius: 14, padding: 10 }}>
              <T v="num" color={t.brand} style={{ fontSize: 24 }}>{v}</T>
              <T v="small" color={t.heroInk}>{l}</T>
            </View>
          ))}
        </Row>
      </View>

      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h3">Hoy</T>
        <Chip label={todayTotal ? `${todayTotal} registro${todayTotal > 1 ? 's' : ''}` : 'Sin registros aún'} tone={todayTotal ? 'ok' : 'warn'} />
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {QR_ACTIVITY_IDS.map((a) => (
          <Link key={a} href="/registrar" asChild>
            <Pressable style={{ flexBasis: '47%', flexGrow: 1 }}>
              <Card style={{ gap: 8 }}>
                <ActivityDot activity={a} />
                <T style={{ fontFamily: font.bold }}>{ACTIVITIES[a].name}</T>
                <T v="small">+{ACTIVITIES[a].points} pts · {today[a] ?? 0}/{ACTIVITIES[a].maxPerDay} hoy</T>
              </Card>
            </Pressable>
          </Link>
        ))}
      </View>

      <WebNotifyBanner />
      <StepsCard />
      <PauseCard />

      <Card>
        <T v="h3">Mi historial</T>
        {recent.rows === null ? <Loading /> : recent.rows.length === 0 ? (
          <Empty text="Aún no tienes registros. Escanea el QR de un acceso para sumar tus primeros puntos." />
        ) : recent.rows.map((r, i) => (
          <Row key={r.id} style={{ paddingVertical: 4, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, paddingTop: i ? 12 : 0 }}>
            <ActivityDot activity={r.activity} size={36} />
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: font.semibold }}>{ACTIVITIES[r.activity].name}</T>
              <T v="small" numberOfLines={1}>{relativeDay(r.at)}, {new Date(r.at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' })} · {r.location}</T>
            </View>
            {r.status === 'approved' ? <T v="num" color={t.brandText}>+{r.points + r.bonus}</T>
              : <Chip tone={r.status === 'pending' ? 'neutral' : 'warn'} label={r.status === 'pending' ? 'Pendiente' : 'No validado'} />}
          </Row>
        ))}
      </Card>

      <Card>
        <T v="label">Mi perfil</T>
        {[['Correo', profile.email], ['Departamento', profile.dept], ['Cédula', profile.employeeId ?? '—'], ['Mejor racha', `${s.bestStreak} días`]].map(([k, v]) => (
          <Row key={k} style={{ justifyContent: 'space-between' }}>
            <T v="small">{k}</T><T style={{ flexShrink: 1, textAlign: 'right' }}>{v}</T>
          </Row>
        ))}
        <Button title="Cerrar sesión" icon="out" variant="ghost" onPress={signOut} />
      </Card>
    </Screen>
  );
}

const headerBtn = (t: ReturnType<typeof useTheme>) => ({
  width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface,
  alignItems: 'center' as const, justifyContent: 'center' as const,
});
