/**
 * AuthService — logique métier d'authentification.
 * Découple la logique auth de la route Express.
 */
const bcrypt        = require('bcryptjs');
const jwt           = require('jsonwebtoken');
const UserRepository = require('../repositories/UserRepository');

const SECRET  = () => process.env.JWT_SECRET || 'gpo_secret';
const EXPIRES = () => process.env.JWT_EXPIRES_IN || '24h';

const AuthService = {
  async login(identifiant, password) {
    const user = await UserRepository.findByLogin(identifiant);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
  },

  generateToken(user) {
    return jwt.sign(
      {
        idUser: user.idUser, role: user.role, email: user.email, username: user.username,
        NumAgr: user.NumAgr || null, idAdh: user.idAdh || null,
      },
      SECRET(),
      { expiresIn: EXPIRES() }
    );
  },

  async hashPassword(password) {
    return bcrypt.hash(password, 10);
  },

  publicUser(user) {
    return {
      idUser: user.idUser, username: user.username, email: user.email, role: user.role,
      NumAgr: user.NumAgr || null, idAdh: user.idAdh || null,
    };
  },
};

module.exports = AuthService;
