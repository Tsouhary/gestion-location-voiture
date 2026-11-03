import db from '../config/db.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { parseBody, str, int, date, datetime, email, enumOf } from '../utils/validate.js';
import { insertRow, updateRow, whereBuilder, likeTerm } from '../utils/sql.js';
import { DRIVER_FREE_SQL } from '../services/availability.js';

const schema = {
  user_id: int({ min: 1 }),
  first_name: str({ required: true, max: 80 }),
  last_name: str({ required: true, max: 80 }),
  phone: str({ max: 30 }),
  email: email(),
  address: str({ max: 255 }),
  license_number: str({ required: true, max: 40 }),
  license_category: str({ max: 10 }),
  license_expiry: date({ required: true }),
  status: enumOf(['available', 'on_mission', 'unavailable'], { notNull: true }),
  hire_date: date(),
};

export async function list(req, res) {
  const w = whereBuilder();
  if (req.query.q) {
    const t = likeTerm(req.query.q);
    w.add('(first_name LIKE ? OR last_name LIKE ? OR license_number LIKE ? OR phone LIKE ?)', t, t, t, t);
  }
  if (req.query.status) w.add('status = ?', String(req.query.status));
  const [rows] = await db.query(`SELECT * FROM drivers ${w.sql} ORDER BY last_name, first_name`, w.params);
  res.json(rows);
}

/** Conducteurs libres sur la période, non indisponibles et dont le permis couvre la fin de mission. */
export async function available(req, res) {
  const { start_at, end_at } = parseBody(req.query, {
    start_at: datetime({ required: true }),
    end_at: datetime({ required: true }),
  });
  if (end_at <= start_at) throw badRequest('La date de retour doit suivre la date de départ');

  const [rows] = await db.query(
    `SELECT d.* FROM drivers d
      WHERE d.status <> 'unavailable' AND d.license_expiry >= DATE(?) AND ${DRIVER_FREE_SQL}
      ORDER BY d.last_name, d.first_name`,
    [end_at, end_at, start_at],
  );
  res.json(rows);
}

export async function getOne(req, res) {
  const [[driver]] = await db.query('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
  if (!driver) throw notFound('Conducteur introuvable');
  res.json(driver);
}

/** Historique des missions d'un conducteur. */
export async function missions(req, res) {
  const [rows] = await db.query(
    `SELECT r.id, r.start_at, r.end_at, r.destination, r.purpose, r.status, r.mileage_start, r.mileage_end,
            v.registration, v.brand, v.model
       FROM reservations r LEFT JOIN vehicles v ON v.id = r.vehicle_id
      WHERE r.driver_id = ? AND r.status IN ('validated','in_progress','completed')
      ORDER BY r.start_at DESC`,
    [req.params.id],
  );
  res.json(rows);
}

export async function create(req, res) {
  const id = await insertRow(db, 'drivers', parseBody(req.body, schema));
  const [[row]] = await db.query('SELECT * FROM drivers WHERE id = ?', [id]);
  res.status(201).json(row);
}

export async function update(req, res) {
  const [[exists]] = await db.query('SELECT id FROM drivers WHERE id = ?', [req.params.id]);
  if (!exists) throw notFound('Conducteur introuvable');
  await updateRow(db, 'drivers', req.params.id, parseBody(req.body, schema, { partial: true }));
  const [[row]] = await db.query('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
  res.json(row);
}

export async function remove(req, res) {
  const [result] = await db.query('DELETE FROM drivers WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw notFound('Conducteur introuvable');
  res.status(204).end();
}
