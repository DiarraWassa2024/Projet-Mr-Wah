const BaseRepository = require('./BaseRepository');
const QueryBuilder   = require('../helpers/queryBuilder');

class PrestataireMoralRepository extends BaseRepository {
  constructor() { super('GPOTB05_PrestataireMoral', 'rcc'); }

  async findAll({ pays, statut, search } = {}) {
    const { clause, params } = QueryBuilder.where([
      ['pm.CodePays = ?', pays],
      ['pm.IdStatut = ?', statut],
      ['(pm.NomOrg LIKE ? OR pm.rcc LIKE ?)', search ? [`%${search}%`, `%${search}%`] : null],
    ]);
    return this.query(`
      SELECT pm.*, p.LibPays, p.DrapEau, s.LibStatut,
             (SELECT COUNT(*) FROM GPOTB16_Prestation pr WHERE pr.rcc = pm.rcc) AS nbPrestations
      FROM GPOTB05_PrestataireMoral pm
      LEFT JOIN GPOTB03_Pays p   ON pm.CodePays = p.CodePays
      LEFT JOIN GPOTB15_Statut s ON pm.IdStatut = s.IdStatut
      ${clause}
      ORDER BY pm.NomOrg
    `, params);
  }

  async findByIdFull(rcc) {
    return this.queryOne(`
      SELECT pm.*, p.LibPays, p.DrapEau, s.LibStatut
      FROM GPOTB05_PrestataireMoral pm
      LEFT JOIN GPOTB03_Pays p   ON pm.CodePays = p.CodePays
      LEFT JOIN GPOTB15_Statut s ON pm.IdStatut = s.IdStatut
      WHERE pm.rcc = ?
    `, [rcc]);
  }

  async generateRcc(codePays) {
    const CHARS = '0123456789';
    for (let i = 0; i < 100; i++) {
      const rand = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
      const rcc  = `${codePays}-PM-${rand}`;
      const existing = await this.findById(rcc);
      if (!existing) return rcc;
    }
    throw new Error('Impossible de générer un identifiant unique');
  }
}

class PrestatairePhysiqueRepository extends BaseRepository {
  constructor() { super('GPOTB18_PrestatairePhysique', 'IdPrestataire'); }

  async findAll({ pays, statut, search } = {}) {
    const { clause, params } = QueryBuilder.where([
      ['pp.CodePays = ?', pays],
      ['pp.IdStatut = ?', statut],
      ['(pp.NomPrestataire LIKE ? OR pp.PrenPrestataire LIKE ?)', search ? [`%${search}%`, `%${search}%`] : null],
    ]);
    return this.query(`
      SELECT pp.*, p.LibPays, p.DrapEau, s.LibStatut
      FROM GPOTB18_PrestatairePhysique pp
      LEFT JOIN GPOTB03_Pays p   ON pp.CodePays = p.CodePays
      LEFT JOIN GPOTB15_Statut s ON pp.IdStatut = s.IdStatut
      ${clause}
      ORDER BY pp.NomPrestataire
    `, params);
  }

  async findByIdFull(id) {
    return this.queryOne(`
      SELECT pp.*, p.LibPays, p.DrapEau, s.LibStatut
      FROM GPOTB18_PrestatairePhysique pp
      LEFT JOIN GPOTB03_Pays p   ON pp.CodePays = p.CodePays
      LEFT JOIN GPOTB15_Statut s ON pp.IdStatut = s.IdStatut
      WHERE pp.IdPrestataire = ?
    `, [id]);
  }
}

module.exports = {
  moral:    new PrestataireMoralRepository(),
  physique: new PrestatairePhysiqueRepository(),
};
