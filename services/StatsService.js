/**
 * StatsService — calcule les statistiques du dashboard.
 * Extrait la logique complexe hors de la route referentiels.js.
 */
const db = require('../config/database');

// Validate ISO date string to prevent SQL injection
function sanitizeDate(d) {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function dateCond(col, dateFrom, dateTo) {
  const parts = [];
  if (dateFrom) parts.push(`${col} >= '${dateFrom}'`);
  if (dateTo)   parts.push(`${col} <= '${dateTo}'`);
  return parts.length ? ' WHERE ' + parts.join(' AND ') : '';
}
function dateAnd(col, dateFrom, dateTo) {
  const parts = [];
  if (dateFrom) parts.push(`${col} >= '${dateFrom}'`);
  if (dateTo)   parts.push(`${col} <= '${dateTo}'`);
  return parts.length ? ' AND ' + parts.join(' AND ') : '';
}

const StatsService = {
  async getDashboardStats({ dateFrom, dateTo } = {}) {
    dateFrom = sanitizeDate(dateFrom);
    dateTo   = sanitizeDate(dateTo);
    const [[orgs]]   = await db.execute(`SELECT COUNT(*) AS total FROM GPOTB01_Organisation${dateCond('DateCreOrg', dateFrom, dateTo)}`);
    const [[adhs]]   = await db.execute(`SELECT COUNT(*) AS total FROM GPOTB02_Adherent${dateCond('DateAdhesion', dateFrom, dateTo)}`);
    const [[benefs]] = await db.execute('SELECT COUNT(*) AS total FROM GPOTB06_Beneficiaire');
    const [[pays]]   = await db.execute(`SELECT SUM(MontantPaiement) AS total FROM GPOTB08_Paiement${dateCond('DatePaiement', dateFrom, dateTo)}`);
    const [[prest]]  = await db.execute(`SELECT COUNT(*) AS total FROM GPOTB16_Prestation${dateCond('DatePrest', dateFrom, dateTo)}`);
    const [[even]]   = await db.execute(`SELECT COUNT(*) AS total FROM GPOTB21_Evenement${dateCond("DATE(Heuraux)", dateFrom, dateTo)}`);

    const [orgsByPays] = await db.execute(`
      SELECT p.LibPays, COUNT(o.NumAgr) AS total
      FROM GPOTB03_Pays p
      LEFT JOIN GPOTB01_Organisation o ON o.CodePays = p.CodePays
        ${dateFrom || dateTo ? `AND (o.DateCreOrg IS NULL${dateAnd('o.DateCreOrg', dateFrom, dateTo)})` : ''}
      GROUP BY p.CodePays, p.LibPays ORDER BY total DESC`);

    const [recentPaiements] = await db.execute(`
      SELECT pa.*, a.NomAdh, o.LibOrg
      FROM GPOTB08_Paiement pa
      LEFT JOIN GPOTB02_Adherent a ON pa.idAdh = a.idAdh
      LEFT JOIN GPOTB01_Organisation o ON pa.NumAgr = o.NumAgr
      ${dateCond('pa.DatePaiement', dateFrom, dateTo)}
      ORDER BY pa.DatePaiement DESC LIMIT 8`);

    const [recentAdherents] = await db.execute(`
      SELECT a.idAdh, a.NomAdh, a.PrenAdh, a.DateAdhesion, o.LibOrg
      FROM GPOTB02_Adherent a
      LEFT JOIN GPOTB01_Organisation o ON a.NumAgr = o.NumAgr
      ${dateCond('a.DateAdhesion', dateFrom, dateTo)}
      ORDER BY a.idAdh DESC LIMIT 5`);

    const [monthlyPaiements] = await db.execute(`
      SELECT strftime('%Y-%m', DatePaiement) AS mois,
             COUNT(*) AS nb,
             COALESCE(SUM(MontantPaiement), 0) AS montant
      FROM GPOTB08_Paiement
      WHERE DatePaiement >= date('now', '-6 months')
        ${dateFrom ? `AND DatePaiement >= '${dateFrom}'` : ''}
        ${dateTo   ? `AND DatePaiement <= '${dateTo}'`   : ''}
      GROUP BY mois ORDER BY mois ASC`);

    const [topOrgs] = await db.execute(`
      SELECT o.LibOrg, COUNT(pa.IdPaiement) AS nbPaiements,
             COALESCE(SUM(pa.MontantPaiement), 0) AS total
      FROM GPOTB01_Organisation o
      LEFT JOIN GPOTB08_Paiement pa ON o.NumAgr = pa.NumAgr
        ${dateFrom ? `AND pa.DatePaiement >= '${dateFrom}'` : ''}
        ${dateTo   ? `AND pa.DatePaiement <= '${dateTo}'`   : ''}
      GROUP BY o.NumAgr, o.LibOrg
      ORDER BY total DESC LIMIT 5`);

    // ── Dons ──────────────────────────────────────────────────────
    const [[donsAgg]] = await db.execute(`
      SELECT COUNT(*) AS nb, COALESCE(SUM(montant),0) AS montant
      FROM SD_Don${dateCond('dateDon', dateFrom, dateTo)}`);

    const [recentDons] = await db.execute(`
      SELECT * FROM SD_Don
      ${dateCond('dateDon', dateFrom, dateTo)}
      ORDER BY dateDon DESC LIMIT 6`);

    const [monthlyDons] = await db.execute(`
      SELECT strftime('%Y-%m', dateDon) AS mois,
             COALESCE(SUM(montant), 0) AS montant
      FROM SD_Don
      WHERE dateDon >= date('now', '-6 months')
        ${dateFrom ? `AND dateDon >= '${dateFrom}'` : ''}
        ${dateTo   ? `AND dateDon <= '${dateTo}'`   : ''}
      GROUP BY mois ORDER BY mois ASC`);

    // ── Opportunités ───────────────────────────────────────────────
    const [[oppsAgg]] = await db.execute(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN statut='Active' THEN 1 ELSE 0 END) AS actives
      FROM SD_Opportunite
      ${dateCond('datePublication', dateFrom, dateTo)}`);

    const [oppsByStatut] = await db.execute(`
      SELECT statut, COUNT(*) AS nb
      FROM SD_Opportunite
      ${dateCond('datePublication', dateFrom, dateTo)}
      GROUP BY statut`);

    const [recentOpportunites] = await db.execute(`
      SELECT * FROM SD_Opportunite
      ${dateCond('datePublication', dateFrom, dateTo)}
      ORDER BY datePublication DESC LIMIT 5`);

    // ── Adhérents par pays ─────────────────────────────────────────
    const [adherentsByPays] = await db.execute(`
      SELECT p.LibPays, COUNT(a.idAdh) AS nb
      FROM GPOTB03_Pays p
      LEFT JOIN GPOTB01_Organisation o ON o.CodePays = p.CodePays
      LEFT JOIN GPOTB02_Adherent a ON a.NumAgr = o.NumAgr
        ${dateFrom || dateTo ? `AND (a.DateAdhesion IS NULL${dateAnd('a.DateAdhesion', dateFrom, dateTo)})` : ''}
      GROUP BY p.CodePays, p.LibPays
      HAVING nb > 0
      ORDER BY nb DESC LIMIT 8`);

    // ── Adhérents mensuels ─────────────────────────────────────────
    const [monthlyAdherents] = await db.execute(`
      SELECT strftime('%Y-%m', DateAdhesion) AS mois,
             COUNT(*) AS nb
      FROM GPOTB02_Adherent
      WHERE DateAdhesion >= date('now', '-6 months')
        ${dateFrom ? `AND DateAdhesion >= '${dateFrom}'` : ''}
        ${dateTo   ? `AND DateAdhesion <= '${dateTo}'`   : ''}
      GROUP BY mois ORDER BY mois ASC`);

    // ── Cotisations ────────────────────────────────────────────────
    const [[cotisAgg]] = await db.execute(`
      SELECT COUNT(*) AS nb, COALESCE(SUM(MontantCoti),0) AS montant
      FROM GPOTB14_Cotisation${dateCond('DateEcheance', dateFrom, dateTo)}`);

    return {
      organisations:       orgs.total       || 0,
      adherents:           adhs.total       || 0,
      beneficiaires:       benefs.total     || 0,
      totalPaiements:      pays.total       || 0,
      prestations:         prest.total      || 0,
      evenements:          even.total       || 0,
      donsTotal:           donsAgg.montant  || 0,
      donsNb:              donsAgg.nb       || 0,
      opportunitesTotal:   oppsAgg.total    || 0,
      opportunitesActives: oppsAgg.actives  || 0,
      cotisationsNb:       cotisAgg.nb      || 0,
      cotisationsMontant:  cotisAgg.montant || 0,
      orgsByPays, recentPaiements, recentAdherents, monthlyPaiements, topOrgs,
      monthlyDons, recentDons, monthlyAdherents, adherentsByPays,
      oppsByStatut, recentOpportunites,
      dateFrom: dateFrom || null,
      dateTo:   dateTo   || null,
    };
  },
};

module.exports = StatsService;
