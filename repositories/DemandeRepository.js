const BaseRepository = require('./BaseRepository');
const QueryBuilder   = require('../helpers/queryBuilder');

class DemandeRepository extends BaseRepository {
  constructor() { super('SD_DemandeAdhesion', 'idDemande'); }

  async findAll({ statut, typeOrg, codePays, ville, fonctionSouhaitee, search, dateFrom, dateTo, numAgr } = {}) {
    const searchVal = search ? `%${search}%` : null;
    const { clause, params } = QueryBuilder.where([
      ['d.statutAdhesion = ?',    statut],
      ['d.typeOrg = ?',           typeOrg],
      ['d.numAgr = ?',            numAgr],
      ['d.codePays = ?',          codePays],
      ['d.ville = ?',             ville],
      ['d.fonctionSouhaitee = ?', fonctionSouhaitee],
      ['d.dateDemande >= ?',      dateFrom],
      ['d.dateDemande <= ?',      dateTo ? QueryBuilder.endOfDay(dateTo) : null],
      ...(search ? [['(d.nomOrg LIKE ? OR d.repNom LIKE ? OR d.repPrenom LIKE ? OR d.emailOrg LIKE ? OR d.ville LIKE ?)',
                     [searchVal, searchVal, searchVal, searchVal, searchVal]]] : []),
    ]);
    return this.query(
      `SELECT d.*,
              o.LibOrg    AS nomOrgCible,
              t.LibTypOrg AS typeOrgCible,
              o.SiegeOrg  AS siegeOrgCible
       FROM SD_DemandeAdhesion d
       LEFT JOIN GPOTB01_Organisation o
              ON o.NumAgr = d.numAgr AND d.typeOrg = 'Individu'
       LEFT JOIN GPOTB07_TypeOrganisation t
              ON t.IdTypOrg = o.IdTypOrg
       ${clause} ORDER BY d.dateDemande DESC`,
      params
    );
  }

  async findById(id) {
    return this.queryOne(
      `SELECT d.*,
              o.LibOrg    AS nomOrgCible,
              t.LibTypOrg AS typeOrgCible,
              o.SiegeOrg  AS siegeOrgCible
       FROM SD_DemandeAdhesion d
       LEFT JOIN GPOTB01_Organisation o
              ON o.NumAgr = d.numAgr AND d.typeOrg = 'Individu'
       LEFT JOIN GPOTB07_TypeOrganisation t
              ON t.IdTypOrg = o.IdTypOrg
       WHERE d.idDemande = ?`,
      [id]
    );
  }

  async getStats(numAgr = null) {
    // Pour un gestionnaire (scope = son organisation), ne compter que les demandes individuelles
    // le concernant — pas la demande de création de sa propre organisation.
    const scope = numAgr ? " AND numAgr = ? AND typeOrg = 'Individu'" : '';
    const p = numAgr ? [numAgr] : [];
    const [[total]]      = await this.db.execute(`SELECT COUNT(*) AS n FROM SD_DemandeAdhesion WHERE 1=1${scope}`, p);
    const [[pending]]    = await this.db.execute(`SELECT COUNT(*) AS n FROM SD_DemandeAdhesion WHERE COALESCE(statutAdhesion,'En attente de validation')='En attente de validation'${scope}`, p);
    const [[actif]]      = await this.db.execute(`SELECT COUNT(*) AS n FROM SD_DemandeAdhesion WHERE statutAdhesion='Actif'${scope}`, p);
    const [[suspendu]]   = await this.db.execute(`SELECT COUNT(*) AS n FROM SD_DemandeAdhesion WHERE statutAdhesion='Suspendu'${scope}`, p);
    const [[radie]]      = await this.db.execute(`SELECT COUNT(*) AS n FROM SD_DemandeAdhesion WHERE statutAdhesion='Radié'${scope}`, p);
    const [[exclu]]      = await this.db.execute(`SELECT COUNT(*) AS n FROM SD_DemandeAdhesion WHERE statutAdhesion='Exclu'${scope}`, p);
    const [[dem]]        = await this.db.execute(`SELECT COUNT(*) AS n FROM SD_DemandeAdhesion WHERE statutAdhesion='Démissionnaire'${scope}`, p);
    const [[refuse]]     = await this.db.execute(`SELECT COUNT(*) AS n FROM SD_DemandeAdhesion WHERE statutAdhesion='Refusé'${scope}`, p);
    return {
      total:         total.n,
      pending:       pending.n,
      actif:         actif.n,
      suspendu:      suspendu.n,
      radie:         radie.n,
      exclu:         exclu.n,
      demissionnaire: dem.n,
      refuse:        refuse.n,
      cloture:       radie.n + exclu.n + dem.n + refuse.n,
      // compat dashboard
      accepted:      actif.n,
      refused:       refuse.n,
    };
  }

  async accept(id, adminUsername, now, ancienStatut, nouveauStatutAdhesion = 'Actif') {
    await this.update(id, {
      statut: 'Acceptée', statutAdhesion: nouveauStatutAdhesion,
      dateTraitement: now, adminTraitement: adminUsername,
    });
    await this.logHistorique(id, ancienStatut, nouveauStatutAdhesion, adminUsername, 'Demande acceptée');
  }

  async refuse(id, adminUsername, now, motif, ancienStatut) {
    await this.update(id, {
      statut: 'Refusée', statutAdhesion: 'Refusé',
      dateTraitement: now, adminTraitement: adminUsername,
      motifRefus: motif || null,
    });
    await this.logHistorique(id, ancienStatut, 'Refusé', adminUsername, motif || null);
  }

  async changeStatut(id, nouveauStatut, auteur, commentaire) {
    const dem = await this.findById(id);
    const ancienStatut = dem.statutAdhesion || 'En attente de validation';
    const now = new Date().toISOString().replace('T', ' ').split('.')[0];
    await this.update(id, {
      statutAdhesion:  nouveauStatut,
      dateTraitement:  now,
      adminTraitement: auteur,
    });
    await this.logHistorique(id, ancienStatut, nouveauStatut, auteur, commentaire);
    return { ancienStatut, nouveauStatut };
  }

  async logHistorique(idDemande, ancienStatut, nouveauStatut, auteur, commentaire) {
    const now = new Date().toISOString().replace('T', ' ').split('.')[0];
    await this.db.execute(
      `INSERT INTO SD_HistoriqueStatut
         (idDemande, ancienStatut, nouveauStatut, auteur, commentaire, dateChangement)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idDemande, ancienStatut || null, nouveauStatut, auteur || null, commentaire || null, now]
    );
  }

  async getHistoriqueStatut(idDemande) {
    return this.query(
      `SELECT * FROM SD_HistoriqueStatut WHERE idDemande = ? ORDER BY dateChangement ASC`,
      [idDemande]
    );
  }

  async getLogs() {
    return this.query(`
      SELECT l.*, d.nomOrg, d.typeOrg, d.statutAdhesion AS statut
      FROM SD_LogActivite l
      LEFT JOIN SD_DemandeAdhesion d ON l.id_cible = d.idDemande
      WHERE l.table_cible = 'SD_DemandeAdhesion'
      ORDER BY l.dateAction DESC LIMIT 100`);
  }
}

module.exports = new DemandeRepository();
