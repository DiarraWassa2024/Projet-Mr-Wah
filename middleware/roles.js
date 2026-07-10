/**
 * Middleware de vérification de rôle.
 *
 * Usage dans les routes :
 *   router.delete('/:id', auth, roles('admin'), ctrl.destroy);
 *   router.post('/',      auth, roles('admin', 'gestionnaire'), ctrl.create);
 */
const roles = (...allowed) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
  if (!allowed.includes(req.user.role))
    return res.status(403).json({ message: `Accès réservé aux rôles : ${allowed.join(', ')}` });
  next();
};

module.exports = roles;
