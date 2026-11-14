import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays, advanceChallenge, applyActivity, canRegister, creditActivity, dayKey, emptyStats, monthKey, normalizeEmail, parseQr,
  dueReminders, endOfLocalDay, isPauseTime, mergeCatalog, passportSet, qrUrl, validateActivity, PASSPORT_ACHIEVEMENTS, releaseStamp, reserveStamp, weekKey,
  type ChallengeDef,
} from '../src/rules';

// 13 nov 2026, 07:30 en Ecuador (UTC-5)
const at = (iso: string) => new Date(iso);
const morning = at('2026-11-13T12:30:00Z');

test('claves de periodo usan la hora de Ecuador', () => {
  // 01:00 UTC del 14 nov = 20:00 del 13 nov en Ecuador
  assert.equal(dayKey(at('2026-11-14T01:00:00Z')), '2026-11-13');
  assert.equal(monthKey(at('2026-12-01T03:00:00Z')), 'M2026-11');
  assert.equal(weekKey(morning), 'W2026-46');
  assert.equal(weekKey(at('2027-01-01T15:00:00Z')), 'W2026-53');
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
});

test('gradas permite 2 registros al día con 60 min entre ellos', () => {
  let s = emptyStats();
  assert.ok(canRegister(s, 'gradas', morning).ok);
  s = applyActivity(s, 'gradas', morning, 10);
  const r = canRegister(s, 'gradas', at('2026-11-13T13:00:00Z'));
  assert.equal(r.reason, 'cooldown');
  const later = at('2026-11-13T14:00:00Z');
  assert.ok(canRegister(s, 'gradas', later).ok);
  s = applyActivity(s, 'gradas', later, 10);
  assert.equal(canRegister(s, 'gradas', at('2026-11-13T20:00:00Z')).reason, 'daily-limit');
  // Al día siguiente se reinicia
  assert.ok(canRegister(s, 'gradas', at('2026-11-14T13:00:00Z')).ok);
});

test('gimnasio solo una vez al día', () => {
  const s = applyActivity(emptyStats(), 'gimnasio', morning, 15);
  assert.equal(canRegister(s, 'gimnasio', at('2026-11-13T22:00:00Z')).reason, 'daily-limit');
  assert.ok(canRegister(s, 'piscina', at('2026-11-13T22:00:00Z')).ok);
});

test('racha sube con días consecutivos y se reinicia al saltar un día', () => {
  let s = applyActivity(emptyStats(), 'gradas', at('2026-11-10T15:00:00Z'), 10);
  s = applyActivity(s, 'gradas', at('2026-11-11T15:00:00Z'), 10);
  s = applyActivity(s, 'futbol', at('2026-11-11T20:00:00Z'), 20);
  s = applyActivity(s, 'gradas', at('2026-11-12T15:00:00Z'), 10);
  assert.equal(s.streak, 3);
  assert.equal(s.activeDays, 3);
  s = applyActivity(s, 'gradas', at('2026-11-14T15:00:00Z'), 10);
  assert.equal(s.streak, 1);
  assert.equal(s.bestStreak, 3);
  assert.equal(s.totalPoints, 60);
  assert.equal(s.counts.gradas, 4);
  assert.equal(s.earlyBird, false);
  assert.equal(applyActivity(emptyStats(), 'gradas', morning, 10).earlyBird, true);
});

test('retos por días cuentan un registro por día dentro del plazo', () => {
  const def: ChallengeDef = { title: 'Semana', kind: 'days', activity: null, goal: 2, durationDays: 7, bonus: 60 };
  let p = { joinedDay: '2026-11-10', endsDay: '2026-11-16', progress: 0, lastDay: null as string | null, completed: false };
  p = advanceChallenge(def, p, 'gradas', '2026-11-10')!;
  assert.equal(advanceChallenge(def, p, 'gimnasio', '2026-11-10'), null);
  p = advanceChallenge(def, p, 'gradas', '2026-11-11')!;
  assert.equal(p.completed, true);
  assert.equal(advanceChallenge(def, p, 'gradas', '2026-11-12'), null);
  const g21: ChallengeDef = { ...def, activity: 'gradas', kind: 'count', goal: 21 };
  assert.equal(advanceChallenge(g21, { ...p, completed: false }, 'piscina', '2026-11-12'), null);
  assert.equal(advanceChallenge(g21, { ...p, completed: false }, 'gradas', '2026-11-20'), null);
});

test('QR y correos', () => {
  assert.deepEqual(parseQr('MUEVETE:GR-A0:a1B2c3D4e5'), { id: 'GR-A0', token: 'a1B2c3D4e5' });
  assert.equal(parseQr('https://evil.example'), null);
  assert.equal(normalizeEmail('  MF.Ruiz@Netlife.net.ec '), 'mf.ruiz@netlife.net.ec');
  assert.equal(normalizeEmail('no-es-correo'), null);
});

test('pasaporte: sellos numerados y cupo reservado aunque esté pendiente', () => {
  const r1 = reserveStamp(emptyStats(), 'futbol', morning);
  assert.equal(r1.stampNumber, 1);
  assert.equal(canRegister(r1.stats, 'futbol', at('2026-11-13T20:00:00Z')).reason, 'daily-limit');
  assert.equal(r1.stats.totalPoints, 0);
  // Rechazo: libera el cupo del día
  const released = releaseStamp(r1.stats, 'futbol', morning);
  assert.ok(canRegister(released, 'futbol', at('2026-11-13T20:00:00Z')).ok);
  // El siguiente sello sigue la numeración aunque el anterior se haya rechazado
  assert.equal(reserveStamp(released, 'gradas', morning).stampNumber, 2);
});

test('pasaporte completo: 4 actividades en el mes dan premio una sola vez', () => {
  let s = emptyStats();
  const acts = ['gradas', 'gimnasio', 'piscina', 'futbol'] as const;
  let got: string[] = [];
  acts.forEach((a, i) => {
    const r = creditActivity(s, a, at(`2026-11-0${i + 2}T15:00:00Z`), 10);
    s = r.stats; got = got.concat(r.achievements);
  });
  assert.deepEqual(got, ['full']);
  assert.equal(s.totalPoints, 40 + PASSPORT_ACHIEVEMENTS.full.bonus);
  assert.equal(s.passportsCompleted, 1);
  assert.equal(creditActivity(s, 'futbol', at('2026-11-20T15:00:00Z'), 10).achievements.length, 0);
  // En diciembre se puede volver a ganar
  let d = s; got = [];
  acts.forEach((a, i) => { const r = creditActivity(d, a, at(`2026-12-0${i + 2}T15:00:00Z`), 10); d = r.stats; got = got.concat(r.achievements); });
  assert.deepEqual(got, ['full']);
});

test('página completa: 9 sellos validados en el mes', () => {
  let s = emptyStats();
  const got: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const r = creditActivity(s, 'gradas', at(`2026-11-${String(i).padStart(2, '0')}T15:00:00Z`), 10);
    s = r.stats; got.push(...r.achievements);
  }
  assert.deepEqual(got, ['page']);
  assert.equal(s.months['2026-11'].stamps, 10);
  assert.equal(s.streak, 10);
});

test('aprobación tardía de un día anterior no rompe la racha', () => {
  let s = creditActivity(emptyStats(), 'gradas', at('2026-11-10T15:00:00Z'), 10).stats;
  s = creditActivity(s, 'gradas', at('2026-11-11T15:00:00Z'), 10).stats;
  s = creditActivity(s, 'futbol', at('2026-11-09T22:00:00Z'), 20).stats; // aprobado tarde
  assert.equal(s.streak, 2);
  assert.equal(s.activeDays, 3);
  assert.equal(s.lastActiveDay, '2026-11-11');
  s = creditActivity(s, 'piscina', at('2026-11-11T22:00:00Z'), 15).stats; // mismo día, no suma día activo
  assert.equal(s.activeDays, 3);
});

test('pausas activas: 4 al día con 60 min entre ellas; no cuentan para pasaporte completo', () => {
  let s = emptyStats();
  for (let h = 13; h <= 16; h++) {
    const t = at(`2026-11-13T${h}:00:00Z`);
    assert.ok(canRegister(s, 'pausa', t).ok);
    s = applyActivity(s, 'pausa', t, 5);
  }
  assert.equal(canRegister(s, 'pausa', at('2026-11-13T19:00:00Z')).reason, 'daily-limit');
  let p = emptyStats(); let got: string[] = [];
  for (const [i, a] of (['pausa', 'pasos', 'gradas', 'gimnasio', 'piscina'] as const).entries()) {
    const r = creditActivity(p, a, at(`2026-11-0${i + 2}T15:00:00Z`), 5); p = r.stats; got = got.concat(r.achievements);
  }
  assert.deepEqual(got, []);
  assert.deepEqual(creditActivity(p, 'futbol', at('2026-11-09T15:00:00Z'), 20).achievements, ['full']);
});

test('fin del día local para pasos de ayer', () => {
  assert.equal(dayKey(endOfLocalDay('2026-11-13')), '2026-11-13');
  assert.equal(endOfLocalDay('2026-11-13').toISOString(), '2026-11-14T04:59:00.000Z');
});

test('recordatorios de eventos: 24 h antes y el mismo día', () => {
  const ev = at('2026-11-15T13:00:00Z'); // domingo 15, 08:00 en Ecuador
  assert.deepEqual(dueReminders(ev, at('2026-11-14T10:00:00Z'), {}), []); // 27 h antes
  assert.deepEqual(dueReminders(ev, at('2026-11-14T13:30:00Z'), {}), ['d1']); // 23.5 h antes
  assert.deepEqual(dueReminders(ev, at('2026-11-14T13:30:00Z'), { d1: true }), []);
  assert.deepEqual(dueReminders(ev, at('2026-11-15T09:00:00Z'), { d1: true }), []); // 04:00 local, faltan 4 h
  assert.deepEqual(dueReminders(ev, at('2026-11-15T11:00:00Z'), { d1: true }), ['d0']); // 06:00 local: faltan 2 h (evento temprano)
  assert.deepEqual(dueReminders(ev, at('2026-11-15T12:00:00Z'), { d1: true }), ['d0']); // 07:00 local
  assert.deepEqual(dueReminders(ev, at('2026-11-15T13:30:00Z'), {}), []); // ya empezó
  const tarde = at('2026-11-15T23:00:00Z'); // 18:00 local
  assert.deepEqual(dueReminders(tarde, at('2026-11-15T15:00:00Z'), {}), ['d0']); // 10:00 local, mismo día
  assert.deepEqual(dueReminders(tarde, at('2026-11-15T08:00:00Z'), {}), []); // 03:00 local del mismo día: espera a las 07:00
  assert.deepEqual(dueReminders(tarde, at('2026-11-14T23:30:00Z'), {}), ['d1']); // 18:30 local del día anterior (23,5 h antes)
});

test('QR como enlace para abrir con la cámara del teléfono', () => {
  const url = qrUrl('https://muevete.netlife.net.ec/', 'GR-A0', 'a1B2c3D4e5');
  assert.equal(url, 'https://muevete.netlife.net.ec/r/GR-A0/a1B2c3D4e5');
  assert.deepEqual(parseQr(url), { id: 'GR-A0', token: 'a1B2c3D4e5' });
  assert.equal(parseQr('http://muevete.netlife.net.ec/r/GR-A0/a1B2c3D4e5'), null);
  assert.equal(parseQr('https://x.com/r/GR-A0/a1B2c3D4e5?y=1'), null);
});

test('recordatorios de pausa del servidor (web): cada 90 min de 8 a 17, lunes a viernes', () => {
  const p = { enabled: true, every: 90, start: 8, end: 17, weekdays: [2, 3, 4, 5, 6] };
  const local = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00-05:00`);
  const hits = ['08:00', '09:30', '09:44', '10:15', '11:00', '15:30', '17:00'].map((h) => isPauseTime(p, local('2026-11-16', h)));
  assert.deepEqual(hits, [false, true, true, false, true, true, false]); // lunes; 09:44 cae en la ventana de 09:30
  assert.equal(isPauseTime(p, local('2026-11-15', '09:30')), false); // domingo
  assert.equal(isPauseTime({ ...p, enabled: false }, local('2026-11-16', '09:30')), false);
});

test('actividades configurables por Talento Humano', () => {
  const v = validateActivity({ name: 'Yoga en la terraza', points: 12, maxPerDay: 1, kind: 'qr', passport: false, icon: 'yoga', color: 'pausa' });
  assert.ok(!('error' in v));
  if ('error' in v) return;
  assert.equal(v.id, 'yoga-en-la-terraza');
  assert.equal(v.rule.points, 12);
  assert.deepEqual(validateActivity({ name: 'X' }), { error: 'El nombre debe tener entre 3 y 40 caracteres.' });
  assert.equal((validateActivity({ name: 'Mucho', points: 999 }) as { rule: { points: number } }).rule.points, 100);
  const cat = mergeCatalog({ [v.id]: v.rule, piscina: { active: false }, gradas: { points: 12 } });
  assert.equal(cat['yoga-en-la-terraza'].name, 'Yoga en la terraza');
  assert.equal(cat.gradas.points, 12);
  assert.equal(cat.gradas.maxPerDay, 2); // conserva lo demás de fábrica
  assert.deepEqual(passportSet(cat).sort(), ['futbol', 'gimnasio', 'gradas']); // piscina desactivada
  let s = emptyStats();
  assert.ok(canRegister(s, 'yoga-en-la-terraza', morning, cat).ok);
  s = applyActivity(s, 'yoga-en-la-terraza', morning, 12);
  assert.equal(canRegister(s, 'yoga-en-la-terraza', at('2026-11-13T20:00:00Z'), cat).reason, 'daily-limit');
  // Pasaporte completo con el conjunto vigente
  let p = emptyStats(); let got: string[] = [];
  for (const [i, a] of (['gradas', 'gimnasio', 'futbol'] as const).entries()) {
    const r = creditActivity(p, a, at(`2026-11-0${i + 2}T15:00:00Z`), 10, passportSet(cat)); p = r.stats; got = got.concat(r.achievements);
  }
  assert.deepEqual(got, ['full']);
});
