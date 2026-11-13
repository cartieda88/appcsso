/**
 * Carga la configuración inicial: departamentos, retos y códigos QR.
 * Uso: npm run seed            (no sobrescribe tokens de QR existentes)
 *      npm run seed -- --rotate (genera tokens nuevos: hay que reimprimir los QR)
 */
import { randomBytes } from 'node:crypto';
import { db } from './admin';

// Ajusta nombres y número de colaboradores con datos reales de Talento Humano.
const DEPARTMENTS = [
  { name: 'Operaciones', headcount: 48 },
  { name: 'Talento Humano', headcount: 14 },
  { name: 'Finanzas', headcount: 22 },
  { name: 'Tecnología', headcount: 26 },
  { name: 'Comercial', headcount: 35 },
  { name: 'Logística', headcount: 40 },
];

const CHALLENGES = [
  { id: 'semana-en-movimiento', title: 'Semana en movimiento', description: 'Registra al menos una actividad cada día durante 7 días.', kind: 'days', activity: null, goal: 7, durationDays: 7, bonus: 60 },
  { id: '21-dias-de-gradas', title: '21 días de gradas', description: 'Usa las gradas en 21 registros durante 30 días.', kind: 'count', activity: 'gradas', goal: 21, durationDays: 30, bonus: 150 },
  { id: '30-dias-de-bienestar', title: '30 días de bienestar', description: 'Suma 30 actividades válidas en 30 días: combina gimnasio, piscina, fútbol y gradas.', kind: 'count', activity: null, goal: 30, durationDays: 30, bonus: 250 },
];

// Campaña destacada en la pantalla de Retos (pon active: false para ocultarla).
const CAMPAIGN = {
  title: 'Noviembre sin ascensor',
  description: 'El departamento con más registros de gradas por persona gana el desayuno saludable del Comité.',
  active: true,
};

// Un documento por cada código impreso. Agrega todos los accesos a gradas que tenga cada edificio.
const QR_CODES = [
  { id: 'GR-A0', activity: 'gradas', location: 'Edificio A · Planta baja' },
  { id: 'GR-B1', activity: 'gradas', location: 'Edificio B · Piso 1' },
  { id: 'GYM-01', activity: 'gimnasio', location: 'Gimnasio · Recepción' },
  { id: 'PIS-01', activity: 'piscina', location: 'Piscina · Ingreso a vestidores' },
  { id: 'FUT-01', activity: 'futbol', location: 'Cancha · Mesa de control' },
];

async function main() {
  const rotate = process.argv.includes('--rotate');
  const batch = db.batch();
  for (const d of DEPARTMENTS) batch.set(db.doc(`departments/${slug(d.name)}`), d, { merge: true });
  for (const { id, ...c } of CHALLENGES) batch.set(db.doc(`challenges/${id}`), { ...c, active: true }, { merge: true });
  batch.set(db.doc('config/campaign'), CAMPAIGN, { merge: true });
  for (const q of QR_CODES) {
    const ref = db.doc(`qrCodes/${q.id}`);
    const existing = await ref.get();
    const token = !rotate && existing.exists ? existing.get('token') : randomBytes(12).toString('hex');
    batch.set(ref, { ...q, token, active: true }, { merge: true });
  }
  await batch.commit();
  console.log(`Listo: ${DEPARTMENTS.length} departamentos, ${CHALLENGES.length} retos, ${QR_CODES.length} códigos QR${rotate ? ' (tokens nuevos)' : ''}.`);
}

function slug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

main().catch((e) => { console.error(e); process.exit(1); });
