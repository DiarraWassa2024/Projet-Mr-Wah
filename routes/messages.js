const router = require('express').Router();
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const db     = require('../config/database');
const { ok, created, notFound, badRequest, serverError } = require('../helpers/response');

// GET /api/messages — messages reçus de l'utilisateur connecté
router.get('/', auth, async (req, res) => {
  try {
    const { type, lu } = req.query;
    let sql = `SELECT m.*, u.username AS expediteurNom
               FROM GPOTB30_Message m
               LEFT JOIN GPOTB_Users u ON u.idUser = m.IdExpediteur
               WHERE m.IdDestinataire = ?`;
    const params = [req.user.idUser];
    if (type)    { sql += ` AND m.TypeMessage = ?`; params.push(type); }
    if (lu !== undefined) { sql += ` AND m.Lu = ?`; params.push(lu === '0' ? 0 : 1); }
    sql += ` ORDER BY m.DateEnvoi DESC`;
    const [rows] = await db.execute(sql, params);
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// GET /api/messages/envoyes — messages envoyés
router.get('/envoyes', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT m.*, u.username AS destinataireNom
       FROM GPOTB30_Message m
       LEFT JOIN GPOTB_Users u ON u.idUser = m.IdDestinataire
       WHERE m.IdExpediteur = ?
       ORDER BY m.DateEnvoi DESC`,
      [req.user.idUser]
    );
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// GET /api/messages/non-lus — compteur
router.get('/non-lus', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT COUNT(*) AS total FROM GPOTB30_Message WHERE IdDestinataire = ? AND Lu = 0`,
      [req.user.idUser]
    );
    ok(res, { total: rows[0].total });
  } catch (err) { serverError(res, err); }
});

// GET /api/messages/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT m.*, u.username AS expediteurNom
       FROM GPOTB30_Message m
       LEFT JOIN GPOTB_Users u ON u.idUser = m.IdExpediteur
       WHERE m.IdMessage = ? AND (m.IdDestinataire = ? OR m.IdExpediteur = ?)`,
      [req.params.id, req.user.idUser, req.user.idUser]
    );
    if (!rows[0]) return notFound(res, 'Message introuvable');
    // Marquer comme lu si destinataire
    if (rows[0].IdDestinataire === req.user.idUser && !rows[0].Lu) {
      await db.execute(
        `UPDATE GPOTB30_Message SET Lu = 1, DateLecture = datetime('now') WHERE IdMessage = ?`,
        [req.params.id]
      );
    }
    ok(res, rows[0]);
  } catch (err) { serverError(res, err); }
});

// POST /api/messages — envoyer un message
router.post('/', auth, async (req, res) => {
  const { Sujet, Contenu, IdDestinataire, NumAgrDest, TypeMessage } = req.body;
  if (!Sujet || !Contenu) return badRequest(res, 'Sujet et Contenu obligatoires');
  if (!IdDestinataire && !NumAgrDest) return badRequest(res, 'Destinataire ou organisation requis');
  try {
    const result = await db.execute(
      `INSERT INTO GPOTB30_Message(Sujet, Contenu, IdExpediteur, IdDestinataire, NumAgrDest, TypeMessage)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Sujet, Contenu, req.user.idUser,
       IdDestinataire || null, NumAgrDest || null,
       TypeMessage || 'direct']
    );
    created(res, { message: 'Message envoyé', IdMessage: result[0].insertId });
  } catch (err) { serverError(res, err); }
});

// PATCH /api/messages/:id/lu — marquer comme lu
router.patch('/:id/lu', auth, async (req, res) => {
  try {
    await db.execute(
      `UPDATE GPOTB30_Message SET Lu = 1, DateLecture = datetime('now')
       WHERE IdMessage = ? AND IdDestinataire = ?`,
      [req.params.id, req.user.idUser]
    );
    ok(res, { message: 'Message marqué comme lu' });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/messages/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT IdMessage FROM GPOTB30_Message WHERE IdMessage = ? AND (IdDestinataire = ? OR IdExpediteur = ?)`,
      [req.params.id, req.user.idUser, req.user.idUser]
    );
    if (!rows[0]) return notFound(res, 'Message introuvable');
    await db.execute(`DELETE FROM GPOTB30_Message WHERE IdMessage = ?`, [req.params.id]);
    ok(res, { message: 'Message supprimé' });
  } catch (err) { serverError(res, err); }
});

// POST /api/messages/broadcast — admin seulement
router.post('/broadcast', auth, roles('admin'), async (req, res) => {
  const { Sujet, Contenu, NumAgrDest } = req.body;
  if (!Sujet || !Contenu) return badRequest(res, 'Sujet et Contenu obligatoires');
  try {
    const result = await db.execute(
      `INSERT INTO GPOTB30_Message(Sujet, Contenu, IdExpediteur, NumAgrDest, TypeMessage)
       VALUES (?, ?, ?, ?, 'broadcast')`,
      [Sujet, Contenu, req.user.idUser, NumAgrDest || null]
    );
    created(res, { message: 'Broadcast envoyé', IdMessage: result[0].insertId });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
