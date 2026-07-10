const router = require('express').Router();
const db     = require('../config/database');
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');

router.get('/', auth, async (req, res) => {
  try {
    let sql = `
      SELECT pr.*, tp.LibTypPrest, o.LibOrg, pm.NomOrg AS NomPrestataire
      FROM GPOTB16_Prestation pr
      LEFT JOIN GPOTB17_TypePrestation tp  ON pr.IdTypPrest = tp.IdTypPrest
      LEFT JOIN GPOTB01_Organisation o     ON pr.NumAgr     = o.NumAgr
      LEFT JOIN GPOTB05_PrestataireMoral pm ON pr.rcc       = pm.rcc
    `;
    const where = [], params = [];
    if (req.query.org)      { where.push('pr.NumAgr = ?');      params.push(req.query.org); }
    if (req.query.dateFrom) { where.push('pr.DatePrest >= ?');  params.push(req.query.dateFrom); }
    if (req.query.dateTo)   { where.push('pr.DatePrest <= ?');  params.push(req.query.dateTo); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY pr.DatePrest DESC';
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { LibPrest, DatePrest, MontantPrest, IdTypPrest, NumAgr, rcc } = req.body;
  if (!LibPrest || !NumAgr) return res.status(400).json({ message: 'LibPrest et NumAgr obligatoires' });
  try {
    const [r] = await db.execute(
      'INSERT INTO GPOTB16_Prestation (LibPrest,DatePrest,MontantPrest,IdTypPrest,NumAgr,rcc) VALUES (?,?,?,?,?,?)',
      [LibPrest, DatePrest||null, MontantPrest||null, IdTypPrest||null, NumAgr, rcc||null]
    );
    res.status(201).json({ message: 'Prestation créée', IdPrest: r.insertId });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  const { LibPrest, DatePrest, MontantPrest, IdTypPrest, NumAgr, rcc } = req.body;
  try {
    await db.execute(
      'UPDATE GPOTB16_Prestation SET LibPrest=?,DatePrest=?,MontantPrest=?,IdTypPrest=?,NumAgr=?,rcc=? WHERE IdPrest=?',
      [LibPrest, DatePrest||null, MontantPrest||null, IdTypPrest||null, NumAgr, rcc||null, req.params.id]
    );
    res.json({ message: 'Prestation mise à jour' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    await db.execute('DELETE FROM GPOTB16_Prestation WHERE IdPrest=?', [req.params.id]);
    res.json({ message: 'Prestation supprimée' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
