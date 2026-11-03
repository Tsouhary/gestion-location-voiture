// Helpers d'écriture. Les noms de colonnes viennent toujours des schémas de validation
// (jamais directement de la requête) ; les valeurs sont passées en paramètres.

const ident = (name) => `\`${name}\``;

export async function insertRow(db, table, data) {
  const cols = Object.keys(data);
  const [res] = await db.query(
    `INSERT INTO ${ident(table)} (${cols.map(ident).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    Object.values(data),
  );
  return res.insertId;
}

export async function updateRow(db, table, id, data) {
  const cols = Object.keys(data);
  if (!cols.length) return 0;
  const [res] = await db.query(
    `UPDATE ${ident(table)} SET ${cols.map((c) => `${ident(c)} = ?`).join(', ')} WHERE id = ?`,
    [...Object.values(data), id],
  );
  return res.affectedRows;
}

/** Construit un WHERE à partir de conditions optionnelles : add('v.status = ?', value). */
export function whereBuilder() {
  const clauses = [];
  const params = [];
  return {
    add(clause, ...values) {
      clauses.push(clause);
      params.push(...values);
    },
    get sql() {
      return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    },
    params,
  };
}

export const likeTerm = (q) => `%${String(q).replace(/[\\%_]/g, '\\$&')}%`;

/** Exécute fn(conn) dans une transaction ; annule tout si fn lève une erreur. */
export async function withTransaction(pool, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
