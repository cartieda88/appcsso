import Svg, { Circle, Path } from 'react-native-svg';

const PATHS: Record<string, string[]> = {
  gradas: ['M3 20h5v-5h5v-5h5V5h3'],
  gimnasio: ['M6 6v12M18 6v12M3 9.5v5M21 9.5v5M6 12h12'],
  piscina: ['M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 19.5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M7 12l4-5 4 3'],
  futbol: ['M12 7.5l4 2.8-1.5 4.6h-5L8 10.3z'],
  home: ['M3 11l9-7 9 7v9h-6v-6H9v6H3z'],
  qr: ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2'],
  medal: ['M8 3l4 7 4-7M12 13v4'],
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8'],
  flag: ['M5 21V4h11l-2 4 2 4H5'],
  chart: ['M4 20V11M10 20V5M16 20v-8M21 20H3'],
  out: ['M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10'],
  fire: ['M12 21c-4 0-7-2.8-7-6.6C5 10 9 8 9 3c3 2 4 4 4 6 1-1 1.5-2 1.5-3 3 2.5 4.5 5 4.5 8.4C19 18.2 16 21 12 21z'],
  star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'],
  check: ['M5 12l5 5 9-10'],
  back: ['M15 5l-7 7 7 7'],
  share: ['M12 3v12M7 8l5-5 5 5M5 14v6h14v-6'],
  users: ['M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2'],
  sun: ['M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  close: ['M6 6l12 12M18 6L6 18'],
  passport: ['M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6zM9 17h7'],
  pausa: ['M12 8v6M12 10l-5-3M12 10l5-3M12 14l-3 7M12 14l3 7'],
  pasos: ['M8 3c1.8 0 2.6 2 2.6 4.2S9.6 11 8 11 5.6 9.4 5.6 7.2 6.2 3 8 3zM6 13.5h4.2v1.6a2.1 2.1 0 0 1-4.2 0zM16 8c1.8 0 2.4 2 2.4 4.2S17.6 16 16 16s-2.6-1.6-2.6-3.8S14.2 8 16 8zM13.8 18.5H18v1.4a2.1 2.1 0 0 1-4.2 0z'],
  bell: ['M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0'],
  calendar: ['M4 6h16v14H4zM4 10h16M8 3v4M16 3v4'],
  pin: ['M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z'],
  play: ['M8 5l11 7-11 7z'],
  plus: ['M12 5v14M5 12h14'],
};
const CIRCLES: Record<string, [number, number, number][]> = {
  piscina: [[16, 6, 2]],
  futbol: [[12, 12, 9]],
  medal: [[12, 15, 5]],
  users: [[9, 8, 3.5]],
  sun: [[12, 12, 4]],
  passport: [[12.5, 10.5, 3.2]],
  pausa: [[12, 5, 2]],
  pin: [[12, 10, 2.2]],
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {(CIRCLES[name] ?? []).map(([cx, cy, r], i) => <Circle key={`c${i}`} cx={cx} cy={cy} r={r} />)}
      {PATHS[name].map((d, i) => <Path key={i} d={d} />)}
    </Svg>
  );
}
