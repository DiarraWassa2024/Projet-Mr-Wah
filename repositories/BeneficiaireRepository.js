const BaseRepository = require('./BaseRepository');
const QueryBuilder   = require('../helpers/queryBuilder');

class BeneficiaireRepository extends BaseRepository {
  constructor() { super('GPOTB06_Beneficiaire', 'idBenef'); }

  async findAll({ org, adherent, statut, search } = {}) {
    const { clause, params } = QueryBuilder.where([
      ['b.NumAgr = ?',   org],
      ['b.idAdh = ?',    adherent],
      ['b.IdStatut = ?', statut],
      ['(b.NomBenef LIKE ? OR b.PrenomBenef LIKE ? OR b.NumBenef LIKE ?)',
        search ? [`%${search}%`, `%${search}%`, `%${search}%`] : null],
    ]);
    return this.query(`
      SELECT b.idBenef, b.NomBenef, b.PrenomBenef, b.NumBenef, b.LienParente,
             b.DateNaissBenef, b.EmailBenef, b.TelBenef, b.Photo,
             b.IdStatut, b.NumAgr, b.idAdh, b.TypeBenef, b.Observations,
             b.CodePays, b.Nationalite,
             o.LibOrg,
             s.LibStatut,
             a.NomAdh, a.PrenAdh, a.NumAdherent
      FROM GPOTB06_Beneficiaire b
      LEFT JOIN GPOTB01_Organisation o ON b.NumAgr   = o.NumAgr
      LEFT JOIN GPOTB15_Statut s       ON b.IdStatut = s.IdStatut
      LEFT JOIN GPOTB02_Adherent a     ON b.idAdh    = a.idAdh
      ${clause}
      ORDER BY b.NomBenef, b.PrenomBenef
    `, params);
  }

  async findByIdFull(id) {
    return this.queryOne(`
      SELECT b.*,
             o.LibOrg, o.Logo AS OrgLogo,
             s.LibStatut,
             a.NomAdh, a.PrenAdh, a.NumAdherent, a.EmailAdh AS AdhEmail, a.DateAdhesion
      FROM GPOTB06_Beneficiaire b
      LEFT JOIN GPOTB01_Organisation o ON b.NumAgr   = o.NumAgr
      LEFT JOIN GPOTB15_Statut s       ON b.IdStatut = s.IdStatut
      LEFT JOIN GPOTB02_Adherent a     ON b.idAdh    = a.idAdh
      WHERE b.idBenef = ?`, [id]);
  }

  async countByAdherent(idAdh) {
    const [rows] = await this.db.execute(
      'SELECT COUNT(*) AS n FROM GPOTB06_Beneficiaire WHERE idAdh = ?', [idAdh]
    );
    return rows[0].n;
  }

  async generateNumBenef(numAdherent) {
    for (let kk = 1; kk <= 10; kk++) {
      const num = `${numAdherent}-${String(kk).padStart(2, '0')}`;
      const [rows] = await this.db.execute(
        'SELECT 1 FROM GPOTB06_Beneficiaire WHERE NumBenef = ?', [num]
      );
      if (!rows.length) return num;
    }
    throw new Error('Cet adhérent a atteint la limite de 10 bénéficiaires');
  }

  async getByAdherent(idAdh) {
    return this.query(`
      SELECT idBenef, NomBenef, PrenomBenef, NumBenef, LienParente, Photo, IdStatut
      FROM GPOTB06_Beneficiaire WHERE idAdh = ? ORDER BY NumBenef`, [idAdh]);
  }
}

module.exports = new BeneficiaireRepository();
