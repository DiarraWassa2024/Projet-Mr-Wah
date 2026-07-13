const router      = require('express').Router();
const auth        = require('../middleware/auth');
const AuthService = require('../services/AuthService');
const UserRepository = require('../repositories/UserRepository');
const OrganisationRepository = require('../repositories/OrganisationRepository');
const AdherentRepository     = require('../repositories/AdherentRepository');
const AuditService   = require('../services/AuditService');
const { authLimiter } = require('../middleware/rateLimiter');
const { ok, badRequest, serverError } = require('../helpers/response');

/**
 * Pour un gestionnaire, joint le nom de son organisation ; pour un adhérent, joint son propre
 * nom complet — affichés à la place de l'identifiant de connexion dans l'interface.
 */
async function withOrgName(publicUser) {
  if (publicUser.role === 'gestionnaire' && publicUser.NumAgr) {
    const org = await OrganisationRepository.findById(publicUser.NumAgr);
    if (org) return { ...publicUser, orgName: org.LibOrg, orgLogo: org.Logo || null };
  }
  if (publicUser.role === 'adherent' && publicUser.idAdh) {
    const adh = await AdherentRepository.findById(publicUser.idAdh);
    if (adh) return { ...publicUser, adherentName: [adh.PrenAdh, adh.NomAdh].filter(Boolean).join(' ') };
  }
  return publicUser;
}

// Remarque : il n'y a volontairement aucune route POST /register — la création de compte
// (adhérent ou organisation) passe exclusivement par le parcours d'adhésion (validation +
// paiement de la cotisation), qui génère et envoie les identifiants par email. Un utilisateur
// ne peut donc jamais créer un compte de connexion directement sans passer par ce parcours.

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  // Accepte "email" (compat historique) ou "login"/"username" comme identifiant de connexion
  const identifiant = req.body.login || req.body.username || req.body.email;
  const { password } = req.body;
  if (!identifiant || !password) return badRequest(res, 'Identifiant et mot de passe requis');
  try {
    const user = await AuthService.login(identifiant, password);
    if (!user) {
      AuditService.log('CONNEXION', req, {
        module: 'Authentification',
        details: `Échec connexion — identifiant : ${identifiant}`,
        user: identifiant,
      }).catch(() => {});
      return res.status(401).json({ message: 'Identifiants invalides' });
    }
    const token = AuthService.generateToken(user);
    // Injecter user dans req pour que AuditService puisse l'utiliser
    req.user = user;
    AuditService.log('CONNEXION', req, {
      module:  'Authentification',
      details: `Connexion réussie`,
    }).catch(() => {});
    ok(res, { token, user: await withOrgName(AuthService.publicUser(user)) });
  } catch (err) { serverError(res, err); }
});

// POST /api/auth/logout
router.post('/logout', auth, async (req, res) => {
  AuditService.log('DECONNEXION', req, {
    module:  'Authentification',
    details: 'Déconnexion',
  }).catch(() => {});
  ok(res, { message: 'Déconnecté' });
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await UserRepository.findById(req.user.idUser);
    ok(res, await withOrgName(user));
  } catch (err) { serverError(res, err); }
});

module.exports = router;
