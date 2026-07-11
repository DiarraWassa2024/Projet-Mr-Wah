const router  = require('express').Router();
const db      = require('../config/database');
const path    = require('path');
const fs      = require('fs');
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');

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
router.post('/restore', auth, roles('admin'), (req, res) => {
  res.status(501).json({
    message: 'La restauration en ligne n\'est pas disponible pour des raisons de sécurité. Contactez l\'administrateur système pour restaurer manuellement.'
  });
});

module.exports = router;
