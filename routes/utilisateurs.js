const router             = require('express').Router();
const auth               = require('../middleware/auth');
const roles              = require('../middleware/roles');
const AuthService        = require('../services/AuthService');
const UserRepository     = require('../repositories/UserRepository');
const UtilisateurPolicy  = require('../policies/UtilisateurPolicy');
const { ok, created, badRequest, forbidden, serverError } = require('../helpers/response');

// Tous les endpoints nécessitent auth + rôle admin
router.use(auth, roles('admin'));

// GET /api/utilisateurs
router.get('/', async (req, res) => {
  try {
    const users = await UserRepository.findAll();
    ok(res, users);
  } catch (err) { serverError(res, err); }
});

// POST /api/utilisateurs
router.post('/', async (req, res) => {
  try {
    const { username, email, password, role, isActive } = req.body;
    if (!username || !email || !password)
      return badRequest(res, 'Nom, email et mot de passe obligatoires');

    const hash = await AuthService.hashPassword(password);
    const result = await UserRepository.create({
      username, email, passwordHash: hash,
      role: role || 'gestionnaire',
      isActive: isActive === 0 ? 0 : 1,
    });
    created(res, { idUser: result.insertId, message: 'Utilisateur créé' });
  } catch (err) {
    if (err.message?.includes('UNIQUE'))
      return res.status(409).json({ message: "Cet email ou nom d'utilisateur existe déjà" });
    serverError(res, err);
  }
});

// PUT /api/utilisateurs/:id
router.put('/:id', async (req, res) => {
  try {
    const { username, email, role, isActive, password } = req.body;
    const data = { username, email, role, isActive: isActive === 0 ? 0 : 1 };
    if (password) data.passwordHash = await AuthService.hashPassword(password);
    await UserRepository.update(req.params.id, data);
    ok(res, { message: 'Utilisateur mis à jour' });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/utilisateurs/:id
router.delete('/:id', async (req, res) => {
  try {
    const target     = await UserRepository.findById(req.params.id);
    const adminCount = await UserRepository.countAdmins();
    if (!UtilisateurPolicy.canDelete(req.user, target?.role, adminCount))
      return forbidden(res, 'Impossible de supprimer le dernier administrateur');
    await UserRepository.delete(req.params.id);
    ok(res, { message: 'Utilisateur supprimé' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
