const router  = require('express').Router();
const multer  = require('multer');
const db      = require('../config/database');
const path    = require('path');
const fs      = require('fs');
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');

const uploadRestore = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// GET /api/sauvegarde/stats
router.get('/stats', auth, roles('admin'), async (req, res) => {
  try {
    const [[orgs]]  = await db.execute('SELECT COUNT(*) as c FROM GPOTB01_Organisation');
    const [[adhs]]  = await db.execute('SELECT COUNT(*) as c FROM GPOTB02_Adherent');
    const [[pays]]  = await db.execute('SELECT COUNT(*) as c FROM GPOTB08_Paiement');
    res.json({
      organisations: orgs.c,
      adherents:     adhs.c,
      paiements:     pays.c,
      lastBackup:    null,
    });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// GET /api/sauvegarde/download
router.get('/download', auth, roles('admin'), (req, res) => {
  try {
    // Use the raw db to get the file path
    const rawDb = require('../config/database').raw;
    const dbFile = rawDb.name; // better-sqlite3 exposes .name (file path)
    if (!fs.existsSync(dbFile))
      return res.status(404).json({ message: 'Fichier base de données introuvable' });
    const filename = `solidev_backup_${new Date().toISOString().slice(0,10)}.db`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(dbFile);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// POST /api/sauvegarde/restore
// Remplace le fichier de base de données par celui envoyé, puis recharge la connexion
// (config/database.js::reload()) — sans redémarrer le processus, donc sans dépendre du
// comportement de redémarrage de l'hébergeur (certaines plateformes ne relancent pas
// automatiquement un process qui se termine proprement avec exit(0)).
router.post('/restore', auth, roles('admin'), uploadRestore.single('database'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Fichier de base de données requis' });

  const buf = req.file.buffer;
  const header = buf.slice(0, 16).toString('utf8');
  if (!header.startsWith('SQLite format 3'))
    return res.status(400).json({ message: "Le fichier fourni n'est pas une base SQLite valide" });

  try {
    const dbModule = require('../config/database');
    const dbFile   = dbModule.raw.name;

    // Sauvegarde de sécurité de la base actuelle avant remplacement (au cas où le fichier
    // envoyé serait incorrect malgré la validation ci-dessus).
    const safetyBackup = `${dbFile}.before-restore-${Date.now()}.bak`;
    if (fs.existsSync(dbFile)) fs.copyFileSync(dbFile, safetyBackup);

    // Ferme proprement la connexion avant d'écraser le fichier sur disque.
    dbModule.raw.close();
    fs.writeFileSync(dbFile, buf);
    // Supprime les fichiers WAL/SHM de l'ancienne connexion (obsolètes après restauration).
    for (const ext of ['-wal', '-shm']) {
      const f = dbFile + ext;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }

    dbModule.reload();
    res.json({ message: 'Restauration réussie — la base est immédiatement active.' });
  } catch (err) {
    res.status(500).json({ message: 'Échec de la restauration : ' + err.message });
  }
});

module.exports = router;
