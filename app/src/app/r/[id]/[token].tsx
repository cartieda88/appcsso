import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Loading, Screen } from '@/components/ui';
import { useSession } from '@/lib/session';

/**
 * Destino del enlace impreso en cada QR (https://…/r/<id>/<token>). Se abre al escanear
 * con la cámara del teléfono. Si no hay sesión, guarda el código y lo registra después del ingreso.
 */
export default function QrLink() {
  const { id, token } = useLocalSearchParams<{ id: string; token: string }>();
  const { user } = useSession();
  const [to, setTo] = useState<string | null>(null);
  // Forma interna del código, independiente de la dirección del sitio.
  const qr = `MUEVETE:${id}:${token}`;

  useEffect(() => {
    if (user) { setTo(`/registrar?qr=${encodeURIComponent(qr)}`); return; }
    AsyncStorage.setItem('muevete.pendingQr', qr).catch(() => {}).finally(() => setTo('/login'));
  }, [user, qr]);

  if (!to) return <Screen><Loading /></Screen>;
  return <Redirect href={to as never} />;
}
