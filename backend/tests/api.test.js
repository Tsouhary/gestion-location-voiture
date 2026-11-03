// Tests d'intégration : base MySQL dédiée "parc_auto_test", recréée à chaque exécution.
// Lancer : npm test   (MySQL doit tourner)
process.env.DB_NAME = 'parc_auto_test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const { default: app } = await import('../app.js');
const { default: pool } = await import('../config/db.js');

let server;
let base;
const tokens = {};

// Dates de test : toujours dans le futur, jamais sur le même créneau que d'autres tests sauf volontairement.
const at = (dayOffset, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(hour)}:00`;
};

async function api(method, path, { body, token } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  // Recrée la base de test à partir du vrai schéma.
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  const schema = readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8').replaceAll(
    'parc_auto',
    'parc_auto_test',
  );
  await admin.query('DROP DATABASE IF EXISTS parc_auto_test');
  await admin.query(schema);
  await admin.end();

  const hash = await bcrypt.hash('Password1!', 4);
  for (const [role, mail] of [['admin', 'admin@t.mg'], ['manager', 'manager@t.mg'], ['user', 'user1@t.mg'], ['user', 'user2@t.mg']]) {
    await pool.query(
      'INSERT INTO users (role_id, first_name, last_name, email, password_hash) VALUES ((SELECT id FROM roles WHERE name = ?), ?, ?, ?, ?)',
      [role, role, mail, mail, hash],
    );
  }

  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;

  for (const mail of ['admin', 'manager', 'user1', 'user2']) {
    const res = await api('POST', '/auth/login', { body: { email: `${mail}@t.mg`, password: 'Password1!' } });
    tokens[mail] = res.body.token;
  }
});

after(async () => {
  server?.close();
  await pool.end();
});

const newVehicle = (reg, extra = {}) =>
  api('POST', '/vehicles', { token: tokens.manager, body: { registration: reg, brand: 'Toyota', model: 'Hilux', seats: 5, mileage: 1000, ...extra } });

const request = (token, body) => api('POST', '/reservations', { token, body: { destination: 'Antsirabe', purpose: 'Mission', passengers: 2, ...body } });

// ---------------------------------------------------------------- authentification

test('connexion : mauvais mot de passe refusé, bon mot de passe accepté', async () => {
  const bad = await api('POST', '/auth/login', { body: { email: 'admin@t.mg', password: 'faux' } });
  assert.equal(bad.status, 401);
  const unknown = await api('POST', '/auth/login', { body: { email: 'nobody@t.mg', password: 'Password1!' } });
  assert.equal(unknown.status, 401);
  assert.equal(bad.body.message, unknown.body.message, 'même message : pas de fuite sur l\'existence du compte');
  assert.ok(tokens.admin);
});

test('routes protégées : sans jeton 401, avec un mauvais rôle 403', async () => {
  assert.equal((await api('GET', '/vehicles')).status, 401);
  assert.equal((await api('GET', '/vehicles', { token: 'n.importe.quoi' })).status, 401);
  assert.equal((await newVehicle('X-1')).status, 201);
  assert.equal((await api('POST', '/vehicles', { token: tokens.user1, body: { registration: 'Y', brand: 'a', model: 'b' } })).status, 403);
  assert.equal((await api('GET', '/drivers', { token: tokens.user1 })).status, 403);
  assert.equal((await api('GET', '/users', { token: tokens.manager })).status, 403);
  assert.equal((await api('GET', '/users', { token: tokens.admin })).status, 200);
});

test('un compte désactivé perd l\'accès immédiatement', async () => {
  const created = await api('POST', '/users', {
    token: tokens.admin,
    body: { first_name: 'A', last_name: 'B', email: 'tmp@t.mg', password: 'Password1!', role: 'user' },
  });
  assert.equal(created.status, 201);
  const login = await api('POST', '/auth/login', { body: { email: 'tmp@t.mg', password: 'Password1!' } });
  assert.equal((await api('GET', '/auth/me', { token: login.body.token })).status, 200);
  await api('PUT', `/users/${created.body.id}`, { token: tokens.admin, body: { active: false } });
  assert.equal((await api('GET', '/auth/me', { token: login.body.token })).status, 401);
});

// ---------------------------------------------------------------- validation

test('validation : champs invalides rejetés, colonnes inconnues ignorées', async () => {
  const noReg = await api('POST', '/vehicles', { token: tokens.manager, body: { brand: 'a', model: 'b' } });
  assert.equal(noReg.status, 400);
  const badYear = await newVehicle('BAD-YEAR', { year: 'abc' });
  assert.equal(badYear.status, 400);
  const dup = await newVehicle('X-1');
  assert.equal(dup.status, 409);

  const injected = await newVehicle('INJ-1', { id: 9999, status: 'available', 'nope; DROP TABLE users': 1 });
  assert.equal(injected.status, 201);
  assert.notEqual(injected.body.id, 9999);

  const sqli = await api('GET', `/vehicles?q=${encodeURIComponent("' OR 1=1 --")}`, { token: tokens.user1 });
  assert.equal(sqli.status, 200);
  assert.equal(sqli.body.length, 0);
});

test('champs vides sur colonnes non nulles : valeur par défaut, pas de 500', async () => {
  const v = await newVehicle('EMPTY-1', { seats: '', mileage: '', fuel_type: '', status: '' });
  assert.equal(v.status, 201);
  assert.equal(v.body.seats, 5);
  assert.equal(v.body.status, 'available');
  const m = await api('POST', '/maintenance', {
    token: tokens.manager,
    body: { vehicle_id: v.body.id, type: 'vidange', maintenance_date: '2026-09-01', cost: '' },
  });
  assert.equal(m.status, 201);
  assert.equal(Number(m.body.cost), 0);
});

// ---------------------------------------------------------------- réservations

test('réservation : dates incohérentes ou passées refusées', async () => {
  const past = await request(tokens.user1, { start_at: '2020-01-01T08:00', end_at: '2020-01-02T08:00' });
  assert.equal(past.status, 400);
  const inverted = await request(tokens.user1, { start_at: at(30, 18), end_at: at(30, 8) });
  assert.equal(inverted.status, 400);
});

test('workflow complet : demande → validation → départ → retour, kilométrage et statuts', async () => {
  const v = (await newVehicle('FLOW-1', { mileage: 5000 })).body;
  const r = await request(tokens.user1, { vehicle_id: v.id, start_at: at(40, 8), end_at: at(41, 18) });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'pending');

  // L'utilisateur ne peut pas valider lui-même.
  assert.equal((await api('PUT', `/reservations/${r.body.id}/validate`, { token: tokens.user1 })).status, 403);

  const ok = await api('PUT', `/reservations/${r.body.id}/validate`, { token: tokens.manager, body: {} });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, 'validated');

  const started = await api('PUT', `/reservations/${r.body.id}/start`, { token: tokens.manager });
  assert.equal(started.body.status, 'in_progress');
  assert.equal(started.body.mileage_start, 5000);
  assert.equal((await api('GET', `/vehicles/${v.id}`, { token: tokens.manager })).body.status, 'in_mission');

  const tooLow = await api('PUT', `/reservations/${r.body.id}/complete`, { token: tokens.manager, body: { mileage_end: 4000 } });
  assert.equal(tooLow.status, 400);

  const done = await api('PUT', `/reservations/${r.body.id}/complete`, { token: tokens.manager, body: { mileage_end: 5450 } });
  assert.equal(done.body.status, 'completed');
  const after = (await api('GET', `/vehicles/${v.id}`, { token: tokens.manager })).body;
  assert.equal(after.status, 'available');
  assert.equal(after.mileage, 5450);
});

test('anti-chevauchement : même véhicule, périodes qui se recoupent → 409 ; bornes qui se touchent → OK', async () => {
  const v = (await newVehicle('OVL-1')).body;
  const first = await request(tokens.user1, { vehicle_id: v.id, start_at: at(50, 8), end_at: at(50, 18) });
  assert.equal((await api('PUT', `/reservations/${first.body.id}/validate`, { token: tokens.manager, body: {} })).status, 200);

  // Une nouvelle demande sur le créneau déjà validé est refusée d'emblée.
  const overlap = await request(tokens.user2, { vehicle_id: v.id, start_at: at(50, 16), end_at: at(51, 9) });
  assert.equal(overlap.status, 409);

  // Dernier créneau qui commence pile à la fin du précédent : autorisé.
  const touching = await request(tokens.user2, { vehicle_id: v.id, start_at: at(50, 18), end_at: at(51, 9) });
  assert.equal(touching.status, 201);
  assert.equal((await api('PUT', `/reservations/${touching.body.id}/validate`, { token: tokens.manager, body: {} })).status, 200);

  // La disponibilité par période reflète ces réservations.
  const during = await api('GET', `/vehicles/available?start_at=${at(50, 10)}&end_at=${at(50, 12)}`, { token: tokens.user1 });
  assert.ok(!during.body.some((x) => x.id === v.id));
  const later = await api('GET', `/vehicles/available?start_at=${at(60, 10)}&end_at=${at(60, 12)}`, { token: tokens.user1 });
  assert.ok(later.body.some((x) => x.id === v.id));
});

test('validations simultanées du même véhicule : une seule réussit', async () => {
  const v = (await newVehicle('RACE-1')).body;
  const a = await request(tokens.user1, { start_at: at(70, 8), end_at: at(70, 18) });
  const b = await request(tokens.user2, { start_at: at(70, 10), end_at: at(70, 20) });
  const results = await Promise.all(
    [a, b].map((r) => api('PUT', `/reservations/${r.body.id}/validate`, { token: tokens.manager, body: { vehicle_id: v.id } })),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});

test('validation sans véhicule refusée ; véhicule en maintenance non réservable', async () => {
  const r = await request(tokens.user1, { start_at: at(80, 8), end_at: at(80, 18) });
  assert.equal((await api('PUT', `/reservations/${r.body.id}/validate`, { token: tokens.manager, body: {} })).status, 400);

  const v = (await newVehicle('MNT-1')).body;
  const m = await api('POST', '/maintenance', {
    token: tokens.manager,
    body: { vehicle_id: v.id, type: 'vidange', maintenance_date: '2026-09-01', mileage: 2000, cost: 100000, put_in_maintenance: true },
  });
  assert.equal(m.status, 201);
  const vehicle = (await api('GET', `/vehicles/${v.id}`, { token: tokens.manager })).body;
  assert.equal(vehicle.status, 'maintenance');
  assert.equal(vehicle.mileage, 2000, 'le kilométrage de l\'entretien met à jour le véhicule');
  assert.equal((await request(tokens.user1, { vehicle_id: v.id, start_at: at(81, 8), end_at: at(81, 18) })).status, 409);
});

test('conducteur : indisponible en cas de chevauchement, permis expiré refusé', async () => {
  const mkDriver = (n, licenseExpiry) =>
    api('POST', '/drivers', {
      token: tokens.manager,
      body: { first_name: 'D', last_name: n, license_number: `LIC-${n}`, license_expiry: licenseExpiry },
    });
  const d1 = (await mkDriver('1', '2099-01-01')).body;
  const dExpired = (await mkDriver('2', '2020-01-01')).body;
  const v1 = (await newVehicle('DRV-1')).body;
  const v2 = (await newVehicle('DRV-2')).body;

  const r1 = await request(tokens.user1, { vehicle_id: v1.id, start_at: at(90, 8), end_at: at(90, 18) });
  assert.equal((await api('PUT', `/reservations/${r1.body.id}/validate`, { token: tokens.manager, body: { driver_id: d1.id } })).status, 200);

  const r2 = await request(tokens.user2, { vehicle_id: v2.id, start_at: at(90, 9), end_at: at(90, 17) });
  const clash = await api('PUT', `/reservations/${r2.body.id}/validate`, { token: tokens.manager, body: { driver_id: d1.id } });
  assert.equal(clash.status, 409);
  const expired = await api('PUT', `/reservations/${r2.body.id}/validate`, { token: tokens.manager, body: { driver_id: dExpired.id } });
  assert.equal(expired.status, 409);

  const free = await api('GET', `/drivers/available?start_at=${at(90, 9)}&end_at=${at(90, 17)}`, { token: tokens.manager });
  assert.ok(!free.body.some((d) => d.id === d1.id));
  assert.ok(!free.body.some((d) => d.id === dExpired.id));
});

test('confidentialité : un utilisateur ne voit que ses réservations', async () => {
  const v = (await newVehicle('PRIV-1')).body;
  const r = await request(tokens.user1, { vehicle_id: v.id, start_at: at(100, 8), end_at: at(100, 18) });
  assert.equal((await api('GET', `/reservations/${r.body.id}`, { token: tokens.user2 })).status, 404);
  assert.equal((await api('PUT', `/reservations/${r.body.id}/cancel`, { token: tokens.user2 })).status, 404);
  const mine = await api('GET', '/reservations', { token: tokens.user2 });
  assert.ok(!mine.body.some((x) => x.id === r.body.id));
  const all = await api('GET', '/reservations', { token: tokens.manager });
  assert.ok(all.body.some((x) => x.id === r.body.id));
});

test('annulation : le créneau est libéré', async () => {
  const v = (await newVehicle('CAN-1')).body;
  const r = await request(tokens.user1, { vehicle_id: v.id, start_at: at(110, 8), end_at: at(110, 18) });
  await api('PUT', `/reservations/${r.body.id}/validate`, { token: tokens.manager, body: {} });
  assert.equal((await request(tokens.user2, { vehicle_id: v.id, start_at: at(110, 9), end_at: at(110, 12) })).status, 409);
  assert.equal((await api('PUT', `/reservations/${r.body.id}/cancel`, { token: tokens.user1 })).body.status, 'cancelled');
  assert.equal((await request(tokens.user2, { vehicle_id: v.id, start_at: at(110, 9), end_at: at(110, 12) })).status, 201);
});

test('refus : motif obligatoire', async () => {
  const r = await request(tokens.user1, { start_at: at(120, 8), end_at: at(120, 18) });
  assert.equal((await api('PUT', `/reservations/${r.body.id}/reject`, { token: tokens.manager, body: {} })).status, 400);
  const rej = await api('PUT', `/reservations/${r.body.id}/reject`, { token: tokens.manager, body: { reason: 'Pas de véhicule' } });
  assert.equal(rej.body.status, 'rejected');
  assert.equal(rej.body.rejection_reason, 'Pas de véhicule');
});

test('tableau de bord : compteurs cohérents et alertes', async () => {
  await newVehicle('ALERT-1', { insurance_expiry: '2020-01-01' });
  const staff = await api('GET', '/dashboard', { token: tokens.manager });
  assert.equal(staff.status, 200);
  assert.equal(staff.body.vehicles.total, Object.values(staff.body.vehicles).slice(0, 5).reduce((a, b) => a + b, 0));
  assert.ok(staff.body.alerts.some((a) => a.type === 'insurance' && a.severity === 'expired'));
  const personal = await api('GET', '/dashboard', { token: tokens.user1 });
  assert.equal(personal.body.scope, 'personal');
  assert.equal(personal.body.alerts, undefined);
});

// ---------------------------------------------------------------- facturation, reçus, contrats

let billingSeq = 0;
/** Réservation validée de user1 sur un véhicule neuf au tarif donné. */
async function validatedReservation(dayOffset, { rate = 150000, endOffset = 1 } = {}) {
  billingSeq += 1;
  const v = (await newVehicle(`BIL-${billingSeq}`, { daily_rate: rate })).body;
  const r = await request(tokens.user1, { vehicle_id: v.id, start_at: at(dayOffset, 8), end_at: at(dayOffset + endOffset, 18) });
  assert.equal(r.status, 201);
  const ok = await api('PUT', `/reservations/${r.body.id}/validate`, { token: tokens.manager, body: {} });
  assert.equal(ok.status, 200);
  return { vehicle: v, reservation: r.body };
}
const invoiceFor = async (reservationId, body = {}) => api('POST', `/reservations/${reservationId}/invoice`, { token: tokens.manager, body });
const pay = (invoiceId, body, token = tokens.manager) =>
  api('POST', `/invoices/${invoiceId}/payments`, { token, body: { method: 'especes', ...body } });
const getInvoice = (id, token = tokens.manager) => api('GET', `/invoices/${id}`, { token });

test('contrat : généré à la validation, unique, visible du demandeur seulement', async () => {
  const { reservation } = await validatedReservation(200);
  const doc = await api('GET', `/reservations/${reservation.id}/contract`, { token: tokens.user1 });
  assert.equal(doc.status, 200);
  assert.match(doc.body.contract.number, /^CTR-\d{4}-\d{4}$/);
  assert.equal(doc.body.client.name, 'user user1@t.mg');
  assert.equal(doc.body.reservation.destination, 'Antsirabe');
  assert.equal(doc.body.contract.signed_at, null);

  const again = await api('POST', `/reservations/${reservation.id}/contract`, { token: tokens.manager });
  assert.equal(again.status, 200);
  assert.equal(again.body.created, false, 'idempotent : pas de second contrat');
  assert.equal((await api('POST', `/reservations/${reservation.id}/contract`, { token: tokens.user1 })).status, 403);
  assert.equal((await api('GET', `/reservations/${reservation.id}/contract`, { token: tokens.user2 })).status, 404);

  const pending = await request(tokens.user1, { start_at: at(201, 8), end_at: at(201, 18) });
  assert.equal((await api('POST', `/reservations/${pending.body.id}/contract`, { token: tokens.manager })).status, 409);
  assert.equal((await api('GET', `/reservations/${pending.body.id}/contract`, { token: tokens.user1 })).status, 404);
});

test('contrat : signature une seule fois, par le personnel', async () => {
  const { reservation } = await validatedReservation(205);
  const doc = (await api('GET', `/reservations/${reservation.id}/contract`, { token: tokens.manager })).body;
  assert.equal((await api('PUT', `/contracts/${doc.contract.id}/sign`, { token: tokens.user1 })).status, 403);
  assert.equal((await api('PUT', `/contracts/${doc.contract.id}/sign`, { token: tokens.manager })).status, 200);
  assert.equal((await api('PUT', `/contracts/${doc.contract.id}/sign`, { token: tokens.manager })).status, 409);
  const after = (await api('GET', `/reservations/${reservation.id}/contract`, { token: tokens.user1 })).body;
  assert.ok(after.contract.signed_at);
});

test('facture : montant = jours × tarif du véhicule, une seule par réservation', async () => {
  // 08:00 le jour J → 18:00 le jour J+1 = 34 h → 2 jours facturés
  const { reservation } = await validatedReservation(210, { rate: 150000 });
  const created = await invoiceFor(reservation.id);
  assert.equal(created.status, 201);
  const doc = (await getInvoice(created.body.id)).body;
  assert.match(doc.invoice.number, /^FAC-\d{4}-\d{4}$/);
  assert.equal(doc.invoice.days, 2);
  assert.equal(doc.invoice.total, 300000);
  assert.equal(doc.invoice.status, 'unpaid');
  assert.equal(doc.invoice.balance, 300000);
  assert.ok(doc.vehicle.registration.startsWith('BIL-'));

  const dup = await invoiceFor(reservation.id);
  assert.equal(dup.status, 409, 'pas de doublon');
  assert.ok(dup.body.message.includes(doc.invoice.number));
  assert.equal((await api('POST', `/reservations/${reservation.id}/invoice`, { token: tokens.user1 })).status, 403);

  const pending = await request(tokens.user1, { start_at: at(211, 8), end_at: at(211, 18) });
  assert.equal((await invoiceFor(pending.body.id)).status, 409, 'une demande non validée ne se facture pas');
});

test('facture : visible du demandeur et du personnel uniquement', async () => {
  const { reservation } = await validatedReservation(215);
  const id = (await invoiceFor(reservation.id)).body.id;
  assert.equal((await getInvoice(id, tokens.user1)).status, 200);
  assert.equal((await getInvoice(id, tokens.user2)).status, 404);
  const mine = await api('GET', '/invoices', { token: tokens.user1 });
  assert.ok(mine.body.some((i) => i.id === id));
  const others = await api('GET', '/invoices', { token: tokens.user2 });
  assert.ok(!others.body.some((i) => i.id === id));
});

test('paiements : partiel, solde, dépassement refusé, reçu numéroté', async () => {
  const { reservation } = await validatedReservation(220, { rate: 100000 }); // 2 jours → 200 000
  const id = (await invoiceFor(reservation.id)).body.id;

  assert.equal((await pay(id, { amount: 0 })).status, 400);
  assert.equal((await pay(id, { amount: 50000 }, tokens.user1)).status, 403, 'un utilisateur n\'encaisse pas');

  const p1 = await pay(id, { amount: 80000, reference: 'MVola 0341234567' });
  assert.equal(p1.status, 201);
  let doc = (await getInvoice(id)).body;
  assert.equal(doc.invoice.status, 'partial');
  assert.equal(doc.invoice.paid, 80000);
  assert.equal(doc.invoice.balance, 120000);

  const over = await pay(id, { amount: 120001 });
  assert.equal(over.status, 409, 'un paiement ne peut pas dépasser le solde');

  const p2 = await pay(id, { amount: 120000, method: 'virement' });
  assert.equal(p2.status, 201);
  doc = (await getInvoice(id)).body;
  assert.equal(doc.invoice.status, 'paid');
  assert.equal(doc.invoice.balance, 0);
  assert.equal(doc.payments.length, 2);
  assert.equal((await pay(id, { amount: 1 })).status, 409, 'facture déjà soldée');

  const r1 = (await api('GET', `/payments/${p1.body.id}`, { token: tokens.user1 })).body;
  const r2 = (await api('GET', `/payments/${p2.body.id}`, { token: tokens.user1 })).body;
  assert.match(r1.receipt.number, /^REC-\d{4}-\d{4}$/);
  assert.notEqual(r1.receipt.number, r2.receipt.number);
  assert.equal(r1.receipt.balance_after, 120000, 'solde restant après le 1er paiement');
  assert.equal(r2.receipt.balance_after, 0);
  assert.equal(r1.receipt.reference, 'MVola 0341234567');
  assert.equal(r1.invoice.number, doc.invoice.number);
  assert.equal((await api('GET', `/payments/${p1.body.id}`, { token: tokens.user2 })).status, 404);
});

test('paiements simultanés : numéros de reçu tous différents, solde jamais dépassé', async () => {
  const { reservation } = await validatedReservation(230, { rate: 100000 }); // 200 000
  const id = (await invoiceFor(reservation.id)).body.id;
  const results = await Promise.all([1, 2, 3, 4].map(() => pay(id, { amount: 60000 }))); // 4 × 60 000 = 240 000 > 200 000
  assert.equal(results.filter((r) => r.status === 201).length, 3, 'le 4e dépasserait le solde');
  assert.equal(results.filter((r) => r.status === 409).length, 1);
  const doc = (await getInvoice(id)).body;
  assert.equal(new Set(doc.payments.map((p) => p.receipt_number)).size, 3);
  assert.equal(doc.invoice.paid, 180000);
});

test('facture : ajustement (remise) contrôlé par rapport aux paiements reçus', async () => {
  const { reservation } = await validatedReservation(240, { rate: 100000 }); // 200 000
  const id = (await invoiceFor(reservation.id)).body.id;
  const upd = await api('PUT', `/invoices/${id}`, { token: tokens.manager, body: { discount: 50000, notes: 'Remise fidélité' } });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.invoice.total, 150000);
  assert.equal(upd.body.invoice.notes, 'Remise fidélité');

  await pay(id, { amount: 100000 });
  const tooLow = await api('PUT', `/invoices/${id}`, { token: tokens.manager, body: { discount: 150000 } }); // total 50 000 < 100 000 déjà payés
  assert.equal(tooLow.status, 409);
  const absurd = await api('PUT', `/invoices/${id}`, { token: tokens.manager, body: { discount: 999999 } });
  assert.equal(absurd.status, 400);
  assert.equal((await api('PUT', `/invoices/${id}`, { token: tokens.user1, body: { discount: 1 } })).status, 403);

  // Solder en réduisant le total au montant déjà payé
  const settle = await api('PUT', `/invoices/${id}`, { token: tokens.manager, body: { discount: 100000 } });
  assert.equal(settle.body.invoice.total, 100000);
  assert.equal(settle.body.invoice.status, 'paid');
});

test('suppression d\'un paiement : administrateur seulement, le statut est recalculé', async () => {
  const { reservation } = await validatedReservation(250, { rate: 100000 });
  const id = (await invoiceFor(reservation.id)).body.id;
  const p = await pay(id, { amount: 200000 });
  assert.equal((await getInvoice(id)).body.invoice.status, 'paid');
  assert.equal((await api('DELETE', `/payments/${p.body.id}`, { token: tokens.manager })).status, 403);
  assert.equal((await api('DELETE', `/payments/${p.body.id}`, { token: tokens.admin })).status, 204);
  assert.equal((await getInvoice(id)).body.invoice.status, 'unpaid');
});

test('annulation de la réservation : facture impayée annulée, facture déjà encaissée conservée', async () => {
  const a = await validatedReservation(260);
  const invA = (await invoiceFor(a.reservation.id)).body.id;
  await api('PUT', `/reservations/${a.reservation.id}/cancel`, { token: tokens.user1 });
  const docA = (await getInvoice(invA)).body;
  assert.equal(docA.invoice.status, 'cancelled');
  assert.equal(docA.invoice.balance, 0);
  assert.equal((await pay(invA, { amount: 1000 })).status, 409, 'plus de paiement sur une facture annulée');

  const b = await validatedReservation(270);
  const invB = (await invoiceFor(b.reservation.id)).body.id;
  await pay(invB, { amount: 10000 });
  await api('PUT', `/reservations/${b.reservation.id}/cancel`, { token: tokens.user1 });
  assert.equal((await getInvoice(invB)).body.invoice.status, 'partial', 'des paiements existent : décision du personnel');
});

test('paramètres de l\'organisation : lecture personnel, écriture administrateur, repris dans les documents', async () => {
  assert.equal((await api('GET', '/settings', { token: tokens.user1 })).status, 403);
  assert.equal((await api('GET', '/settings', { token: tokens.manager })).status, 200);
  assert.equal((await api('PUT', '/settings', { token: tokens.manager, body: { org_name: 'X' } })).status, 403);
  const upd = await api('PUT', '/settings', { token: tokens.admin, body: { org_name: 'Transports Rakoto', org_nif: '123456', org_email: 'contact@rakoto.mg' } });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.org_name, 'Transports Rakoto');
  assert.equal((await api('PUT', '/settings', { token: tokens.admin, body: { org_email: 'pas-un-email' } })).status, 400);

  const { reservation } = await validatedReservation(280);
  const id = (await invoiceFor(reservation.id)).body.id;
  const doc = (await getInvoice(id, tokens.user1)).body;
  assert.equal(doc.org.name, 'Transports Rakoto');
  assert.equal(doc.org.nif, '123456');
});

test('numéros de factures : séquence continue, sans trou ni doublon', async () => {
  const numbers = (await api('GET', '/invoices', { token: tokens.manager })).body.map((i) => Number(i.number.slice(-4))).sort((a, b) => a - b);
  assert.ok(numbers.length >= 6);
  assert.deepEqual(numbers, numbers.map((_, i) => i + 1));
});
