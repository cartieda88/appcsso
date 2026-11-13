import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays, advanceChallenge, applyActivity, canRegister, dayKey, emptyStats, monthKey, normalizeEmail, parseQr, weekKey,
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
