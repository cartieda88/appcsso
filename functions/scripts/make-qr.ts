/**
 * Genera los QR para imprimir y pegar en los accesos (PNG + una hoja HTML lista para imprimir).
 * Uso: npm run make-qr   → carpeta qr-print/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';
import { db } from './admin';

const NAMES: Record<string, string> = { gradas: 'Gradas', gimnasio: 'Gimnasio', piscina: 'Piscina', futbol: 'Fútbol' };
const POINTS: Record<string, number> = { gradas: 10, gimnasio: 15, piscina: 15, futbol: 20 };

async function main() {
  mkdirSync('qr-print', { recursive: true });
  const snap = await db.collection('qrCodes').where('active', '==', true).get();
  const cards: string[] = [];
  for (const d of snap.docs) {
    const { activity, location, token } = d.data();
    const payload = `MUEVETE:${d.id}:${token}`;
    await QRCode.toFile(`qr-print/${d.id}.png`, payload, { width: 900, margin: 2, errorCorrectionLevel: 'M' });
    const svg = await QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    cards.push(`<section><p class="k">Muévete Netlife · Comité de Seguridad y Salud</p><h1>${NAMES[activity] ?? activity}</h1>
      <div class="qr">${svg}</div><p class="l">${location}</p><p class="p">Escanea con la app y suma ${POINTS[activity] ?? ''} puntos</p><p class="id">${d.id}</p></section>`);
  }
  writeFileSync('qr-print/imprimir.html', `<!doctype html><meta charset="utf-8"><title>QR Muévete</title>
<style>body{font-family:Figtree,Arial,sans-serif;margin:0}section{page-break-after:always;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center}
h1{font-size:64px;margin:0}.k{font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B6F76}.qr{width:70vmin;border:12px solid #F5AD20;border-radius:24px;padding:16px}.l{font-size:24px;font-weight:700}.p{font-size:20px}.id{color:#6B6F76}</style>
${cards.join('\n')}`);
  console.log(`Generados ${snap.size} códigos en qr-print/ (abre imprimir.html para imprimirlos).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
