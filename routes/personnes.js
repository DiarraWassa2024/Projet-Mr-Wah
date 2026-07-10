const router = require('express').Router();
const db     = require('../config/database');
const auth   = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, sx.LibSexe, sm.LibSituMat, pi.LibPieceIdenti, pa.LibPays
      FROM GPOTB04_Personne p
      LEFT JOIN GPOTB12_Sexe sx                  ON p.IdSexe       = sx.IdSexe
      LEFT JOIN GPOTB20_SituationMatrimoniale sm  ON p.IdSituMat    = sm.IdSituMat
      LEFT JOIN GPOTB19_PieceIdentite pi          ON p.IdPieceIdenti= pi.IdPieceIdenti
      LEFT JOIN GPOTB03_Pays pa                   ON p.CodePays     = pa.CodePays
      ORDER BY p.NomPers, p.PrenomPers`);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const [[row]] = await db.execute(`
      SELECT p.*, sx.LibSexe, sm.LibSituMat, pi.LibPieceIdenti, pa.LibPays
      FROM GPOTB04_Personne p
      LEFT JOIN GPOTB12_Sexe sx                  ON p.IdSexe       = sx.IdSexe
      LEFT JOIN GPOTB20_SituationMatrimoniale sm  ON p.IdSituMat    = sm.IdSituMat
      LEFT JOIN GPOTB19_PieceIdentite pi          ON p.IdPieceIdenti= pi.IdPieceIdenti
      LEFT JOIN GPOTB03_Pays pa                   ON p.CodePays     = pa.CodePays
      WHERE p.idPers = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ message: 'Personne non trouvée' });
    res.json(row);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { NomPers, PrenomPers, TelPers, AdrPers, EmailPers, DateNaissPers, IdSexe, IdSituMat, IdPieceIdenti, NumeroPiece, CodePays } = req.body;
  if (!NomPers) return res.status(400).json({ message: 'NomPers obligatoire' });
  try {
    const [r] = await db.execute(
      `INSERT INTO GPOTB04_Personne
        (NomPers,PrenomPers,TelPers,AdrPers,EmailPers,DateNaissPers,IdSexe,IdSituMat,IdPieceIdenti,NumeroPiece,CodePays)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [NomPers, PrenomPers||null, TelPers||null, AdrPers||null, EmailPers||null,
       DateNaissPers||null, IdSexe||null, IdSituMat||null, IdPieceIdenti||null, NumeroPiece||null, CodePays||null]
    );
    res.status(201).json({ message: 'Personne créée', idPers: r.insertId });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { NomPers, PrenomPers, TelPers, AdrPers, EmailPers, DateNaissPers, IdSexe, IdSituMat, IdPieceIdenti, NumeroPiece, CodePays } = req.body;
  try {
    await db.execute(
      `UPDATE GPOTB04_Personne SET
        NomPers=?,PrenomPers=?,TelPers=?,AdrPers=?,EmailPers=?,DateNaissPers=?,
        IdSexe=?,IdSituMat=?,IdPieceIdenti=?,NumeroPiece=?,CodePays=?
       WHERE idPers=?`,
      [NomPers, PrenomPers||null, TelPers||null, AdrPers||null, EmailPers||null,
       DateNaissPers||null, IdSexe||null, IdSituMat||null, IdPieceIdenti||null, NumeroPiece||null, CodePays||null, req.params.id]
    );
    res.json({ message: 'Personne mise à jour' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.execute('DELETE FROM GPOTB04_Personne WHERE idPers=?', [req.params.id]);
    res.json({ message: 'Personne supprimée' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
