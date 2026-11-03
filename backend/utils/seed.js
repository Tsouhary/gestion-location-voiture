// Données de démonstration : npm run seed. Chaque étape est idempotente (ne recrée pas ce qui existe déjà).
import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { withTransaction } from './sql.js';
import { createContractIfMissing, createInvoice, recalcInvoice } from '../services/billing.js';
import { nextNumber } from '../services/documentNumbers.js';

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const at = (offset, time) => `${day(offset)} ${time}`;

const PASSWORD = 'Parc2026!';

const users = [
  ['admin', 'Admin', 'Système', 'admin@parc.mg'],
  ['manager', 'Hery', 'Randria', 'gestionnaire@parc.mg'],
  ['user', 'Jean', 'Rakoto', 'jean.rakoto@parc.mg'],
  ['user', 'Lala', 'Rasoa', 'lala.rasoa@parc.mg'],
  ['driver', 'Faly', 'Andria', 'faly.andria@parc.mg'],
];

// Compte administrateur personnel (mot de passe volontairement simple : environnement local uniquement).
const TSOU = { role: 'admin', first: 'Tsou', last: 'Admin', email: 'tsou@parc.mg', password: '1234' };

const insertUser = async (role, first, last, email, password) => {
  const [res] = await db.query(
    'INSERT INTO users (role_id, first_name, last_name, email, password_hash) VALUES ((SELECT id FROM roles WHERE name = ?), ?, ?, ?, ?)',
    [role, first, last, email, await bcrypt.hash(password, 10)],
  );
  return res.insertId;
};
const userExists = async (email) => (await db.query('SELECT 1 FROM users WHERE email = ?', [email]))[0].length > 0;

// ---------- 1. Comptes, véhicules, conducteurs, entretien

if (await userExists('admin@parc.mg')) {
  console.log('Données de base déjà présentes.');
} else {
  const ids = {};
  for (const [role, first, last, mail] of users) ids[mail] = await insertUser(role, first, last, mail, PASSWORD);

  const [cats] = await db.query('SELECT id, name FROM vehicle_categories');
  const cat = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  const vehicles = [
    // catégorie, immat., marque, modèle, année, couleur, carburant, boîte, places, km, assurance, CT
    ['4x4', '1234 TBA', 'Toyota', 'Hilux', 2022, 'Blanc', 'diesel', 'manuelle', 5, 48200, day(200), day(150)],
    ['Berline', '5678 TBC', 'Toyota', 'Corolla', 2021, 'Gris', 'essence', 'automatique', 5, 62100, day(12), day(90)],
    ['SUV', '2468 TAB', 'Hyundai', 'Tucson', 2023, 'Noir', 'diesel', 'automatique', 5, 21500, day(300), day(20)],
    ['Minibus', '1357 TAC', 'Toyota', 'Hiace', 2020, 'Blanc', 'diesel', 'manuelle', 14, 97300, day(120), day(60)],
    ['Utilitaire', '9753 TBD', 'Renault', 'Kangoo', 2019, 'Bleu', 'diesel', 'manuelle', 3, 134800, day(45), day(-5)],
    ['Camion', '8642 TAD', 'Isuzu', 'NPR', 2018, 'Blanc', 'diesel', 'manuelle', 3, 210400, day(90), day(75)],
  ];
  for (const [c, reg, brand, model, year, color, fuel, gear, seats, km, ins, ct] of vehicles) {
    await db.query(
      `INSERT INTO vehicles (category_id, registration, brand, model, year, color, fuel_type, transmission, seats, mileage,
                             insurance_expiry, technical_inspection_expiry)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cat[c], reg, brand, model, year, color, fuel, gear, seats, km, ins, ct],
    );
  }

  await db.query(
    `INSERT INTO drivers (user_id, first_name, last_name, phone, license_number, license_category, license_expiry, hire_date)
     VALUES (?, 'Faly', 'Andria', '034 00 000 01', 'MG-001-2019', 'B', ?, '2019-03-01'),
            (NULL, 'Rija', 'Rabe', '034 00 000 02', 'MG-002-2020', 'C', ?, '2020-06-15'),
            (NULL, 'Toky', 'Razafy', '034 00 000 03', 'MG-003-2021', 'D', ?, '2021-09-10')`,
    [ids['faly.andria@parc.mg'], day(400), day(25), day(700)],
  );

  await db.query(
    `INSERT INTO vehicle_maintenance (vehicle_id, type, maintenance_date, mileage, cost, garage, next_date, next_mileage, created_by)
     SELECT id, 'vidange', ?, 47000, 180000, 'Garage Central', ?, 57000, ? FROM vehicles WHERE registration = '1234 TBA'`,
    [day(-60), day(20), ids['gestionnaire@parc.mg']],
  );
  console.log(`Données de base créées (mot de passe des comptes de démonstration : ${PASSWORD}).`);
}

// ---------- 2. Administrateur Tsou

if (await userExists(TSOU.email)) {
  console.log(`Compte ${TSOU.email} déjà présent.`);
} else {
  await insertUser(TSOU.role, TSOU.first, TSOU.last, TSOU.email, TSOU.password);
  console.log(`Administrateur créé : ${TSOU.email} / ${TSOU.password}`);
}

// ---------- 3. Réservations d'exemple (statuts variés)

const [[{ n: reservationCount }]] = await db.query('SELECT COUNT(*) AS n FROM reservations');
if (reservationCount) {
  console.log('Réservations déjà présentes.');
} else {
  const idOf = async (sql, param) => (await db.query(sql, [param]))[0][0]?.id;
  const jean = await idOf('SELECT id FROM users WHERE email = ?', 'jean.rakoto@parc.mg');
  const lala = await idOf('SELECT id FROM users WHERE email = ?', 'lala.rasoa@parc.mg');
  const hery = await idOf('SELECT id FROM users WHERE email = ?', 'gestionnaire@parc.mg');
  const veh = (reg) => idOf('SELECT id FROM vehicles WHERE registration = ?', reg);
  const drv = (lic) => idOf('SELECT id FROM drivers WHERE license_number = ?', lic);

  if (![jean, lala, hery].every(Boolean)) {
    console.log('Comptes de démonstration absents : réservations d\'exemple ignorées.');
  } else {
    const hilux = await veh('1234 TBA');
    const tucson = await veh('2468 TAB');
    const hiace = await veh('1357 TAC');
    const kangoo = await veh('9753 TBD');
    const rija = await drv('MG-002-2020');
    const toky = await drv('MG-003-2021');

    const insert = (r) =>
      db.query(
        `INSERT INTO reservations (user_id, vehicle_id, driver_id, driver_requested, start_at, end_at, destination, purpose,
                                   passengers, status, rejection_reason, mileage_start, mileage_end, decided_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.user, r.vehicle ?? null, r.driver ?? null, r.driver ? 1 : 0, r.start, r.end, r.destination, r.purpose,
          r.passengers, r.status, r.reason ?? null, r.kmStart ?? null, r.kmEnd ?? null, r.decidedBy ?? null],
      );

    // Mission terminée (le véhicule est revenu à 48 200 km, comme dans sa fiche)
    const [done] = await insert({
      user: jean, vehicle: hilux, driver: rija, start: at(-10, '08:00:00'), end: at(-9, '18:00:00'), destination: 'Antsirabe',
      purpose: 'Visite de chantier', passengers: 3, status: 'completed', kmStart: 47750, kmEnd: 48200, decidedBy: hery,
    });
    await db.query(
      `INSERT INTO vehicle_mileage (vehicle_id, reservation_id, mileage, context) VALUES (?, ?, 47750, 'reservation_start'), (?, ?, 48200, 'reservation_end')`,
      [hilux, done.insertId, hilux, done.insertId],
    );

    await insert({ // Validée, à venir, avec conducteur
      user: lala, vehicle: tucson, driver: toky, start: at(3, '08:00:00'), end: at(4, '17:00:00'), destination: 'Toamasina',
      purpose: 'Réunion avec un partenaire', passengers: 2, status: 'validated', decidedBy: hery,
    });
    await insert({ // En attente d'une décision
      user: jean, vehicle: kangoo, start: at(7, '07:30:00'), end: at(7, '17:30:00'), destination: 'Mahajanga',
      purpose: 'Livraison de matériel', passengers: 1, status: 'pending',
    });
    await insert({ // Refusée
      user: lala, vehicle: hiace, start: at(5, '06:00:00'), end: at(6, '20:00:00'), destination: 'Fianarantsoa',
      purpose: 'Sortie d\'équipe', passengers: 10, status: 'rejected', reason: 'Véhicule déjà prévu pour une autre mission', decidedBy: hery,
    });
    console.log('Réservations d\'exemple créées (terminée, validée, en attente, refusée).');
  }
}

// ---------- 4. Tarifs, organisation, contrats, factures et paiements

const RATES = { '1234 TBA': 250000, '5678 TBC': 150000, '2468 TAB': 200000, '1357 TAC': 300000, '9753 TBD': 120000, '8642 TAD': 350000 };
for (const [reg, rate] of Object.entries(RATES)) {
  await db.query('UPDATE vehicles SET daily_rate = ? WHERE registration = ? AND daily_rate = 0', [rate, reg]);
}

const [[{ n: hasDefaultOrg }]] = await db.query("SELECT COUNT(*) AS n FROM settings WHERE setting_key = 'org_name' AND setting_value = 'Mon organisation'");
if (hasDefaultOrg) {
  const org = {
    org_name: 'Société Malagasy de Transport (démo)', org_address: 'Lot II A 45, Analakely', org_city: 'Antananarivo',
    org_phone: '020 22 000 00', org_email: 'contact@parc.mg', org_nif: '1000000000', org_stat: '49100 11 2020 0 00001',
  };
  for (const [k, v] of Object.entries(org)) await db.query('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [v, k]);
  console.log("Coordonnées de l'organisation (démo) renseignées : modifiables dans Paramètres.");
}

const [[{ n: invoiceCount }]] = await db.query('SELECT COUNT(*) AS n FROM invoices');
if (invoiceCount) {
  console.log('Facturation déjà présente.');
} else {
  const [reservations] = await db.query("SELECT id, destination, status FROM reservations WHERE status IN ('completed','validated')");
  const [[manager]] = await db.query("SELECT id FROM users WHERE email = 'gestionnaire@parc.mg'");
  const addPayment = (conn, invoiceId, amount, method, reference, daysAgo) =>
    withTransaction(conn, async (c) => {
      const receipt = await nextNumber(c, 'receipt');
      await c.query(
        'INSERT INTO payments (receipt_number, invoice_id, amount, method, reference, paid_at, recorded_by) VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), ?)',
        [receipt, invoiceId, amount, method, reference, daysAgo, manager.id],
      );
      await recalcInvoice(c, invoiceId);
    });

  for (const r of reservations) {
    const { id: contractId } = await withTransaction(db, (c) => createContractIfMissing(c, r.id, manager.id));
    const invoiceId = await withTransaction(db, (c) => createInvoice(c, r.id, manager.id, {}));

    if (r.status === 'completed') {
      // Mission terminée : contrat signé, facture soldée en deux paiements
      await db.query('UPDATE contracts SET signed_at = DATE_SUB(NOW(), INTERVAL 11 DAY) WHERE id = ?', [contractId]);
      await addPayment(db, invoiceId, 250000, 'mobile_money', 'MVola 034 12 345 67', 10);
      const [[{ total }]] = await db.query('SELECT total FROM invoices WHERE id = ?', [invoiceId]);
      await addPayment(db, invoiceId, total - 250000, 'especes', null, 8);
    } else {
      // Réservation à venir : contrat à signer, acompte versé
      await addPayment(db, invoiceId, 100000, 'mobile_money', 'MVola 034 98 765 43', 1);
    }
  }
  console.log('Contrats, factures et reçus de démonstration créés.');
}

await db.end();
