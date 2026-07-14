const router = require('express').Router();
const db     = require('../config/database');
const auth   = require('../middleware/auth');
const { ok, serverError } = require('../helpers/response');

// GET /api/notifications — les 30 dernières notifications de l'utilisateur connecté + compteur non lus
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM SD_Notification WHERE idUser = ? ORDER BY dateEnvoi DESC LIMIT 30`,
      [req.user.idUser]
    );
    const [[agg]] = await db.execute(
      `SELECT COUNT(*) AS nonLu FROM SD_Notification WHERE idUser = ? AND lu = 0`,
      [req.user.idUser]
    );
    ok(res, { notifications: rows, nonLu: agg.nonLu });
  } catch (err) { serverError(res, err); }
});

// PUT /api/notifications/:id/lu — marque une notification comme lue (uniquement la sienne)
router.put('/:id/lu', auth, async (req, res) => {
  try {
    await db.execute(
      `UPDATE SD_Notification SET lu = 1 WHERE idNotification = ? AND idUser = ?`,
      [req.params.id, req.user.idUser]
    );
    ok(res, { message: 'Notification marquée comme lue' });
  } catch (err) { serverError(res, err); }
});

// PUT /api/notifications/lu-tout — marque toutes les notifications de l'utilisateur comme lues
router.put('/lu-tout', auth, async (req, res) => {
  try {
    await db.execute(`UPDATE SD_Notification SET lu = 1 WHERE idUser = ? AND lu = 0`, [req.user.idUser]);
    ok(res, { message: 'Toutes les notifications sont marquées comme lues' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
