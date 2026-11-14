import { View } from 'react-native';
import { useCatalog } from '@/lib/catalog';

import { Icon } from './icon';
import { Card, Chip, Loading, Progress, Row, T } from './ui';
import { badgesFor, levelFor, LEVELS } from '@/lib/program';
import { useSession } from '@/lib/session';
import { font, useTheme } from '@/lib/theme';

/** Nivel, puntos por actividad e insignias (pestaña Pasaporte → Logros). */
export function LogrosView() {
  const cat = useCatalog();
  const t = useTheme();
  const { profile } = useSession();
  if (!profile) return <Loading />;
  const s = profile.stats;
  const lv = levelFor(s.totalPoints);
  const badges = badgesFor(s);
  const byAct = cat.all.filter((x) => x.active || (s.counts[x.id] ?? 0) > 0).map((x) => x.id).map((a) => ({ a, pts: (s.counts[a] ?? 0) * cat.get(a).points, n: s.counts[a] ?? 0 }));
  const max = Math.max(1, ...byAct.map((x) => x.pts));

  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <T v="label">Nivel {lv.index + 1} de {LEVELS.length}</T>
            <T v="h2">{lv.cur.name}</T>
          </View>
          <T v="h1" color={t.brandText} style={{ fontSize: 40, lineHeight: 44 }}>{s.totalPoints}</T>
        </Row>
        <Progress value={lv.progress} />
        <T v="small">{lv.next ? `Te faltan ${lv.next.min - s.totalPoints} puntos para el nivel ${lv.next.name}` : 'Alcanzaste el nivel máximo'}</T>
      </Card>

      <Card>
        <T v="h3">Puntos por actividad</T>
        {byAct.map(({ a, pts, n }) => (
          <View key={a} style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="small" color={t.ink}>{cat.get(a).name} · {n} registro{n === 1 ? '' : 's'}</T>
              <T v="num" style={{ fontSize: 14 }}>{pts}</T>
            </Row>
            <Progress value={pts / max} color={cat.color(t, a)} />
          </View>
        ))}
        <T v="small">Los retos cumplidos suman bonos aparte.</T>
      </Card>

      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h3">Insignias</T>
        <Chip label={`${badges.filter((b) => b.earned).length}/${badges.length}`} />
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {badges.map((b) => (
          <Card key={b.name} style={{ flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: 6, paddingHorizontal: 8 }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: b.earned ? t.brand : t.surface2 }}>
              <Icon name={b.icon} color={b.earned ? t.brandInk : t.muted} />
            </View>
            <T style={{ fontFamily: font.bold, fontSize: 13, textAlign: 'center' }} color={b.earned ? t.ink : t.muted}>{b.name}</T>
            <T v="small" style={{ fontSize: 11, textAlign: 'center', lineHeight: 14 }}>{b.desc}</T>
            {!b.earned && b.progress !== undefined ? <View style={{ width: '80%' }}><Progress value={b.progress} height={5} /></View> : null}
          </Card>
        ))}
      </View>
    </>
  );
}
