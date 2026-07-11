const router      = require('express').Router();
const auth        = require('../middleware/auth');
const AuthService = require('../services/AuthService');
const UserRepository = require('../repositories/UserRepository');
const AuditService   = require('../services/AuditService');
const { authLimiter } = require('../middleware/rateLimiter');
const { ok, created, badRequest, serverError } = require('../helpers/response');

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password)
    return badRequest(res, 'Champs obligatoires manquants');
  const ALLOWED_ROLES = ['gestionnaire', 'adherent'];
  const safeRole = ALLOWED_ROLES.includes(role) ? role : 'gestionnaire';
  try {
    const result = await AuthService.register({ username, email, password, role: safeRole });
    created(res, { message: 'Utilisateur créé', idUser: result.insertId });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT' || err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ message: 'Email ou pseudo déjà utilisé' });
    serverError(res, err);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return badRequest(res, 'Email et mot de passe requis');
  try {
    const user = await AuthService.login(email, password);
    if (!user) {
      AuditService.log('CONNEXION', req, {
        module: 'Authentification',
        details: `Échec connexion — email : ${email}`,
        user: email,
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
    ok(res, { token, user: AuthService.publicUser(user) });
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
    ok(res, user);
  } catch (err) { serverError(res, err); }
});

module.exports = router;
