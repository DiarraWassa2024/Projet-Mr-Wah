const router       = require('express').Router();
const db           = require('../config/database');
const StatsService = require('../services/StatsService');
const { ok, serverError } = require('../helpers/response');

const tables = {
  types_org:   ['GPOTB07_TypeOrganisation',        'IdTypOrg',     'LibTypOrg'],
  vocations:   ['GPOTB09_VocationOrganisation',     'IdVocOrg',     'LibVocOrg'],
  roles:       ['GPOTB11_Role',                     'IdRole',       'LibRole'],
  sexes:       ['GPOTB12_Sexe',                     'IdSexe',       'LibSexe'],
  moyens_pay:  ['GPOTB13_MoyenPaiement',            'IdMoyPay',     'LibMoyPay'],
  statuts:     ['GPOTB15_Statut',                   'IdStatut',     'LibStatut'],
  types_prest: ['GPOTB17_TypePrestation',           'IdTypPrest',   'LibTypPrest'],
  pieces_id:   ['GPOTB19_PieceIdentite',            'IdPieceIdenti','LibPieceIdenti'],
  sit_matri:   ['GPOTB20_SituationMatrimoniale',    'IdSituMat',    'LibSituMat'],
  filiations:  ['GPOTB22_Filiation',                'idFil',        'LibFil'],
  types_fil:   ['GPOTB23_TypeFiliation',            'idTypFil',     'LibTypFil'],
  reglements:  ['GPOTB10_ReglementInterieur',       'IdRegleInt',   'NomRegleInt'],
  pays:        ['GPOTB03_Pays',                     'CodePays',     'LibPays'],
  devises:     ['GPOTB27_Devise',                   'CodeDevise',   'LibDevise'],
  types_benef: null, // custom (voir ci-dessous)
};

// IMPORTANT : les routes statiques doivent précéder /:name

router.get('/dashboard/stats', async (req, res) => {
  try {
    ok(res, await StatsService.getDashboardStats(req.query));
  } catch (err) { serverError(res, err); }
});

// Devises avec champs complets (symbole, taux)
router.get('/devises', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT CodeDevise AS code, LibDevise AS lib, Symbole AS symbole, TauxParRapportEuro AS taux
       FROM GPOTB27_Devise WHERE EstActif = 1 ORDER BY LibDevise`
    );
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// Ministères — tous ou filtrés par pays (?codePays=CIV)
router.get('/ministeres', async (req, res) => {
  try {
    const { codePays } = req.query;
    const sql = codePays
      ? `SELECT IdMinistere AS id, LibMinistere AS lib, CodePays AS codePays, Domaine AS domaine
         FROM GPOTB28_Ministere WHERE CodePays = ? ORDER BY LibMinistere`
      : `SELECT IdMinistere AS id, LibMinistere AS lib, CodePays AS codePays, Domaine AS domaine
         FROM GPOTB28_Ministere ORDER BY CodePays, LibMinistere`;
    const [rows] = await db.execute(sql, codePays ? [codePays] : []);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

router.get('/:name', async (req, res) => {
  const entry = tables[req.params.name];
  if (!entry || entry === null) return res.status(404).json({ message: 'Référentiel inconnu' });
  const [table, idCol, libCol] = entry;
  try {
    const [rows] = await db.execute(`SELECT ${idCol} AS id, ${libCol} AS lib FROM ${table} ORDER BY ${libCol}`);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

module.exports = router;
