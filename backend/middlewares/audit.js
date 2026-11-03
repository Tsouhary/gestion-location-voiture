// Journalisation des actions d'écriture (qui, quoi, résultat). Sortie console ;
// à rediriger vers un fichier ou une table selon le déploiement.
export function auditLog(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  res.on('finish', () => {
    const who = req.user ? `user#${req.user.id}(${req.user.role})` : 'anonyme';
    console.log(`[audit] ${new Date().toISOString()} ${who} ${req.method} ${req.originalUrl} -> ${res.statusCode}`);
  });
  next();
}
