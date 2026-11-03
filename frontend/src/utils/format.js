export const VEHICLE_STATUS = {
  available: 'Disponible',
  reserved: 'Réservé',
  in_mission: 'En mission',
  maintenance: 'En maintenance',
  out_of_service: 'Hors service',
};
export const RESERVATION_STATUS = {
  pending: 'En attente',
  validated: 'Validée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
  in_progress: 'En cours',
  completed: 'Terminée',
};
export const DRIVER_STATUS = { available: 'Disponible', on_mission: 'En mission', unavailable: 'Indisponible' };
export const ROLE_LABEL = { admin: 'Administrateur', manager: 'Gestionnaire', user: 'Utilisateur', driver: 'Conducteur' };
export const FUEL = { diesel: 'Diesel', essence: 'Essence', hybride: 'Hybride', electrique: 'Électrique' };
export const GEARBOX = { manuelle: 'Manuelle', automatique: 'Automatique' };
export const MAINTENANCE_TYPE = {
  vidange: 'Vidange',
  pneus: 'Changement de pneus',
  freinage: 'Freinage',
  batterie: 'Batterie',
  revision: 'Révision',
  reparation: 'Réparation',
  controle_technique: 'Contrôle technique',
};
export const INVOICE_STATUS = { unpaid: 'Impayée', partial: 'Partiellement payée', paid: 'Payée', cancelled: 'Annulée' };
export const PAYMENT_METHOD = { especes: 'Espèces', mobile_money: 'Mobile money', virement: 'Virement bancaire', cheque: 'Chèque', carte: 'Carte bancaire' };
export const ALERT_LABEL = {
  insurance: 'Assurance',
  technical_inspection: 'Contrôle technique',
  driver_license: 'Permis de conduire',
  maintenance_due: 'Entretien à prévoir',
};

// Couleur du badge selon le statut (les clés communes à plusieurs domaines ont le même sens).
export const TONE = {
  available: 'green', validated: 'green',
  reserved: 'blue', in_mission: 'blue', on_mission: 'blue', in_progress: 'blue',
  pending: 'amber', maintenance: 'amber',
  rejected: 'red', out_of_service: 'red', unavailable: 'red',
  cancelled: 'gray', completed: 'gray',
  unpaid: 'red', partial: 'amber', paid: 'green',
};

export const formatDate = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
export const formatDateTime = (s) => (s ? `${formatDate(s)} ${s.slice(11, 16)}` : '—');
/** "2026-09-20 08:00:00" → "2026-09-20T08:00" pour <input type="datetime-local"> */
export const toInputDateTime = (s) => (s ? s.slice(0, 16).replace(' ', 'T') : '');
/** « 20 septembre 2026 » à partir de "2026-09-20" ou "2026-09-20 08:00:00". */
export const formatDateLong = (s) => (s ? new Date(`${s.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const parseLocal = (s) => new Date(s.slice(0, 16).replace(' ', 'T'));
/** Jour et mois abrégé : "27 sept." à partir de "2026-09-27 07:30:00". */
export const formatDayShort = (s) => (s ? `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]}` : '—');
export const formatTime = (s) => (s ? s.slice(11, 16) : '—');
/** "07:30 → 17:30" le même jour, "23 sept. 08:00 → 24 sept. 17:00" sinon. */
export const formatPeriod = (start, end) => (start.slice(0, 10) === end.slice(0, 10)
  ? `${formatTime(start)} → ${formatTime(end)}`
  : `${formatDayShort(start)} ${formatTime(start)} → ${formatDayShort(end)} ${formatTime(end)}`);
/** Durée lisible : "10 h", "1 j 9 h", "45 min". Chaîne vide si la période est invalide. */
export const formatDuration = (start, end) => {
  const mins = Math.round((parseLocal(end) - parseLocal(start)) / 60000);
  if (!(mins > 0)) return '';
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return [d && `${d} j`, h && `${h} h`, !d && m && `${m} min`].filter(Boolean).join(' ');
};
export const initials = (name) => (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
export const formatKm =(n) => (n == null ? '—' : `${Number(n).toLocaleString('fr-FR')} km`);
export const formatMoney = (n) => `${Number(n || 0).toLocaleString('fr-FR')} Ar`;
export const vehicleLabel = (r) => (r.registration ? `${r.brand} ${r.model} — ${r.registration}` : '—');

export const isStaff = (user) => user?.role === 'admin' || user?.role === 'manager';
