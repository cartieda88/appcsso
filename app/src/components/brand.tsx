import { Image } from 'expo-image';
import { View } from 'react-native';

import { useTheme } from '@/lib/theme';
import { T } from './ui';

const LOGO = require('@/assets/images/brand/netlife-logo.png');
const RATIO = 1983 / 525;

/** Logo oficial de Netlife (badge negro con borde degradado). */
export function NetlifeLogo({ height = 32 }: { height?: number }) {
  return <Image source={LOGO} style={{ height, width: height * RATIO }} contentFit="contain" accessibilityLabel="Netlife" />;
}

/** Encabezado de la app: logo Netlife + nombre del programa. */
export function BrandHeader() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <NetlifeLogo height={30} />
      <View style={{ width: 1, height: 28, backgroundColor: t.line }} />
      <View>
        <T v="h3" style={{ lineHeight: 19 }}>Muévete</T>
        <T v="label" style={{ fontSize: 10 }}>Seguridad y Salud</T>
      </View>
    </View>
  );
}
