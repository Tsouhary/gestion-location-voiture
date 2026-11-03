import db from '../config/db.js';
import { STAFF } from '../middlewares/auth.js';
import { badRequest, conflict, notFound } from '../utils/httpError.js';
import { parseBody, str, int, num, datetime, enumOf, nowSql } from '../utils/validate.js';
import { whereBuilder, withTransaction } from '../utils/sql.js';
import { getOrg } from '../services/settings.js';
import { nextNumber } from '../services/documentNumbers.js';
import {
  createContractIfMissing, createInvoice, invoiceTotal, recalcInvoice, round2,
} from '../services/billing.js';

const isStaff = (user) => STAFF.includes(user.role);
export const PAYMENT_METHODS = ['especes', 'mobile_money', 'virement', 'cheque', 'carte'];

// ------------------------------------------------------------------ factures

const INVOICE_SELECT = `SELECT i.*, r.user_id, r.destination, r.purpose, r.passengers, r.start_at, r.end_at, r.status AS reservation_status,
    u.first_name, u.last_name, u.email, u.phone,
    v.registration, v.brand, v.model,
    (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = i.id) AS paid
  FROM invoices i
  JOIN reservations r ON r.id = i.reservation_id
  JOIN users u ON u.id = r.user_id
  LEFT JOIN vehicles v ON v.id = r.vehicle_id`;

/** Charge une facture ; 404 (et non 403) si l'utilisateur n'est ni le personnel ni le demandeur. */
async function loadInvoice(id, user, conn = db) {
  const [[inv]] = await conn.query(`${INVOICE_SELECT} WHERE i.id = ?`, [id]);
  if (!inv || !(isStaff(user) || inv.user_id === user.id)) throw notFound('Facture introuvable');
  return inv;
}

export async function listInvoices(req, res) {
  const w = whereBuilder();
  if (!isStaff(req.user)) w.add('r.user_id = ?', req.user.id);
  if (req.query.status) w.add('i.status = ?', String(req.query.status));
  const [rows] = await db.query(`${INVOICE_SELECT} ${w.sql} ORDER BY i.id DESC`, w.params);
  res.json(rows.map((i) => ({ ...i, balance: i.status === 'cancelled' ? 0 : round2(i.total - i.paid) })));
}

/** Document complet d'une facture : en-tête, client, prestation, paiements et solde. */
export async function getInvoice(req, res) {
  const inv = await loadInvoice(req.params.id, req.user);
  const [payments] = await db.query(
    `SELECT p.id, p.receipt_number, p.amount, p.method, p.reference, p.paid_at,
            CONCAT(u.first_name, ' ', u.last_name) AS recorded_by_name
       FROM payments p LEFT JOIN users u ON u.id = p.recorded_by
      WHERE p.invoice_id = ? ORDER BY p.id`,
    [inv.id],
  );
  res.json({
    org: await getOrg(db),
    invoice: {
      id: inv.id, number: inv.number, issue_date: inv.issue_date, status: inv.status, notes: inv.notes,
      days: inv.days, unit_price: inv.unit_price, discount: inv.discount,
      subtotal: round2(inv.days * inv.unit_price), total: inv.total,
      paid: round2(inv.paid), balance: inv.status === 'cancelled' ? 0 : round2(inv.total - inv.paid),
    },
    client: { name: `${inv.first_name} ${inv.last_name}`, email: inv.email, phone: inv.phone },
    reservation: {
      id: inv.reservation_id, status: inv.reservation_status, destination: inv.destination, purpose: inv.purpose,
      passengers: inv.passengers, start_at: inv.start_at, end_at: inv.end_at,
    },
    vehicle: inv.registration ? { registration: inv.registration, brand: inv.brand, model: inv.model } : null,
    payments,
  });
}

export async function createInvoiceForReservation(req, res) {
  const overrides = parseBody(req.body, {
    days: int({ min: 1, max: 3650 }),
    unit_price: num({ min: 0 }),
    discount: num({ min: 0 }),
    notes: str({ max: 255 }),
  });
  const id = await withTransaction(db, (conn) => createInvoice(conn, Number(req.params.id), req.user.id, overrides));
  res.status(201).json({ id });
}

/** Ajuste jours / prix / remise / note. Le nouveau total ne peut pas descendre sous ce qui a déjà été payé. */
export async function updateInvoice(req, res) {
  const changes = parseBody(req.body, {
    days: int({ min: 1, max: 3650, notNull: true }),
    unit_price: num({ min: 0, notNull: true }),
    discount: num({ min: 0, notNull: true }),
    notes: str({ max: 255 }),
  }, { partial: true });

  await withTransaction(db, async (conn) => {
    const [[inv]] = await conn.query('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!inv) throw notFound('Facture introuvable');
    if (inv.status === 'cancelled') throw conflict('Une facture annulée ne peut pas être modifiée');

    const next = { ...inv, ...changes };
    if (next.discount > next.days * next.unit_price) throw badRequest('La remise ne peut pas dépasser le montant de la location');
    const total = invoiceTotal(next);

    const [[{ paid }]] = await conn.query('SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = ?', [inv.id]);
    if (total < paid - 0.005) throw conflict(`Le total (${total}) ne peut pas être inférieur aux paiements déjà reçus (${paid})`);

    await conn.query(
      'UPDATE invoices SET days = ?, unit_price = ?, discount = ?, notes = ?, total = ? WHERE id = ?',
      [next.days, next.unit_price, next.discount, next.notes, total, inv.id],
    );
    await recalcInvoice(conn, inv.id);
  });
  await getInvoice(req, res);
}

// ------------------------------------------------------------------ paiements & reçus

export async function addPayment(req, res) {
  const data = parseBody(req.body, {
    amount: num({ required: true, min: 0.01 }),
    method: enumOf(PAYMENT_METHODS, { required: true }),
    reference: str({ max: 80 }),
    paid_at: datetime(),
  });
  const paidAt = data.paid_at ?? nowSql();
  if (paidAt > nowSql()) throw badRequest('La date du paiement ne peut pas être dans le futur');

  const paymentId = await withTransaction(db, async (conn) => {
    const [[inv]] = await conn.query('SELECT id, total, status FROM invoices WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!inv) throw notFound('Facture introuvable');
    if (inv.status === 'cancelled') throw conflict('Cette facture est annulée');

    const [[{ paid }]] = await conn.query('SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = ?', [inv.id]);
    const remaining = round2(inv.total - paid);
    if (remaining <= 0) throw conflict('Cette facture est déjà entièrement payée');
    if (data.amount > remaining + 0.005) throw conflict(`Le montant dépasse le solde restant (${remaining})`);

    const receipt = await nextNumber(conn, 'receipt');
    const [ins] = await conn.query(
      'INSERT INTO payments (receipt_number, invoice_id, amount, method, reference, paid_at, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [receipt, inv.id, data.amount, data.method, data.reference ?? null, paidAt, req.user.id],
    );
    await recalcInvoice(conn, inv.id);
    return ins.insertId;
  });
  res.status(201).json({ id: paymentId });
}

/** Correction d'une saisie erronée (administrateur). Le numéro de reçu supprimé n'est pas réutilisé. */
export async function deletePayment(req, res) {
  await withTransaction(db, async (conn) => {
    const [[p]] = await conn.query('SELECT id, invoice_id FROM payments WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!p) throw notFound('Paiement introuvable');
    await conn.query('DELETE FROM payments WHERE id = ?', [p.id]);
    await recalcInvoice(conn, p.invoice_id);
  });
  res.status(204).end();
}

/** Reçu de paiement : la pièce justificative remise au client. */
export async function getReceipt(req, res) {
  const [[p]] = await db.query('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  if (!p) throw notFound('Reçu introuvable');
  const inv = await loadInvoice(p.invoice_id, req.user);

  const [[{ paid_until }]] = await db.query(
    'SELECT COALESCE(SUM(amount), 0) AS paid_until FROM payments WHERE invoice_id = ? AND id <= ?',
    [p.invoice_id, p.id],
  );
  const [[cashier]] = await db.query("SELECT CONCAT(first_name, ' ', last_name) AS name FROM users WHERE id = ?", [p.recorded_by ?? 0]);

  res.json({
    org: await getOrg(db),
    receipt: {
      id: p.id, number: p.receipt_number, amount: p.amount, method: p.method, reference: p.reference, paid_at: p.paid_at,
      balance_after: round2(inv.total - paid_until), recorded_by: cashier?.name ?? null,
    },
    invoice: { id: inv.id, number: inv.number, total: inv.total },
    client: { name: `${inv.first_name} ${inv.last_name}`, email: inv.email, phone: inv.phone },
    reservation: { id: inv.reservation_id, destination: inv.destination, start_at: inv.start_at, end_at: inv.end_at },
    vehicle: inv.registration ? { registration: inv.registration, brand: inv.brand, model: inv.model } : null,
  });
}

// ------------------------------------------------------------------ contrats

/** Génère (ou retrouve) le contrat d'une réservation validée. */
export async function createContract(req, res) {
  const { id, created } = await withTransaction(db, (conn) => createContractIfMissing(conn, Number(req.params.id), req.user.id));
  res.status(created ? 201 : 200).json({ id, created });
}

export async function getContract(req, res) {
  const [[c]] = await db.query(
    `SELECT c.id AS contract_id, c.number, c.issued_at, c.signed_at,
            r.id AS reservation_id, r.user_id, r.driver_id, r.start_at, r.end_at, r.destination, r.purpose, r.passengers,
            r.status AS reservation_status, r.mileage_start, r.mileage_end, r.driver_requested,
            u.first_name, u.last_name, u.email, u.phone,
            v.registration, v.brand, v.model, v.year, v.color, v.fuel_type, v.transmission, v.seats, v.mileage AS current_mileage,
            v.insurance_company, v.insurance_expiry,
            d.first_name AS d_first, d.last_name AS d_last, d.phone AS d_phone, d.license_number, d.license_category,
            i.number AS invoice_number, i.total AS invoice_total
       FROM reservations r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN contracts c ON c.reservation_id = r.id
       LEFT JOIN vehicles v ON v.id = r.vehicle_id
       LEFT JOIN drivers d ON d.id = r.driver_id
       LEFT JOIN invoices i ON i.reservation_id = r.id AND i.status <> 'cancelled'
      WHERE r.id = ?`,
    [req.params.id],
  );

  const assignedDriver = req.user.driver_id != null && c?.driver_id === req.user.driver_id;
  if (!c || !(isStaff(req.user) || c.user_id === req.user.id || assignedDriver)) throw notFound('Réservation introuvable');
  if (!c.contract_id) throw notFound('Aucun contrat n\'a encore été généré pour cette réservation');

  res.json({
    org: await getOrg(db),
    contract: { id: c.contract_id, number: c.number, issued_at: c.issued_at, signed_at: c.signed_at },
    client: { name: `${c.first_name} ${c.last_name}`, email: c.email, phone: c.phone },
    reservation: {
      id: c.reservation_id, status: c.reservation_status, start_at: c.start_at, end_at: c.end_at, destination: c.destination,
      purpose: c.purpose, passengers: c.passengers, mileage_start: c.mileage_start, mileage_end: c.mileage_end,
    },
    vehicle: c.registration
      ? {
          registration: c.registration, brand: c.brand, model: c.model, year: c.year, color: c.color, fuel_type: c.fuel_type,
          transmission: c.transmission, seats: c.seats, mileage: c.mileage_start ?? c.current_mileage,
          insurance_company: c.insurance_company, insurance_expiry: c.insurance_expiry,
        }
      : null,
    driver: c.d_first
      ? { name: `${c.d_first} ${c.d_last}`, phone: c.d_phone, license_number: c.license_number, license_category: c.license_category }
      : null,
    invoice: c.invoice_number ? { number: c.invoice_number, total: c.invoice_total } : null,
  });
}

export async function signContract(req, res) {
  const [result] = await db.query('UPDATE contracts SET signed_at = ? WHERE id = ? AND signed_at IS NULL', [nowSql(), req.params.id]);
  if (!result.affectedRows) {
    const [[exists]] = await db.query('SELECT id FROM contracts WHERE id = ?', [req.params.id]);
    if (!exists) throw notFound('Contrat introuvable');
    throw conflict('Ce contrat est déjà signé');
  }
  res.json({ signed: true });
}
