import { useState } from 'react';
import { View } from 'react-native';

import { Agenda } from '@/components/agenda';
import { Button, Card, Chip, Empty, Loading, Progress, Row, Screen, Segmented, T } from '@/components/ui';
import { errorMessage, joinChallenge } from '@/lib/api';
import { useCampaign, useChallenges } from '@/lib/data';
import { dayKey } from '@/lib/program';
import { font, useTheme } from '@/lib/theme';

const fmt = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });

export default function RetosTab() {
  const [view, setView] = useState<'retos' | 'agenda'>('retos');
  return (
    <Screen>
      <T v="h2">{view === 'retos' ? 'Retos y campañas' : 'Agenda del Comité'}</T>
      <Segmented<'retos' | 'agenda'> options={[['retos', 'Retos'], ['agenda', 'Agenda']]} value={view} onChange={setView} />
      {view === 'retos' ? <Retos /> : <Agenda />}
    </Screen>
  );
}

function Retos() {
  const t = useTheme();
  const { challenges, joined, error } = useChallenges();
  const campaign = useCampaign();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function join(id: string) {
    setBusy(id); setMsg(null);
    try { await joinChallenge({ challengeId: id }); }
    catch (e) { setMsg(errorMessage(e)); }
    finally { setBusy(null); }
  }

  const today = dayKey();
  return (
    <>
      {campaign ? (
        <Card style={{ backgroundColor: t.brand, borderColor: 'transparent' }}>
          <T v="label" color={t.brandInk}>Campaña del mes</T>
          <T v="h2" color={t.brandInk}>{campaign.title}</T>
          <T color={t.brandInk}>{campaign.description}</T>
        </Card>
      ) : null}
      {msg ? <Card><T color={t.warn}>{msg}</T></Card> : null}
      {error ? <Card><T color={t.warn}>{error}</T></Card> : !challenges || !joined ? <Loading /> : challenges.length === 0 ? (
        <Card><Empty text="No hay retos activos en este momento." /></Card>
      ) : challenges.map((c) => {
        const j = joined.find((x) => x.id === c.id);
        const expired = j && !j.completed && j.endsDay < today;
        return (
          <Card key={c.id}>
            <Row style={{ alignItems: 'flex-start', gap: 14 }}>
              <View style={{ alignItems: 'center' }}>
                <T style={{ fontFamily: font.black, fontSize: 40, lineHeight: 42 }} color={t.brandText}>{c.durationDays}</T>
                <T v="label">días</T>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <T v="h3" style={{ flex: 1 }}>{c.title}</T>
                  {j?.completed ? <Chip tone="ok" label="Cumplido" /> : expired ? <Chip tone="warn" label="Vencido" /> : j ? <Chip label="En curso" /> : null}
                </Row>
                <T v="small">{c.description}</T>
              </View>
            </Row>
            {j ? (
              <>
                <Progress value={j.progress / j.goal} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <T v="small">{fmt(j.joinedDay)} – {fmt(j.endsDay)}</T>
                  <T v="num">{Math.min(j.progress, j.goal)}/{j.goal}</T>
                </Row>
              </>
            ) : (
              <Button title={`Unirme · bono de ${c.bonus} pts`} variant="ghost" loading={busy === c.id} onPress={() => join(c.id)} />
            )}
          </Card>
        );
      })}
    </>
  );
}
