/**
 * AuthService — logique métier d'authentification.
 * Découple la logique auth de la route Express.
 */
const bcrypt        = require('bcryptjs');
const jwt           = require('jsonwebtoken');
const crypto        = require('crypto');
const ms            = require('ms');
const UserRepository = require('../repositories/UserRepository');
const db             = require('../config/database');

const SECRET  = () => process.env.JWT_SECRET || 'gpo_secret';
const EXPIRES = () => process.env.JWT_EXPIRES_IN || '24h';

// ── Verrouillage anti-bruteforce (par identifiant tenté, indépendant de l'IP — complète le
// rate-limiter IP déjà en place dans middleware/rateLimiter.js) ────────────────────────────
const MAX_TENTATIVES   = 5;
const FENETRE_MINUTES  = 15; // au-delà, le compteur repart de zéro
const BLOCAGE_MINUTES  = 15;

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

  /** @returns {number|null} minutes restantes si bloqué, sinon null */
  async verifierBlocage(identifiant) {
    const [[row]] = await db.execute(`SELECT bloqueJusqu FROM SD_TentativeConnexion WHERE identifiant = ?`, [identifiant]);
    if (row?.bloqueJusqu && new Date(row.bloqueJusqu) > new Date()) {
      return Math.max(1, Math.ceil((new Date(row.bloqueJusqu) - new Date()) / 60000));
    }
    return null;
  },

  async enregistrerEchecConnexion(identifiant) {
    const now = new Date();
    const [[row]] = await db.execute(`SELECT * FROM SD_TentativeConnexion WHERE identifiant = ?`, [identifiant]);
    if (!row) {
      await db.execute(
        `INSERT INTO SD_TentativeConnexion (identifiant, nbTentatives, dateDerniereTentative) VALUES (?, 1, datetime('now'))`,
        [identifiant]
      );
      return;
    }
    const minutesEcoulees = (now - new Date(row.dateDerniereTentative)) / 60000;
    const nb = minutesEcoulees > FENETRE_MINUTES ? 1 : row.nbTentatives + 1;
    const bloqueJusqu = nb >= MAX_TENTATIVES ? new Date(now.getTime() + BLOCAGE_MINUTES * 60000).toISOString() : null;
    await db.execute(
      `UPDATE SD_TentativeConnexion SET nbTentatives=?, dateDerniereTentative=datetime('now'), bloqueJusqu=? WHERE identifiant=?`,
      [nb, bloqueJusqu, identifiant]
    );
  },

  async reinitialiserTentatives(identifiant) {
    await db.execute(`DELETE FROM SD_TentativeConnexion WHERE identifiant = ?`, [identifiant]);
  },

  async logHistoriqueConnexion(idUser, req, statutConnexion) {
    try {
      await db.execute(
        `INSERT INTO SD_HistoriqueConnexion (idUser, ipAdresse, userAgent, statutConnexion) VALUES (?,?,?,?)`,
        [idUser, req.ip || null, req.get?.('User-Agent') || null, statutConnexion]
      );
    } catch (_) {}
  },

  /** Journalise la session (hash du JWT, jamais le token en clair) — traçabilité, pas un store d'auth. */
  async creerSession(idUser, token, req) {
    try {
      const dateExpiration = new Date(Date.now() + ms(EXPIRES())).toISOString();
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await db.execute(
        `INSERT INTO SD_SessionUtilisateur (idUser, token, dateExpiration, ipAdresse, userAgent) VALUES (?,?,?,?,?)`,
        [idUser, tokenHash, dateExpiration, req.ip || null, req.get?.('User-Agent') || null]
      );
    } catch (_) {}
  },
};

module.exports = AuthService;
