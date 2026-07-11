router.register('prestataires', async () => {
  const app = document.getElementById('app');
  let activeTab = 'moral';
  let listMoral = [], listPhysique = [];
  let filterPays = '', filterStatut = '', filterSearch = '';

  const STATUT_CFG = {
    1: { lib: 'Actif',      cls: 'badge-actif',    icon: '✅' },
    2: { lib: 'Inactif',    cls: 'badge-inactif',  icon: '⚫' },
    3: { lib: 'Suspendu',   cls: 'badge-suspendu', icon: '⚠️' },
    4: { lib: 'En attente', cls: 'badge-attente',  icon: '⏳' },
    5: { lib: 'Clôturé',    cls: 'badge-cloture',  icon: '🔒' },
  };
  const TRANSITIONS_FE = {
    4: [{ action: 'valider',    label: 'Valider',    cls: 'btn-wf-valider'    },
        { action: 'rejeter',    label: 'Rejeter',    cls: 'btn-wf-rejeter'    }],
    1: [{ action: 'suspendre',  label: 'Suspendre',  cls: 'btn-wf-suspendre'  },
        { action: 'desactiver', label: 'Désactiver', cls: 'btn-wf-desactiver' },
        { action: 'cloturer',   label: 'Clôturer',   cls: 'btn-wf-cloturer'   }],
    3: [{ action: 'reactiver',  label: 'Réactiver',  cls: 'btn-wf-reactiver'  }],
    2: [{ action: 'reactiver',  label: 'Réactiver',  cls: 'btn-wf-reactiver'  }],
  };

  function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `gpo-toast gpo-toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function statusBadge(idStatut) {
    const s = STATUT_CFG[idStatut] || { lib: '—', cls: 'badge-grey', icon: '?' };
    return `<span class="badge ${s.cls}">${s.icon} ${s.lib}</span>`;
  }

  function paysOpts(sel = '') {
    return `<option value="">— Pays —</option>` + Object.values(PAYS_CONFIG).map(p =>
      `<option value="${p.code}"${sel === p.code ? ' selected' : ''}>${p.drapeau} ${p.nom}</option>`
    ).join('');
  }

  function workflowBtns(row, endpoint) {
    const actions = TRANSITIONS_FE[row.IdStatut] || [];
    if (!actions.length) return '';
    return actions.map(a =>
      `<button class="btn-wf ${a.cls}" data-endpoint="${endpoint}" data-id="${row.rcc || row.IdPrestataire}" data-action="${a.action}">${a.label}</button>`
    ).join('');
  }

  async function loadAll() {
    const p = new URLSearchParams();
    if (filterPays)   p.set('pays', filterPays);
    if (filterStatut) p.set('statut', filterStatut);
    if (filterSearch) p.set('search', filterSearch);
    [listMoral, listPhysique] = await Promise.all([
      api.get(`/prestataires/moraux?${p}`),
      api.get(`/prestataires/physiques?${p}`),
    ]);
  }

  // ── Modal ──────────────────────────────────────────────────────
  function buildModalHtml(type, row, isEdit) {
    const isMoral = type === 'moral';
    const title = isMoral ? 'prestataire (organisation)' : 'prestataire (personne)';

    const fields = isMoral ? `
      <div class="form-group">
        <label>Nom de l'organisation *</label>
        <input type="text" name="NomOrg" value="${row.NomOrg || ''}" required minlength="2" maxlength="150">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Pays *</label>
          <select name="CodePays" ${isEdit ? 'disabled' : 'required'}>${paysOpts(row.CodePays)}</select>
        </div>
        <div class="form-group">
          <label>Siège</label>
          <input type="text" name="Siege" value="${row.Siege || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="EmailOrg" value="${row.EmailOrg || ''}">
        </div>
        <div class="form-group">
          <label>Téléphone</label>
          <input type="text" name="TelOrg" value="${row.TelOrg || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Site web</label>
        <input type="url" name="SiteWeb" value="${row.SiteWeb || ''}" placeholder="https://...">
      </div>` : `
      <div class="form-row">
        <div class="form-group">
          <label>Nom *</label>
          <input type="text" name="NomPrestataire" value="${row.NomPrestataire || ''}" required minlength="2" maxlength="100">
        </div>
        <div class="form-group">
          <label>Prénom</label>
          <input type="text" name="PrenPrestataire" value="${row.PrenPrestataire || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Pays *</label>
          <select name="CodePays" ${isEdit ? 'disabled' : 'required'}>${paysOpts(row.CodePays)}</select>
        </div>
        <div class="form-group">
          <label>Date de naissance</label>
          <input type="date" name="DateNaissPrestataire" value="${row.DateNaissPrestataire ? row.DateNaissPrestataire.split('T')[0] : ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="EmailPrestataire" value="${row.EmailPrestataire || ''}">
        </div>
        <div class="form-group">
          <label>Téléphone</label>
          <input type="text" name="TelPrestataire" value="${row.TelPrestataire || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Spécialité</label>
        <input type="text" name="Specialite" value="${row.Specialite || ''}" placeholder="Ex : Formation, Santé, Logistique…">
      </div>`;

    return `
    <div class="modal-overlay" id="prestModalOverlay">
      <div class="modal" style="max-width:560px;width:95%">
        <div class="modal-header">
          <h3>${isEdit ? '✏️ Modifier' : '➕ Nouveau'} ${title}</h3>
          <button class="modal-close" id="prestCloseBtn">&times;</button>
        </div>
        <form id="prestForm" style="padding:16px 20px">
          ${fields}
        </form>
        <div class="form-actions" style="padding:14px 20px;border-top:1px solid #e5e7eb">
          <button type="button" class="btn btn-secondary" id="prestCloseBtn2">Annuler</button>
          <button type="submit" form="prestForm" class="btn btn-primary">💾 Enregistrer</button>
        </div>
      </div>
    </div>`;
  }

  async function openModal(type, id = null) {
    const isEdit = !!id;
    const endpoint = type === 'moral' ? 'moraux' : 'physiques';
    const row = isEdit ? await api.get(`/prestataires/${endpoint}/${id}`) : {};

    document.body.insertAdjacentHTML('beforeend', buildModalHtml(type, row, isEdit));
    const overlay = document.getElementById('prestModalOverlay');
    const close = () => overlay.remove();
    document.getElementById('prestCloseBtn').onclick  = close;
    document.getElementById('prestCloseBtn2').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    document.getElementById('prestForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = overlay.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        const fd = new FormData(e.target);
        const body = Object.fromEntries(fd.entries());
        if (isEdit) {
          await api.put(`/prestataires/${endpoint}/${id}`, body);
          toast('Prestataire mis à jour');
        } else {
          await api.post(`/prestataires/${endpoint}`, body);
          toast('Prestataire créé en attente de validation');
        }
        close(); render();
      } catch (err) { toast(err.message, 'error'); }
      finally { btn.disabled = false; }
    });
  }

  async function doTransition(endpoint, id, action) {
    try {
      await api.post(`/prestataires/${endpoint}/${id}/statut`, { action });
      toast('Statut mis à jour');
      render();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function doDelete(endpoint, id) {
    if (!confirm('Supprimer ce prestataire ?')) return;
    try {
      await api.delete(`/prestataires/${endpoint}/${id}`);
      toast('Prestataire supprimé');
      render();
    } catch (err) { toast(err.message, 'error'); }
  }

  // ── Rendu tableau ────────────────────────────────────────────
  function renderTableMoral() {
    return `
      <table class="table">
        <thead><tr>
          <th>Organisation</th><th>Pays</th><th>Contact</th><th>Prestations</th><th>Statut</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${listMoral.length ? listMoral.map(r => `
            <tr>
              <td><strong>${r.NomOrg}</strong><br><code class="id-code">${r.rcc}</code></td>
              <td>${r.DrapEau || ''} ${r.LibPays || r.CodePays || '—'}</td>
              <td>${r.EmailOrg || '—'}${r.TelOrg ? '<br>' + r.TelOrg : ''}</td>
              <td>${r.nbPrestations || 0}</td>
              <td>${statusBadge(r.IdStatut)}</td>
              <td class="actions">
                ${workflowBtns(r, 'moraux')}
                <button class="btn-icon edit" data-type="moral" data-id="${r.rcc}" title="Modifier">✏️</button>
                <button class="btn-icon del"  data-type="moral" data-id="${r.rcc}" title="Supprimer">🗑️</button>
              </td>
            </tr>`).join('')
          : `<tr><td colspan="6" class="text-center" style="padding:48px;color:#9ca3af">Aucun prestataire organisationnel</td></tr>`}
        </tbody>
      </table>`;
  }

  function renderTablePhysique() {
    return `
      <table class="table">
        <thead><tr>
          <th>Nom</th><th>Pays</th><th>Spécialité</th><th>Contact</th><th>Statut</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${listPhysique.length ? listPhysique.map(r => `
            <tr>
              <td><strong>${r.NomPrestataire}${r.PrenPrestataire ? ' ' + r.PrenPrestataire : ''}</strong></td>
              <td>${r.DrapEau || ''} ${r.LibPays || r.CodePays || '—'}</td>
              <td>${r.Specialite || '—'}</td>
              <td>${r.EmailPrestataire || '—'}${r.TelPrestataire ? '<br>' + r.TelPrestataire : ''}</td>
              <td>${statusBadge(r.IdStatut)}</td>
              <td class="actions">
                ${workflowBtns(r, 'physiques')}
                <button class="btn-icon edit" data-type="physique" data-id="${r.IdPrestataire}" title="Modifier">✏️</button>
                <button class="btn-icon del"  data-type="physique" data-id="${r.IdPrestataire}" title="Supprimer">🗑️</button>
              </td>
            </tr>`).join('')
          : `<tr><td colspan="6" class="text-center" style="padding:48px;color:#9ca3af">Aucun prestataire individuel</td></tr>`}
        </tbody>
      </table>`;
  }

  async function render() {
    await loadAll();
    app.innerHTML = `
      <div class="page-header">
        <h2>🩺 Prestataires <span class="adh-count">${listMoral.length + listPhysique.length}</span></h2>
        <div class="header-actions">
          <input type="search" id="prestSearch" class="input-sm" placeholder="🔍 Nom…" value="${filterSearch}" style="width:160px">
          <select id="prestPaysFil" class="select-sm">${paysOpts(filterPays)}</select>
          <select id="prestStatutFil" class="select-sm">
            <option value="">Tous statuts</option>
            ${Object.entries(STATUT_CFG).map(([k,v]) => `<option value="${k}"${filterStatut===k?' selected':''}>${v.icon} ${v.lib}</option>`).join('')}
          </select>
          <button class="btn btn-primary" id="btnAddPrest">+ Ajouter</button>
        </div>
      </div>
      <div class="hab-main-tabs">
        <button class="hab-main-tab ${activeTab==='moral'?'active':''}" data-t="moral">🏢 Organisations <span class="adh-count">${listMoral.length}</span></button>
        <button class="hab-main-tab ${activeTab==='physique'?'active':''}" data-t="physique">🧑 Individus <span class="adh-count">${listPhysique.length}</span></button>
      </div>
      <div class="table-wrap">
        ${activeTab === 'moral' ? renderTableMoral() : renderTablePhysique()}
      </div>`;

    document.querySelectorAll('.hab-main-tab').forEach(btn => {
      btn.addEventListener('click', () => { activeTab = btn.dataset.t; render(); });
    });

    let searchTimer = null;
    document.getElementById('prestSearch').addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { filterSearch = e.target.value.trim(); render(); }, 400);
    });
    document.getElementById('prestPaysFil').addEventListener('change', e => { filterPays = e.target.value; render(); });
    document.getElementById('prestStatutFil').addEventListener('change', e => { filterStatut = e.target.value; render(); });
    document.getElementById('btnAddPrest').addEventListener('click', () => openModal(activeTab));

    document.querySelectorAll('.btn-icon.edit').forEach(btn => {
      btn.addEventListener('click', () => openModal(btn.dataset.type, btn.dataset.id));
    });
    document.querySelectorAll('.btn-icon.del').forEach(btn => {
      const endpoint = btn.dataset.type === 'moral' ? 'moraux' : 'physiques';
      btn.addEventListener('click', () => doDelete(endpoint, btn.dataset.id));
    });
    document.querySelectorAll('.btn-wf').forEach(btn => {
      btn.addEventListener('click', () => doTransition(btn.dataset.endpoint, btn.dataset.id, btn.dataset.action));
    });
  }

  render();
});
