/**
 * auditMiddleware — auto-instrumentation de toutes les routes API.
 * Intercepte les requêtes mutantes (POST/PUT/DELETE) et les recherches (GET?search=)
 * et enregistre chaque événement dans SD_LogActivite après réponse réussie.
 */
const AuditService = require('../services/AuditService');

// Mapping méthode HTTP → action audit
const METHOD_ACTION = {
  POST:   'CREATION',
  PUT:    'MODIFICATION',
  PATCH:  'MODIFICATION',
  DELETE: 'SUPPRESSION',
};

// Surcharges par pattern d'URL (testées dans l'ordre)
const OVERRIDES = [
  { test: p => p === '/api/auth/login',                            action: 'CONNEXION'    },
  { test: p => p === '/api/auth/logout',                           action: 'DECONNEXION'  },
  { test: p => /^\/api\/paiements\/\d+\/statut$/.test(p),         action: 'VALIDATION'   },
  { test: p => /^\/api\/paiements$/.test(p),         method:'POST', action: 'PAIEMENT'   },
  { test: p => /^\/api\/piste-audit\/event$/.test(p),              action: null           }, // skip (self-log)
];

// Routes à ignorer complètement (auth.js gère ses propres logs de connexion)
const SKIP = [
  /^\/api\/piste-audit/,
  /^\/api\/auth\//,     // auth.js logue connexion/déconnexion lui-même
  /^\/api\/ref\//,
  /^\/api\/pays/,
  /^\/api\/public/,
];

function resolveAction(req) {
  const path   = req.path;
  const method = req.method;

  // Recherche via GET?search=
  if (method === 'GET') {
    const q = req.query.search || req.query.q || '';
    if (!q) return null;
    return { action: 'RECHERCHE', details: `Recherche : "${q}"` };
  }

  for (const ov of OVERRIDES) {
    if (ov.action === null && ov.test(path)) return null; // skip
    if (ov.test(path) && (!ov.method || ov.method === method)) {
      return { action: ov.action };
    }
  }

  const action = METHOD_ACTION[method];
  return action ? { action } : null;
}

function buildDetails(req, resolved) {
  if (resolved?.details) return resolved.details;

  const body = req.body || {};
  // Exclure les mots de passe et données sensibles
  const safe = Object.fromEntries(
    Object.entries(body).filter(([k]) => !/password|token|hash|secret/i.test(k))
  );
  const str = JSON.stringify(safe);
  return str.length > 2 ? str.slice(0, 400) : null;
}

module.exports = function auditMiddleware(req, res, next) {
  // Seulement les routes API
  if (!req.path.startsWith('/api/')) return next();

  // Routes à ignorer
  if (SKIP.some(p => p.test(req.path))) return next();

  const resolved = resolveAction(req);
  if (!resolved) return next();

  // Patch res.json pour capturer la réponse
  const origJson = res.json.bind(res);
  res.json = function(body) {
    const result = origJson(body);
    // Logguer après envoi, seulement si succès
    if (res.statusCode < 400 && req.user) {
      setImmediate(() => {
        const parts = req.path.split('/').filter(Boolean);
        const module = parts[1] || 'api';

        AuditService.log(resolved.action, req, {
          module,
          details: buildDetails(req, resolved),
          id:      body?.id || body?.insertId || null,
        }).catch(() => {});
      });
    }
    return result;
  };

  next();
};
