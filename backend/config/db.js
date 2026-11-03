import 'dotenv/config';
import mysql from 'mysql2/promise';

// dateStrings : DATE/DATETIME sont renvoyés tels quels ("2026-09-20 08:00:00"),
// sans conversion de fuseau horaire par le driver.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'parc_auto',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  decimalNumbers: true, // les montants (DECIMAL) sortent en nombres, pas en chaînes
});

export default pool;
