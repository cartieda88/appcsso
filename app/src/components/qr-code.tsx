import QRCode from 'qrcode';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/** Código QR dibujado con SVG (para mostrar, imprimir o compartir desde Gestión). */
export function QrCode({ value, size = 220, color = '#141416', background = '#FFFFFF' }: { value: string; size?: number; color?: string; background?: string }) {
  const { d, n } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
    return { d, n };
  }, [value]);
  const m = 2; // margen en módulos
  return (
    <Svg width={size} height={size} viewBox={`${-m} ${-m} ${n + 2 * m} ${n + 2 * m}`} accessibilityLabel="Código QR">
      <Rect x={-m} y={-m} width={n + 2 * m} height={n + 2 * m} fill={background} />
      <Path d={d} fill={color} />
    </Svg>
  );
}
