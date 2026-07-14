// Pourcentage prélevé par la plateforme sur chaque don versé à une organisation.
// Le reste (100 - PLATFORM_COMMISSION_PCT) est crédité à l'organisation bénéficiaire.
module.exports = {
  PLATFORM_COMMISSION_PCT: Number(process.env.PLATFORM_COMMISSION_PCT) || 20,
};
