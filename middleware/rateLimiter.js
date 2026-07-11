/**
 * Rate limiting centralisé.
 * Protège les routes publiques (auth, formulaires publics) contre les abus.
 *
 * Implémenté sans dépendance externe via un simple compteur en mémoire.
 * Pour la production, remplacer par express-rate-limit + Redis.
 */

const store = new Map(); // ip -> { count, resetAt }

/**
 * Crée un middleware de rate-limit.
 * @param {{ windowMs, max, message }} options
 */
function createLimiter({ windowMs = 60_000, max = 60, message = 'Trop de requêtes, réessayez plus tard' } = {}) {
  return (req, res, next) => {
    const ip  = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(ip, entry);
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', retryAfter);
      return res.status(429).json({ message });
    }

    next();
  };
}

// Limiteurs pré-configurés
const authLimiter   = createLimiter({ windowMs: 15 * 60_000, max: 20, message: 'Trop de tentatives de connexion' });
const publicLimiter = createLimiter({ windowMs: 60_000,       max: 30, message: 'Trop de soumissions, réessayez plus tard' });
const apiLimiter    = createLimiter({ windowMs: 60_000,       max: 200 });

// Nettoyage périodique du store (évite les fuites mémoire)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(ip);
  }
}, 5 * 60_000);

module.exports = { createLimiter, authLimiter, publicLimiter, apiLimiter };
