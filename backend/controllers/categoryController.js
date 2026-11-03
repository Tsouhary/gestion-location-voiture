import db from '../config/db.js';
import { notFound } from '../utils/httpError.js';
import { parseBody, str } from '../utils/validate.js';
import { insertRow, updateRow } from '../utils/sql.js';

const schema = { name: str({ required: true, max: 80 }), description: str({ max: 255 }) };

const SELECT = `SELECT c.*, (SELECT COUNT(*) FROM vehicles v WHERE v.category_id = c.id) AS vehicle_count
                  FROM vehicle_categories c`;

export async function list(_req, res) {
  const [rows] = await db.query(`${SELECT} ORDER BY c.name`);
  res.json(rows);
}

export async function create(req, res) {
  const id = await insertRow(db, 'vehicle_categories', parseBody(req.body, schema));
  const [[row]] = await db.query(`${SELECT} WHERE c.id = ?`, [id]);
  res.status(201).json(row);
}

export async function update(req, res) {
  const affected = await updateRow(db, 'vehicle_categories', req.params.id, parseBody(req.body, schema, { partial: true }));
  if (!affected) throw notFound('Catégorie introuvable');
  const [[row]] = await db.query(`${SELECT} WHERE c.id = ?`, [req.params.id]);
  res.json(row);
}

// Les véhicules de la catégorie supprimée passent à "sans catégorie" (ON DELETE SET NULL).
export async function remove(req, res) {
  const [result] = await db.query('DELETE FROM vehicle_categories WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw notFound('Catégorie introuvable');
  res.status(204).end();
}
