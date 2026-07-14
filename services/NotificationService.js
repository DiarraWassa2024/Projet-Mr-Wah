const db = require('../config/database');

const NotificationService = {
  /** Crée une notification interne pour un utilisateur (insertion synchrone, pas de queue). */
  async notifier({ idUser, titre, contenu = null, type = 'systeme', lien = null }) {
    if (!idUser) return null;
    try {
      const [result] = await db.execute(
        `INSERT INTO SD_Notification (idUser, titre, contenu, type, lien) VALUES (?, ?, ?, ?, ?)`,
        [idUser, titre, contenu, type, lien]
      );
      return result.insertId;
    } catch (_) {
      return null; // une notification manquée ne doit jamais faire échouer l'action métier associée
    }
  },

  /** Résout l'idUser du/des compte(s) gestionnaire d'une organisation (pas les adhérents qui
   * partagent la même colonne NumAgr), pour la notifier d'un événement. */
  async idsUsersOrganisation(numAgr) {
    if (!numAgr) return [];
    const [rows] = await db.execute(
      `SELECT idUser FROM GPOTB_Users WHERE NumAgr = ? AND role = 'gestionnaire'`, [numAgr]
    );
    return rows.map(r => r.idUser);
  },

  /** Résout l'idUser du compte adhérent lié à un idAdh, pour le notifier d'un événement. */
  async idUserAdherent(idAdh) {
    if (!idAdh) return null;
    const [rows] = await db.execute(`SELECT idUser FROM GPOTB_Users WHERE idAdh = ? LIMIT 1`, [idAdh]);
    return rows[0]?.idUser || null;
  },
};

module.exports = NotificationService;
