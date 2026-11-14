import { File, Paths } from 'expo-file-system';
import { useCatalog } from '@/lib/catalog';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { Icon } from '@/components/icon';
import { Button, Card, Loading, Progress, Row, Screen, Segmented, T } from '@/components/ui';
import { adminStats, errorMessage, type AdminStats } from '@/lib/api';
import { relativeDay } from '@/lib/program';
import { font, useTheme } from '@/lib/theme';

const monthLabel = (m: string) => {
  const [y, mm] = m.slice(1).split('-').map(Number);
  const label = new Date(y, mm - 1, 1).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export default function Admin() {
  const cat = useCatalog();
  const t = useTheme();
  const [data, setData] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dept, setDept] = useState('Todos');
  const [sort, setSort] = useState<'points' | 'count'>('points');

  const load = useCallback(async () => {
    setError(null);
    try { setData((await adminStats({})).data); } catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const people = useMemo(() => {
    if (!data) return [];
    return data.people.filter((p) => dept === 'Todos' || p.dept === dept).sort((a, b) => b[sort] - a[sort]);
  }, [data, dept, sort]);

  async function exportCsv() {
    if (!data) return;
    const rows = [['Colaborador', 'Departamento', 'Registros', 'Puntos', 'Última actividad'],
      ...people.map((p) => [p.name, p.dept, String(p.count), String(p.points), p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : ''])];
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\n');
    const name = `muevete-${data.month}-${dept === 'Todos' ? 'todos' : dept}.csv`;
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
      return;
    }
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Exportar participantes', UTI: 'public.comma-separated-values-text' });
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" color={t.ink} />
        </Pressable>
        <T v="h2" style={{ flex: 1 }}>Panel Talento Humano</T>
        <Pressable accessibilityLabel="Gestión" onPress={() => router.push('/gestion')} style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="gear" color={t.ink} />
        </Pressable>
      </Row>
      {error ? <Card><T color={t.warn}>{error}</T><Button title="Reintentar" variant="ghost" onPress={load} /></Card> : !data ? <Loading /> : (
        <>
          <T v="small">{monthLabel(data.month)}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[
              ['Participantes activos', String(data.participants), `de ${data.headcount} en nómina`],
              ['Participación', data.headcount ? `${Math.round((data.participants / data.headcount) * 100)}%` : '—', 'del personal'],
              ['Registros del mes', data.registrations.toLocaleString('es-EC'), `${data.points.toLocaleString('es-EC')} puntos`],
              ['Frecuencia', data.participants ? (data.registrations / data.participants).toFixed(1) : '0', 'registros por persona'],
              ['Pasaportes completos', String(data.passportsCompleted), `${data.pagesCompleted} páginas completas`],
              ['Sellos por validar', String(data.pendingApprovals), 'en la mesa de control'],
            ].map(([k, v, s]) => (
              <Card key={k} style={{ flexBasis: '47%', flexGrow: 1, gap: 2 }}>
                <T v="small">{k}</T>
                <T style={{ fontFamily: font.extrabold, fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'] }}>{v}</T>
                <T v="small" style={{ fontSize: 12 }}>{s}</T>
              </Card>
            ))}
          </View>

          <Card>
            <T v="h3">Registros por semana</T>
            <WeeklyChart weeks={data.weekly} />
          </Card>

          <Card>
            <T v="h3">Participación por departamento</T>
            {data.departments.slice().sort((a, b) => b.participants / (b.headcount || 1) - a.participants / (a.headcount || 1)).map((d) => {
              const pct = d.headcount ? d.participants / d.headcount : 0;
              return (
                <View key={d.name} style={{ gap: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="small" color={t.ink}>{d.name}</T>
                    <T v="small">{d.participants}/{d.headcount} · {Math.round(pct * 100)}%</T>
                  </Row>
                  <Progress value={pct} />
                </View>
              );
            })}
          </Card>

          <Card>
            <T v="h3">Uso por actividad</T>
            {(() => {
              const ids = cat.all.filter((x) => x.active || (data.byActivity[x.id] ?? 0) > 0).map((x) => x.id);
              const total = ids.reduce((s, a) => s + (data.byActivity[a] ?? 0), 0) || 1;
              return (
                <>
                  <View style={{ flexDirection: 'row', height: 16, borderRadius: 99, overflow: 'hidden', backgroundColor: t.surface2 }}>
                    {ids.map((a) => <View key={a} style={{ flex: (data.byActivity[a] ?? 0) / total, backgroundColor: cat.color(t, a) }} />)}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {ids.map((a) => (
                      <Row key={a} style={{ gap: 6 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: cat.color(t, a) }} />
                        <T v="small">{cat.get(a).name} {Math.round(((data.byActivity[a] ?? 0) / total) * 100)}% ({data.byActivity[a] ?? 0})</T>
                      </Row>
                    ))}
                  </View>
                </>
              );
            })()}
          </Card>

          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h3">Participantes</T>
              <Button title="Exportar CSV" icon="share" variant="ghost" onPress={exportCsv} />
            </Row>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {['Todos', ...data.departments.map((d) => d.name)].map((d) => (
                <Pressable key={d} onPress={() => setDept(d)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: d === dept ? t.brand : t.surface2 }}>
                  <T style={{ fontFamily: font.bold, fontSize: 13 }} color={d === dept ? t.brandInk : t.ink}>{d}</T>
                </Pressable>
              ))}
            </ScrollView>
            <Segmented<'points' | 'count'> options={[['points', 'Por puntos'], ['count', 'Por frecuencia']]} value={sort} onChange={setSort} />
            {people.length === 0 ? <T v="small">Sin participantes en este filtro.</T> : people.map((p, i) => (
              <Row key={p.uid} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: t.line, paddingTop: i ? 10 : 0 }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: font.semibold }} numberOfLines={1}>{p.name}</T>
                  <T v="small" numberOfLines={1}>{p.dept} · {p.updatedAt ? relativeDay(p.updatedAt) : '—'}</T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T v="num" color={t.brandText}>{p.points}</T>
                  <T v="small" style={{ fontSize: 12 }}>{p.count} registros</T>
                </View>
              </Row>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function WeeklyChart({ weeks }: { weeks: { week: string; total: number }[] }) {
  const t = useTheme();
  const W = 320, H = 130, pad = 26;
  const max = Math.max(10, ...weeks.map((w) => w.total));
  const top = Math.ceil(max / 10) * 10;
  const x = (i: number) => pad + (i * (W - pad * 1.5)) / Math.max(1, weeks.length - 1);
  const y = (v: number) => H - pad - (v / top) * (H - pad * 1.6);
  const line = weeks.map((w, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(w.total).toFixed(1)}`).join('');
  const area = `${line}L${x(weeks.length - 1)},${H - pad}L${x(0)},${H - pad}Z`;
  const last = weeks[weeks.length - 1];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={`Registros por semana; última semana ${last?.total ?? 0}`}>
      {[0, top / 2, top].map((v) => (
        <G key={v}>
          <Line x1={pad} x2={W - pad / 2} y1={y(v)} y2={y(v)} stroke={t.line} />
          <SvgText x={2} y={y(v) + 3} fontSize={10} fontFamily={font.medium} fill={t.muted}>{Math.round(v)}</SvgText>
        </G>
      ))}
      <Path d={area} fill={t.brand} fillOpacity={0.18} />
      <Path d={line} fill="none" stroke={t.brandText} strokeWidth={2.5} />
      {last ? <Circle cx={x(weeks.length - 1)} cy={y(last.total)} r={4.5} fill={t.brand} stroke={t.ink} strokeWidth={1.5} /> : null}
      {weeks.map((w, i) => <SvgText key={w.week} x={x(i) - 8} y={H - 8} fontSize={10} fontFamily={font.medium} fill={t.muted}>{`S${w.week.slice(-2)}`}</SvgText>)}
    </Svg>
  );
}
