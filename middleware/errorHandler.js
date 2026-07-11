/**
 * Gestionnaire d'erreurs global Express.
 * Doit être enregistré EN DERNIER dans server.js (après toutes les routes).
 *
 * Gère :
 *  - Erreurs SQLite (contraintes, duplicates)
 *  - Erreurs métier (err.status personnalisé)
 *  - Erreurs inattendues (500)
 */
module.exports = (err, req, res, next) => {
  // Log serveur (évite de polluer la console en test)
  if (process.env.NODE_ENV !== 'test') console.error('[ERROR]', err.message || err);

  // Contrainte SQLite (duplicate, FK, etc.)
  if (err.code === 'SQLITE_CONSTRAINT' || err.code === 'SQLITE_CONSTRAINT_UNIQUE')
    return res.status(409).json({ message: 'Contrainte de données violée (doublon ou référence invalide)' });

  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY')
    return res.status(409).json({ message: 'Référence invalide : l\'enregistrement lié n\'existe pas' });

  // Erreur métier avec statut HTTP explicite
  if (err.status) return res.status(err.status).json({ message: err.message });

  // Fallback 500
  res.status(500).json({ message: err.message || 'Erreur serveur interne' });
};
