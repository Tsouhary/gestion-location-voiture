import db from '../config/db.js';
import { parseBody, str, email } from '../utils/validate.js';
import { ORG_KEYS, getSettings } from '../services/settings.js';

const schema = {
  org_name: str({ required: true, max: 120 }),
  org_address: str({ max: 200 }),
  org_city: str({ max: 80 }),
  org_phone: str({ max: 40 }),
  org_email: email(),
  org_nif: str({ max: 40 }),
  org_stat: str({ max: 40 }),
};

export async function get(_req, res) {
  res.json(await getSettings(db));
}

export async function update(req, res) {
  const data = parseBody(req.body, schema, { partial: true });
  for (const key of ORG_KEYS) {
    if (key in data) {
      await db.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [key, data[key] ?? ''],
      );
    }
  }
  res.json(await getSettings(db));
}
