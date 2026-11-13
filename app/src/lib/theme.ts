import { useColorScheme } from 'react-native';

/** Paleta Netlife (tomada de los diseños de Netlife Access). */
const light = {
  bg: '#F2F3F5',
  surface: '#FFFFFF',
  surface2: '#F0F1F3',
  ink: '#141416',
  muted: '#6B6F76',
  line: '#E1E3E7',
  brand: '#F5AD20',
  brandInk: '#141416',
  brandText: '#9A5B00',
  brandSoft: '#FFF4DC',
  hero: '#141416',
  heroInk: '#F5F3EE',
  heroTile: '#2A2A2E',
  ok: '#1C7A43',
  warn: '#C2410C',
  dotInk: '#FFFFFF',
  act: { gradas: '#141416', gimnasio: '#3B4A8C', piscina: '#0E7FA6', futbol: '#D9640A' },
};

const dark: typeof light = {
  bg: '#000000',
  surface: '#141416',
  surface2: '#1F1F21',
  ink: '#F5F3EE',
  muted: '#A6A39C',
  line: '#2C2C30',
  brand: '#F5AD20',
  brandInk: '#141416',
  brandText: '#F5AD20',
  brandSoft: '#2A2418',
  hero: '#141416',
  heroInk: '#F5F3EE',
  heroTile: '#2A2A2E',
  ok: '#4CC27E',
  warn: '#FF9B4A',
  dotInk: '#141416',
  act: { gradas: '#F5AD20', gimnasio: '#8A9BE0', piscina: '#4CC3E8', futbol: '#FF9B4A' },
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const font = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
  black: 'Figtree_900Black',
};

export const radius = { sm: 12, md: 16, lg: 20, pill: 999 };
