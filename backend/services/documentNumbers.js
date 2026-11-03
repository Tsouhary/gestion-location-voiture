const PREFIX = { invoice: 'FAC', receipt: 'REC', contract: 'CTR' };

/**
 * Numéro suivant d'un type de document, par année : FAC-2026-0001.
 * DOIT être appelé sur une connexion en transaction : le compteur est verrouillé jusqu'au commit,
 * donc deux créations simultanées n'obtiennent jamais le même numéro, et une création annulée ne laisse pas de trou.
 */
export async function nextNumber(conn, kind, date = new Date()) {
  const year = date.getFullYear();
  await conn.query(
    `INSERT INTO document_sequences (kind, year, last_number) VALUES (?, ?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
    [kind, year],
  );
  const [[row]] = await conn.query('SELECT LAST_INSERT_ID() AS n');
  return `${PREFIX[kind]}-${year}-${String(row.n).padStart(4, '0')}`;
}
