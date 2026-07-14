// Pourcentage prélevé par la plateforme sur chaque don versé à une organisation.
// Le reste (100 - PLATFORM_COMMISSION_PCT) est crédité à l'organisation bénéficiaire.
//
// Modifiable depuis l'admin sans redéploiement (SD_ConfigPlateforme, clé PLATFORM_COMMISSION_PCT) —
// la valeur d'environnement ne sert que de repli tant qu'aucune ligne n'existe encore en base.
const DEFAULT_PCT = Number(process.env.PLATFORM_COMMISSION_PCT) || 20;

function getCommissionPct() {
  try {
    const db = require('./database').raw;
    const row = db.prepare(`SELECT valeur FROM SD_ConfigPlateforme WHERE cle = 'PLATFORM_COMMISSION_PCT'`).get();
    return row ? Number(row.valeur) : DEFAULT_PCT;
  } catch (_) {
    return DEFAULT_PCT;
  }
}

module.exports = { getCommissionPct, DEFAULT_PCT };
