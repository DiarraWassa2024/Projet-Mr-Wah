const router = require('express').Router();
const db     = require('../config/database');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ── File upload config ────────────────────────────────────────
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `agr_${Date.now()}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.jpg','.jpeg','.png'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// POST /api/public/adhesion  (multipart/form-data)
router.post('/adhesion', upload.single('docAgrement'), async (req, res) => {
  try {
    const b = req.body;
    const {
      type, nom, email, tel, pays, libPays, siege, dateCrea, description, numAgr,
      repNom, repPrenom, repFonction, repAdresse, repTel, repEmail,
      repSexe, prenom, ministere,
    } = b;

    const nomOrg = nom || `${b.nomPhys||''} ${prenom||''}`.trim();
    if (!nomOrg)   return res.status(400).json({ message: 'Nom obligatoire' });
    if (!type)     return res.status(400).json({ message: "Type d'adhésion obligatoire" });
    if (!email)    return res.status(400).json({ message: 'Email obligatoire' });
    if (!repSexe)  return res.status(400).json({ message: 'Le sexe du déclarant est obligatoire' });

    const docAgrement = req.file ? `/uploads/${req.file.filename}` : null;
    const now = new Date().toISOString().replace('T',' ').split('.')[0];

    const [result] = await db.execute(
      `INSERT INTO SD_DemandeAdhesion
         (typeOrg, nomOrg, numAgr, emailOrg, telOrg, codePays, libPays,
          siegeOrg, dateCrea, description, ministere, docAgrement,
          repNom, repPrenom, repFonction, repAdresse, repTel, repEmail, repSexe, dateDemande)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, nomOrg, numAgr||null, email, tel||null, pays||null, libPays||null,
       siege||null, dateCrea||null, description||null, ministere||null, docAgrement,
       repNom||null, repPrenom||null, repFonction||null,
       repAdresse||null, repTel||null, repEmail||null, repSexe||null, now]
    );

    res.status(201).json({
      message: `Votre demande d'adhésion (${type}) a bien été reçue. Nous vous contacterons prochainement.`,
      id: result.insertId,
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
    const { search, type, pays, ville, page = '0' } = req.query;
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

    const [rows] = await db.execute(
      `SELECT o.NumAgr, o.LibOrg, t.LibTypOrg AS TypeOrg,
              o.SiegeOrg AS Ville, o.CodePays, p.LibPays AS Pays, o.EmailOrg, o.Description
       ${baseSql} ORDER BY o.LibOrg ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ orgs: rows, total, page: parseInt(page) || 0, pages: Math.ceil(total / limit) || 1 });
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
    if (!Array.isArray(orgs) || orgs.length === 0)
      return res.status(400).json({ message: 'Sélectionnez au moins une organisation' });
    if (orgs.length > 10)
      return res.status(400).json({ message: 'Maximum 10 organisations par envoi' });

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
            photo, photoCNI, sexe, profession, ville, fonctionSouhaitee)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ['Individu', nomOrg, org.NumAgr,
         dossier.email, dossier.tel || null,
         dossier.codePays || null, dossier.libPays || null,
         dossier.adresse || null, dossier.dateNaiss || null,
         dossier.description || null,
         dossier.nom, dossier.prenom || null,
         dossier.numCNI || null, dossier.adresse || null,
         refDossier, now,
         photoPath, photoCNIPath,
         dossier.sexe || null, dossier.profession || null,
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

// POST /api/public/don
router.post('/don', async (req, res) => {
  try {
    const { montant, cause, message, nom, email, tel, modePaiement, anonyme } = req.body;
    if (!montant || Number(montant) < 100)
      return res.status(400).json({ message: 'Montant invalide (minimum 100)' });
    const now = new Date().toISOString().replace('T',' ').split('.')[0];
    const [result] = await db.execute(
      `INSERT INTO SD_Don (montant, cause, message, nom, email, tel, modePaiement, anonyme, dateDon)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(montant), cause||null, message||null,
       anonyme ? null : (nom||null),
       anonyme ? null : (email||null),
       anonyme ? null : (tel||null),
       modePaiement||'mobile_money',
       anonyme ? 1 : 0,
       now]
    );
    res.status(201).json({ message: 'Don enregistré avec succès', id: result.insertId });
  } catch(err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
