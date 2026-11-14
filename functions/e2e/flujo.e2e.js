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
  assert.equal(r1.points, 10); assert.equal(r1.activity, 'gradas'); assert.equal(r1.stampNumber, 1);
  ok(`gradas +${r1.points} (total ${r1.totalPoints}, racha ${r1.streak}, bono reto ${r1.bonus})`);
  await fails(a.call('registerActivity', { qr: qr['GR-B1'] }), /Espera \d+ min/);
  ok('gradas: exige 60 min entre registros');
  const r2 = await a.call('registerActivity', { qr: qr['GYM-01'] });
  assert.equal(r2.points, 15);
  await fails(a.call('registerActivity', { qr: qr['GYM-01'] }), /Ya registraste gimnasio hoy/);
  ok('gimnasio +15 y bloquea el segundo registro del día');
  const fut = await a.call('registerActivity', { qr: qr['FUT-01'] });
  assert.equal(fut.status, 'pending'); assert.equal(fut.points, 0); assert.equal(fut.stampNumber, 3);
  ok('fútbol queda como sello pendiente (sin puntos) hasta que lo valide la mesa de control');
  await fails(a.call('registerActivity', { qr: qr['FUT-01'] }), /Ya registraste fútbol hoy/);
  ok('un sello pendiente ocupa el cupo del día');
  await a.call('registerActivity', { qr: qr['PIS-01'] });
  let stats = (await getDoc(doc(a.db, 'users', uid))).data().stats;
  assert.equal(stats.totalPoints, 40); assert.equal(stats.totalActivities, 3); assert.equal(stats.stampsIssued, 4);
  ok(`perfil: ${stats.totalPoints} pts validados, ${stats.stampsIssued} sellos (1 pendiente)`);
  const ch = (await getDoc(doc(a.db, 'users', uid, 'challenges', 'semana-en-movimiento'))).data();
  assert.equal(ch.progress, 1);
  ok('el reto de días cuenta 1 día aunque haya varios registros');
  const stamps = await getDocs(query(collection(a.db, 'users', uid, 'activities'), orderBy('createdAt', 'asc')));
  assert.deepEqual(stamps.docs.map((d) => [d.get('stampNumber'), d.get('activity'), d.get('status')]),
    [[1, 'gradas', 'approved'], [2, 'gimnasio', 'approved'], [3, 'futbol', 'pending'], [4, 'piscina', 'approved']]);
  ok('pasaporte: 4 sellos numerados en orden, con fecha, hora, actividad y estado');

  console.log('Validación por la mesa de control');
  const b = await client('b');
  const carlos = await login(b, 'c.mendez@netlife.net.ec');
  await b.call('registerActivity', { qr: qr['FUT-01'] });
  await fails(getDocs(collection(b.db, 'approvals')), /permission|PERMISSION/i);
  ok('un colaborador no puede ver los sellos pendientes');
  await fails(b.call('reviewActivity', { approvalId: 'x', approve: true }), /responsables de validación/);
  ok('un colaborador no puede aprobar sellos');
  const v = await client('v');
  await login(v, 'mesa.futbol@netlife.net.ec');
  const pend = await getDocs(query(collection(v.db, 'approvals'), where('status', '==', 'pending'), orderBy('createdAt', 'asc')));
  assert.deepEqual(pend.docs.map((d) => d.get('name')), ['María Fernanda Ruiz', 'Carlos Méndez']);
  ok('la mesa de control ve 2 sellos pendientes: ' + pend.docs.map((d) => d.get('name')).join(', '));
  const rv = await v.call('reviewActivity', { approvalId: pend.docs[0].id, approve: true });
  assert.equal(rv.points, 20); assert.equal(rv.bonus, 50);
  stats = (await getDoc(doc(a.db, 'users', uid))).data().stats;
  assert.equal(stats.totalPoints, 110); assert.equal(stats.passportsCompleted, 1);
  const futDoc = (await getDoc(doc(a.db, 'users', uid, 'activities', pend.docs[0].get('activityId')))).data();
  assert.equal(futDoc.status, 'approved'); assert.equal(futDoc.reviewerName, 'Jorge Villacís');
  ok('aprobado: +20 de fútbol y +50 por "Pasaporte completo" (4 actividades en el mes) → 110 pts');
  await fails(v.call('reviewActivity', { approvalId: pend.docs[0].id, approve: true }), /ya fue aprobado/);
  ok('un sello no se puede aprobar dos veces');
  await v.call('reviewActivity', { approvalId: pend.docs[1].id, approve: false, note: 'No estaba en el partido' });
  const cDoc = (await getDoc(doc(b.db, 'users', carlos, 'activities', pend.docs[1].get('activityId')))).data();
  assert.equal(cDoc.status, 'rejected'); assert.equal(cDoc.note, 'No estaba en el partido');
  const again = await b.call('registerActivity', { qr: qr['FUT-01'] });
  assert.equal(again.status, 'pending');
  ok('rechazado: queda marcado con la nota y libera el cupo del día');

  console.log('Ranking y seguridad');
  const month = (await adb.collection('stats').get()).docs.map((d) => d.id).find((id) => id.startsWith('M'));
  const rank = await getDocs(query(collection(b.db, 'scores'), where('period', '==', month), orderBy('points', 'desc')));
  assert.deepEqual(rank.docs.map((d) => [d.get('name'), d.get('points')]), [['María Fernanda Ruiz', 110]]);
  ok('el ranking solo suma sellos validados: ' + rank.docs.map((d) => `${d.get('name')} ${d.get('points')}`).join(', '));
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
  assert.equal(s.participants, 1); assert.equal(s.registrations, 4); assert.equal(s.headcount, 5);
  assert.equal(s.pendingApprovals, 1); assert.equal(s.passportsCompleted, 1);
  ok(`participantes ${s.participants}/${s.headcount}, registros ${s.registrations}, pendientes ${s.pendingApprovals}, pasaportes completos ${s.passportsCompleted}`);
  const ops = s.departments.find((d) => d.name === 'Operaciones');
  assert.equal(ops.participants, 1); assert.equal(ops.points, 110);
  ok('participación por departamento correcta');

  console.log('Pausas activas y pasos');
  await fails(a.call('registerPause', { seconds: 30 }), /Completa la rutina/);
  ok('la pausa exige completar la rutina guiada (2 min)');
  const pz = await a.call('registerPause', { seconds: 150 });
  assert.equal(pz.points, 5); assert.equal(pz.activity, 'pausa');
  await fails(a.call('registerPause', { seconds: 150 }), /Espera \d+ min/);
  ok('pausa activa +5 y exige 60 min hasta la siguiente');
  const { addDays: plusDays, dayKey: dk } = require('../lib/src/rules');
  const today = dk(new Date()); const ayer = plusDays(today, -1);
  let st = await a.call('syncSteps', { days: [{ day: ayer, steps: 9100 }, { day: today, steps: 4200 }, { day: '2020-01-01', steps: 99999 }], source: 'prueba' });
  assert.equal(st.goal, 8000);
  assert.deepEqual(st.results.map((r) => [r.day, r.steps, r.goalReachedNow]), [[ayer, 9100, true], [today, 4200, false]]);
  ok('pasos: ayer llegó a 9.100 (sello Meta de pasos), hoy 4.200; ignora días fuera de rango');
  st = await a.call('syncSteps', { days: [{ day: today, steps: 3000 }] });
  assert.equal(st.results[0].steps, 4200);
  st = await a.call('syncSteps', { days: [{ day: today, steps: 8350 }] });
  assert.equal(st.results[0].goalReachedNow, true); assert.equal(st.results[0].points, 10);
  st = await a.call('syncSteps', { days: [{ day: today, steps: 12000 }] });
  assert.equal(st.results[0].goalReachedNow, false);
  ok('pasos: guarda el máximo del día y da la meta (+10) una sola vez');
  const pasos = await getDocs(query(collection(a.db, 'users', uid, 'activities'), where('activity', '==', 'pasos')));
  assert.equal(pasos.size, 2);
  const mySteps = await getDoc(doc(a.db, 'steps', `${uid}_${today}`));
  assert.equal(mySteps.get('steps'), 12000);
  await fails(getDoc(doc(b.db, 'steps', `${uid}_${today}`)), /permission|PERMISSION/i);
  ok('los pasos de una persona no los ven los demás');

  console.log('Notificaciones y agenda');
  await a.call('registerDevice', { token: 'ExponentPushToken[telefonoMaria]', platform: 'android' });
  await b.call('registerDevice', { token: 'ExponentPushToken[telefonoCarlos]', platform: 'ios' });
  await fails(a.call('registerDevice', { token: 'cualquier-cosa' }), /no válido/);
  ok('registra los teléfonos para notificaciones push');
  const y = Number(today.slice(0, 4)), mo = Number(today.slice(5, 7)), dd = Number(today.slice(8, 10));
  const startsAt = Date.UTC(y, mo - 1, dd + 3, 13); // en 3 días, 08:00 en Ecuador
  await fails(b.call('saveEvent', { title: 'X', location: 'Y', startsAt }), /Talento Humano/);
  ok('solo Talento Humano / Comité crea eventos');
  const ev = await c.call('saveEvent', { title: 'Carrera 5K Netlife', type: 'carrera', location: 'Parque La Carolina', description: 'Recorrido de 5 km.', startsAt, audience: 'attendees' });
  const logs = async (tag) => (await adb.collection('pushLog').where('tag', '==', tag).get()).docs.map((d) => d.data());
  const nuevo = await logs(`nuevo:${ev.id}`);
  assert.equal(nuevo.length, 1); assert.equal(nuevo[0].tokens, 2); assert.match(nuevo[0].title, /Nueva actividad: Carrera 5K/);
  ok(`al publicar la carrera se notifica a todos: "${nuevo[0].title}" (${nuevo[0].tokens} teléfonos)`);
  await a.call('setAttendance', { eventId: ev.id, going: true });
  assert.equal((await getDoc(doc(a.db, 'events', ev.id))).get('attendees'), 1);
  ok('María se inscribe (1 inscrito)');
  await c.call('debugRunReminders', { now: startsAt - 30 * 3600_000 });
  assert.equal((await logs(`d1:${ev.id}`)).length, 0);
  await c.call('debugRunReminders', { now: startsAt - 23 * 3600_000 });
  const d1 = await logs(`d1:${ev.id}`);
  assert.equal(d1.length, 1); assert.deepEqual(d1[0].recipients, [uid]); assert.match(d1[0].title, /^Mañana: Carrera 5K/);
  ok(`24 h antes, solo a inscritos: "${d1[0].title}" — ${d1[0].body}`);
  await c.call('debugRunReminders', { now: startsAt - 22 * 3600_000 });
  assert.equal((await logs(`d1:${ev.id}`)).length, 1);
  ok('no repite el recordatorio');
  await c.call('debugRunReminders', { now: startsAt - 1 * 3600_000 });
  const d0 = await logs(`d0:${ev.id}`);
  assert.equal(d0.length, 1); assert.match(d0[0].title, /^Hoy: Carrera 5K/);
  ok(`el mismo día: "${d0[0].title}" — ${d0[0].body}`);
  await c.call('saveEvent', { id: ev.id, title: 'Carrera 5K Netlife', type: 'carrera', location: 'Parque Samanes', startsAt: startsAt + 3600_000, audience: 'attendees' });
  const cambio = await logs(`cambio:${ev.id}`);
  assert.equal(cambio.length, 1); assert.match(cambio[0].body, /Parque Samanes/);
  ok('si cambia fecha o lugar, avisa a los inscritos y reprograma los recordatorios');

  console.log('Versión web');
  const tokGr = qr['GR-B1'].split(':')[2];
  const rUrl = await b.call('registerActivity', { qr: `https://muevete-netlife.web.app/r/GR-B1/${tokGr}` });
  assert.equal(rUrl.activity, 'gradas'); assert.equal(rUrl.points, 10);
  ok('el QR como enlace (cámara del teléfono → página web) registra la actividad');
  await a.call('registerDevice', { token: 'fcm_token_navegador_maria_0123456789abcdef', kind: 'web', platform: 'web' });
  await fails(a.call('registerDevice', { token: 'x', kind: 'web' }), /no válido/);
  ok('registra el navegador para Web Push');
  const pr = await a.call('savePauseReminders', { enabled: true, every: 90, start: 8, end: 17, weekdays: [1, 2, 3, 4, 5, 6, 7] });
  assert.deepEqual(pr, { enabled: true, every: 90, start: 8, end: 17, weekdays: [1, 2, 3, 4, 5, 6, 7] });
  const day0 = dk(new Date());
  const at930 = Date.UTC(+day0.slice(0, 4), +day0.slice(5, 7) - 1, +day0.slice(8, 10), 14, 31); // 09:31 en Ecuador
  await c.call('debugRunReminders', { now: at930 });
  const pausaLog = await logs(`pausa:${day0}`);
  assert.equal(pausaLog.length, 1); assert.deepEqual(pausaLog[0].recipients, [uid]); assert.equal(pausaLog[0].webTokens, 1); assert.equal(pausaLog[0].tokens, 0);
  ok(`recordatorio de pausa a las 09:30 enviado al navegador: "${pausaLog[0].title}" — ${pausaLog[0].body}`);
  await c.call('debugRunReminders', { now: at930 + 45 * 60_000 }); // 10:16: no toca
  assert.equal((await logs(`pausa:${day0}`)).length, 1);
  ok('a las 10:15 no se envía (siguiente: 11:00)');

  console.log('Gestión (Talento Humano)');
  await fails(b.call('saveActivity', { name: 'Yoga' }), /Talento Humano/);
  ok('un colaborador no puede crear actividades');
  const yoga = await c.call('saveActivity', { name: 'Yoga', points: 12, maxPerDay: 1, kind: 'qr', icon: 'yoga', color: 'pausa' });
  assert.equal(yoga.id, 'yoga');
  await fails(c.call('saveActivity', { name: 'Yoga' }), /Ya existe/);
  const pt = await c.call('saveQrPoint', { activity: 'yoga', location: 'Terraza · Edificio A' });
  assert.match(pt.id, /^YOGA-[0-9A-F]{4}$/);
  ok(`Talento Humano crea la actividad "Yoga" (+12) y su punto QR ${pt.id}`);
  const qrs = await getDocs(collection(c.db, 'qrCodes'));
  assert.ok(qrs.size >= 6);
  ok('Talento Humano puede ver los QR para imprimirlos');
  const ry = await b.call('registerActivity', { qr: `https://muevete-netlife.web.app/r/${pt.id}/${pt.token}` });
  assert.equal(ry.activity, 'yoga'); assert.equal(ry.points, 12); assert.equal(ry.activityName, 'Yoga');
  ok('Carlos escanea el QR de Yoga: +12 y sello de Yoga');
  const rot = await c.call('saveQrPoint', { id: pt.id, rotate: true });
  await fails(b.call('registerActivity', { qr: `MUEVETE:${pt.id}:${pt.token}` }), /ya no es válido/);
  assert.notEqual(rot.token, pt.token);
  ok('al cambiar la clave del QR, el impreso anterior deja de servir');
  await c.call('saveActivity', { id: 'yoga', name: 'Yoga', points: 12, active: false });
  await fails(b.call('registerActivity', { qr: `MUEVETE:${pt.id}:${rot.token}` }), /ya no es válido/);
  ok('una actividad desactivada ya no registra');

  await fails(b.call('savePerson', { email: 'x@netlife.net.ec', name: 'X', dept: 'Y' }), /Talento Humano/);
  const np = await c.call('savePerson', { email: 'nueva.persona@netlife.net.ec', name: 'Ana Quishpe', dept: 'Comercial', role: 'validador' });
  assert.equal(np.hasAccount, false);
  const n = await client('n');
  await login(n, 'nueva.persona@netlife.net.ec');
  const nTok = await n.auth.currentUser.getIdTokenResult();
  assert.equal(nTok.claims.validator, true);
  ok('Talento Humano agrega a Ana Quishpe como validadora y ella ya puede ingresar');
  await c.call('savePerson', { email: 'c.mendez@netlife.net.ec', name: 'Carlos Méndez', dept: 'Logística', role: 'admin' });
  await b.auth.currentUser.getIdToken(true);
  assert.equal((await b.auth.currentUser.getIdTokenResult()).claims.admin, true);
  ok('promueve a Carlos a administrador (se aplica al renovar su sesión)');
  await fails(c.call('savePerson', { email: 'th.admin@netlife.net.ec', name: 'Paola Andrade', dept: 'Talento Humano', role: 'colaborador' }), /a ti mismo/);
  ok('nadie puede quitarse a sí mismo el rol de administrador');
  await c.call('savePerson', { email: 'nueva.persona@netlife.net.ec', name: 'Ana Quishpe', dept: 'Comercial', role: 'colaborador', active: false });
  await adb.doc('loginCodes/nueva.persona@netlife.net.ec').delete().catch(() => {});
  await fails(n.call('requestLoginCode', { email: 'nueva.persona@netlife.net.ec' }), /no está registrado/);
  ok('al dar de baja a una persona ya no puede pedir código');
  await c.call('saveDepartment', { name: 'Comercial', headcount: 36 });
  assert.equal((await adb.doc('departments/comercial').get()).get('headcount'), 36);
  ok('actualiza el número de personas de un departamento');
  await signOut(n.auth); await deleteApp(n.app);

  for (const x of [a, b, c, v]) { await signOut(x.auth); await deleteApp(x.app); }
  console.log('\nTodo OK');
  process.exit(0);
})().catch((e) => { console.error('\n✘', e); process.exit(1); });
