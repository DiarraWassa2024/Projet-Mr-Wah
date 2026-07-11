router.register('habilitation', async () => {
  const app = document.getElementById('app');
  let activeTab = 'roles';
  let allRoles = [], allGroupes = [], allUsers = [], allOrgs = [];

  // ── Constants ────────────────────────────────────────────────
  const MENUS_LIST = [
    { code: 'dashboard',     label: 'Tableau de bord',  icon: '📊' },
    { code: 'organisations', label: 'Organisations',     icon: '🏢' },
    { code: 'adherents',     label: 'Adhérents',         icon: '👥' },
    { code: 'beneficiaires', label: 'Bénéficiaires',     icon: '🛡️' },
    { code: 'paiements',     label: 'Paiements',         icon: '💰' },
    { code: 'prestataires',  label: 'Prestataires',      icon: '🩺' },
    { code: 'prestations',   label: 'Prestations',       icon: '🎁' },
    { code: 'evenements',    label: 'Événements',        icon: '📅' },
    { code: 'demandes',      label: 'Demandes',          icon: '📨' },
    { code: 'besoins-admin', label: 'Besoins',           icon: '🛠️' },
    { code: 'opportunites',  label: 'Opportunités',      icon: '🌱' },
    { code: 'utilisateurs',  label: 'Utilisateurs',      icon: '👤' },
    { code: 'habilitation',  label: 'Habilitation',      icon: '🔐' },
    { code: 'piste-audit',   label: "Piste d'audit",     icon: '📋' },
    { code: 'sauvegarde',    label: 'Sauvegarde',        icon: '💾' },
    { code: 'impressions',   label: 'Impressions',       icon: '🖨️' },
  ];

  const RESSOURCES_LIST = [
    { code: 'organisation',  label: 'Organisations' },
    { code: 'adherent',      label: 'Adhérents' },
    { code: 'beneficiaire',  label: 'Bénéficiaires' },
    { code: 'paiement',      label: 'Paiements' },
    { code: 'cotisation',    label: 'Cotisations' },
    { code: 'prestataire',   label: 'Prestataires' },
    { code: 'prestation',    label: 'Prestations' },
    { code: 'evenement',     label: 'Événements' },
    { code: 'demande',       label: 'Demandes' },
    { code: 'besoin',        label: 'Besoins' },
    { code: 'opportunite',   label: 'Opportunités' },
    { code: 'utilisateur',   label: 'Utilisateurs' },
    { code: 'role',          label: 'Rôles' },
    { code: 'groupe',        label: 'Groupes' },
    { code: 'document',      label: 'Documents' },
  ];

  const HABILITATIONS_LIST = [
    { code: 'voir_toutes_orgs',    label: 'Voir toutes les organisations' },
    { code: 'voir_tous_adherents', label: 'Voir tous les adhérents' },
    { code: 'changer_statut_adh',  label: 'Changer le statut des adhérents' },
    { code: 'valider_paiements',   label: 'Valider les paiements' },
    { code: 'gerer_budget',        label: 'Gérer le budget' },
    { code: 'signer_documents',    label: 'Signer les documents' },
    { code: 'representer_org',     label: "Représenter l'organisation" },
    { code: 'inviter_membres',     label: 'Inviter des membres' },
    { code: 'exclure_membres',     label: 'Exclure des membres' },
    { code: 'modifier_statuts',    label: "Modifier les statuts de l'association" },
    { code: 'acceder_audit',       label: "Accéder à la piste d'audit" },
    { code: 'exporter_donnees',    label: 'Exporter les données' },
    { code: 'gerer_utilisateurs',  label: 'Gérer les utilisateurs' },
    { code: 'sauvegarder',         label: 'Effectuer des sauvegardes' },
  ];

  const PERMS_COLS = ['Lire', 'Creer', 'Modifier', 'Supprimer', 'Valider', 'Exporter'];
  const NIVEAU_CFG = { 1: { lib: 'Plateforme', cls: 'role-niveau-1' }, 2: { lib: 'Organisation', cls: 'role-niveau-2' } };

  function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `gpo-toast gpo-toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ── Load data ────────────────────────────────────────────────
  async function loadAll() {
    [allRoles, allGroupes, allUsers, allOrgs] = await Promise.all([
      api.get('/roles'),
      api.get('/groupes'),
      api.get('/utilisateurs').catch(() => []),
      api.get('/organisations').catch(() => []),
    ]);
  }

  // ── Shell ────────────────────────────────────────────────────
  function renderShell() {
    app.innerHTML = `
      <div class="page-header">
        <h2>🔐 Habilitation & Rôles</h2>
      </div>
      <div class="hab-main-tabs">
        <button class="hab-main-tab ${activeTab==='roles'?'active':''}"    data-t="roles">🎭 Rôles <span class="adh-count">${allRoles.length}</span></button>
        <button class="hab-main-tab ${activeTab==='groupes'?'active':''}"  data-t="groupes">👥 Groupes <span class="adh-count">${allGroupes.length}</span></button>
      </div>
      <div id="hab-content"></div>`;

    document.querySelectorAll('.hab-main-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.t;
        renderShell();
        renderContent();
      });
    });
  }

  // ── ROLES TAB ────────────────────────────────────────────────
  function renderRoles() {
    const content = document.getElementById('hab-content');
    const curUser = JSON.parse(localStorage.getItem('gpo_user') || '{}');
    const isAdmin = curUser.role === 'admin';

    content.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        ${isAdmin ? `<button class="btn btn-primary" id="btnNewRole" style="background:#6366f1;border-color:#6366f1">+ Nouveau rôle</button>` : ''}
      </div>
      <div class="role-grid">
        ${allRoles.map(r => roleCard(r, isAdmin)).join('')}
      </div>`;

    document.getElementById('btnNewRole')?.addEventListener('click', () => openRoleModal());

    content.querySelectorAll('.btn-role-edit').forEach(btn =>
      btn.addEventListener('click', () => openRoleModal(parseInt(btn.dataset.id)))
    );
    content.querySelectorAll('.btn-role-del').forEach(btn =>
      btn.addEventListener('click', () => deleteRole(parseInt(btn.dataset.id), btn.dataset.lib))
    );
    content.querySelectorAll('.btn-role-hist').forEach(btn =>
      btn.addEventListener('click', () => openHistModal(parseInt(btn.dataset.id), btn.dataset.lib))
    );
  }

  function roleCard(r, isAdmin) {
    const niv = NIVEAU_CFG[r.Niveau] || NIVEAU_CFG[2];
    return `
    <div class="role-card" style="border-top:4px solid ${r.Couleur}">
      <div class="role-card-header">
        <div class="role-icon" style="background:${r.Couleur}18;color:${r.Couleur}">${r.Icone || '👤'}</div>
        <div class="role-card-info">
          <div class="role-card-name">${r.LibRole}
            ${r.isSysteme ? '<span class="role-systeme-badge">système</span>' : ''}
          </div>
          <div class="role-card-meta">
            <span class="role-niveau-badge ${niv.cls}">${niv.lib}</span>
            ${r.nbAdherents > 0 ? `<span class="role-usage">${r.nbAdherents} adhérent(s)</span>` : ''}
          </div>
        </div>
      </div>
      ${r.Description ? `<p class="role-desc">${r.Description}</p>` : ''}
      <div class="role-card-footer">
        <div class="role-meta-line">
          ${r.CreateurNom ? `<span title="Créateur">👤 ${r.CreateurNom}</span>` : '<span style="color:#9ca3af">Système</span>'}
          ${r.DateCreation ? `<span>📅 ${new Date(r.DateCreation).toLocaleDateString('fr-FR')}</span>` : ''}
        </div>
        <div class="role-actions">
          <button class="btn-icon btn-role-hist" data-id="${r.IdRole}" data-lib="${r.LibRole}" title="Historique">📋</button>
          ${isAdmin ? `
            <button class="btn-icon btn-role-edit" data-id="${r.IdRole}" title="Modifier">✏️</button>
            ${!r.isSysteme ? `<button class="btn-icon del btn-role-del" data-id="${r.IdRole}" data-lib="${r.LibRole}" title="Supprimer">🗑️</button>` : ''}
          ` : ''}
        </div>
      </div>
    </div>`;
  }

  async function deleteRole(id, lib) {
    if (!confirm(`Supprimer le rôle « ${lib} » ?`)) return;
    try {
      await api.delete(`/roles/${id}`);
      toast('Rôle supprimé');
      await loadAll(); renderShell(); renderContent();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ── ROLE MODAL ───────────────────────────────────────────────
  async function openRoleModal(id = null) {
    const isEdit = id !== null;
    let role = {};
    if (isEdit) {
      try { role = await api.get(`/roles/${id}`); } catch(e) { toast(e.message,'error'); return; }
    }

    const activeMenus = new Set(role.menus || []);
    const permMap = {};
    (role.permissions || []).forEach(p => { permMap[p.Ressource] = p; });
    const activeHabs = new Set((role.habilitations || []).map(h => h.CodeHab));

    const html = `
    <div class="modal-overlay" id="roleModalOverlay" style="z-index:1200">
      <div class="modal" style="max-width:780px;width:97%;max-height:94vh;display:flex;flex-direction:column">
        <div class="modal-header" style="border-bottom:3px solid #6366f1">
          <h3>${isEdit ? '✏️ Modifier rôle' : '➕ Nouveau rôle'}${role.LibRole ? ` — <em>${role.LibRole}</em>` : ''}</h3>
          <button class="modal-close" id="roleClose">&times;</button>
        </div>
        <div class="adh-tabs">
          <button type="button" class="adh-tab active" data-tab="rinfo">📋 Informations</button>
          <button type="button" class="adh-tab" data-tab="rmenus">📌 Menus</button>
          <button type="button" class="adh-tab" data-tab="rperms">🔒 Permissions</button>
          <button type="button" class="adh-tab" data-tab="rhabs">🏅 Habilitations</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:18px 22px">
          <!-- Informations -->
          <div class="adh-tab-pane active" id="rpane-rinfo">
            <div class="form-row">
              <div class="form-group">
                <label>Libellé *</label>
                <input type="text" id="rLibRole" value="${role.LibRole || ''}" maxlength="80" placeholder="Nom du rôle"
                  ${isEdit && role.isSysteme ? 'readonly style="background:#f9fafb"' : ''}>
                ${isEdit && role.isSysteme ? '<p style="font-size:11px;color:#9ca3af;margin-top:4px">ℹ️ Libellé non modifiable pour un rôle système</p>' : ''}
              </div>
              <div class="form-group" style="max-width:160px">
                <label>Niveau</label>
                <select id="rNiveau" ${isEdit && role.isSysteme ? 'disabled' : ''}>
                  <option value="1" ${(role.Niveau||2)==1?'selected':''}>Plateforme</option>
                  <option value="2" ${(role.Niveau||2)==2?'selected':''}>Organisation</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea id="rDescription" rows="2" style="width:100%;resize:vertical;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px">${role.Description || ''}</textarea>
            </div>
            <div class="form-row" style="align-items:flex-end">
              <div class="form-group" style="max-width:120px">
                <label>Couleur</label>
                <input type="color" id="rCouleur" value="${role.Couleur || '#6366f1'}" style="width:100%;height:36px;border-radius:6px;cursor:pointer">
              </div>
              <div class="form-group">
                <label>Icône (emoji)</label>
                <input type="text" id="rIcone" value="${role.Icone || '👤'}" maxlength="4" style="font-size:20px;width:70px;text-align:center">
              </div>
            </div>
          </div>

          <!-- Menus -->
          <div class="adh-tab-pane" id="rpane-rmenus">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="font-size:13px;color:#6b7280">Cochez les menus accessibles pour ce rôle</span>
              <div style="display:flex;gap:8px">
                <button type="button" class="btn btn-sm btn-secondary" id="rMenuAll">Tout cocher</button>
                <button type="button" class="btn btn-sm btn-secondary" id="rMenuNone">Tout décocher</button>
              </div>
            </div>
            <div class="role-menu-grid">
              ${MENUS_LIST.map(m => `
                <label class="role-menu-item ${activeMenus.has(m.code) ? 'checked' : ''}">
                  <input type="checkbox" class="rMenuCb" value="${m.code}" ${activeMenus.has(m.code) ? 'checked' : ''}>
                  <span class="role-menu-icon">${m.icon}</span>
                  <span>${m.label}</span>
                </label>`).join('')}
            </div>
          </div>

          <!-- Permissions -->
          <div class="adh-tab-pane" id="rpane-rperms">
            <div style="font-size:13px;color:#6b7280;margin-bottom:12px">Définissez les droits CRUD par ressource</div>
            <div style="overflow-x:auto">
              <table class="table role-perm-table">
                <thead><tr>
                  <th>Ressource</th>
                  ${PERMS_COLS.map(c => `<th style="text-align:center;white-space:nowrap">${c}</th>`).join('')}
                  <th style="text-align:center">Tout</th>
                </tr></thead>
                <tbody>
                  ${RESSOURCES_LIST.map(res => {
                    const p = permMap[res.code] || {};
                    return `<tr data-res="${res.code}">
                      <td style="font-weight:500">${res.label}</td>
                      ${PERMS_COLS.map(col => `<td style="text-align:center">
                        <input type="checkbox" class="rPermCb" data-res="${res.code}" data-col="${col}" ${p[col] ? 'checked' : ''}>
                      </td>`).join('')}
                      <td style="text-align:center">
                        <button type="button" class="btn-row-all" data-res="${res.code}" title="Tout cocher la ligne">▶</button>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Habilitations -->
          <div class="adh-tab-pane" id="rpane-rhabs">
            <div style="font-size:13px;color:#6b7280;margin-bottom:12px">Habilitations spéciales accordées à ce rôle</div>
            <div class="role-hab-grid">
              ${HABILITATIONS_LIST.map(h => `
                <label class="role-hab-item ${activeHabs.has(h.code) ? 'checked' : ''}">
                  <input type="checkbox" class="rHabCb" value="${h.code}" ${activeHabs.has(h.code) ? 'checked' : ''}>
                  <span class="role-hab-icon">🏅</span>
                  <span>${h.label}</span>
                </label>`).join('')}
            </div>
          </div>
        </div>

        <div class="form-actions" style="padding:14px 22px;border-top:1px solid #e5e7eb;flex-shrink:0">
          <button type="button" class="btn btn-secondary" id="roleClose2">Annuler</button>
          <button type="button" class="btn btn-primary" id="roleSave" style="background:#6366f1;border-color:#6366f1">💾 Enregistrer</button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    const ov = document.getElementById('roleModalOverlay');
    const close = () => ov.remove();

    document.getElementById('roleClose').onclick  = close;
    document.getElementById('roleClose2').onclick = close;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });

    // Tabs
    ov.querySelectorAll('.adh-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        ov.querySelectorAll('.adh-tab, .adh-tab-pane').forEach(el => el.classList.remove('active'));
        tab.classList.add('active');
        ov.querySelector(`#rpane-${tab.dataset.tab}`).classList.add('active');
      });
    });

    // Menu checkbox style
    ov.querySelectorAll('.rMenuCb').forEach(cb => {
      cb.addEventListener('change', () => cb.closest('label').classList.toggle('checked', cb.checked));
    });
    ov.querySelectorAll('.rHabCb').forEach(cb => {
      cb.addEventListener('change', () => cb.closest('label').classList.toggle('checked', cb.checked));
    });
    document.getElementById('rMenuAll').onclick  = () => ov.querySelectorAll('.rMenuCb').forEach(cb => { cb.checked = true;  cb.closest('label').classList.add('checked'); });
    document.getElementById('rMenuNone').onclick = () => ov.querySelectorAll('.rMenuCb').forEach(cb => { cb.checked = false; cb.closest('label').classList.remove('checked'); });

    // Row all-permissions button
    ov.querySelectorAll('.btn-row-all').forEach(btn => {
      btn.addEventListener('click', () => {
        const res = btn.dataset.res;
        const cbs = ov.querySelectorAll(`.rPermCb[data-res="${res}"]`);
        const allChecked = [...cbs].every(c => c.checked);
        cbs.forEach(c => { c.checked = !allChecked; });
      });
    });

    // Save
    document.getElementById('roleSave').addEventListener('click', async () => {
      const btn = document.getElementById('roleSave');
      const LibRole = document.getElementById('rLibRole').value.trim();
      if (!LibRole) { toast('Le libellé est obligatoire', 'error'); return; }

      const menus = [...ov.querySelectorAll('.rMenuCb:checked')].map(c => c.value);
      const permissions = RESSOURCES_LIST.map(res => {
        const p = { Ressource: res.code };
        PERMS_COLS.forEach(col => {
          p[col] = ov.querySelector(`.rPermCb[data-res="${res.code}"][data-col="${col}"]`)?.checked ? 1 : 0;
        });
        return p;
      });
      const habilitations = [...ov.querySelectorAll('.rHabCb:checked')].map(c => c.value);

      const body = {
        LibRole,
        Description: document.getElementById('rDescription').value.trim() || null,
        Niveau:      parseInt(document.getElementById('rNiveau').value),
        Couleur:     document.getElementById('rCouleur').value,
        Icone:       document.getElementById('rIcone').value || '👤',
        menus, permissions, habilitations,
      };

      btn.disabled = true;
      try {
        if (isEdit) { await api.put(`/roles/${id}`, body); toast('Rôle mis à jour'); }
        else        { await api.post('/roles', body);      toast('Rôle créé'); }
        close();
        await loadAll(); renderShell(); renderContent();
      } catch(e) { toast(e.message, 'error'); }
      finally { btn.disabled = false; }
    });
  }

  // ── HISTORIQUE MODAL ─────────────────────────────────────────
  async function openHistModal(id, lib) {
    let hist = [];
    try { hist = await api.get(`/roles/${id}/historique`); } catch(e) { toast(e.message,'error'); return; }

    const ACTION_CFG = {
      creation:     { icon: '✨', cls: 'hist-creation' },
      modification: { icon: '✏️', cls: 'hist-modification' },
      suppression:  { icon: '🗑️', cls: 'hist-suppression' },
    };

    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="histModalOverlay" style="z-index:1300">
      <div class="modal" style="max-width:640px;width:95%;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <h3>📋 Historique — ${lib}</h3>
          <button class="modal-close" id="histClose">&times;</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:16px 20px">
          ${hist.length === 0
            ? '<p style="color:#9ca3af;text-align:center;padding:32px">Aucun historique enregistré</p>'
            : hist.map(h => {
              const cfg = ACTION_CFG[h.Action] || { icon: '•', cls: '' };
              let detail = '';
              try { const d = JSON.parse(h.Detail); detail = JSON.stringify(d, null, 2); } catch(_) { detail = h.Detail || ''; }
              return `
              <div class="hist-item ${cfg.cls}">
                <div class="hist-icon">${cfg.icon}</div>
                <div class="hist-body">
                  <div class="hist-action">${h.Action}</div>
                  <div class="hist-meta">par <strong>${h.AuteurNom || '—'}</strong> · ${new Date(h.DateAction).toLocaleString('fr-FR')}</div>
                  ${detail ? `<pre class="hist-detail">${detail}</pre>` : ''}
                </div>
              </div>`;
            }).join('')}
        </div>
        <div class="form-actions" style="padding:12px 20px;border-top:1px solid #e5e7eb">
          <button class="btn btn-secondary" id="histClose2">Fermer</button>
        </div>
      </div>
    </div>`);

    const ov = document.getElementById('histModalOverlay');
    const close = () => ov.remove();
    document.getElementById('histClose').onclick  = close;
    document.getElementById('histClose2').onclick = close;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
  }

  // ── GROUPES TAB ──────────────────────────────────────────────
  function renderGroupes() {
    const content = document.getElementById('hab-content');
    const curUser = JSON.parse(localStorage.getItem('gpo_user') || '{}');

    content.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn btn-primary" id="btnNewGroupe">+ Nouveau groupe</button>
      </div>
      ${allGroupes.length === 0
        ? '<div class="adh-empty-hint" style="text-align:center;padding:48px">Aucun groupe créé</div>'
        : `<div class="groupe-grid">
          ${allGroupes.map(g => {
            const isCreateur = g.idCreateur === curUser.idUser || curUser.role === 'admin';
            return `
            <div class="groupe-card">
              <div class="groupe-card-header">
                <div class="groupe-icon">👥</div>
                <div>
                  <div class="groupe-name">${g.LibGroupe}</div>
                  ${g.LibOrg ? `<div class="groupe-org">${g.LibOrg}</div>` : ''}
                </div>
                ${isCreateur ? `<div class="groupe-actions">
                  <button class="btn-icon btn-grp-edit" data-id="${g.IdGroupe}" title="Modifier">✏️</button>
                  <button class="btn-icon del btn-grp-del" data-id="${g.IdGroupe}" data-lib="${g.LibGroupe}" title="Supprimer">🗑️</button>
                </div>` : ''}
              </div>
              ${g.Description ? `<p class="groupe-desc">${g.Description}</p>` : ''}
              <div class="groupe-footer">
                <span>👥 ${g.nbMembres} membre(s)</span>
                <span>📅 ${new Date(g.DateCreation).toLocaleDateString('fr-FR')}</span>
                <button class="btn btn-sm btn-secondary btn-grp-membres" data-id="${g.IdGroupe}" data-lib="${g.LibGroupe}">Membres</button>
              </div>
            </div>`;
          }).join('')}
        </div>`}`;

    document.getElementById('btnNewGroupe').addEventListener('click', () => openGroupeModal());
    content.querySelectorAll('.btn-grp-edit').forEach(btn =>
      btn.addEventListener('click', () => openGroupeModal(parseInt(btn.dataset.id)))
    );
    content.querySelectorAll('.btn-grp-del').forEach(btn =>
      btn.addEventListener('click', () => deleteGroupe(parseInt(btn.dataset.id), btn.dataset.lib))
    );
    content.querySelectorAll('.btn-grp-membres').forEach(btn =>
      btn.addEventListener('click', () => openMembresModal(parseInt(btn.dataset.id), btn.dataset.lib))
    );
  }

  async function deleteGroupe(id, lib) {
    if (!confirm(`Supprimer le groupe « ${lib} » ?`)) return;
    try {
      await api.delete(`/groupes/${id}`);
      toast('Groupe supprimé');
      await loadAll(); renderShell(); renderContent();
    } catch(e) { toast(e.message, 'error'); }
  }

  async function openGroupeModal(id = null) {
    const isEdit = id !== null;
    let g = {};
    if (isEdit) {
      try { const rows = allGroupes.find(x => x.IdGroupe === id); g = rows || {}; } catch(_) {}
    }

    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="grpModalOverlay" style="z-index:1200">
      <div class="modal" style="max-width:480px;width:95%">
        <div class="modal-header">
          <h3>${isEdit ? '✏️ Modifier groupe' : '➕ Nouveau groupe'}</h3>
          <button class="modal-close" id="grpClose">&times;</button>
        </div>
        <div style="padding:18px 22px">
          <div class="form-group">
            <label>Nom du groupe *</label>
            <input type="text" id="grpLib" value="${g.LibGroupe || ''}" maxlength="80" placeholder="Ex: Bureau exécutif">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="grpDesc" rows="2" style="width:100%;resize:vertical;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px">${g.Description || ''}</textarea>
          </div>
          <div class="form-group">
            <label>Organisation</label>
            <select id="grpOrg">
              <option value="">— Toutes les organisations —</option>
              ${allOrgs.map(o => `<option value="${o.NumAgr}" ${g.NumAgr===o.NumAgr?'selected':''}>${o.LibOrg}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-actions" style="padding:12px 22px;border-top:1px solid #e5e7eb">
          <button class="btn btn-secondary" id="grpClose2">Annuler</button>
          <button class="btn btn-primary" id="grpSave">💾 Enregistrer</button>
        </div>
      </div>
    </div>`);

    const ov = document.getElementById('grpModalOverlay');
    const close = () => ov.remove();
    document.getElementById('grpClose').onclick  = close;
    document.getElementById('grpClose2').onclick = close;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });

    document.getElementById('grpSave').addEventListener('click', async () => {
      const btn = document.getElementById('grpSave');
      const lib = document.getElementById('grpLib').value.trim();
      if (!lib) { toast('Le nom est obligatoire', 'error'); return; }
      const body = { LibGroupe: lib, Description: document.getElementById('grpDesc').value.trim()||null, NumAgr: document.getElementById('grpOrg').value||null };
      btn.disabled = true;
      try {
        if (isEdit) { await api.put(`/groupes/${id}`, body); toast('Groupe mis à jour'); }
        else        { await api.post('/groupes', body);      toast('Groupe créé'); }
        close(); await loadAll(); renderShell(); renderContent();
      } catch(e) { toast(e.message, 'error'); }
      finally { btn.disabled = false; }
    });
  }

  async function openMembresModal(id, lib) {
    let membres = [];
    try { membres = await api.get(`/groupes/${id}/membres`); } catch(e) { toast(e.message,'error'); return; }
    const curUser = JSON.parse(localStorage.getItem('gpo_user') || '{}');
    const groupe  = allGroupes.find(g => g.IdGroupe === id) || {};
    const isOwner = groupe.idCreateur === curUser.idUser || curUser.role === 'admin';

    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="membresModalOverlay" style="z-index:1300">
      <div class="modal" style="max-width:520px;width:95%;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <h3>👥 Membres — ${lib}</h3>
          <button class="modal-close" id="mbrClose">&times;</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:16px 20px">
          ${isOwner ? `
          <div style="display:flex;gap:8px;margin-bottom:16px">
            <select id="mbrSelectUser" style="flex:1;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px">
              <option value="">— Ajouter un utilisateur —</option>
              ${allUsers.filter(u => !membres.find(m => m.idUser === u.idUser))
                .map(u => `<option value="${u.idUser}">${u.username} (${u.email})</option>`).join('')}
            </select>
            <button class="btn btn-primary" id="mbrAddBtn" style="white-space:nowrap">+ Ajouter</button>
          </div>` : ''}
          <div id="mbrList">
            ${membres.length === 0
              ? '<p style="color:#9ca3af;text-align:center;padding:24px">Aucun membre dans ce groupe</p>'
              : membres.map(m => `
                <div class="membre-item" data-uid="${m.idUser}">
                  <div class="membre-avatar">${(m.username||'?')[0].toUpperCase()}</div>
                  <div class="membre-info">
                    <div class="membre-name">${m.username}</div>
                    <div class="membre-meta">${m.email} · ${m.role}</div>
                  </div>
                  ${isOwner ? `<button class="btn-icon del btn-mbr-del" data-uid="${m.idUser}" title="Retirer">✖</button>` : ''}
                </div>`).join('')}
          </div>
        </div>
        <div class="form-actions" style="padding:12px 20px;border-top:1px solid #e5e7eb">
          <button class="btn btn-secondary" id="mbrClose2">Fermer</button>
        </div>
      </div>
    </div>`);

    const ov = document.getElementById('membresModalOverlay');
    const close = () => ov.remove();
    document.getElementById('mbrClose').onclick  = close;
    document.getElementById('mbrClose2').onclick = close;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });

    document.getElementById('mbrAddBtn')?.addEventListener('click', async () => {
      const uid = document.getElementById('mbrSelectUser').value;
      if (!uid) { toast('Sélectionnez un utilisateur','error'); return; }
      try {
        await api.post(`/groupes/${id}/membres`, { idUser: parseInt(uid) });
        toast('Membre ajouté'); close(); openMembresModal(id, lib);
      } catch(e) { toast(e.message,'error'); }
    });

    ov.querySelectorAll('.btn-mbr-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Retirer ce membre ?')) return;
        try {
          await api.delete(`/groupes/${id}/membres/${btn.dataset.uid}`);
          btn.closest('.membre-item').remove();
          toast('Membre retiré');
        } catch(e) { toast(e.message,'error'); }
      });
    });
  }

  // ── Dispatch content ─────────────────────────────────────────
  function renderContent() {
    if      (activeTab === 'roles')      renderRoles();
    else if (activeTab === 'groupes')    renderGroupes();
  }

  // ── Boot ─────────────────────────────────────────────────────
  await loadAll();
  renderShell();
  renderContent();
});
