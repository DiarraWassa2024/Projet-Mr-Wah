const router = require('express').Router();
const db     = require('../config/database');
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');

router.get('/', auth, async (req, res) => {
  try {
    let sql = `SELECT c.*, o.LibOrg FROM GPOTB14_Cotisation c
               LEFT JOIN GPOTB01_Organisation o ON c.NumAgr = o.NumAgr`;
    const params = [];
    if (req.query.org) { sql += ' WHERE c.NumAgr = ?'; params.push(req.query.org); }
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { MontantCoti, PeriodeCoti, DateEcheance, NumAgr } = req.body;
  if (!MontantCoti || !NumAgr) return res.status(400).json({ message: 'MontantCoti et NumAgr obligatoires' });
  try {
    const [r] = await db.execute(
      'INSERT INTO GPOTB14_Cotisation (MontantCoti,PeriodeCoti,DateEcheance,NumAgr) VALUES (?,?,?,?)',
      [MontantCoti, PeriodeCoti||'Mensuelle', DateEcheance||null, NumAgr]
    );
    res.status(201).json({ message: 'Cotisation créée', IdCoti: r.insertId });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  const { MontantCoti, PeriodeCoti, DateEcheance, NumAgr } = req.body;
  try {
    await db.execute(
      'UPDATE GPOTB14_Cotisation SET MontantCoti=?,PeriodeCoti=?,DateEcheance=?,NumAgr=? WHERE IdCoti=?',
      [MontantCoti, PeriodeCoti||'Mensuelle', DateEcheance||null, NumAgr, req.params.id]
    );
    res.json({ message: 'Cotisation mise à jour' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', auth, roles('admin', 'gestionnaire'), async (req, res) => {
  try {
    await db.execute('DELETE FROM GPOTB14_Cotisation WHERE IdCoti=?', [req.params.id]);
    res.json({ message: 'Cotisation supprimée' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
