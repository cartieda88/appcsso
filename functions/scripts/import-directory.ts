/**
 * Importa la nómina que autoriza el ingreso a la app.
 * Uso: npm run import-directory -- nomina.csv
 * CSV con encabezado: correo,nombre,departamento,cedula,rol
 *   rol = "admin" para Talento Humano / Comité, "validador" para la mesa de control
 *   (aprueba sellos pendientes, p. ej. fútbol); vacío para colaboradores.
 * Los correos que no estén en el archivo no se borran; para dar de baja pon active=false en Firestore.
 */
import { readFileSync } from 'node:fs';
import { db } from './admin';

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Indica el archivo CSV: npm run import-directory -- nomina.csv');
  const lines = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const [iMail, iName, iDept, iId, iRole] = ['correo', 'nombre', 'departamento', 'cedula', 'rol'].map(col);
  if (iMail < 0 || iName < 0 || iDept < 0) throw new Error('El CSV necesita las columnas correo, nombre y departamento.');

  let n = 0;
  let batch = db.batch();
  for (const line of lines.slice(1)) {
    const c = line.split(sep).map((v) => v.trim());
    const email = c[iMail]?.toLowerCase();
    if (!email || !email.includes('@')) continue;
    batch.set(db.doc(`directory/${email}`), {
      email,
      name: c[iName],
      dept: c[iDept],
      employeeId: iId >= 0 ? c[iId] || null : null,
      role: (() => { const r = iRole >= 0 ? c[iRole]?.toLowerCase() : ''; return r === 'admin' || r === 'validador' ? r : 'colaborador'; })(),
      active: true,
    }, { merge: true });
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`Importados ${n} colaboradores.`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
