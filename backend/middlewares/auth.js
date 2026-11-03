import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { HttpError, forbidden } from '../utils/httpError.js';

export const ROLES = { ADMIN: 'admin', MANAGER: 'manager', USER: 'user', DRIVER: 'driver' };
export const STAFF = [ROLES.ADMIN, ROLES.MANAGER];

export function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

/** Vérifie le JWT puis recharge l'utilisateur : un compte désactivé ou un rôle modifié prend effet immédiatement. */
export async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Authentification requise');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Session invalide ou expirée');
  }

  const [rows] = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.active, r.name AS role,
            d.id AS driver_id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN drivers d ON d.user_id = u.id
      WHERE u.id = ?`,
    [payload.sub],
  );
  const user = rows[0];
  if (!user || !user.active) throw new HttpError(401, 'Compte introuvable ou désactivé');

  req.user = user;
  next();
}

export const authorize = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw forbidden();
  next();
};
