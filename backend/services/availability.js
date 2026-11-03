// Règles de disponibilité. Seules les réservations validées ou en cours occupent un créneau ;
// deux périodes se chevauchent si  début_A < fin_B  ET  fin_A > début_B  (les bornes qui se touchent sont permises).
const BLOCKING = "('validated','in_progress')";

async function overlapping(db, column, id, start, end, excludeId) {
  const [rows] = await db.query(
    `SELECT id, start_at, end_at FROM reservations
      WHERE ${column} = ? AND status IN ${BLOCKING}
        AND start_at < ? AND end_at > ? AND id <> ?
      LIMIT 1`,
    [id, end, start, excludeId ?? 0],
  );
  return rows[0] || null;
}

export const vehicleConflict = (db, vehicleId, start, end, excludeId) =>
  overlapping(db, 'vehicle_id', vehicleId, start, end, excludeId);

export const driverConflict = (db, driverId, start, end, excludeId) =>
  overlapping(db, 'driver_id', driverId, start, end, excludeId);

/** Fragment SQL : véhicules libres sur [start, end] (à utiliser avec deux paramètres : end, start). */
export const VEHICLE_FREE_SQL = `NOT EXISTS (
  SELECT 1 FROM reservations r
   WHERE r.vehicle_id = v.id AND r.status IN ${BLOCKING}
     AND r.start_at < ? AND r.end_at > ?)`;

export const DRIVER_FREE_SQL = `NOT EXISTS (
  SELECT 1 FROM reservations r
   WHERE r.driver_id = d.id AND r.status IN ${BLOCKING}
     AND r.start_at < ? AND r.end_at > ?)`;
