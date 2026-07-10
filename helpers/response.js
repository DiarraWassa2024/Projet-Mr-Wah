// Standardized HTTP response helpers — keeps controllers/routes consistent

const ok        = (res, data, status = 200)           => res.status(status).json(data);
const created   = (res, data)                          => res.status(201).json(data);
const noContent = (res)                                => res.status(204).send();
const notFound  = (res, msg = 'Ressource introuvable') => res.status(404).json({ message: msg });
const badRequest= (res, msg)                           => res.status(400).json({ message: msg });
const forbidden = (res, msg = 'Accès refusé')          => res.status(403).json({ message: msg });
const conflict  = (res, msg = 'Conflit de données')    => res.status(409).json({ message: msg });
const serverError = (res, err) => {
  const msg = (err && err.message) ? err.message : 'Erreur serveur interne';
  return res.status(500).json({ message: msg });
};

module.exports = { ok, created, noContent, notFound, badRequest, forbidden, conflict, serverError };
