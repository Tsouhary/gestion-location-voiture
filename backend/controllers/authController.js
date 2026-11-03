import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { signToken } from '../middlewares/auth.js';
import { HttpError, badRequest } from '../utils/httpError.js';
import { parseBody, str, email } from '../utils/validate.js';
import { updateRow } from '../utils/sql.js';

// Hash factice : on compare toujours un mot de passe pour ne pas révéler si l'email existe (temps de réponse).
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

const publicUser = (u) => ({
  id: u.id,
  first_name: u.first_name,
  last_name: u.last_name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  driver_id: u.driver_id ?? null,
});

export async function login(req, res) {
  const { email: mail, password } = parseBody(req.body, {
    email: email({ required: true }),
    password: str({ required: true, max: 200 }),
  });

  const [rows] = await db.query(
    `SELECT u.*, r.name AS role, d.id AS driver_id
       FROM users u JOIN roles r ON r.id = u.role_id
       LEFT JOIN drivers d ON d.user_id = u.id
      WHERE u.email = ?`,
    [mail],
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) throw new HttpError(401, 'Email ou mot de passe incorrect');

  res.json({ token: signToken(user.id), user: publicUser(user) });
}

export function me(req, res) {
  res.json(publicUser(req.user));
}

export async function updateProfile(req, res) {
  const data = parseBody(
    req.body,
    { first_name: str({ max: 80, required: true }), last_name: str({ max: 80, required: true }), phone: str({ max: 30 }) },
    { partial: true },
  );
  await updateRow(db, 'users', req.user.id, data);
  res.json(publicUser({ ...req.user, ...data }));
}

export async function changePassword(req, res) {
  const { current_password, new_password } = parseBody(req.body, {
    current_password: str({ required: true, max: 200 }),
    new_password: str({ required: true, min: 8, max: 72 }), // bcrypt ignore au-delà de 72 octets
  });

  const [[row]] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(current_password, row.password_hash))) {
    throw badRequest('Mot de passe actuel incorrect');
  }
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(new_password, 10), req.user.id]);
  res.json({ message: 'Mot de passe modifié' });
}

// JWT sans état : la déconnexion consiste à supprimer le jeton côté client.
export function logout(_req, res) {
  res.status(204).end();
}
