const Policy = require('./Policy');

class UtilisateurPolicy extends Policy {
  /** Seul l'admin gère les utilisateurs */
  canManage(user) { return this.isAdmin(user); }

  /** Protection du dernier admin : on ne peut pas le supprimer */
  canDelete(user, targetRole, adminCount) {
    if (!this.isAdmin(user)) return false;
    if (targetRole === 'admin' && adminCount <= 1) return false;
    return true;
  }
}

module.exports = new UtilisateurPolicy();
