// Montant en toutes lettres (français), pour les reçus : 250 000 → « deux cent cinquante mille ».
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const TENS = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

// `terminal` : le nombre termine l'énoncé (« quatre-vingts », « deux cents » prennent alors un s).
function below100(n, terminal) {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS[t];
    return u === 1 ? `${TENS[t]} et un` : `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${below100(n - 60, false)}`;
  if (n === 80) return terminal ? 'quatre-vingts' : 'quatre-vingt';
  return `quatre-vingt-${below100(n - 80, false)}`;
}

function below1000(n, terminal) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let out = '';
  if (h) {
    out = h === 1 ? 'cent' : `${UNITS[h]} cent`;
    if (r === 0 && h > 1 && terminal) out += 's';
  }
  if (r) out += `${out ? ' ' : ''}${below100(r, terminal)}`;
  return out;
}

export function numberToWords(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0 || n >= 1e12) return '';
  if (n === 0) return 'zéro';

  const billions = Math.floor(n / 1e9);
  const millions = Math.floor(n / 1e6) % 1000;
  const thousands = Math.floor(n / 1e3) % 1000;
  const rest = n % 1000;

  const parts = [];
  if (billions) parts.push(`${below1000(billions, false)} milliard${billions > 1 ? 's' : ''}`);
  if (millions) parts.push(millions === 1 ? 'un million' : `${below1000(millions, false)} millions`);
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`);
  if (rest) parts.push(below1000(rest, true));
  return parts.join(' ');
}

/** « Deux cent cinquante mille ariary » */
export function amountInWords(value) {
  const words = numberToWords(value);
  if (!words) return '';
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} ariary`;
}
