const Policy = require('./Policy');

class DemandePolicy extends Policy {
  /** Seul l'admin peut accepter ou refuser une demande */
  canAccept(user) { return this.isAdmin(user); }
  canRefuse(user) { return this.isAdmin(user); }

  /** Le staff peut lire les demandes */
  canRead(user) { return this.isStaff(user); }

  /** Seul l'admin voit les logs de traitement */
  canViewLogs(user) { return this.isAdmin(user); }
}

module.exports = new DemandePolicy();
