import { badRequest } from './httpError.js';

// Déclaration des règles : chaque champ du schéma décrit un type et ses contraintes.
export const str = (o = {}) => ({ kind: 'str', ...o });
export const int = (o = {}) => ({ kind: 'int', ...o });
export const num = (o = {}) => ({ kind: 'num', ...o });
export const date = (o = {}) => ({ kind: 'date', ...o });
export const datetime = (o = {}) => ({ kind: 'datetime', ...o });
export const email = (o = {}) => ({ kind: 'email', ...o });
export const bool = (o = {}) => ({ kind: 'bool', ...o });
export const enumOf = (values, o = {}) => ({ kind: 'enum', values, ...o });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

function parseValue(key, v, rule) {
  switch (rule.kind) {
    case 'str': {
      if (typeof v !== 'string') return { error: `${key} doit être du texte` };
      const s = v.trim();
      if (!s) return { value: null };
      if (s.length > (rule.max ?? 255)) return { error: `${key} est trop long (max ${rule.max ?? 255})` };
      if (rule.min && s.length < rule.min) return { error: `${key} est trop court (min ${rule.min})` };
      return { value: s };
    }
    case 'email': {
      const s = String(v).trim().toLowerCase();
      if (!EMAIL_RE.test(s) || s.length > 150) return { error: `${key} n'est pas une adresse email valide` };
      return { value: s };
    }
    case 'int':
    case 'num': {
      const n = typeof v === 'number' ? v : Number(String(v).trim());
      if (!Number.isFinite(n) || (rule.kind === 'int' && !Number.isInteger(n))) {
        return { error: `${key} doit être un ${rule.kind === 'int' ? 'entier' : 'nombre'}` };
      }
      if (rule.min !== undefined && n < rule.min) return { error: `${key} doit être ≥ ${rule.min}` };
      if (rule.max !== undefined && n > rule.max) return { error: `${key} doit être ≤ ${rule.max}` };
      return { value: n };
    }
    case 'date': {
      const s = String(v).trim().slice(0, 10);
      if (!DATE_RE.test(s) || !isValidDate(s)) return { error: `${key} doit être une date valide (AAAA-MM-JJ)` };
      return { value: s };
    }
    case 'datetime': {
      const m = DATETIME_RE.exec(String(v).trim());
      if (!m || !isValidDate(m[1]) || Number(m[2]) > 23 || Number(m[3]) > 59) {
        return { error: `${key} doit être une date et heure valides` };
      }
      return { value: `${m[1]} ${m[2]}:${m[3]}:${m[4] ?? '00'}` };
    }
    case 'bool': {
      if ([true, 1, '1', 'true'].includes(v)) return { value: 1 };
      if ([false, 0, '0', 'false'].includes(v)) return { value: 0 };
      return { error: `${key} doit être un booléen` };
    }
    case 'enum': {
      if (!rule.values.includes(v)) return { error: `${key} doit être parmi : ${rule.values.join(', ')}` };
      return { value: v };
    }
    default:
      return { error: `${key} : règle inconnue` };
  }
}

/**
 * Valide `body` selon `schema` et renvoie uniquement les champs déclarés
 * (protège contre l'injection de colonnes). Une chaîne vide vaut null.
 * `partial` : les champs absents sont ignorés (mise à jour).
 */
export function parseBody(body, schema, { partial = false } = {}) {
  const out = {};
  const errors = [];
  const src = body && typeof body === 'object' ? body : {};

  for (const [key, rule] of Object.entries(schema)) {
    let v = src[key];
    if (v === '') v = null;

    if (v === undefined) {
      if (!partial && rule.required) errors.push(`${key} est obligatoire`);
      continue;
    }
    if (v === null) {
      if (rule.required) errors.push(`${key} est obligatoire`);
      else if (!rule.notNull) out[key] = null; // notNull : colonne non nullable, on garde la valeur par défaut
      continue;
    }

    const res = parseValue(key, v, rule);
    if (res.error) errors.push(res.error);
    else if (res.value === null && rule.required) errors.push(`${key} est obligatoire`);
    else out[key] = res.value;
  }

  if (errors.length) throw badRequest(errors[0], errors);
  return out;
}

/** "YYYY-MM-DD HH:mm:ss" en heure locale du serveur (même format que les DATETIME renvoyés). */
export function nowSql(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
