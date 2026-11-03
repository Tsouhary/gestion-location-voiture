import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { parseBody, str, email, bool, enumOf } from '../utils/validate.js';
import { insertRow, updateRow } from '../utils/sql.js';

const schema = {
  first_name: str({ required: true, max: 80 }),
  last_name: str({ required: true, max: 80 }),
  email: email({ required: true }),
  phone: str({ max: 30 }),
  role: enumOf(['admin', 'manager', 'user', 'driver'], { required: true }),
  active: bool({ notNull: true }),
};
const passwordRule = { password: str({ min: 8, max: 72 }) };

const SELECT = `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.active, u.created_at, r.name AS role
                  FROM users u JOIN roles r ON r.id = u.role_id`;

async function roleId(name) {
  const [[r]] = await db.query('SELECT id FROM roles WHERE name = ?', [name]);
  return r.id;
}

export async function list(_req, res) {
  const [rows] = await db.query(`${SELECT} ORDER BY u.last_name, u.first_name`);
  res.json(rows);
}

export async function getOne(req, res) {
  const [[row]] = await db.query(`${SELECT} WHERE u.id = ?`, [req.params.id]);
  if (!row) throw notFound('Utilisateur introuvable');
  res.json(row);
}

export async function create(req, res) {
  const data = parseBody(req.body, { ...schema, ...passwordRule });
  if (!data.password) throw badRequest('password est obligatoire');

  const { role, password, ...fields } = data;
  const id = await insertRow(db, 'users', {
    ...fields,
    role_id: await roleId(role),
    password_hash: await bcrypt.hash(password, 10),
  });
  const [[row]] = await db.query(`${SELECT} WHERE u.id = ?`, [id]);
  res.status(201).json(row);
}

export async function update(req, res) {
  const id = Number(req.params.id);
  const data = parseBody(req.body, { ...schema, ...passwordRule }, { partial: true });
  const { role, password, ...fields } = data;

  if (id === req.user.id && (role && role !== 'admin' || fields.active === 0)) {
    throw badRequest('Vous ne pouvez pas retirer vos propres droits ni désactiver votre compte');
  }
  if (role) fields.role_id = await roleId(role);
  if (password) fields.password_hash = await bcrypt.hash(password, 10);

  const affected = await updateRow(db, 'users', id, fields);
  if (!affected) throw notFound('Utilisateur introuvable');
  const [[row]] = await db.query(`${SELECT} WHERE u.id = ?`, [id]);
  res.json(row);
}

export async function remove(req, res) {
  const id = Number(req.params.id);
  if (id === req.user.id) throw badRequest('Vous ne pouvez pas supprimer votre propre compte');
  const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
  if (!result.affectedRows) throw notFound('Utilisateur introuvable');
  res.status(204).end();
}
