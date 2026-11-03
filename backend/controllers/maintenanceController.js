import db from '../config/db.js';
import { conflict, notFound } from '../utils/httpError.js';
import { parseBody, str, int, num, date, bool, enumOf } from '../utils/validate.js';
import { insertRow, updateRow, whereBuilder, withTransaction } from '../utils/sql.js';

export const MAINTENANCE_TYPES = ['vidange', 'pneus', 'freinage', 'batterie', 'revision', 'reparation', 'controle_technique'];

const schema = {
  vehicle_id: int({ required: true, min: 1 }),
  type: enumOf(MAINTENANCE_TYPES, { required: true }),
  maintenance_date: date({ required: true }),
  mileage: int({ min: 0 }),
  description: str({ max: 5000 }),
  cost: num({ min: 0, notNull: true }),
  garage: str({ max: 120 }),
  next_date: date(),
  next_mileage: int({ min: 0 }),
};

const SELECT = `SELECT m.*, v.registration, v.brand, v.model
                  FROM vehicle_maintenance m JOIN vehicles v ON v.id = m.vehicle_id`;

export async function list(req, res) {
  const w = whereBuilder();
  if (req.query.vehicle_id) w.add('m.vehicle_id = ?', Number(req.query.vehicle_id));
  if (req.query.type) w.add('m.type = ?', String(req.query.type));
  const [rows] = await db.query(`${SELECT} ${w.sql} ORDER BY m.maintenance_date DESC, m.id DESC`, w.params);
  res.json(rows);
}

export async function getOne(req, res) {
  const [[row]] = await db.query(`${SELECT} WHERE m.id = ?`, [req.params.id]);
  if (!row) throw notFound('Entretien introuvable');
  res.json(row);
}

/**
 * Enregistre un entretien. Effets de bord voulus (spec §15, §18) :
 *  - le kilométrage relevé met à jour celui du véhicule s'il est supérieur ;
 *  - `put_in_maintenance: true` place le véhicule en maintenance (donc non réservable).
 */
export async function create(req, res) {
  const { put_in_maintenance, ...data } = parseBody(req.body, { ...schema, put_in_maintenance: bool() });

  const id = await withTransaction(db, async (conn) => {
    const [[vehicle]] = await conn.query('SELECT id, status FROM vehicles WHERE id = ? FOR UPDATE', [data.vehicle_id]);
    if (!vehicle) throw notFound('Véhicule introuvable');
    if (put_in_maintenance && vehicle.status === 'in_mission') {
      throw conflict('Ce véhicule est en mission : terminez la mission avant de le mettre en maintenance');
    }

    const newId = await insertRow(conn, 'vehicle_maintenance', { ...data, created_by: req.user.id });
    if (data.mileage != null) {
      await conn.query('UPDATE vehicles SET mileage = GREATEST(mileage, ?) WHERE id = ?', [data.mileage, data.vehicle_id]);
    }
    if (put_in_maintenance) {
      await conn.query("UPDATE vehicles SET status = 'maintenance' WHERE id = ?", [data.vehicle_id]);
    }
    return newId;
  });

  const [[row]] = await db.query(`${SELECT} WHERE m.id = ?`, [id]);
  res.status(201).json(row);
}

export async function update(req, res) {
  const [[exists]] = await db.query('SELECT id FROM vehicle_maintenance WHERE id = ?', [req.params.id]);
  if (!exists) throw notFound('Entretien introuvable');
  await updateRow(db, 'vehicle_maintenance', req.params.id, parseBody(req.body, schema, { partial: true }));
  const [[row]] = await db.query(`${SELECT} WHERE m.id = ?`, [req.params.id]);
  res.json(row);
}

export async function remove(req, res) {
  const [result] = await db.query('DELETE FROM vehicle_maintenance WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw notFound('Entretien introuvable');
  res.status(204).end();
}
