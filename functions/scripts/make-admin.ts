/**
 * Crea (o convierte en) administrador a una persona, para el primer ingreso a Gestión.
 * Uso: npm run make-admin -- correo@netlife.net.ec "Nombre Apellido" "Talento Humano"
 * Después, desde la app (Gestión → Personas) se agregan los demás.
 */
import { db } from './admin';

async function main() {
  const [email, name, dept] = process.argv.slice(2);
  if (!email || !email.includes('@')) throw new Error('Uso: npm run make-admin -- correo@netlife.net.ec "Nombre" "Departamento"');
  const ref = db.doc(`directory/${email.trim().toLowerCase()}`);
  const prev = (await ref.get()).data() ?? {};
  await ref.set({
    email: email.trim().toLowerCase(),
    name: name ?? prev.name ?? email.split('@')[0],
    dept: dept ?? prev.dept ?? 'Talento Humano',
    employeeId: prev.employeeId ?? null,
    role: 'admin',
    active: true,
  }, { merge: true });
  console.log(`${email} es administrador. Que ingrese a la app con su correo: verá el botón de Gestión en Inicio.`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
