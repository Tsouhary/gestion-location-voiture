import app from './app.js';
import db from './config/db.js';

const port = Number(process.env.PORT) || 5000;

try {
  await db.query('SELECT 1');
} catch (err) {
  console.error(`Connexion MySQL impossible (${err.code || err.message}). MySQL est-il démarré ? Le schéma est-il importé ?`);
  process.exit(1);
}

app.listen(port, () => console.log(`API parc automobile sur http://localhost:${port}/api`));
