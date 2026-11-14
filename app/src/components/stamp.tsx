import Svg, { Circle, Defs, G, Path, Text as SvgText, TextPath, TSpan } from 'react-native-svg';

import { ACTIVITIES, type ActivityId } from '@/lib/program';
import { font, useTheme } from '@/lib/theme';

const TZ = 'America/Guayaquil';
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export function stampDate(ms: number) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const g = (k: string) => p.find((x) => x.type === k)!.value;
  return { date: `${g('day')} ${MONTHS[Number(g('month')) - 1]} ${g('year')}`, time: `${g('hour')}:${g('minute')}` };
}

/** Inclinación fija por sello, para que la página se vea sellada a mano. */
const tilt = (n: number) => ((n * 37) % 17) - 8;

/**
 * Sello del pasaporte: actividad en el arco superior, fecha y hora al centro,
 * número de sello y "Muévete Netlife" en el arco inferior.
 */
export function Stamp({ activity, at, number, size = 104 }: { activity: ActivityId; at: number; number?: number | null; size?: number }) {
  const t = useTheme();
  const ink = t.act[activity];
  const { date, time } = stampDate(at);
  const id = `${activity}-${number ?? at}`;
  const name = ACTIVITIES[activity].name.toUpperCase();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={`Sello ${ACTIVITIES[activity].name}, ${date} a las ${time}`}>
      <Defs>
        <Path id={`top-${id}`} d="M 14 50 A 36 36 0 0 1 86 50" />
        <Path id={`bot-${id}`} d="M 12 50 A 38 38 0 0 0 88 50" />
      </Defs>
      <G rotation={tilt(number ?? Math.floor(at / 60000))} origin="50, 50" opacity={0.92}>
        <Circle cx={50} cy={50} r={47} fill="none" stroke={ink} strokeWidth={3} />
        <Circle cx={50} cy={50} r={43} fill="none" stroke={ink} strokeWidth={1} strokeDasharray="2 2" />
        <Circle cx={50} cy={50} r={30} fill="none" stroke={ink} strokeWidth={1.4} />
        <SvgText fill={ink} fontSize={name.length > 7 ? 9 : 10.5} fontFamily={font.black} letterSpacing={1.2}>
          <TextPath href={`#top-${id}`} startOffset="50%">
            <TSpan textAnchor="middle">{name}</TSpan>
          </TextPath>
        </SvgText>
        <SvgText fill={ink} fontSize={6.2} fontFamily={font.bold} letterSpacing={1}>
          <TextPath href={`#bot-${id}`} startOffset="50%">
            <TSpan textAnchor="middle" dy={4}>{`MUÉVETE NETLIFE${number ? ` · N° ${String(number).padStart(4, '0')}` : ''}`}</TSpan>
          </TextPath>
        </SvgText>
        <SvgText x={50} y={47.5} fill={ink} fontSize={8} fontFamily={font.extrabold} textAnchor="middle">{date}</SvgText>
        <SvgText x={50} y={62} fill={ink} fontSize={13} fontFamily={font.black} textAnchor="middle">{time}</SvgText>
        <Circle cx={18} cy={50} r={1.6} fill={ink} />
        <Circle cx={82} cy={50} r={1.6} fill={ink} />
      </G>
    </Svg>
  );
}

/** Espacio vacío de una página del pasaporte. */
export function StampSlot({ size = 104 }: { size?: number }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={50} cy={50} r={45} fill="none" stroke={t.line} strokeWidth={1.5} strokeDasharray="4 5" />
    </Svg>
  );
}
