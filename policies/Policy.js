/**
 * Classe de base pour les policies d'autorisation.
 *
 * Les policies encapsulent les règles métier d'autorisation,
 * séparément de la logique de routage et des middlewares génériques.
 *
 * Usage :
 *   class DemandePolicy extends Policy {
 *     canAccept(user) { return this.isAdmin(user); }
 *   }
 *   const policy = new DemandePolicy();
 *   if (!policy.canAccept(req.user)) return res.status(403).json(...)
 */
class Policy {
  isAdmin(user)        { return user?.role === 'admin'; }
  isGestionnaire(user) { return user?.role === 'gestionnaire'; }
  isAdherent(user)     { return user?.role === 'adherent'; }
  isStaff(user)        { return ['admin', 'gestionnaire'].includes(user?.role); }

  /** Lance une erreur 403 utilisable avec next(err) */
  deny(message = 'Action non autorisée') {
    const err = new Error(message);
    err.status = 403;
    return err;
  }
}

module.exports = Policy;
