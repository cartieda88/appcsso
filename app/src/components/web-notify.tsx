import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { enableWebPush, webPushStatus } from '@/lib/notifications';
import { useTheme } from '@/lib/theme';
import { Icon } from './icon';
import { Button, Card, Row, T } from './ui';

type Status = Awaited<ReturnType<typeof webPushStatus>>;

/** Solo en la versión web: invita a activar las notificaciones (o a instalar la página en iPhone). */
export function WebNotifyBanner() {
  const t = useTheme();
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (Platform.OS === 'web') webPushStatus().then(setSt); }, []);
  if (Platform.OS !== 'web' || !st || st === 'granted' || st === 'unsupported') return null;

  return (
    <Card style={{ backgroundColor: t.brandSoft, borderColor: 'transparent' }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Icon name="bell" color={t.brandText} />
        <View style={{ flex: 1, gap: 4 }}>
          <T style={{ fontWeight: '700' }}>Recibe los avisos de Muévete</T>
          {st === 'install-first' ? (
            <T v="small" color={t.ink}>En iPhone: toca Compartir y luego "Agregar a pantalla de inicio". Abre Muévete desde ese ícono y activa las notificaciones para recibir carreras, eventos y pausas activas.</T>
          ) : st === 'denied' ? (
            <T v="small" color={t.ink}>Las notificaciones están bloqueadas en este navegador. Actívalas en la configuración del sitio (candado junto a la dirección).</T>
          ) : (
            <T v="small" color={t.ink}>Te avisamos de carreras y eventos (24 h antes y el mismo día) y de tus pausas activas.</T>
          )}
        </View>
      </Row>
      {st === 'prompt' ? <Button title="Activar notificaciones" icon="bell" loading={busy} onPress={async () => { setBusy(true); await enableWebPush().catch(() => {}); setSt(await webPushStatus()); setBusy(false); }} /> : null}
    </Card>
  );
}
