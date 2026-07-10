const BaseRepository = require('./BaseRepository');
const QueryBuilder   = require('../helpers/queryBuilder');

class OpportuniteRepository extends BaseRepository {
  constructor() { super('SD_Opportunite', 'id'); }

  async findAll({ dateFrom, dateTo, categorie, domaine, pays, statut, numAgr, search } = {}) {
    const searchVal = search ? `%${search}%` : null;
    const { clause, params } = QueryBuilder.where([
      ['o.datePublication >= ?', dateFrom],
      ['o.datePublication <= ?', dateTo],
      ['o.categorie = ?',        categorie],
      ['o.domaine = ?',          domaine],
      ['o.pays = ?',             pays],
      ['o.statut = ?',           statut],
      ['o.numAgr = ?',           numAgr],
      ...(search ? [['(o.titre LIKE ? OR o.description LIKE ?)', [searchVal, searchVal]]] : []),
    ]);
    return this.query(`
      SELECT o.*, org.LibOrg
      FROM SD_Opportunite o
      LEFT JOIN GPOTB01_Organisation org ON org.NumAgr = o.numAgr
      ${clause}
      ORDER BY o.datePublication DESC
    `, params);
  }
}

module.exports = new OpportuniteRepository();
