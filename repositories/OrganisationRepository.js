const BaseRepository = require('./BaseRepository');
const QueryBuilder   = require('../helpers/queryBuilder');

class OrganisationRepository extends BaseRepository {
  constructor() { super('GPOTB01_Organisation', 'NumAgr'); }

  async findAll({ pays, statut, type, search } = {}) {
    const { clause, params } = QueryBuilder.where([
      ['o.CodePays = ?', pays],
      ['o.IdStatut = ?', statut],
      ['o.IdTypOrg = ?', type],
      ['(o.LibOrg LIKE ? OR o.NumAgr LIKE ?)', search ? [`%${search}%`, `%${search}%`] : null],
    ]);
    return this.query(`
      SELECT o.*, p.LibPays, p.DrapEau,
             t.LibTypOrg, v.LibVocOrg, s.LibStatut,
             (SELECT COUNT(*) FROM GPOTB02_Adherent  a WHERE a.NumAgr = o.NumAgr) AS nbAdherents,
             (SELECT COUNT(*) FROM GPOTB26_Document  d WHERE d.NumAgr = o.NumAgr) AS nbDocuments
      FROM GPOTB01_Organisation o
      LEFT JOIN GPOTB03_Pays p                 ON o.CodePays = p.CodePays
      LEFT JOIN GPOTB07_TypeOrganisation t     ON o.IdTypOrg = t.IdTypOrg
      LEFT JOIN GPOTB09_VocationOrganisation v ON o.IdVocOrg = v.IdVocOrg
      LEFT JOIN GPOTB15_Statut s               ON o.IdStatut = s.IdStatut
      ${clause}
      ORDER BY o.LibOrg
    `, params);
  }

  async findByIdFull(numAgr) {
    const org = await this.queryOne(`
      SELECT o.*, p.LibPays, p.DrapEau, t.LibTypOrg, v.LibVocOrg,
             s.LibStatut, r.NomRegleInt, m.LibMinistere
      FROM GPOTB01_Organisation o
      LEFT JOIN GPOTB03_Pays p                 ON o.CodePays   = p.CodePays
      LEFT JOIN GPOTB07_TypeOrganisation t     ON o.IdTypOrg   = t.IdTypOrg
      LEFT JOIN GPOTB09_VocationOrganisation v ON o.IdVocOrg   = v.IdVocOrg
      LEFT JOIN GPOTB15_Statut s               ON o.IdStatut   = s.IdStatut
      LEFT JOIN GPOTB10_ReglementInterieur r   ON o.IdRegleInt = r.IdRegleInt
      LEFT JOIN GPOTB28_Ministere m            ON o.IdMinistere = m.IdMinistere
      WHERE o.NumAgr = ?`, [numAgr]);
    if (!org) return null;

    const [adh]   = await this.db.execute('SELECT COUNT(*) AS n FROM GPOTB02_Adherent    WHERE NumAgr=?', [numAgr]);
    const [benef] = await this.db.execute('SELECT COUNT(*) AS n FROM GPOTB06_Beneficiaire WHERE NumAgr=?', [numAgr]);
    const docs    = await this.getDocuments(numAgr);
    const [dem]   = await this.db.execute(
      "SELECT 1 FROM SD_DemandeAdhesion WHERE numAgr=? AND statut='Acceptée' LIMIT 1", [numAgr]
    );

    return { ...org, nbAdherents: adh[0].n, nbBeneficiaires: benef[0].n, documents: docs, fromAdhesion: dem.length > 0 };
  }

  async findByIdWithStats(numAgr) { return this.findByIdFull(numAgr); }

  async generateNumAgr(codePays, typeCode) {
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 100; i++) {
      const rand   = Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
      const numAgr = `${codePays}-${typeCode}-${rand}`;
      const [rows] = await this.db.execute('SELECT 1 FROM GPOTB01_Organisation WHERE NumAgr=?', [numAgr]);
      if (!rows.length) return numAgr;
    }
    throw new Error('Impossible de générer un identifiant unique');
  }

  async getDocuments(numAgr) {
    const [rows] = await this.db.execute(
      `SELECT IdDoc, LibDoc, TypeDoc, CheminFichier, DateDocument, DateCreation
       FROM GPOTB26_Document WHERE NumAgr=? ORDER BY DateCreation DESC`,
      [numAgr]
    );
    return rows;
  }

  async getDocumentById(idDoc, numAgr) {
    const [rows] = await this.db.execute(
      `SELECT * FROM GPOTB26_Document WHERE IdDoc=? AND NumAgr=?`, [idDoc, numAgr]
    );
    return rows[0] || null;
  }

  async addDocument({ LibDoc, TypeDoc, CheminFichier, NumAgr, DateDocument }) {
    const now = new Date().toISOString().replace('T', ' ').split('.')[0];
    const [r] = await this.db.execute(
      `INSERT INTO GPOTB26_Document (LibDoc, TypeDoc, CheminFichier, NumAgr, DateDocument, DateCreation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [LibDoc, TypeDoc, CheminFichier, NumAgr, DateDocument, now]
    );
    return r.insertId;
  }

  async deleteDocument(idDoc) {
    await this.db.execute('DELETE FROM GPOTB26_Document WHERE IdDoc=?', [idDoc]);
  }
}

module.exports = new OrganisationRepository();
