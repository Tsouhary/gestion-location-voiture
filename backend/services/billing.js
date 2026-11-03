import { badRequest, conflict, notFound } from '../utils/httpError.js';
import { nextNumber } from './documentNumbers.js';

// Une réservation ne se facture / ne se contractualise qu'une fois validée.
export const DOCUMENT_STATUSES = ['validated', 'in_progress', 'completed'];

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Jours facturables : durée arrondie au jour supérieur, 1 jour minimum. */
export function billableDays(startAt, endAt) {
  const ms = new Date(endAt.replace(' ', 'T')) - new Date(startAt.replace(' ', 'T'));
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

export const invoiceTotal = ({ days, unit_price, discount }) => Math.max(0, round2(days * unit_price - discount));

/** Recalcule le statut d'une facture d'après ses paiements. Une facture annulée reste annulée. */
export async function recalcInvoice(conn, invoiceId) {
  const [[inv]] = await conn.query('SELECT id, total, status FROM invoices WHERE id = ? FOR UPDATE', [invoiceId]);
  const [[{ paid }]] = await conn.query('SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = ?', [invoiceId]);

  let status = inv.status;
  if (status !== 'cancelled') {
    if (paid >= inv.total - 0.005) status = 'paid';
    else if (paid > 0) status = 'partial';
    else status = 'unpaid';
    await conn.query('UPDATE invoices SET status = ? WHERE id = ?', [status, invoiceId]);
  }
  return { paid: round2(paid), total: inv.total, status };
}

/** Crée la facture d'une réservation (une seule par réservation). Le tarif par défaut est celui du véhicule. */
export async function createInvoice(conn, reservationId, userId, overrides = {}) {
  const [[r]] = await conn.query('SELECT id, status, vehicle_id, start_at, end_at FROM reservations WHERE id = ? FOR UPDATE', [reservationId]);
  if (!r) throw notFound('Réservation introuvable');
  if (!DOCUMENT_STATUSES.includes(r.status)) throw conflict('Seule une réservation validée peut être facturée');

  const [[existing]] = await conn.query('SELECT number FROM invoices WHERE reservation_id = ?', [reservationId]);
  if (existing) throw conflict(`Une facture existe déjà pour cette réservation (${existing.number})`);

  const [[vehicle]] = await conn.query('SELECT daily_rate FROM vehicles WHERE id = ?', [r.vehicle_id]);
  const days = overrides.days ?? billableDays(r.start_at, r.end_at);
  const unit_price = overrides.unit_price ?? vehicle?.daily_rate ?? 0;
  const discount = overrides.discount ?? 0;
  const total = invoiceTotal({ days, unit_price, discount });
  if (discount > days * unit_price) throw badRequest('La remise ne peut pas dépasser le montant de la location');

  const number = await nextNumber(conn, 'invoice');
  const [res] = await conn.query(
    `INSERT INTO invoices (number, reservation_id, issue_date, days, unit_price, discount, total, status, notes, created_by)
     VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?)`,
    [number, reservationId, days, unit_price, discount, total, total === 0 ? 'paid' : 'unpaid', overrides.notes ?? null, userId],
  );
  return res.insertId;
}

/** Crée le contrat d'une réservation validée s'il n'existe pas encore ; renvoie son identifiant. */
export async function createContractIfMissing(conn, reservationId, userId) {
  const [[r]] = await conn.query('SELECT id, status FROM reservations WHERE id = ? FOR UPDATE', [reservationId]);
  if (!r) throw notFound('Réservation introuvable');
  if (!DOCUMENT_STATUSES.includes(r.status)) throw conflict('Le contrat n\'est disponible que pour une réservation validée');

  const [[existing]] = await conn.query('SELECT id FROM contracts WHERE reservation_id = ?', [reservationId]);
  if (existing) return { id: existing.id, created: false };

  const number = await nextNumber(conn, 'contract');
  const [res] = await conn.query('INSERT INTO contracts (number, reservation_id, created_by) VALUES (?, ?, ?)', [number, reservationId, userId]);
  return { id: res.insertId, created: true };
}
