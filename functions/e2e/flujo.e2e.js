/**
 * Prueba de punta a punta contra los emuladores (firebase emulators:start).
 * Uso: node e2e/flujo.e2e.js   (con FIRESTORE_EMULATOR_HOST y GCLOUD_PROJECT=demo-muevete)
 */
const path = require('node:path');
const assert = require('node:assert/strict');
const appReq = (m) => require(require.resolve(m, { paths: [path.join(__dirname, '../../app')] }));
const { initializeApp, deleteApp } = appReq('firebase/app');
const { getAuth, connectAuthEmulator, signInWithCustomToken, signOut } = appReq('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, getDoc, collection, query, where, orderBy, getDocs } = appReq('firebase/firestore');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = appReq('firebase/functions');
const { initializeApp: adminInit } = require('firebase-admin/app');
const { getFirestore: adminFirestore } = require('firebase-admin/firestore');

adminInit({ projectId: 'demo-muevete' });
const adb = adminFirestore();

async function client(name) {
  const app = initializeApp({ apiKey: 'demo', projectId: 'demo-muevete' }, name);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const fns = getFunctions(app, 'us-east1'); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
  return { app, auth, db, call };
}
const fails = async (p, re) => { try { await p; } catch (e) { assert.match(`${e.code} ${e.message}`, re); return e; } assert.fail('se esperaba error ' + re); };
const ok = (m) => console.log('  ✔ ' + m);

async function login(c, email) {
  const { devCode } = await c.call('requestLoginCode', { email });
  const { token } = await c.call('verifyLoginCode', { email, code: devCode });
  await signInWithCustomToken(c.auth, token);
  return c.auth.currentUser.uid;
}

(async () => {
  const qr = {};
  for (const d of (await adb.collection('qrCodes').get()).docs) qr[d.id] = `MUEVETE:${d.id}:${d.get('token')}`;

  console.log('Ingreso');
  const a = await client('a');
  await fails(a.call('requestLoginCode', { email: 'alguien@gmail.com' }), /institucional/);
  ok('rechaza correos fuera de @netlife.net.ec');
  await fails(a.call('requestLoginCode', { email: 'no.existe@netlife.net.ec' }), /no está registrado/);
  ok('rechaza correos que no están en la nómina');
  await adb.doc('loginCodes/mf.ruiz@netlife.net.ec').delete().catch(() => {});
  const { devCode } = await a.call('requestLoginCode', { email: 'mf.ruiz@netlife.net.ec' });
  await fails(a.call('requestLoginCode', { email: 'mf.ruiz@netlife.net.ec' }), /Espera un minuto/);
  ok('limita a un código por minuto');
  const wrong = devCode === '000000' ? '111111' : '000000';
  await fails(a.call('verifyLoginCode', { email: 'mf.ruiz@netlife.net.ec', code: wrong }), /incorrecto/);
  ok('rechaza código incorrecto');
  const { token } = await a.call('verifyLoginCode', { email: 'mf.ruiz@netlife.net.ec', code: devCode });
  await signInWithCustomToken(a.auth, token);
  const uid = a.auth.currentUser.uid;
  const me = (await getDoc(doc(a.db, 'users', uid))).data();
  assert.equal(me.name, 'María Fernanda Ruiz'); assert.equal(me.dept, 'Operaciones');
  ok('crea el perfil con nombre y departamento de la nómina');

  console.log('Retos');
  await a.call('joinChallenge', { challengeId: 'semana-en-movimiento' });
  ok('se une a "Semana en movimiento"');

  console.log('Registro por QR');
  await fails(a.call('registerActivity', { qr: 'https://otra-cosa.com' }), /no pertenece/);
  await fails(a.call('registerActivity', { qr: 'MUEVETE:GR-A0:tokenfalso123' }), /ya no es válido/);
  ok('rechaza QR ajenos o con token incorrecto');
  const r1 = await a.call('registerActivity', { qr: qr['GR-A0'] });
  assert.equal(r1.points, 10); assert.equal(r1.activity, 'gradas');
  ok(`gradas +${r1.points} (total ${r1.totalPoints}, racha ${r1.streak}, bono reto ${r1.bonus})`);
  await fails(a.call('registerActivity', { qr: qr['GR-B1'] }), /Espera \d+ min/);
  ok('gradas: exige 60 min entre registros');
  const r2 = await a.call('registerActivity', { qr: qr['GYM-01'] });
  assert.equal(r2.points, 15);
  await fails(a.call('registerActivity', { qr: qr['GYM-01'] }), /Ya registraste gimnasio hoy/);
  ok('gimnasio +15 y bloquea el segundo registro del día');
  await a.call('registerActivity', { qr: qr['FUT-01'] });
  await a.call('registerActivity', { qr: qr['PIS-01'] });
  const stats = (await getDoc(doc(a.db, 'users', uid))).data().stats;
  assert.equal(stats.totalPoints, 60); assert.equal(stats.totalActivities, 4); assert.equal(stats.streak, 1);
  ok(`perfil: ${stats.totalPoints} pts, ${stats.totalActivities} actividades, racha ${stats.streak}`);
  const ch = (await getDoc(doc(a.db, 'users', uid, 'challenges', 'semana-en-movimiento'))).data();
  assert.equal(ch.progress, 1);
  ok('el reto de días cuenta 1 día aunque haya 4 registros');

  console.log('Ranking y seguridad');
  const b = await client('b');
  await login(b, 'c.mendez@netlife.net.ec');
  await b.call('registerActivity', { qr: qr['FUT-01'] });
  const month = (await adb.collection('stats').get()).docs.map((d) => d.id).find((id) => id.startsWith('M'));
  const rank = await getDocs(query(collection(b.db, 'scores'), where('period', '==', month), orderBy('points', 'desc')));
  assert.deepEqual(rank.docs.map((d) => d.get('name')), ['María Fernanda Ruiz', 'Carlos Méndez']);
  ok('ranking mensual ordenado: ' + rank.docs.map((d) => `${d.get('name')} ${d.get('points')}`).join(', '));
  await fails(getDoc(doc(b.db, 'users', uid)), /permission|PERMISSION/i);
  ok('un colaborador no puede leer el perfil de otro');
  await fails(getDocs(collection(b.db, 'qrCodes')), /permission|PERMISSION/i);
  ok('nadie puede leer los tokens de los QR desde la app');
  await fails(b.call('adminStats', {}), /Talento Humano/);
  ok('el panel está cerrado para colaboradores');

  console.log('Panel Talento Humano');
  const c = await client('c');
  await login(c, 'th.admin@netlife.net.ec');
  const s = await c.call('adminStats', {});
  assert.equal(s.participants, 2); assert.equal(s.registrations, 5); assert.equal(s.headcount, 4);
  ok(`participantes ${s.participants}/${s.headcount}, registros ${s.registrations}, por actividad ${JSON.stringify(s.byActivity)}`);
  const ops = s.departments.find((d) => d.name === 'Operaciones');
  assert.equal(ops.participants, 1); assert.equal(ops.points, 60);
  ok('participación por departamento correcta');

  for (const x of [a, b, c]) { await signOut(x.auth); await deleteApp(x.app); }
  console.log('\nTodo OK');
  process.exit(0);
})().catch((e) => { console.error('\n✘', e); process.exit(1); });
