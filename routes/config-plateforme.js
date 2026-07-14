const router = require('express').Router();
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const db     = require('../config/database');
const { ok, created, notFound, badRequest, serverError } = require('../helpers/response');

// Tout ce module est réservé à l'admin.
router.use(auth, roles('admin'));

// Clés connues avec leur valeur par défaut (repli tant qu'aucune ligne n'existe encore) — permet
// à l'écran de configuration d'afficher toutes les clés pertinentes même avant tout réglage.
const CLES_CONNUES = [
  { cle: 'PLATFORM_COMMISSION_PCT', description: 'Commission plateforme sur les dons (%)', defaut: () => require('../config/donation').DEFAULT_PCT },
  { cle: 'TAUX_REMBOURSEMENT_PCT',  description: 'Taux de remboursement partiel (%)',      defaut: () => require('../config/remboursement').DEFAULT_PCT },
];

// ── GET /api/config-plateforme — liste des réglages (connus + toute clé déjà en base) ──
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT * FROM SD_ConfigPlateforme ORDER BY cle`);
    const parClef = Object.fromEntries(rows.map(r => [r.cle, r]));
    const resultat = CLES_CONNUES.map(k => parClef[k.cle] || {
      cle: k.cle, valeur: String(k.defaut()), description: k.description, dateMaj: null,
    });
    // Ajoute toute clé déjà en base mais pas dans la liste connue (réglages ajoutés manuellement)
    for (const r of rows) if (!CLES_CONNUES.some(k => k.cle === r.cle)) resultat.push(r);
    ok(res, resultat);
  } catch (err) { serverError(res, err); }
});

// ── PUT /api/config-plateforme/:cle — crée ou met à jour un réglage ──
router.put('/:cle', async (req, res) => {
  const { valeur, description } = req.body;
  if (valeur === undefined || valeur === '') return badRequest(res, 'Valeur requise');
  try {
    const [[existing]] = await db.execute(`SELECT idConfig FROM SD_ConfigPlateforme WHERE cle = ?`, [req.params.cle]);
    if (existing) {
      await db.execute(
        `UPDATE SD_ConfigPlateforme SET valeur = ?, description = COALESCE(?, description), dateMaj = datetime('now'), idModificateur = ? WHERE cle = ?`,
        [valeur, description || null, req.user.idUser, req.params.cle]
      );
    } else {
      await db.execute(
        `INSERT INTO SD_ConfigPlateforme (cle, valeur, description, idModificateur) VALUES (?, ?, ?, ?)`,
        [req.params.cle, valeur, description || null, req.user.idUser]
      );
    }
    ok(res, { message: 'Réglage mis à jour' });
  } catch (err) { serverError(res, err); }
});

// ── Pages statiques (CGU, À propos, Confidentialité...) ──
router.get('/pages', async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT * FROM SD_PageStatique ORDER BY titre`);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

router.post('/pages', async (req, res) => {
  const { titre, slug, contenu, langue } = req.body;
  if (!titre || !slug) return badRequest(res, 'Titre et slug requis');
  try {
    const result = await db.execute(
      `INSERT INTO SD_PageStatique (titre, slug, contenu, langue) VALUES (?, ?, ?, ?)`,
      [titre, slug.trim().toLowerCase(), contenu || null, langue || 'fr']
    );
    created(res, { message: 'Page créée', id: result[0].insertId });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return badRequest(res, 'Ce slug existe déjà');
    serverError(res, err);
  }
});

router.put('/pages/:id', async (req, res) => {
  const { titre, contenu, langue } = req.body;
  try {
    await db.execute(
      `UPDATE SD_PageStatique SET titre = ?, contenu = ?, langue = ?, dateMaj = datetime('now') WHERE idPage = ?`,
      [titre, contenu || null, langue || 'fr', req.params.id]
    );
    ok(res, { message: 'Page mise à jour' });
  } catch (err) { serverError(res, err); }
});

router.delete('/pages/:id', async (req, res) => {
  try {
    await db.execute(`DELETE FROM SD_PageStatique WHERE idPage = ?`, [req.params.id]);
    ok(res, { message: 'Page supprimée' });
  } catch (err) { serverError(res, err); }
});

// ── Thème par pays ──
router.get('/themes', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT t.*, p.LibPays FROM SD_ThemePays t LEFT JOIN GPOTB03_Pays p ON p.CodePays = t.codePays ORDER BY p.LibPays`
    );
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

router.put('/themes/:codePays', async (req, res) => {
  const { couleurPrimaire, couleurSecondaire, logoPays } = req.body;
  try {
    const [[existing]] = await db.execute(`SELECT idTheme FROM SD_ThemePays WHERE codePays = ?`, [req.params.codePays]);
    if (existing) {
      await db.execute(
        `UPDATE SD_ThemePays SET couleurPrimaire = ?, couleurSecondaire = ?, logoPays = COALESCE(?, logoPays) WHERE codePays = ?`,
        [couleurPrimaire || null, couleurSecondaire || null, logoPays || null, req.params.codePays]
      );
    } else {
      await db.execute(
        `INSERT INTO SD_ThemePays (codePays, couleurPrimaire, couleurSecondaire, logoPays) VALUES (?, ?, ?, ?)`,
        [req.params.codePays, couleurPrimaire || null, couleurSecondaire || null, logoPays || null]
      );
    }
    ok(res, { message: 'Thème mis à jour' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
