import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { Card, Empty, Loading, Row, Screen, Segmented, T } from '@/components/ui';
import { useDeptRanking, usePeopleRanking } from '@/lib/data';
import { initials, monthKey, weekKey } from '@/lib/program';
import { useSession } from '@/lib/session';
import { font, radius, useTheme } from '@/lib/theme';

type Mode = 'ind' | 'dep';
type Per = 'semana' | 'mes';

interface Item { key: string; title: string; subtitle: string; value: number; me?: boolean; badge: string | null }

export default function Ranking() {
  const t = useTheme();
  const { user, profile } = useSession();
  const [mode, setMode] = useState<Mode>('ind');
  const [per, setPer] = useState<Per>('semana');
  const period = per === 'semana' ? weekKey() : monthKey();
  const people = usePeopleRanking(period);
  const depts = useDeptRanking(period);

  const items: Item[] | null = mode === 'ind'
    ? people.rows?.map((r) => ({ key: r.id, title: r.name, subtitle: r.dept, value: r.points, me: r.uid === user?.uid, badge: initials(r.name) })) ?? null
    : depts.rows?.map((d) => ({
        key: d.name, title: d.name, value: d.avg, me: d.name === profile?.dept, badge: null,
        subtitle: `${d.headcount ? Math.round((d.participants / d.headcount) * 100) : 0}% participa · ${d.headcount} colaboradores`,
      })) ?? null;
  const error = mode === 'ind' ? people.error : depts.error;

  const Badge = ({ it, size = 32 }: { it: Item; size?: number }) => (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
      {it.badge ? <T style={{ fontFamily: font.bold, fontSize: 12 }}>{it.badge}</T> : <Icon name="users" color={t.ink} size={18} />}
    </View>
  );

  return (
    <Screen>
      <T v="h2">Ranking Netlife</T>
      <Segmented<Mode> options={[['ind', 'Individual'], ['dep', 'Departamentos']]} value={mode} onChange={setMode} />
      <Segmented<Per> options={[['semana', 'Esta semana'], ['mes', 'Este mes']]} value={per} onChange={setPer} />

      {error ? <Card><T color={t.warn}>No se pudo cargar el ranking. {error}</T></Card> : items === null ? <Loading /> : items.length === 0 ? (
        <Card><Empty text="Aún no hay registros en este periodo. ¡El primero en escanear se lleva el primer lugar!" /></Card>
      ) : (
        <>
          {items.length >= 3 ? (
            <Card>
              <Row style={{ alignItems: 'flex-end', gap: 8 }}>
                {[1, 0, 2].map((i) => {
                  const it = items[i];
                  const h = [92, 70, 54][i];
                  return (
                    <View key={it.key} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                      <Badge it={it} />
                      <T style={{ fontFamily: font.bold, fontSize: 13, textAlign: 'center' }} numberOfLines={2}>{mode === 'ind' ? it.title.split(' ')[0] : it.title}</T>
                      <T v="small" style={{ fontSize: 12 }}>{it.value} pts{mode === 'dep' ? '/persona' : ''}</T>
                      <View style={{ width: '100%', height: h, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderRadius: 4, backgroundColor: i === 0 ? t.brand : t.surface2, alignItems: 'center', justifyContent: 'center' }}>
                        <T v="h2" color={i === 0 ? t.brandInk : t.ink}>{i + 1}</T>
                      </View>
                    </View>
                  );
                })}
              </Row>
            </Card>
          ) : null}
          <Card style={{ gap: 0 }}>
            {items.map((it, i) => (
              <Row key={it.key} style={{
                paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: t.line,
                ...(it.me ? { backgroundColor: t.brandSoft, marginHorizontal: -10, paddingHorizontal: 10, borderRadius: radius.sm, borderTopColor: 'transparent' } : null),
              }}>
                <T v="num" color={t.muted} style={{ width: 26, textAlign: 'center' }}>{i + 1}</T>
                <Badge it={it} size={30} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: font.semibold }} numberOfLines={1}>{it.title}{it.me ? (mode === 'ind' ? ' (tú)' : ' (tu equipo)') : ''}</T>
                  <T v="small" numberOfLines={1}>{it.subtitle}</T>
                </View>
                <T v="num" color={t.brandText}>{it.value}</T>
              </Row>
            ))}
          </Card>
        </>
      )}
      <T v="small" style={{ textAlign: 'center' }}>
        {mode === 'ind'
          ? 'Reconocimiento semanal al primer lugar y mensual a los tres primeros.'
          : 'Los departamentos compiten por puntos promedio por colaborador, para que los equipos pequeños compitan en igualdad.'}
      </T>
    </Screen>
  );
}
