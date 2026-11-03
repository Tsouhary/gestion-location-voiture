import db from '../config/db.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { parseBody, str, int, num, date, datetime, enumOf } from '../utils/validate.js';
import { insertRow, updateRow, whereBuilder, likeTerm } from '../utils/sql.js';
import { VEHICLE_FREE_SQL } from '../services/availability.js';
import { DISPLAY_STATUS_SQL } from '../services/vehicleStatus.js';

const schema = {
  category_id: int({ min: 1 }),
  registration: str({ required: true, max: 20 }),
  brand: str({ required: true, max: 60 }),
  model: str({ required: true, max: 60 }),
  year: int({ min: 1950, max: 2100 }),
  color: str({ max: 40 }),
  fuel_type: enumOf(['diesel', 'essence', 'hybride', 'electrique'], { notNull: true }),
  transmission: enumOf(['manuelle', 'automatique'], { notNull: true }),
  seats: int({ min: 1, max: 100, notNull: true }),
  mileage: int({ min: 0, notNull: true }),
  daily_rate: num({ min: 0, notNull: true }),
  first_registration_date: date(),
  insurance_company: str({ max: 100 }),
  insurance_expiry: date(),
  technical_inspection_expiry: date(),
  status: enumOf(['available', 'in_mission', 'maintenance', 'out_of_service'], { notNull: true }),
  photo: str({ max: 255 }),
  description: str({ max: 5000 }),
};

const SELECT = `SELECT v.*, c.name AS category_name, ${DISPLAY_STATUS_SQL} AS display_status
  FROM vehicles v LEFT JOIN vehicle_categories c ON c.id = v.category_id`;

export async function list(req, res) {
  const { q, category_id, brand, fuel_type, status } = req.query;
  const w = whereBuilder();
  if (q) {
    const t = likeTerm(q);
    w.add('(v.registration LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)', t, t, t);
  }
  if (category_id) w.add('v.category_id = ?', Number(category_id));
  if (brand) w.add('v.brand = ?', String(brand));
  if (fuel_type) w.add('v.fuel_type = ?', String(fuel_type));

  // "status" porte sur le statut affiché (donc "reserved" est filtrable), d'où le HAVING.
  const having = status ? 'HAVING display_status = ?' : '';
  const [rows] = await db.query(
    `${SELECT} ${w.sql} ${having} ORDER BY v.brand, v.model, v.registration`,
    status ? [...w.params, String(status)] : w.params,
  );
  res.json(rows);
}

/** Véhicules réservables sur une période : ni en maintenance/hors service, ni déjà pris. */
export async function available(req, res) {
  const { start_at, end_at } = parseBody(req.query, {
    start_at: datetime({ required: true }),
    end_at: datetime({ required: true }),
  });
  if (end_at <= start_at) throw badRequest('La date de retour doit suivre la date de départ');

  const w = whereBuilder();
  w.add("v.status NOT IN ('maintenance','out_of_service')");
  w.add(VEHICLE_FREE_SQL, end_at, start_at);
  if (req.query.seats) w.add('v.seats >= ?', Number(req.query.seats));
  if (req.query.category_id) w.add('v.category_id = ?', Number(req.query.category_id));

  const [rows] = await db.query(`${SELECT} ${w.sql} ORDER BY v.brand, v.model`, w.params);
  res.json(rows);
}

export async function getOne(req, res) {
  const [[row]] = await db.query(`${SELECT} WHERE v.id = ?`, [req.params.id]);
  if (!row) throw notFound('Véhicule introuvable');
  res.json(row);
}

/** Historique chronologique : réservations (hors demandes en attente) + entretiens. */
export async function history(req, res) {
  const id = Number(req.params.id);
  const [[exists]] = await db.query('SELECT id FROM vehicles WHERE id = ?', [id]);
  if (!exists) throw notFound('Véhicule introuvable');

  const [reservations] = await db.query(
    `SELECT r.id, r.start_at AS at, r.end_at, r.destination, r.status, r.mileage_start, r.mileage_end,
            CONCAT(u.first_name, ' ', u.last_name) AS requester
       FROM reservations r JOIN users u ON u.id = r.user_id
      WHERE r.vehicle_id = ? AND r.status IN ('validated','in_progress','completed')`,
    [id],
  );
  const [maintenance] = await db.query(
    `SELECT id, maintenance_date AS at, type, description, cost, garage, mileage
       FROM vehicle_maintenance WHERE vehicle_id = ?`,
    [id],
  );

  const events = [
    ...reservations.map((r) => ({ kind: 'reservation', ...r })),
    ...maintenance.map((m) => ({ kind: 'maintenance', ...m })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  res.json(events);
}

export async function create(req, res) {
  const id = await insertRow(db, 'vehicles', parseBody(req.body, schema));
  const [[row]] = await db.query(`${SELECT} WHERE v.id = ?`, [id]);
  res.status(201).json(row);
}

export async function update(req, res) {
  const affected = await updateRow(db, 'vehicles', req.params.id, parseBody(req.body, schema, { partial: true }));
  if (!affected) {
    const [[exists]] = await db.query('SELECT id FROM vehicles WHERE id = ?', [req.params.id]);
    if (!exists) throw notFound('Véhicule introuvable');
  }
  const [[row]] = await db.query(`${SELECT} WHERE v.id = ?`, [req.params.id]);
  res.json(row);
}

// Refusé (409) si le véhicule a déjà des réservations : on le met plutôt "hors service" pour garder l'historique.
export async function remove(req, res) {
  const [result] = await db.query('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw notFound('Véhicule introuvable');
  res.status(204).end();
}
