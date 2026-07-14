const router      = require('express').Router();
const crypto      = require('crypto');
const auth        = require('../middleware/auth');
const AuthService = require('../services/AuthService');
const UserRepository = require('../repositories/UserRepository');
const OrganisationRepository = require('../repositories/OrganisationRepository');
const AdherentRepository     = require('../repositories/AdherentRepository');
const AuditService   = require('../services/AuditService');
const db              = require('../config/database');
const emailSvc        = require('../services/email');
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
    // Verrouillage anti-bruteforce par identifiant (complète le rate-limiter IP existant) —
    // ne révèle jamais si l'identifiant correspond à un compte réel.
    const minutesRestantes = await AuthService.verifierBlocage(identifiant);
    if (minutesRestantes) {
      return res.status(429).json({ message: `Trop de tentatives échouées. Réessayez dans ${minutesRestantes} minute(s).` });
    }

    const user = await AuthService.login(identifiant, password);
    if (!user) {
      await AuthService.enregistrerEchecConnexion(identifiant);
      await AuthService.logHistoriqueConnexion(null, req, 'Échec');
      AuditService.log('CONNEXION', req, {
        module: 'Authentification',
        details: `Échec connexion — identifiant : ${identifiant}`,
        user: identifiant,
      }).catch(() => {});
      return res.status(401).json({ message: 'Identifiants invalides' });
    }
    await AuthService.reinitialiserTentatives(identifiant);
    const token = AuthService.generateToken(user);
    await AuthService.logHistoriqueConnexion(user.idUser, req, 'Succès');
    await AuthService.creerSession(user.idUser, token, req);
    // Injecter user dans req pour que AuditService puisse l'utiliser
    req.user = user;
    AuditService.log('CONNEXION', req, {
      module:  'Authentification',
      details: `Connexion réussie`,
    }).catch(() => {});
    ok(res, { token, user: await withOrgName(AuthService.publicUser(user)) });
  } catch (err) { serverError(res, err); }
});

// POST /api/auth/mot-de-passe-oublie — envoie un lien de réinitialisation valable 1h. Répond
// toujours de la même façon, que l'identifiant corresponde à un compte ou non (ne révèle jamais
// l'existence d'un compte).
router.post('/mot-de-passe-oublie', authLimiter, async (req, res) => {
  const identifiant = (req.body.identifiant || '').trim();
  if (!identifiant) return badRequest(res, 'Identifiant ou email requis');
  try {
    const user = await UserRepository.findByLogin(identifiant);
    if (user?.email) {
      const token = crypto.randomBytes(32).toString('hex');
      const dateExpiration = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
      await db.execute(
        `INSERT INTO SD_ReinitialisationMDP (idUser, token, dateExpiration) VALUES (?, ?, ?)`,
        [user.idUser, token, dateExpiration]
      );
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const lien = `${appUrl}/reinitialiser-mdp?token=${token}`;
      emailSvc.sendMail(emailSvc.emailReinitialisationMDP(user, lien)).catch(() => {});
    }
    ok(res, { message: "Si un compte existe pour cet identifiant, un email de réinitialisation vient d'être envoyé." });
  } catch (err) { serverError(res, err); }
});

// POST /api/auth/reinitialiser — consomme le token à usage unique et change le mot de passe.
router.post('/reinitialiser', authLimiter, async (req, res) => {
  const { token, nouveauMotDePasse } = req.body;
  if (!token || !nouveauMotDePasse) return badRequest(res, 'Token et nouveau mot de passe requis');
  if (nouveauMotDePasse.length < 6) return badRequest(res, 'Le mot de passe doit contenir au moins 6 caractères');
  try {
    const [[row]] = await db.execute(`SELECT * FROM SD_ReinitialisationMDP WHERE token = ?`, [token]);
    if (!row) return badRequest(res, 'Lien de réinitialisation invalide');
    if (row.utilise) return badRequest(res, 'Ce lien a déjà été utilisé');
    if (new Date(row.dateExpiration) < new Date()) return badRequest(res, 'Ce lien a expiré — demandez-en un nouveau');

    const passwordHash = await AuthService.hashPassword(nouveauMotDePasse);
    await UserRepository.update(row.idUser, { passwordHash });
    await db.execute(`UPDATE SD_ReinitialisationMDP SET utilise = 1 WHERE idReinit = ?`, [row.idReinit]);
    ok(res, { message: 'Mot de passe réinitialisé — vous pouvez maintenant vous connecter.' });
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
