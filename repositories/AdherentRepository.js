const BaseRepository = require('./BaseRepository');
const QueryBuilder   = require('../helpers/queryBuilder');

class AdherentRepository extends BaseRepository {
  constructor() { super('GPOTB02_Adherent', 'idAdh'); }

  async findAll({ org, statut, search, pays, typeOrg } = {}) {
    const { clause, params } = QueryBuilder.where([
      ['a.NumAgr = ?',   org],
      ['a.IdStatut = ?', statut],
      ['a.CodePays = ?', pays],
      ['t.LibTypOrg = ?', typeOrg],
      ['(a.NomAdh LIKE ? OR a.PrenAdh LIKE ? OR a.NumAdherent LIKE ? OR a.EmailAdh LIKE ?)',
        search ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`] : null],
    ]);
    return this.query(`
      SELECT a.idAdh, a.NomAdh, a.PrenAdh, a.EmailAdh, a.TelAdh,
             a.DateAdhesion, a.NumAdherent, a.Photo, a.FonctionAdh,
             a.Profession, a.CodePays, a.IdStatut, a.NumAgr, a.IdRole,
             o.LibOrg, t.LibTypOrg, r.LibRole, s.LibStatut
      FROM GPOTB02_Adherent a
      LEFT JOIN GPOTB01_Organisation o ON a.NumAgr   = o.NumAgr
      LEFT JOIN GPOTB07_TypeOrganisation t ON t.IdTypOrg = o.IdTypOrg
      LEFT JOIN GPOTB11_Role r         ON a.IdRole   = r.IdRole
      LEFT JOIN GPOTB15_Statut s       ON a.IdStatut = s.IdStatut
      ${clause}
      ORDER BY a.NomAdh, a.PrenAdh
    `, params);
  }

  /** Toutes les adhésions (une par organisation) d'une même personne, reliées par son email. */
  async findAllByEmail(email) {
    return this.query(`
      SELECT a.idAdh, a.NumAgr, a.FonctionAdh, a.IdStatut, a.DateAdhesion,
             o.LibOrg, o.EmailOrg, o.TelOrg, o.SiegeOrg, t.LibTypOrg, p.LibPays, s.LibStatut
      FROM GPOTB02_Adherent a
      LEFT JOIN GPOTB01_Organisation o     ON a.NumAgr   = o.NumAgr
      LEFT JOIN GPOTB07_TypeOrganisation t ON t.IdTypOrg = o.IdTypOrg
      LEFT JOIN GPOTB03_Pays p             ON p.CodePays = o.CodePays
      LEFT JOIN GPOTB15_Statut s           ON a.IdStatut = s.IdStatut
      WHERE a.EmailAdh = ?
      ORDER BY a.DateAdhesion DESC
    `, [email]);
  }

  async findByIdFull(id) {
    const adh = await this.queryOne(`
      SELECT a.*, o.LibOrg, o.Logo AS OrgLogo, r.LibRole, s.LibStatut
      FROM GPOTB02_Adherent a
      LEFT JOIN GPOTB01_Organisation o ON a.NumAgr   = o.NumAgr
      LEFT JOIN GPOTB11_Role r         ON a.IdRole   = r.IdRole
      LEFT JOIN GPOTB15_Statut s       ON a.IdStatut = s.IdStatut
      WHERE a.idAdh = ?`, [id]);
    if (!adh) return null;

    const docs      = await this.getDocuments(id);
    const paiements = await this.query(
      'SELECT * FROM GPOTB08_Paiement WHERE idAdh = ? ORDER BY DatePaiement DESC', [id]
    );
    return { ...adh, documents: docs, paiements };
  }

  /** Le suffixe (YYYY) d'un adhérent déjà inscrit ailleurs sur la plateforme, à réutiliser pour
   * ses adhésions suivantes — seul l'identifiant d'organisation (préfixe) doit changer d'une
   * organisation à l'autre, le numéro d'adhérent de la personne reste le même partout. */
  async findSuffixByEmail(email) {
    if (!email) return null;
    const [rows] = await this.db.execute(
      `SELECT NumAdherent FROM GPOTB02_Adherent WHERE EmailAdh = ? ORDER BY idAdh ASC LIMIT 1`, [email]
    );
    if (!rows.length) return null;
    const parts = rows[0].NumAdherent.split('-');
    return parts[parts.length - 1];
  }

  async generateNumAdherent(numAgr, suffixeExistant = null) {
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    if (suffixeExistant) {
      const num = `${numAgr}-${suffixeExistant}`;
      const [rows] = await this.db.execute('SELECT 1 FROM GPOTB02_Adherent WHERE NumAdherent=?', [num]);
      if (!rows.length) return num;
      // Collision extrêmement improbable avec ce suffixe sur cette organisation précise :
      // on retombe sur la génération aléatoire ci-dessous plutôt que d'échouer.
    }
    for (let i = 0; i < 100; i++) {
      const rand = Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
      const num  = `${numAgr}-${rand}`;
      const [rows] = await this.db.execute('SELECT 1 FROM GPOTB02_Adherent WHERE NumAdherent=?', [num]);
      if (!rows.length) return num;
    }
    throw new Error('Impossible de générer un identifiant unique');
  }

  async getDocuments(idAdh) {
    const [rows] = await this.db.execute(
      `SELECT * FROM GPOTB32_DocumentAdherent WHERE idAdh=? ORDER BY DateCreation DESC`,
      [idAdh]
    );
    return rows;
  }

  async getDocumentById(idDocAdh, idAdh) {
    const [rows] = await this.db.execute(
      `SELECT * FROM GPOTB32_DocumentAdherent WHERE IdDocAdh=? AND idAdh=?`,
      [idDocAdh, idAdh]
    );
    return rows[0] || null;
  }

  async addDocument({ LibDocAdh, TypeDocAdh, CheminFichier, idAdh, DateDocument }) {
    const now = new Date().toISOString().replace('T', ' ').split('.')[0];
    const [r] = await this.db.execute(
      `INSERT INTO GPOTB32_DocumentAdherent
         (LibDocAdh, TypeDocAdh, CheminFichier, idAdh, DateDocument, DateCreation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [LibDocAdh, TypeDocAdh || 'Autre', CheminFichier, idAdh, DateDocument, now]
    );
    return r.insertId;
  }

  async deleteDocument(idDocAdh) {
    await this.db.execute('DELETE FROM GPOTB32_DocumentAdherent WHERE IdDocAdh=?', [idDocAdh]);
  }

  async addPaiement({ idAdh, MontantPaiement, TypePaiement, DatePaiement, Reference, CodeDevise, NotePaiement, NumAgr }) {
    const [r] = await this.db.execute(
      `INSERT INTO GPOTB08_Paiement
         (idAdh, MontantPaiement, TypePaiement, DatePaiement, Reference, CodeDevise, NotePaiement, Statut, NumAgr)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Validé', ?)`,
      [idAdh, MontantPaiement, TypePaiement || 'Cotisation', DatePaiement,
       Reference || null, CodeDevise || null, NotePaiement || null, NumAgr || null]
    );
    return r.insertId;
  }
}

module.exports = new AdherentRepository();
