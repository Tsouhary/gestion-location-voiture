import db from '../config/db.js';
import { STAFF } from '../middlewares/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import { parseBody, str, int, bool, datetime, enumOf, nowSql } from '../utils/validate.js';
import { insertRow, updateRow, whereBuilder, withTransaction } from '../utils/sql.js';
import { assertVehicleBookable, assertDriverAvailable } from '../services/reservationRules.js';
import { createContractIfMissing } from '../services/billing.js';

const requestSchema = {
  vehicle_id: int({ min: 1 }),
  driver_requested: bool({ notNull: true }),
  start_at: datetime({ required: true }),
  end_at: datetime({ required: true }),
  destination: str({ required: true, max: 150 }),
  purpose: str({ required: true, max: 255 }),
  passengers: int({ min: 1, max: 100, notNull: true }),
};

const SELECT = `SELECT r.*,
    CONCAT(u.first_name, ' ', u.last_name) AS requester_name, u.email AS requester_email,
    v.registration, v.brand, v.model,
    CONCAT(d.first_name, ' ', d.last_name) AS driver_name,
    inv.id AS invoice_id, inv.status AS invoice_status, ct.id AS contract_id
  FROM reservations r
  JOIN users u ON u.id = r.user_id
  LEFT JOIN vehicles v ON v.id = r.vehicle_id
  LEFT JOIN drivers d ON d.id = r.driver_id
  LEFT JOIN invoices inv ON inv.reservation_id = r.id
  LEFT JOIN contracts ct ON ct.reservation_id = r.id`;

const isStaff = (user) => STAFF.includes(user.role);
const isOwner = (user, r) => r.user_id === user.id;
const isAssignedDriver = (user, r) => user.driver_id != null && r.driver_id === user.driver_id;

/** Charge la réservation ; 404 (et non 403) si l'utilisateur n'a pas le droit de la voir. */
async function load(id, user, conn = db) {
  const [[r]] = await conn.query(`${SELECT} WHERE r.id = ?`, [id]);
  if (!r || !(isStaff(user) || isOwner(user, r) || isAssignedDriver(user, r))) {
    throw notFound('Réservation introuvable');
  }
  return r;
}

function assertPeriod({ start_at, end_at }) {
  if (end_at <= start_at) throw badRequest('La date de retour doit être postérieure à la date de départ');
}

export async function list(req, res) {
  const { status, vehicle_id, from, to } = req.query;
  const w = whereBuilder();
  if (!isStaff(req.user)) {
    // Un conducteur voit aussi les missions qui lui sont attribuées.
    w.add('(r.user_id = ? OR r.driver_id = ?)', req.user.id, req.user.driver_id ?? 0);
  }
  if (status) w.add('r.status = ?', String(status));
  if (vehicle_id) w.add('r.vehicle_id = ?', Number(vehicle_id));
  if (from) w.add('r.end_at >= ?', `${String(from).slice(0, 10)} 00:00:00`);
  if (to) w.add('r.start_at <= ?', `${String(to).slice(0, 10)} 23:59:59`);

  const [rows] = await db.query(`${SELECT} ${w.sql} ORDER BY r.start_at DESC`, w.params);
  res.json(rows);
}

export async function getOne(req, res) {
  res.json(await load(req.params.id, req.user));
}

export async function create(req, res) {
  const data = parseBody(req.body, requestSchema);
  assertPeriod(data);
  if (data.start_at < nowSql()) throw badRequest('La date de départ ne peut pas être dans le passé');
  data.passengers ??= 1;

  if (data.vehicle_id) await assertVehicleBookable(db, data.vehicle_id, data);

  const id = await insertRow(db, 'reservations', { ...data, user_id: req.user.id });
  res.status(201).json(await load(id, req.user));
}

/** Modification d'une demande encore en attente (par son auteur ou le personnel). */
export async function update(req, res) {
  const current = await load(req.params.id, req.user);
  if (!isStaff(req.user) && !isOwner(req.user, current)) throw forbidden();
  if (current.status !== 'pending') throw conflict('Seule une demande en attente peut être modifiée');

  const changes = parseBody(req.body, requestSchema, { partial: true });
  const merged = { ...current, ...changes };
  assertPeriod(merged);
  if (merged.start_at < nowSql()) throw badRequest('La date de départ ne peut pas être dans le passé');
  if (merged.vehicle_id) await assertVehicleBookable(db, merged.vehicle_id, merged, current.id);

  await updateRow(db, 'reservations', current.id, changes);
  res.json(await load(current.id, req.user));
}

/** Validation : affecte véhicule (et conducteur) après re-vérification des disponibilités, sous verrou. */
export async function validate(req, res) {
  const { vehicle_id, driver_id } = parseBody(req.body, { vehicle_id: int({ min: 1 }), driver_id: int({ min: 1 }) });

  await withTransaction(db, async (conn) => {
    const [[r]] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!r) throw notFound('Réservation introuvable');
    if (r.status !== 'pending') throw conflict('Seule une demande en attente peut être validée');

    const vId = vehicle_id ?? r.vehicle_id;
    const dId = driver_id ?? r.driver_id;
    if (!vId) throw badRequest('Affectez un véhicule avant de valider');
    if (r.driver_requested && !dId) throw badRequest("Un conducteur a été demandé : affectez-en un avant de valider");

    // Verrous dans un ordre fixe (véhicule puis conducteur) : deux validations concurrentes
    // sur la même ressource sont sérialisées, la seconde voit alors le chevauchement.
    await conn.query('SELECT id FROM vehicles WHERE id = ? FOR UPDATE', [vId]);
    if (dId) await conn.query('SELECT id FROM drivers WHERE id = ? FOR UPDATE', [dId]);

    await assertVehicleBookable(conn, vId, r, r.id);
    if (dId) await assertDriverAvailable(conn, dId, r, r.id);

    await conn.query(
      `UPDATE reservations SET status = 'validated', vehicle_id = ?, driver_id = ?, decided_by = ?, rejection_reason = NULL
        WHERE id = ?`,
      [vId, dId ?? null, req.user.id, r.id],
    );
    // Le contrat de mise à disposition est généré dès la validation.
    await createContractIfMissing(conn, r.id, req.user.id);
  });
  res.json(await load(req.params.id, req.user));
}

export async function reject(req, res) {
  const { reason } = parseBody(req.body, { reason: str({ required: true, max: 255 }) });
  const [result] = await db.query(
    `UPDATE reservations SET status = 'rejected', rejection_reason = ?, decided_by = ?
      WHERE id = ? AND status = 'pending'`,
    [reason, req.user.id, req.params.id],
  );
  if (!result.affectedRows) {
    await load(req.params.id, req.user);
    throw conflict('Seule une demande en attente peut être refusée');
  }
  res.json(await load(req.params.id, req.user));
}

export async function cancel(req, res) {
  const r = await load(req.params.id, req.user);
  if (!isStaff(req.user) && !isOwner(req.user, r)) throw forbidden();
  if (!['pending', 'validated'].includes(r.status)) throw conflict("Cette réservation ne peut plus être annulée");

  await db.query("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [r.id]);
  // Une facture sans aucun paiement est annulée avec la réservation ; s'il y a eu des paiements, le personnel décide.
  await db.query(
    "UPDATE invoices SET status = 'cancelled' WHERE reservation_id = ? AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id)",
    [r.id],
  );
  res.json(await load(r.id, req.user));
}

/** Départ du véhicule : relève le kilométrage et passe véhicule/conducteur en mission. */
export async function start(req, res) {
  await withTransaction(db, async (conn) => {
    const [[r]] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!r) throw notFound('Réservation introuvable');
    if (r.status !== 'validated') throw conflict('Seule une réservation validée peut démarrer');

    const [[vehicle]] = await conn.query('SELECT id, status, mileage FROM vehicles WHERE id = ? FOR UPDATE', [r.vehicle_id]);
    if (vehicle.status !== 'available') throw conflict('Le véhicule n\'est pas disponible (déjà en mission, en maintenance ou hors service)');

    await conn.query("UPDATE reservations SET status = 'in_progress', mileage_start = ? WHERE id = ?", [vehicle.mileage, r.id]);
    await conn.query("UPDATE vehicles SET status = 'in_mission' WHERE id = ?", [vehicle.id]);
    if (r.driver_id) await conn.query("UPDATE drivers SET status = 'on_mission' WHERE id = ? AND status = 'available'", [r.driver_id]);
    await conn.query(
      "INSERT INTO vehicle_mileage (vehicle_id, reservation_id, mileage, context) VALUES (?, ?, ?, 'reservation_start')",
      [vehicle.id, r.id, vehicle.mileage],
    );
  });
  res.json(await load(req.params.id, req.user));
}

/** Retour du véhicule : enregistre le kilométrage final et libère véhicule/conducteur. */
export async function complete(req, res) {
  const { mileage_end } = parseBody(req.body, { mileage_end: int({ required: true, min: 0 }) });

  await withTransaction(db, async (conn) => {
    const [[r]] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!r) throw notFound('Réservation introuvable');
    if (r.status !== 'in_progress') throw conflict('Seule une mission en cours peut être terminée');
    if (mileage_end < (r.mileage_start ?? 0)) {
      throw badRequest(`Le kilométrage de retour ne peut pas être inférieur au départ (${r.mileage_start} km)`);
    }

    await conn.query("UPDATE reservations SET status = 'completed', mileage_end = ? WHERE id = ?", [mileage_end, r.id]);
    await conn.query(
      "UPDATE vehicles SET mileage = GREATEST(mileage, ?), status = IF(status = 'in_mission', 'available', status) WHERE id = ?",
      [mileage_end, r.vehicle_id],
    );
    if (r.driver_id) {
      await conn.query("UPDATE drivers SET status = IF(status = 'on_mission', 'available', status) WHERE id = ?", [r.driver_id]);
    }
    await conn.query(
      "INSERT INTO vehicle_mileage (vehicle_id, reservation_id, mileage, context) VALUES (?, ?, ?, 'reservation_end')",
      [r.vehicle_id, r.id, mileage_end],
    );
  });
  res.json(await load(req.params.id, req.user));
}

export async function remove(req, res) {
  const r = await load(req.params.id, req.user);
  if (r.status === 'in_progress') throw conflict('Une mission en cours ne peut pas être supprimée');
  if (!isStaff(req.user)) {
    if (!isOwner(req.user, r)) throw forbidden();
    if (r.status !== 'pending') throw conflict("Seule une demande en attente peut être supprimée (sinon, annulez-la)");
  }
  await db.query('DELETE FROM reservations WHERE id = ?', [r.id]);
  res.status(204).end();
}
