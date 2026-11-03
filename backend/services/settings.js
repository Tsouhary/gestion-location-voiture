// Informations de l'organisation affichées en en-tête des factures, reçus et contrats.
export const ORG_KEYS = ['org_name', 'org_address', 'org_city', 'org_phone', 'org_email', 'org_nif', 'org_stat'];

export async function getSettings(db) {
  const [rows] = await db.query('SELECT setting_key, setting_value FROM settings');
  const map = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  return Object.fromEntries(ORG_KEYS.map((k) => [k, map[k] ?? '']));
}

export async function getOrg(db) {
  const s = await getSettings(db);
  return {
    name: s.org_name || 'Mon organisation',
    address: s.org_address,
    city: s.org_city,
    phone: s.org_phone,
    email: s.org_email,
    nif: s.org_nif,
    stat: s.org_stat,
  };
}
