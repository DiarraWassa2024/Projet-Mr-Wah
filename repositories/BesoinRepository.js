const BaseRepository = require('./BaseRepository');
const QueryBuilder   = require('../helpers/queryBuilder');

class BesoinRepository extends BaseRepository {
  constructor() { super('SD_BesoinExprime', 'IdDemande'); }

  async findAll({ dateFrom, dateTo, statut, search, numAgr } = {}) {
    const searchVal = search ? `%${search}%` : null;
    const { clause, params } = QueryBuilder.where([
      ['DateDemande >= ?',       dateFrom],
      ['DateDemande <= ?',       dateTo ? QueryBuilder.endOfDay(dateTo) : null],
      ['statut = ?',             statut],
      ['numAgr = ?',             numAgr],
      ...(search ? [['(nom LIKE ? OR email LIKE ?)', [searchVal, searchVal]]] : []),
    ]);
    return this.query(`
      SELECT IdDemande AS idBesoin, nom, email, typeBesoin, typeEntite,
             description, statut, organisation, numAgr, DateDemande AS dateDemande, dateTraitement, adminTraitement
      FROM SD_BesoinExprime
      ${clause}
      ORDER BY DateDemande DESC
    `, params);
  }

  async markTraited(id, adminUsername, now) {
    return this.update(id, {
      statut: 'Traité', dateTraitement: now, adminTraitement: adminUsername,
    });
  }
}

module.exports = new BesoinRepository();
