const router = require('express').Router();
const db     = require('../config/database');
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');

router.get('/', auth, async (req, res) => {
  try {
    let sql = `SELECT e.*, o.LibOrg FROM GPOTB21_Evenement e
               LEFT JOIN GPOTB01_Organisation o ON e.NumAgr = o.NumAgr`;
    const where = [], params = [];
    if (req.query.org)      { where.push('e.NumAgr = ?');      params.push(req.query.org); }
    if (req.query.dateFrom) { where.push('DATE(e.Heuraux) >= ?'); params.push(req.query.dateFrom); }
    if (req.query.dateTo)   { where.push('DATE(e.Heuraux) <= ?'); params.push(req.query.dateTo); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY e.Heuraux DESC';
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { LibEven, Heuraux, NumAgr, LieuEven, DescEven } = req.body;
  if (!LibEven || !NumAgr) return res.status(400).json({ message: 'LibEven et NumAgr obligatoires' });
  try {
    const [r] = await db.execute(
      'INSERT INTO GPOTB21_Evenement (LibEven,Heuraux,NumAgr,LieuEven,DescEven) VALUES (?,?,?,?,?)',
      [LibEven, Heuraux||null, NumAgr, LieuEven||null, DescEven||null]
    );
    res.status(201).json({ message: 'Événement créé', IdEven: r.insertId });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  const { LibEven, Heuraux, NumAgr, LieuEven, DescEven } = req.body;
  try {
    await db.execute(
      'UPDATE GPOTB21_Evenement SET LibEven=?,Heuraux=?,NumAgr=?,LieuEven=?,DescEven=? WHERE IdEven=?',
      [LibEven, Heuraux||null, NumAgr, LieuEven||null, DescEven||null, req.params.id]
    );
    res.json({ message: 'Événement mis à jour' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    await db.execute('DELETE FROM GPOTB21_Evenement WHERE IdEven=?', [req.params.id]);
    res.json({ message: 'Événement supprimé' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
