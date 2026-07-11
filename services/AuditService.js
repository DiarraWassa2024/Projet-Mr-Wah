/**
 * AuditService v2 — journalisation enrichie.
 * Capture : action, date/heure, utilisateur, programme, IP, navigateur.
 */
const AuditRepository = require('../repositories/AuditRepository');

const MODULE_LABELS = {
  'paiements':        'Paiements',
  'adherents':        'Adhérents',
  'organisations':    'Organisations',
  'beneficiaires':    'Bénéficiaires',
  'auth':             'Authentification',
  'demandes':         'Demandes',
  'evenements':       'Événements',
  'prestations':      'Prestations',
  'cotisations':      'Cotisations',
  'opportunites':     'Opportunités',
  'utilisateurs':     'Utilisateurs',
  'personnes':        'Personnes',
  'besoins-admin':    'Besoins',
  'groupes':          'Groupes',
  'roles':            'Rôles',
  'sauvegarde':       'Sauvegarde',
  'pays':             'Référentiel Pays',
  'ref':              'Référentiels',
  'messages':         'Messages',
  'autorisations-ministere': 'Autorisations',
  'ia-opportunites':  'IA Opportunités',
  'impressions':      'Impressions',
};

function extractIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || '127.0.0.1';
}

function extractBrowser(ua = '') {
  if (!ua) return 'Inconnu';
  if (/Edg\//.test(ua))          return 'Microsoft Edge';
  if (/OPR\/|Opera/.test(ua))    return 'Opera';
  if (/Chrome\//.test(ua))       return 'Google Chrome';
  if (/Firefox\//.test(ua))      return 'Mozilla Firefox';
  if (/Safari\//.test(ua))       return 'Apple Safari';
  if (/MSIE|Trident/.test(ua))   return 'Internet Explorer';
  if (/curl/.test(ua))           return 'cURL';
  if (/Postman/.test(ua))        return 'Postman';
  return ua.slice(0, 80);
}

function extractModule(req) {
  if (!req) return null;
  const parts = (req.path || req.url || '').split('/').filter(Boolean);
  const raw = parts[1] || parts[0] || null;
  return raw ? (MODULE_LABELS[raw] || raw) : null;
}

function extractIdFromPath(req) {
  if (!req) return null;
  const m = (req.path || '').match(/\/(\d+)/);
  return m ? parseInt(m[1]) : null;
}

function serializeDetails(details) {
  if (!details) return null;
  if (typeof details === 'string') return details.slice(0, 500);
  try { return JSON.stringify(details).slice(0, 500); } catch { return String(details).slice(0, 500); }
}

const AuditService = {
  /**
   * Enregistre une action dans SD_LogActivite.
   *
   * @param {string} action   — CONNEXION | DECONNEXION | CREATION | SUPPRESSION |
   *                            MODIFICATION | PAIEMENT | VALIDATION | IMPRESSION |
   *                            EXPORT | RECHERCHE
   * @param {object|null} req — requête Express (null pour les events système)
   * @param {object} opts     — { details, table, id, module, user, userId, username }
   */
  async log(action, req, opts = {}) {
    try {
      const ip  = req ? extractIP(req)  : '127.0.0.1';
      const nav = req ? extractBrowser(req.headers?.['user-agent'] || '') : 'Système';
      const u   = req?.user || {};

      // Résoudre le module avec traduction
      const rawModule = opts.module || extractModule(req);
      const resolvedModule = rawModule ? (MODULE_LABELS[rawModule] || rawModule) : null;

      await AuditRepository.log({
        action,
        table_cible:    opts.table    || null,
        id_cible:       opts.id       || (req ? extractIdFromPath(req) : null),
        details:        serializeDetails(opts.details),
        adminUser:      u.email || u.username || opts.user || 'système',
        ipAdresse:      ip,
        navigateur:     nav,
        module:         resolvedModule,
        userId:         u.idUser      || opts.userId   || null,
        nomUtilisateur: u.username    || opts.username || null,
      });
    } catch(err) {
      console.warn('[AuditService] Échec log:', err.message);
    }
  },

  // Alias court pour contexte Express
  async logReq(req, action, opts = {}) {
    return this.log(action, req, opts);
  },
};

module.exports = AuditService;
