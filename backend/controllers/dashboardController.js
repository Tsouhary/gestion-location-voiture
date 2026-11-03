import db from '../config/db.js';
import { STAFF } from '../middlewares/auth.js';
import { DISPLAY_STATUS_SQL } from '../services/vehicleStatus.js';

const ALERT_DAYS = 30;

const RESERVATION_STATUSES = ['pending', 'validated', 'rejected', 'cancelled', 'in_progress', 'completed'];
const VEHICLE_STATUSES = ['available', 'reserved', 'in_mission', 'maintenance', 'out_of_service'];

const countBy = (rows, keys) => {
  const out = Object.fromEntries(keys.map((k) => [k, 0]));
  let total = 0;
  for (const { k, n } of rows) {
    out[k] = n;
    total += n;
  }
  return { ...out, total };
};

const UPCOMING_SELECT = `SELECT r.id, r.start_at, r.end_at, r.destination, r.status,
    CONCAT(u.first_name, ' ', u.last_name) AS requester_name, v.registration, v.brand, v.model
  FROM reservations r JOIN users u ON u.id = r.user_id LEFT JOIN vehicles v ON v.id = r.vehicle_id`;

/** Alertes de la flotte : pièces expirées ou proches de l'expiration, entretiens à prévoir. */
async function fleetAlerts() {
  const soon = `DATE_ADD(CURDATE(), INTERVAL ${ALERT_DAYS} DAY)`;
  const flag = (col) => `IF(${col} < CURDATE(), 'expired', 'soon')`;

  const [vehicleDocs] = await db.query(
    `SELECT id, registration, brand, model, 'insurance' AS type, insurance_expiry AS due_date, ${flag('insurance_expiry')} AS severity
       FROM vehicles WHERE insurance_expiry IS NOT NULL AND insurance_expiry <= ${soon}
     UNION ALL
     SELECT id, registration, brand, model, 'technical_inspection', technical_inspection_expiry, ${flag('technical_inspection_expiry')}
       FROM vehicles WHERE technical_inspection_expiry IS NOT NULL AND technical_inspection_expiry <= ${soon}`,
  );
  const [licenses] = await db.query(
    `SELECT id, CONCAT(first_name, ' ', last_name) AS label, 'driver_license' AS type,
            license_expiry AS due_date, ${flag('license_expiry')} AS severity
       FROM drivers WHERE license_expiry <= ${soon}`,
  );
  // Entretien à prévoir : on ignore ceux déjà "remplacés" par un entretien plus récent du même type.
  const [maintenance] = await db.query(
    `SELECT v.id, v.registration, v.brand, v.model, 'maintenance_due' AS type, m.type AS detail,
            m.next_date AS due_date, ${flag('m.next_date')} AS severity
       FROM vehicle_maintenance m JOIN vehicles v ON v.id = m.vehicle_id
      WHERE m.next_date IS NOT NULL AND m.next_date <= ${soon}
        AND NOT EXISTS (SELECT 1 FROM vehicle_maintenance m2
                         WHERE m2.vehicle_id = m.vehicle_id AND m2.type = m.type
                           AND m2.maintenance_date > m.maintenance_date)`,
  );

  return [...vehicleDocs, ...licenses, ...maintenance].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
}

export async function stats(req, res) {
  if (STAFF.includes(req.user.role)) {
    const [vehicleRows] = await db.query(
      `SELECT k, COUNT(*) AS n FROM (SELECT ${DISPLAY_STATUS_SQL} AS k FROM vehicles v) t GROUP BY k`,
    );
    const [reservationRows] = await db.query('SELECT status AS k, COUNT(*) AS n FROM reservations GROUP BY status');
    const [upcoming] = await db.query(
      `${UPCOMING_SELECT} WHERE r.status IN ('validated','in_progress') AND r.end_at >= NOW()
        ORDER BY r.start_at LIMIT 5`,
    );

    return res.json({
      scope: 'fleet',
      vehicles: countBy(vehicleRows, VEHICLE_STATUSES),
      reservations: countBy(reservationRows, RESERVATION_STATUSES),
      upcoming,
      alerts: await fleetAlerts(),
    });
  }

  // Utilisateur / conducteur : uniquement ses propres données.
  const [reservationRows] = await db.query(
    'SELECT status AS k, COUNT(*) AS n FROM reservations WHERE user_id = ? OR driver_id = ? GROUP BY status',
    [req.user.id, req.user.driver_id ?? 0],
  );
  const [upcoming] = await db.query(
    `${UPCOMING_SELECT} WHERE (r.user_id = ? OR r.driver_id = ?) AND r.status IN ('pending','validated','in_progress')
        AND r.end_at >= NOW() ORDER BY r.start_at LIMIT 5`,
    [req.user.id, req.user.driver_id ?? 0],
  );
  res.json({ scope: 'personal', reservations: countBy(reservationRows, RESERVATION_STATUSES), upcoming });
}
