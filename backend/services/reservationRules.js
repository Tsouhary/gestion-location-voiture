import { badRequest, conflict } from '../utils/httpError.js';
import { vehicleConflict, driverConflict } from './availability.js';

const period = (c) => `du ${c.start_at.slice(0, 16)} au ${c.end_at.slice(0, 16)}`;

/** Le véhicule existe-t-il, est-il utilisable, assez grand, et libre sur la période ? */
export async function assertVehicleBookable(db, vehicleId, { start_at, end_at, passengers }, excludeId) {
  const [[vehicle]] = await db.query('SELECT id, status, seats FROM vehicles WHERE id = ?', [vehicleId]);
  if (!vehicle) throw badRequest('Véhicule introuvable');
  if (vehicle.status === 'maintenance') throw conflict('Ce véhicule est en maintenance');
  if (vehicle.status === 'out_of_service') throw conflict('Ce véhicule est hors service');
  if (passengers > vehicle.seats) {
    throw badRequest(`Ce véhicule n'a que ${vehicle.seats} places pour ${passengers} passagers`);
  }
  const clash = await vehicleConflict(db, vehicleId, start_at, end_at, excludeId);
  if (clash) throw conflict(`Ce véhicule est déjà réservé ${period(clash)}`);
  return vehicle;
}

/** Le conducteur existe-t-il, est-il disponible, son permis est-il valide, et est-il libre sur la période ? */
export async function assertDriverAvailable(db, driverId, { start_at, end_at }, excludeId) {
  const [[driver]] = await db.query('SELECT id, status, license_expiry FROM drivers WHERE id = ?', [driverId]);
  if (!driver) throw badRequest('Conducteur introuvable');
  if (driver.status === 'unavailable') throw conflict('Ce conducteur est indisponible');
  if (driver.license_expiry < end_at.slice(0, 10)) {
    throw conflict(`Le permis de ce conducteur expire le ${driver.license_expiry}, avant la fin de la mission`);
  }
  const clash = await driverConflict(db, driverId, start_at, end_at, excludeId);
  if (clash) throw conflict(`Ce conducteur est déjà affecté ${period(clash)}`);
  return driver;
}
