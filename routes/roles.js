const router = require('express').Router();
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const db     = require('../config/database');
const { ok, created, notFound, badRequest, serverError } = require('../helpers/response');

// ── helpers ────────────────────────────────────────────────────
async function getRoleFull(id) {
  const [[role]] = await db.execute(
    `SELECT r.*, u.username AS CreateurNom
     FROM GPOTB11_Role r
     LEFT JOIN GPOTB_Users u ON u.idUser = r.idCreateur
     WHERE r.IdRole = ?`, [id]
  );
  if (!role) return null;
  const [menus]  = await db.execute(`SELECT MenuCode FROM SD_RoleMenu WHERE IdRole = ?`, [id]);
  const [perms]  = await db.execute(`SELECT * FROM SD_RolePermission WHERE IdRole = ?`, [id]);
  const [habs]   = await db.execute(`SELECT CodeHab, Valeur FROM SD_RoleHabilitation WHERE IdRole = ?`, [id]);
  return { ...role, menus: menus.map(m => m.MenuCode), permissions: perms, habilitations: habs };
}

async function logHistorique(IdRole, idUser, action, detail) {
  await db.execute(
    `INSERT INTO SD_RoleHistorique(IdRole,idUser,Action,Detail) VALUES(?,?,?,?)`,
    [IdRole, idUser, action, detail ? JSON.stringify(detail) : null]
  );
}

// ── GET /api/roles ─────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.IdRole, r.LibRole, r.Description, r.Niveau, r.Couleur, r.Icone,
              r.isSysteme, r.DateCreation, r.idCreateur,
              u.username AS CreateurNom,
              (SELECT COUNT(*) FROM GPOTB02_Adherent a WHERE a.IdRole = r.IdRole) AS nbAdherents
       FROM GPOTB11_Role r
       LEFT JOIN GPOTB_Users u ON u.idUser = r.idCreateur
       ORDER BY r.Niveau, r.IdRole`
    );
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// ── GET /api/roles/:id ─────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const role = await getRoleFull(req.params.id);
    if (!role) return notFound(res, 'Rôle introuvable');
    ok(res, role);
  } catch (err) { serverError(res, err); }
});

// ── GET /api/roles/:id/historique ─────────────────────────────
router.get('/:id/historique', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT h.*, u.username AS AuteurNom
       FROM SD_RoleHistorique h
       LEFT JOIN GPOTB_Users u ON u.idUser = h.idUser
       WHERE h.IdRole = ?
       ORDER BY h.DateAction DESC
       LIMIT 100`, [req.params.id]
    );
    ok(res, rows);
  } catch (err) { serverError(res, err); }
});

// ── POST /api/roles ────────────────────────────────────────────
router.post('/', auth, roles('admin'), async (req, res) => {
  const { LibRole, Description, Niveau, Couleur, Icone, menus = [], permissions = [], habilitations = [] } = req.body;
  if (!LibRole || !LibRole.trim()) return badRequest(res, 'Le libellé du rôle est obligatoire');
  if (LibRole.trim().length > 80)  return badRequest(res, 'Libellé trop long (max 80 caractères)');

  try {
    const [exist] = await db.execute(
      `SELECT 1 FROM GPOTB11_Role WHERE LibRole = ?`, [LibRole.trim()]
    );
    if (exist.length) return res.status(409).json({ message: 'Un rôle avec ce libellé existe déjà' });

    const [result] = await db.execute(
      `INSERT INTO GPOTB11_Role(LibRole,Description,Niveau,Couleur,Icone,isSysteme,idCreateur,DateCreation)
       VALUES(?,?,?,?,?,0,?,datetime('now'))`,
      [LibRole.trim(), Description || null, Niveau || 2, Couleur || '#6366f1', Icone || '👤', req.user.idUser]
    );
    const id = result.insertId;

    for (const m of menus) {
      await db.execute(`INSERT OR IGNORE INTO SD_RoleMenu(IdRole,MenuCode) VALUES(?,?)`, [id, m]);
    }
    for (const p of permissions) {
      await db.execute(
        `INSERT OR REPLACE INTO SD_RolePermission(IdRole,Ressource,Lire,Creer,Modifier,Supprimer,Valider,Exporter)
         VALUES(?,?,?,?,?,?,?,?)`,
        [id, p.Ressource, p.Lire||0, p.Creer||0, p.Modifier||0, p.Supprimer||0, p.Valider||0, p.Exporter||0]
      );
    }
    for (const h of habilitations) {
      await db.execute(`INSERT OR IGNORE INTO SD_RoleHabilitation(IdRole,CodeHab,Valeur) VALUES(?,?,1)`, [id, h]);
    }

    await logHistorique(id, req.user.idUser, 'creation', { LibRole: LibRole.trim() });
    created(res, { message: 'Rôle créé', IdRole: id });
  } catch (err) { serverError(res, err); }
});

// ── PUT /api/roles/:id ─────────────────────────────────────────
router.put('/:id', auth, roles('admin'), async (req, res) => {
  const { LibRole, Description, Couleur, Icone, Niveau, menus, permissions, habilitations } = req.body;
  const id = req.params.id;

  try {
    const [[existing]] = await db.execute(
      `SELECT * FROM GPOTB11_Role WHERE IdRole = ?`, [id]
    );
    if (!existing) return notFound(res, 'Rôle introuvable');
    if (existing.isSysteme && LibRole && LibRole.trim() !== existing.LibRole) {
      return badRequest(res, 'Le libellé d\'un rôle système ne peut pas être modifié');
    }

    const newLib = LibRole ? LibRole.trim() : existing.LibRole;
    await db.execute(
      `UPDATE GPOTB11_Role SET LibRole=?,Description=?,Couleur=?,Icone=?,Niveau=? WHERE IdRole=?`,
      [newLib, Description ?? existing.Description, Couleur || existing.Couleur,
       Icone || existing.Icone, Niveau || existing.Niveau, id]
    );

    if (Array.isArray(menus)) {
      await db.execute(`DELETE FROM SD_RoleMenu WHERE IdRole = ?`, [id]);
      for (const m of menus) {
        await db.execute(`INSERT OR IGNORE INTO SD_RoleMenu(IdRole,MenuCode) VALUES(?,?)`, [id, m]);
      }
    }
    if (Array.isArray(permissions)) {
      await db.execute(`DELETE FROM SD_RolePermission WHERE IdRole = ?`, [id]);
      for (const p of permissions) {
        await db.execute(
          `INSERT INTO SD_RolePermission(IdRole,Ressource,Lire,Creer,Modifier,Supprimer,Valider,Exporter)
           VALUES(?,?,?,?,?,?,?,?)`,
          [id, p.Ressource, p.Lire||0, p.Creer||0, p.Modifier||0, p.Supprimer||0, p.Valider||0, p.Exporter||0]
        );
      }
    }
    if (Array.isArray(habilitations)) {
      await db.execute(`DELETE FROM SD_RoleHabilitation WHERE IdRole = ?`, [id]);
      for (const h of habilitations) {
        await db.execute(`INSERT OR IGNORE INTO SD_RoleHabilitation(IdRole,CodeHab,Valeur) VALUES(?,?,1)`, [id, h]);
      }
    }

    await logHistorique(id, req.user.idUser, 'modification', {
      avant: { LibRole: existing.LibRole, Couleur: existing.Couleur },
      apres: { LibRole: newLib, Couleur: Couleur || existing.Couleur },
    });
    ok(res, { message: 'Rôle mis à jour' });
  } catch (err) { serverError(res, err); }
});

// ── DELETE /api/roles/:id ──────────────────────────────────────
router.delete('/:id', auth, roles('admin'), async (req, res) => {
  const id = req.params.id;
  try {
    const [[existing]] = await db.execute(
      `SELECT * FROM GPOTB11_Role WHERE IdRole = ?`, [id]
    );
    if (!existing) return notFound(res, 'Rôle introuvable');
    if (existing.isSysteme) return badRequest(res, 'Les rôles système ne peuvent pas être supprimés');

    const [[usage]] = await db.execute(
      `SELECT COUNT(*) AS n FROM GPOTB02_Adherent WHERE IdRole = ?`, [id]
    );
    if (usage.n > 0) {
      return badRequest(res, `Ce rôle est utilisé par ${usage.n} adhérent(s) — réaffectez-les d'abord`);
    }

    await logHistorique(id, req.user.idUser, 'suppression', { LibRole: existing.LibRole });
    await db.execute(`DELETE FROM GPOTB11_Role WHERE IdRole = ?`, [id]);
    ok(res, { message: 'Rôle supprimé' });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
