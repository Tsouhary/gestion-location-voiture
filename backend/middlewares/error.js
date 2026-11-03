import { HttpError } from '../utils/httpError.js';

export function notFoundHandler(req, _res, next) {
  next(new HttpError(404, `Route introuvable : ${req.method} ${req.originalUrl}`));
}

// Codes d'erreur MySQL connus, traduits en réponses compréhensibles.
const MYSQL_ERRORS = {
  ER_DUP_ENTRY: [409, 'Cette valeur existe déjà (doublon)'],
  ER_NO_REFERENCED_ROW_2: [400, 'Référence invalide (élément lié introuvable)'],
  ER_ROW_IS_REFERENCED_2: [409, 'Suppression impossible : cet élément est utilisé ailleurs'],
  ER_BAD_NULL_ERROR: [400, 'Un champ obligatoire est vide'],
  ER_CHECK_CONSTRAINT_VIOLATED: [400, 'Données incohérentes (contrainte non respectée)'],
};

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Corps de requête JSON invalide' });
  }
  const mapped = MYSQL_ERRORS[err.code];
  if (mapped) return res.status(mapped[0]).json({ message: mapped[1] });

  // Erreur inattendue : détail dans les logs uniquement, jamais dans la réponse.
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({ message: 'Erreur interne du serveur' });
}
