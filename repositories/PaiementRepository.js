const BaseRepository = require('./BaseRepository');
const QueryBuilder   = require('../helpers/queryBuilder');

class PaiementRepository extends BaseRepository {
  constructor() { super('GPOTB08_Paiement', 'IdPaiement'); }

  async findAll({ org, adh, type, statut, pays, devise, dateFrom, dateTo, search } = {}) {
    const sv = search ? `%${search}%` : null;
    const { clause, params } = QueryBuilder.where([
      ['pa.NumAgr = ?',          org],
      ['pa.idAdh = ?',           adh],
      ['pa.TypePaiement = ?',    type],
      ['pa.Statut = ?',          statut],
      ['pa.CodePays = ?',        pays],
      ['pa.CodeDevise = ?',      devise],
      ['pa.DatePaiement >= ?',   dateFrom],
      ['pa.DatePaiement <= ?',   dateTo],
      ...(sv ? [['(pa.Reference LIKE ? OR pa.NumRecu LIKE ? OR a.NomAdh LIKE ? OR o.LibOrg LIKE ?)', [sv,sv,sv,sv]]] : []),
    ]);
    return this.query(`
      SELECT pa.*,
             a.NomAdh, a.PrenAdh, a.EmailAdh, a.TelAdh,
             o.LibOrg,
             p.LibPays,
             mp.LibMoyPay,
             d.LibDevise, d.Symbole AS SymDevise
      FROM GPOTB08_Paiement pa
      LEFT JOIN GPOTB02_Adherent a       ON pa.idAdh     = a.idAdh
      LEFT JOIN GPOTB01_Organisation o   ON pa.NumAgr    = o.NumAgr
      LEFT JOIN GPOTB03_Pays p           ON pa.CodePays  = p.CodePays
      LEFT JOIN GPOTB13_MoyenPaiement mp ON pa.IdMoyPay  = mp.IdMoyPay
      LEFT JOIN GPOTB27_Devise d         ON pa.CodeDevise = d.CodeDevise
      ${clause}
      ORDER BY pa.DatePaiement DESC, pa.IdPaiement DESC
    `, params);
  }

  async findByIdFull(id) {
    const rows = await this.query(`
      SELECT pa.*,
             a.NomAdh, a.PrenAdh, a.EmailAdh, a.TelAdh,
             o.LibOrg,
             p.LibPays,
             mp.LibMoyPay,
             d.LibDevise, d.Symbole AS SymDevise
      FROM GPOTB08_Paiement pa
      LEFT JOIN GPOTB02_Adherent a       ON pa.idAdh     = a.idAdh
      LEFT JOIN GPOTB01_Organisation o   ON pa.NumAgr    = o.NumAgr
      LEFT JOIN GPOTB03_Pays p           ON pa.CodePays  = p.CodePays
      LEFT JOIN GPOTB13_MoyenPaiement mp ON pa.IdMoyPay  = mp.IdMoyPay
      LEFT JOIN GPOTB27_Devise d         ON pa.CodeDevise = d.CodeDevise
      WHERE pa.IdPaiement = ?
    `, [id]);
    return rows[0] || null;
  }

  async stats({ org, dateFrom, dateTo } = {}) {
    const db = require('../config/database');
    const cond = [], p = [];
    if (org)      { cond.push('NumAgr = ?');        p.push(org); }
    if (dateFrom) { cond.push('DatePaiement >= ?'); p.push(dateFrom); }
    if (dateTo)   { cond.push('DatePaiement <= ?'); p.push(dateTo); }
    const W = cond.length ? 'WHERE ' + cond.join(' AND ') : '';

    const [[tot]] = await db.execute(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(MontantPaiement),0) AS montantTotal,
        COALESCE(SUM(CASE WHEN Statut='Payé'       THEN MontantPaiement ELSE 0 END),0) AS montantPaye,
        COALESCE(SUM(CASE WHEN Statut='Impayé'     THEN MontantPaiement ELSE 0 END),0) AS montantImpaye,
        COALESCE(SUM(CASE WHEN Statut='En attente' THEN MontantPaiement ELSE 0 END),0) AS montantAttente,
        COUNT(CASE WHEN Statut='Payé'       THEN 1 END) AS nbPaye,
        COUNT(CASE WHEN Statut='Impayé'     THEN 1 END) AS nbImpaye,
        COUNT(CASE WHEN Statut='En attente' THEN 1 END) AS nbAttente,
        COUNT(CASE WHEN TypePaiement='Don'        THEN 1 END) AS nbDons,
        COUNT(CASE WHEN TypePaiement='Adhésion'   THEN 1 END) AS nbAdhesions,
        COUNT(CASE WHEN TypePaiement='Cotisation' THEN 1 END) AS nbCotisations,
        COUNT(CASE WHEN TypePaiement='Abonnement' THEN 1 END) AS nbAbonnements
      FROM GPOTB08_Paiement ${W}`, p);

    const [byType]  = await db.execute(`SELECT TypePaiement AS type, COUNT(*) AS nb, COALESCE(SUM(MontantPaiement),0) AS montant FROM GPOTB08_Paiement ${W} GROUP BY TypePaiement ORDER BY montant DESC`, p);
    const [byStatut]= await db.execute(`SELECT Statut AS statut, COUNT(*) AS nb, COALESCE(SUM(MontantPaiement),0) AS montant FROM GPOTB08_Paiement ${W} GROUP BY Statut ORDER BY nb DESC`, p);
    const [byPays]  = await db.execute(`SELECT COALESCE(CodePays,'—') AS pays, COUNT(*) AS nb, COALESCE(SUM(MontantPaiement),0) AS montant FROM GPOTB08_Paiement ${W} GROUP BY CodePays ORDER BY montant DESC LIMIT 8`, p);
    const [byDevise]= await db.execute(`SELECT COALESCE(CodeDevise,'FCFA') AS devise, COUNT(*) AS nb, COALESCE(SUM(MontantPaiement),0) AS montant FROM GPOTB08_Paiement ${W} GROUP BY CodeDevise ORDER BY montant DESC`, p);

    const monthWhere = W ? W + ' AND DatePaiement >= date(\'now\',\'-6 months\')' : 'WHERE DatePaiement >= date(\'now\',\'-6 months\')';
    const [monthly] = await db.execute(`SELECT strftime('%Y-%m', DatePaiement) AS mois, COALESCE(SUM(MontantPaiement),0) AS montant, COUNT(*) AS nb FROM GPOTB08_Paiement ${monthWhere} ${W ? 'AND' : 'AND'} DatePaiement IS NOT NULL GROUP BY mois ORDER BY mois`, p);

    return { ...tot, byType, byStatut, byPays, byDevise, monthly };
  }

  async updatePaiement(id, data) {
    const { DatePaiement, MontantPaiement, Statut, TypePaiement, idAdh, IdMoyPay,
            NumAgr, Reference, CodeDevise, CodePays, NotePaiement, DateEcheance, ObjetPaiement } = data;
    return this.update(id, {
      DatePaiement, MontantPaiement, Statut: Statut || 'En attente',
      TypePaiement: TypePaiement || 'Cotisation',
      idAdh: idAdh || null, IdMoyPay: IdMoyPay || null, NumAgr: NumAgr || null,
      Reference: Reference || null, CodeDevise: CodeDevise || null,
      CodePays: CodePays || null, NotePaiement: NotePaiement || null,
      DateEcheance: DateEcheance || null, ObjetPaiement: ObjetPaiement || null,
    });
  }
}

module.exports = new PaiementRepository();
