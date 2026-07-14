const router             = require('express').Router();
const db                 = require('../config/database');
const multer             = require('multer');
const path               = require('path');
const fs                 = require('fs');
const PaymentService     = require('../services/payment/PaymentService');
const PaiementRepository = require('../repositories/PaiementRepository');
const OrganisationRepository = require('../repositories/OrganisationRepository');
const DemandeService     = require('../services/DemandeService');
const { getFormulesCotisation, deviseDuPays, genererCodeConfirmationUnique } = DemandeService;
const { PLATFORM_COMMISSION_PCT } = require('../config/donation');
const NotificationService = require('../services/NotificationService');
const AdherentRepository  = require('../repositories/AdherentRepository');

const TYPE_ORG_ID   = { 'Association': 1, 'ONG': 2, 'Mutuelle': 6 };
const TYPE_ORG_CODE = { 'Association': 'ASS', 'ONG': 'ONG', 'Mutuelle': 'MUT' };

// ── File upload config ────────────────────────────────────────
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext    = path.extname(file.originalname);
    const prefix = file.fieldname === 'logo' ? 'orglogo_' : 'agr_';
    cb(null, `${prefix}${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = file.fieldname === 'logo'
      ? ['.jpg','.jpeg','.png','.webp','.svg']
      : ['.pdf','.jpg','.jpeg','.png'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// POST /api/public/adhesion  (multipart/form-data) — inscription d'une organisation
// L'organisation est créée immédiatement (statut "en attente") et paie sa cotisation
// tout de suite ; l'admin (ou un gestionnaire existant) valide ensuite le dossier.
router.post('/adhesion', upload.fields([
  { name: 'docAgrement', maxCount: 1 },
  { name: 'logo',        maxCount: 1 },
]), async (req, res) => {
  try {
    const b = req.body;
    const {
      type, nom, email, tel, pays, libPays, siege, dateCrea, description, numAgr: numAgrSaisi,
      repNom, repPrenom, repFonction, repAdresse, repTel, repEmail,
      repSexe, prenom, ministere, siteWeb,
    } = b;

    const nomOrg = nom || `${b.nomPhys||''} ${prenom||''}`.trim();
    if (!nomOrg)   return res.status(400).json({ message: 'Nom obligatoire' });
    if (!type)     return res.status(400).json({ message: "Type d'adhésion obligatoire" });
    if (!email)    return res.status(400).json({ message: 'Email obligatoire' });
    if (!repSexe)  return res.status(400).json({ message: 'Le sexe du déclarant est obligatoire' });
    if (!pays)     return res.status(400).json({ message: 'Le pays est obligatoire' });
    if (await DemandeService.emailDejaUtilise(email))
      return res.status(409).json({ message: "Cet email est déjà utilisé sur la plateforme — un email ne peut servir qu'à une seule inscription." });
    if (dateCrea) {
      const dc = new Date(dateCrea);
      if (isNaN(dc.getTime())) return res.status(400).json({ message: 'Date de création invalide' });
      if (dc > new Date())     return res.status(400).json({ message: 'La date de création ne peut pas être dans le futur' });
    }

    const docAgrement = req.files?.docAgrement?.[0] ? `/uploads/${req.files.docAgrement[0].filename}` : null;
    const logo         = req.files?.logo?.[0]        ? `/uploads/${req.files.logo[0].filename}`        : null;
    const now = new Date().toISOString().replace('T',' ').split('.')[0];

    // Identifiant plateforme généré automatiquement (le champ "numéro d'agrément" saisi par
    // l'organisation, s'il existe, est conservé dans la description — ce n'est pas notre clé interne).
    const typeCode = TYPE_ORG_CODE[type] || 'ASS';
    const numAgr = await OrganisationRepository.generateNumAgr(pays, typeCode);
    const descriptionComplete = numAgrSaisi
      ? `${description || ''}${description ? '\n' : ''}Numéro d'agrément déclaré : ${numAgrSaisi}`.trim()
      : (description || null);

    // Organisation créée tout de suite (en attente de validation admin) pour pouvoir régler la cotisation
    await OrganisationRepository.create({
      NumAgr: numAgr,
      LibOrg: nomOrg,
      CodePays: pays,
      IdTypOrg: TYPE_ORG_ID[type] || null,
      DateCreOrg: dateCrea || null,
      SiegeOrg: siege || null,
      EmailOrg: email,
      TelOrg: tel || repTel || null,
      SiteWeb: siteWeb || null,
      Description: descriptionComplete,
      NomRepresentant: [repPrenom, repNom].filter(Boolean).join(' ') || null,
      FonctionRepresentant: repFonction || null,
      Logo: logo,
      IdStatut: 4,
    });

    const [result] = await db.execute(
      `INSERT INTO SD_DemandeAdhesion
         (typeOrg, nomOrg, numAgr, emailOrg, telOrg, codePays, libPays,
          siegeOrg, dateCrea, description, ministere, docAgrement,
          repNom, repPrenom, repFonction, repAdresse, repTel, repEmail, repSexe, dateDemande)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, nomOrg, numAgr, email, tel||null, pays, libPays||null,
       siege||null, dateCrea||null, descriptionComplete, ministere||null, docAgrement,
       repNom||null, repPrenom||null, repFonction||null,
       repAdresse||null, repTel||null, repEmail||null, repSexe||null, now]
    );
    const idDemande = result.insertId;

    // Cotisation à régler immédiatement (avant même la revue de l'admin)
    const codeDevise = deviseDuPays(pays);
    const formules    = await getFormulesCotisation(numAgr, codeDevise);
    const codeConfirmation = await genererCodeConfirmationUnique();

    const payResult = await PaiementRepository.create({
      DatePaiement: now.split(' ')[0],
      MontantPaiement: formules.Annuelle,
      Statut: 'En attente',
      TypePaiement: 'Adhésion',
      NumAgr: numAgr,
      CodeDevise: formules.CodeDevise,
      CodePays: pays,
      idDemande,
      ObjetPaiement: "Cotisation d'inscription — SoliDev",
      CodeConfirmation: codeConfirmation,
    });

    res.status(201).json({
      message: `Votre demande d'adhésion (${type}) a bien été reçue. Réglez votre cotisation ci-dessous pour finaliser votre inscription.`,
      id: idDemande,
      numAgr,
      idPaiement: payResult.insertId,
      montant: formules.Annuelle,
      codeDevise: formules.CodeDevise,
      codePays: pays,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/public/besoins
router.post('/besoins', async (req, res) => {
  try {
    const { nom, email, typeBesoin, description, typeEntite } = req.body;
    if (!nom)         return res.status(400).json({ message: 'Nom obligatoire' });
    if (!description) return res.status(400).json({ message: 'Description obligatoire' });
    if (!email)       return res.status(400).json({ message: 'Email obligatoire' });

    const now = new Date().toISOString().replace('T',' ').split('.')[0];
    const [result] = await db.execute(
      `INSERT INTO SD_BesoinExprime (nom, email, typeBesoin, typeEntite, description, DateDemande)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nom, email, typeBesoin||null, typeEntite||null, description, now]
    );

    res.status(201).json({
      message: 'Votre besoin a été enregistré avec succès',
      id: result.insertId,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/public/organisations — organisations actives pour la recherche (public, sans auth)
router.get('/organisations', async (req, res) => {
  try {
    const { search, type, pays, ville, page = '0', all } = req.query;
    const limit  = 20;
    const offset = Math.max(0, parseInt(page) || 0) * limit;

    let where = `o.IdStatut = 1`;
    const params = [];

    if (search?.trim()) { where += ` AND o.LibOrg LIKE ?`;      params.push(`%${search.trim()}%`); }
    if (type)            { where += ` AND t.LibTypOrg = ?`;      params.push(type); }
    if (pays)            { where += ` AND o.CodePays = ?`;       params.push(pays); }
    if (ville?.trim())   { where += ` AND o.SiegeOrg LIKE ?`;   params.push(`%${ville.trim()}%`); }

    const baseSql = `FROM GPOTB01_Organisation o
      LEFT JOIN GPOTB07_TypeOrganisation t ON t.IdTypOrg = o.IdTypOrg
      LEFT JOIN GPOTB03_Pays p ON p.CodePays = o.CodePays
      WHERE ${where}`;

    const [cntRows] = await db.execute(`SELECT COUNT(*) AS total ${baseSql}`, params);
    const total = cntRows[0].total;

    // `all=1` : liste complète non paginée — utilisée par le sélecteur de la page d'accueil,
    // qui doit proposer toutes les organisations déjà inscrites dans une liste déroulante.
    const isAll   = all === '1' || all === 'true';
    const limitSql   = isAll ? '' : `LIMIT ? OFFSET ?`;
    const sqlParams  = isAll ? params : [...params, limit, offset];

    const [rows] = await db.execute(
      `SELECT o.NumAgr, o.LibOrg, t.LibTypOrg AS TypeOrg,
              o.SiegeOrg AS Ville, o.CodePays, p.LibPays AS Pays, o.EmailOrg, o.Description
       ${baseSql} ORDER BY o.LibOrg ASC ${limitSql}`,
      sqlParams
    );

    res.json({
      orgs: rows,
      total,
      page: parseInt(page) || 0,
      pages: isAll ? 1 : (Math.ceil(total / limit) || 1),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/public/organisations/suggest?q=... — autocomplete instantané (organisations actives uniquement)
router.get('/organisations/suggest', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const [rows] = await db.execute(
      `SELECT o.NumAgr, o.LibOrg, o.SiegeOrg, t.LibTypOrg
       FROM GPOTB01_Organisation o
       LEFT JOIN GPOTB07_TypeOrganisation t ON t.IdTypOrg = o.IdTypOrg
       WHERE o.IdStatut = 1 AND o.LibOrg LIKE ?
       ORDER BY o.LibOrg ASC LIMIT 8`,
      [`%${q}%`]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/public/campagnes?numAgr=... — campagnes de dons actives d'une organisation
router.get('/campagnes', async (req, res) => {
  try {
    const { numAgr } = req.query;
    if (!numAgr) return res.json([]);
    const [rows] = await db.execute(
      `SELECT idCampagne, titre, description, objectifMontant, montantCollecte, dateDebut, dateFin
       FROM SD_CampagneDon WHERE numAgr = ? AND statut = 'Active' ORDER BY dateCreation DESC`,
      [numAgr]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/public/verifier-adherent?code=... — fiche complète d'un adhérent à partir du QR code
// de sa carte de membre (accès public volontaire : c'est exactement l'usage prévu d'une carte —
// n'importe qui la scanne pour vérifier l'identité du porteur, ex. un contrôle à l'entrée d'un
// événement — donc pas d'authentification requise ; protégé par le rate-limiter public global).
router.get('/verifier-adherent', async (req, res) => {
  try {
    const code = (req.query.code || '').trim();
    if (!code) return res.status(400).json({ message: 'Code adhérent requis' });

    const [[adh]] = await db.execute(
      `SELECT a.idAdh, a.NumAdherent, a.NomAdh, a.PrenAdh, a.DateNaissAdh, a.LieuNaissAdh, a.Sexe,
              a.Nationalite, a.CodePays, a.NumCNI, a.Profession, a.TelAdh, a.EmailAdh, a.AdrAdh,
              a.FonctionAdh, a.DateAdhesion, a.Photo, a.NumAgr,
              o.LibOrg, o.Logo AS OrgLogo, o.SiegeOrg, t.LibTypOrg,
              r.LibRole, s.LibStatut
       FROM GPOTB02_Adherent a
       LEFT JOIN GPOTB01_Organisation o     ON a.NumAgr = o.NumAgr
       LEFT JOIN GPOTB07_TypeOrganisation t ON t.IdTypOrg = o.IdTypOrg
       LEFT JOIN GPOTB11_Role r             ON a.IdRole = r.IdRole
       LEFT JOIN GPOTB15_Statut s           ON a.IdStatut = s.IdStatut
       WHERE a.NumAdherent = ?`,
      [code]
    );
    if (!adh) return res.status(404).json({ message: 'Aucun adhérent ne correspond à ce code' });

    const [beneficiaires] = await db.execute(
      `SELECT NomBenef, PrenomBenef, LienParente, DateNaissBenef FROM GPOTB06_Beneficiaire WHERE idAdh = ?`,
      [adh.idAdh]
    );
    const [paiements] = await db.execute(
      `SELECT DatePaiement, MontantPaiement, CodeDevise, TypePaiement, Statut, ObjetPaiement
       FROM GPOTB08_Paiement WHERE idAdh = ? ORDER BY DatePaiement DESC`,
      [adh.idAdh]
    );

    delete adh.idAdh; // identifiant interne, sans intérêt pour un scan externe
    res.json({ ...adh, beneficiaires, paiements });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/public/verifier-organisation?code=... — même principe que verifier-adherent, mais
// pour la carte d'organisation (accès public volontaire : usage prévu d'une carte scannée).
router.get('/verifier-organisation', async (req, res) => {
  try {
    const code = (req.query.code || '').trim();
    if (!code) return res.status(400).json({ message: "Code d'organisation requis" });

    const [[org]] = await db.execute(
      `SELECT o.NumAgr, o.LibOrg, o.SiegeOrg, o.EmailOrg, o.TelOrg, o.SiteWeb, o.DateCreOrg, o.Logo,
              o.NomRepresentant, o.FonctionRepresentant, o.CodePays,
              p.LibPays, t.LibTypOrg, s.LibStatut
       FROM GPOTB01_Organisation o
       LEFT JOIN GPOTB03_Pays p             ON o.CodePays = p.CodePays
       LEFT JOIN GPOTB07_TypeOrganisation t ON o.IdTypOrg = t.IdTypOrg
       LEFT JOIN GPOTB15_Statut s           ON o.IdStatut = s.IdStatut
       WHERE o.NumAgr = ?`,
      [code]
    );
    if (!org) return res.status(404).json({ message: 'Aucune organisation ne correspond à ce code' });

    const [[adhCount]]   = await db.execute('SELECT COUNT(*) AS n FROM GPOTB02_Adherent WHERE NumAgr = ?', [org.NumAgr]);
    const [[benefCount]] = await db.execute('SELECT COUNT(*) AS n FROM GPOTB06_Beneficiaire WHERE NumAgr = ?', [org.NumAgr]);

    res.json({ ...org, nbAdherents: adhCount.n, nbBeneficiaires: benefCount.n });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/public/actualites — dernières actualités publiées (plateforme + organisations)
router.get('/actualites', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT a.idActu, a.titre, a.contenu, a.image, a.datePublication, a.numAgr, o.LibOrg
       FROM SD_Actualite a
       LEFT JOIN GPOTB01_Organisation o ON o.NumAgr = a.numAgr
       WHERE a.statut = 'Publiée'
       ORDER BY a.datePublication DESC LIMIT 6`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/public/faq — questions actives, triées par ordre d'affichage
router.get('/faq', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT idFAQ, question, reponse, categorie FROM SD_FAQ WHERE actif = 1 ORDER BY ordre ASC, idFAQ ASC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/public/adhesion-multi — envoi d'un même dossier individu à plusieurs orgs
router.post('/adhesion-multi', upload.fields([
  { name: 'photo',    maxCount: 1 },
  { name: 'photoCNI', maxCount: 1 },
]), async (req, res) => {
  try {
    let dossier, orgs;
    try {
      dossier = JSON.parse(req.body.dossier || '{}');
      orgs    = JSON.parse(req.body.orgs    || '[]');
    } catch(_) {
      return res.status(400).json({ message: 'Format de données invalide' });
    }

    if (!dossier?.email) return res.status(400).json({ message: 'Email obligatoire' });
    if (!dossier?.nom)   return res.status(400).json({ message: 'Nom obligatoire' });
    if (!dossier?.sexe)  return res.status(400).json({ message: 'Le sexe est obligatoire' });
    if (dossier?.dateNaiss) {
      const dn = new Date(dossier.dateNaiss);
      if (isNaN(dn.getTime()))            return res.status(400).json({ message: 'Date de naissance invalide' });
      if (dn > new Date())                return res.status(400).json({ message: 'La date de naissance ne peut pas être dans le futur' });
      if (dn > new Date('2010-12-31'))    return res.status(400).json({ message: 'La date de naissance doit être antérieure au 31/12/2010' });
    }
    if (!Array.isArray(orgs) || orgs.length === 0)
      return res.status(400).json({ message: 'Sélectionnez au moins une organisation' });
    if (orgs.length > 10)
      return res.status(400).json({ message: 'Maximum 10 organisations par envoi' });
    if (await DemandeService.emailDejaUtilise(dossier.email))
      return res.status(409).json({ message: "Cet email est déjà utilisé sur la plateforme — un email ne peut servir qu'à une seule inscription." });

    const photoPath    = req.files?.photo?.[0]    ? `/uploads/${req.files.photo[0].filename}`    : null;
    const photoCNIPath = req.files?.photoCNI?.[0] ? `/uploads/${req.files.photoCNI[0].filename}` : null;

    const refDossier = Date.now().toString(36).toUpperCase().slice(-5) +
                       Math.random().toString(36).slice(2, 5).toUpperCase();
    const now    = new Date().toISOString().replace('T', ' ').split('.')[0];
    const nomOrg = `${dossier.nom} ${dossier.prenom || ''}`.trim();

    const demandes = [];
    for (const numAgr of orgs) {
      const [orgRows] = await db.execute(
        `SELECT o.NumAgr, o.LibOrg, t.LibTypOrg AS TypeOrg, o.SiegeOrg, p.LibPays
         FROM GPOTB01_Organisation o
         LEFT JOIN GPOTB07_TypeOrganisation t ON t.IdTypOrg = o.IdTypOrg
         LEFT JOIN GPOTB03_Pays p ON p.CodePays = o.CodePays
         WHERE o.NumAgr = ? AND o.IdStatut = 1`, [numAgr]
      );
      if (!orgRows[0]) continue;
      const org = orgRows[0];

      const [result] = await db.execute(
        `INSERT INTO SD_DemandeAdhesion
           (typeOrg, nomOrg, numAgr, emailOrg, telOrg, codePays, libPays,
            siegeOrg, dateCrea, description, repNom, repPrenom, repCNI,
            repAdresse, refDossier, dateDemande,
            photo, photoCNI, sexe, profession, situationMatrimoniale, ville, fonctionSouhaitee)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ['Individu', nomOrg, org.NumAgr,
         dossier.email, dossier.tel || null,
         dossier.codePays || null, dossier.libPays || null,
         dossier.adresse || null, dossier.dateNaiss || null,
         dossier.description || null,
         dossier.nom, dossier.prenom || null,
         dossier.numCNI || null, dossier.adresse || null,
         refDossier, now,
         photoPath, photoCNIPath,
         dossier.sexe || null, dossier.profession || null, dossier.situationMatrimoniale || null,
         dossier.ville || null, dossier.fonctionSouhaitee || null]
      );

      demandes.push({
        id: result.insertId,
        numAgr: org.NumAgr,
        nomOrg: org.LibOrg,
        typeOrg: org.TypeOrg || 'Organisation',
        siege: [org.SiegeOrg, org.LibPays].filter(Boolean).join(', '),
        statut: 'En attente',
      });
    }

    if (demandes.length === 0)
      return res.status(400).json({ message: 'Aucune organisation valide sélectionnée' });

    res.status(201).json({
      message: `${demandes.length} demande(s) d'adhésion envoyée(s)`,
      refDossier,
      demandes,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/public/mes-demandes?email=&ref= — suivi des demandes individu
router.get('/mes-demandes', async (req, res) => {
  try {
    const { email, ref } = req.query;
    if (!email && !ref)
      return res.status(400).json({ message: 'Email ou référence dossier requis' });

    let where = `d.typeOrg = 'Individu'`;
    const params = [];
    if (email) { where += ` AND d.emailOrg = ?`;    params.push(email); }
    if (ref)   { where += ` AND d.refDossier = ?`;  params.push(ref); }

    const [rows] = await db.execute(
      `SELECT d.idDemande, d.nomOrg, d.numAgr, d.statut, d.dateDemande,
              d.dateTraitement, d.motifRefus, d.refDossier,
              COALESCE(o.LibOrg, d.nomOrg) AS LibOrg,
              t.LibTypOrg AS TypeOrg, o.SiegeOrg, p.LibPays
       FROM SD_DemandeAdhesion d
       LEFT JOIN GPOTB01_Organisation o ON o.NumAgr = d.numAgr
       LEFT JOIN GPOTB07_TypeOrganisation t ON t.IdTypOrg = o.IdTypOrg
       LEFT JOIN GPOTB03_Pays p ON p.CodePays = o.CodePays
       WHERE ${where}
       ORDER BY d.dateDemande DESC`,
      params
    );

    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/public/don — don général (plateforme) ou fléché vers une organisation, avec
// répartition automatique organisation / commission plateforme.
router.post('/don', async (req, res) => {
  try {
    const { montant, numAgr, idCampagne, message, nom, email, tel, modePaiement, codeDevise, anonyme } = req.body;
    if (!montant || Number(montant) < 100)
      return res.status(400).json({ message: 'Montant invalide (minimum 100)' });

    let numAgrClean = numAgr ? String(numAgr).trim() : null;
    let orgLibOrg   = null;
    if (numAgrClean) {
      const [orgRows] = await db.execute(
        `SELECT NumAgr, LibOrg FROM GPOTB01_Organisation WHERE NumAgr = ? AND IdStatut = 1`,
        [numAgrClean]
      );
      if (!orgRows.length) return res.status(400).json({ message: 'Organisation introuvable ou inactive' });
      orgLibOrg = orgRows[0].LibOrg;
    }

    let idCampagneClean = null;
    if (idCampagne) {
      const [campRows] = await db.execute(
        `SELECT idCampagne FROM SD_CampagneDon WHERE idCampagne = ? AND numAgr = ? AND statut = 'Active'`,
        [idCampagne, numAgrClean]
      );
      if (campRows.length) idCampagneClean = campRows[0].idCampagne;
    }

    const montantNum = Number(montant);
    // Don fléché vers une organisation : la plateforme prélève PLATFORM_COMMISSION_PCT %,
    // le reste est crédité à l'organisation. Don général (aucune organisation choisie) :
    // l'intégralité revient à la plateforme elle-même.
    const tauxCommission    = numAgrClean ? PLATFORM_COMMISSION_PCT : 100;
    const montantPlateforme = Math.round(montantNum * tauxCommission / 100);
    const montantOrg        = montantNum - montantPlateforme;

    const now = new Date().toISOString().replace('T',' ').split('.')[0];
    const [result] = await db.execute(
      `INSERT INTO SD_Don (montant, codeDevise, numAgr, idCampagne, message, nom, email, tel, modePaiement,
                            tauxCommission, montantOrg, montantPlateforme, anonyme, dateDon)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [montantNum, codeDevise||'XOF', numAgrClean, idCampagneClean, message||null,
       anonyme ? null : (nom||null),
       anonyme ? null : (email||null),
       anonyme ? null : (tel||null),
       modePaiement||'mobile_money',
       tauxCommission, montantOrg, montantPlateforme,
       anonyme ? 1 : 0,
       now]
    );

    if (idCampagneClean) {
      await db.execute(
        `UPDATE SD_CampagneDon SET montantCollecte = montantCollecte + ? WHERE idCampagne = ?`,
        [montantOrg, idCampagneClean]
      );
    }

    res.status(201).json({
      message: 'Don enregistré avec succès', id: result.insertId,
      montantOrg, montantPlateforme, tauxCommission,
    });

    // Reçu par email — envoyé même pour un don anonyme (l'email sert uniquement au reçu
    // personnel du donateur, il n'est jamais affiché publiquement ni sur les tableaux de bord).
    if (email) {
      const EmailService = require('../services/EmailService');
      const { subject, html, text } = EmailService.tplRecuDon({
        idDon: result.insertId, montant: montantNum, codeDevise: codeDevise || 'XOF',
        nom: anonyme ? null : (nom || null), modePaiement: modePaiement || 'mobile_money',
        message: message || null, dateDon: now, orgLibOrg, montantOrg, montantPlateforme, tauxCommission,
      });
      EmailService.sendEmail({ to: email, subject, html, text }).catch(() => {});
    }

    // Notifie le(s) gestionnaire(s) de l'organisation bénéficiaire, s'il y en a un compte.
    if (numAgrClean) {
      NotificationService.idsUsersOrganisation(numAgrClean).then(ids => {
        ids.forEach(idUser => NotificationService.notifier({
          idUser,
          titre: '🎁 Nouveau don reçu',
          contenu: `${orgLibOrg} vient de recevoir un don de ${montantOrg.toLocaleString('fr-FR')} ${codeDevise || 'XOF'} (net après commission).`,
          type: 'don',
          lien: '/dashboard',
        }));
      }).catch(() => {});
    }
  } catch(err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/public/paiement-operateurs/:codePays — opérateurs disponibles (paiement d'adhésion public)
router.get('/paiement-operateurs/:codePays', async (req, res) => {
  const cfg = PaymentService.getOperateurs(req.params.codePays);
  if (!cfg) return res.status(404).json({ message: 'Aucun opérateur disponible pour ce pays' });
  res.json(cfg);
});

// GET /api/public/paiement/:id — récapitulatif public d'un paiement d'adhésion (champs limités)
router.get('/paiement/:id', async (req, res) => {
  try {
    const pay = await PaiementRepository.findByIdFull(req.params.id);
    if (!pay || !pay.idDemande) return res.status(404).json({ message: 'Paiement introuvable' });
    res.json({
      IdPaiement: pay.IdPaiement,
      MontantPaiement: pay.MontantPaiement,
      CodeDevise: pay.CodeDevise,
      CodePays: pay.CodePays,
      Statut: pay.Statut,
      Nom: pay.NomAdh ? `${pay.PrenAdh || ''} ${pay.NomAdh}`.trim() : pay.LibOrg,
      ObjetPaiement: pay.ObjetPaiement,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/public/verifier-code — résout un code de confirmation reçu par SMS/WhatsApp
router.post('/verifier-code', async (req, res) => {
  try {
    const code = (req.body.code || '').trim();
    if (!code) return res.status(400).json({ message: 'Code requis' });

    const [[pay]] = await db.execute(
      `SELECT * FROM GPOTB08_Paiement WHERE CodeConfirmation = ? AND idDemande IS NOT NULL`, [code]
    );
    if (!pay) return res.status(404).json({ message: 'Code invalide' });
    if (pay.Statut === 'Payé') return res.status(400).json({ message: 'Ce code a déjà été utilisé (paiement déjà confirmé)' });

    const full = await PaiementRepository.findByIdFull(pay.IdPaiement);
    res.json({
      IdPaiement: full.IdPaiement,
      MontantPaiement: full.MontantPaiement,
      CodeDevise: full.CodeDevise,
      CodePays: full.CodePays,
      Statut: full.Statut,
      Nom: full.NomAdh ? `${full.PrenAdh || ''} ${full.NomAdh}`.trim() : full.LibOrg,
      ObjetPaiement: full.ObjetPaiement,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/public/paiement/:id/payer — règle la cotisation d'adhésion (simulé) puis active le compte
router.post('/paiement/:id/payer', async (req, res) => {
  try {
    const pay = await PaiementRepository.findByIdFull(req.params.id);
    if (!pay || !pay.idDemande) return res.status(404).json({ message: 'Paiement introuvable' });

    // Garde-fou : l'appelant doit connaître soit l'email du dossier, soit le code de confirmation reçu par SMS/WhatsApp
    const { email, code } = req.body;
    const [[demande]] = await db.execute('SELECT emailOrg FROM SD_DemandeAdhesion WHERE idDemande = ?', [pay.idDemande]);
    const emailMatches = demande && email && demande.emailOrg.toLowerCase() === String(email).toLowerCase();
    const codeMatches  = code && pay.CodeConfirmation && String(code).trim() === String(pay.CodeConfirmation);
    if (!emailMatches && !codeMatches)
      return res.status(403).json({ message: 'Vérification échouée (email ou code invalide)' });

    const result = await PaymentService.payer(req.params.id, req.body);
    if (result.success && result.idDemande) {
      await DemandeService.completerApresPaiement(result.idDemande).catch(e => console.error('[Adhesion] activation:', e.message));
    }
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
