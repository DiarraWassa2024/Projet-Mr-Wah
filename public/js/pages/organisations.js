router.register('organisations', async () => {
  const app = document.getElementById('app');

  // ── Constantes ─────────────────────────────────────────────
  const TYPE_MAP = {
    1: { code: 'ASS', lib: 'Association', icon: '🏛️' },
    2: { code: 'ONG', lib: 'ONG',         icon: '🌍' },
    6: { code: 'MUT', lib: 'Mutuelle',    icon: '🤝' },
  };
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
  const TYPE_DOCS  = ['Statuts', 'PV Assemblée', 'Agrément ministériel', 'Rapport annuel', 'Attestation', 'Autre'];
  const FONCTIONS  = ['Président', 'Trésorier', 'Secrétaire', 'Directeur Exécutif', 'Coordinateur'];

  let pays = [], vocations = [], reglements = [];
  const TYPE_LABEL_TO_ID = { 'Association': '1', 'ONG': '2', 'Mutuelle': '6' };
  const _storedType = sessionStorage.getItem('orgTypeFilter');
  sessionStorage.removeItem('orgTypeFilter');
  let filterPays = '', filterStatut = '', filterType = TYPE_LABEL_TO_ID[_storedType] || '', searchQuery = '';

  // ── Chargement des référentiels ────────────────────────────
  async function loadRefs() {
    [pays, vocations, reglements] = await Promise.all([
      api.get('/ref/pays'), api.get('/ref/vocations'), api.get('/ref/reglements'),
    ]);
  }

  // ── Options HTML ───────────────────────────────────────────
  function paysOpts(sel = '') {
    return pays.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.lib}</option>`).join('');
  }
  function selOpts(arr, sel = '') {
    return arr.map(x => `<option value="${x.id}" ${x.id == sel ? 'selected' : ''}>${x.lib}</option>`).join('');
  }
  function fonctionOpts(sel = '') {
    return `<option value="">— Choisir —</option>` +
      FONCTIONS.map(f => `<option value="${f}" ${f === sel ? 'selected' : ''}>${f}</option>`).join('');
  }
  function typeDocOpts() {
    return TYPE_DOCS.map(t => `<option value="${t}">${t}</option>`).join('');
  }

  // ── Badges ────────────────────────────────────────────────
  function statusBadge(idStatut) {
    const s = STATUT_CFG[idStatut] || { lib: '?', cls: 'badge-grey', icon: '?' };
    return `<span class="badge ${s.cls}">${s.icon} ${s.lib}</span>`;
  }
  function typeBadge(libTypOrg, idTypOrg) {
    if (!libTypOrg) return '<span class="badge badge-grey">—</span>';
    const cls  = { 1: 'org-type-ass', 2: 'org-type-ong', 6: 'org-type-mut' };
    const icon = { 1: '🏛️', 2: '🌍', 6: '🤝' };
    return `<span class="org-type-badge ${cls[idTypOrg]||''}">${icon[idTypOrg]||''} ${libTypOrg}</span>`;
  }

  // ── URL filtres ────────────────────────────────────────────
  function buildUrl() {
    const q = [];
    if (filterPays)   q.push(`pays=${filterPays}`);
    if (filterStatut) q.push(`statut=${filterStatut}`);
    if (filterType)   q.push(`type=${filterType}`);
    if (searchQuery)  q.push(`search=${encodeURIComponent(searchQuery)}`);
    return q.length ? `/organisations?${q.join('&')}` : '/organisations';
  }

  // ── Toast ──────────────────────────────────────────────────
  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = 'gpo-toast';
    el.style.background = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ── Rendu principal ────────────────────────────────────────
  async function render() {
    let orgs = [];
    try { orgs = await api.get(buildUrl()); } catch (_) {}

    app.innerHTML = `
      <div class="page-header">
        <h2>🏢 Organisations</h2>
        <button class="btn btn-primary" id="btnAddOrg">+ Nouvelle organisation</button>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
        <input id="orgSearch" placeholder="🔍 Rechercher par nom ou identifiant…" value="${searchQuery}"
               style="flex:1;min-width:180px;padding:8px 12px;border:1px solid #e5e7eb;
                      border-radius:6px;font-size:13px;outline:none;">
        <select id="orgFilterPays" class="select-sm">
          <option value="">Tous les pays</option>${paysOpts(filterPays)}
        </select>
        <select id="orgFilterType" class="select-sm">
          <option value="">Tous les types</option>
          <option value="1" ${filterType === '1' ? 'selected' : ''}>🏛️ Association</option>
          <option value="2" ${filterType === '2' ? 'selected' : ''}>🌍 ONG</option>
          <option value="6" ${filterType === '6' ? 'selected' : ''}>🤝 Mutuelle</option>
        </select>
        <select id="orgFilterStatut" class="select-sm">
          <option value="">Tous les statuts</option>
          <option value="4" ${filterStatut === '4' ? 'selected' : ''}>⏳ En attente</option>
          <option value="1" ${filterStatut === '1' ? 'selected' : ''}>✅ Actif</option>
          <option value="3" ${filterStatut === '3' ? 'selected' : ''}>⚠️ Suspendu</option>
          <option value="2" ${filterStatut === '2' ? 'selected' : ''}>⚫ Inactif</option>
          <option value="5" ${filterStatut === '5' ? 'selected' : ''}>🔒 Clôturé</option>
        </select>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Identifiant</th>
            <th>Organisation</th>
            <th>Pays</th>
            <th>Type</th>
            <th>Statut</th>
            <th style="text-align:center">Adhérents</th>
            <th style="text-align:center">Docs</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>${orgs.length ? orgs.map(o => `
            <tr>
              <td><code style="font-size:12px;background:#f3f4f6;padding:2px 7px;border-radius:4px;
                              letter-spacing:1px">${o.NumAgr}</code></td>
              <td>
                <div style="font-weight:600;font-size:13px">${o.LibOrg}</div>
                ${o.SiegeOrg ? `<div style="font-size:11px;color:#9ca3af;margin-top:1px">📍 ${o.SiegeOrg}</div>` : ''}
              </td>
              <td>${o.DrapEau || ''} ${o.LibPays || '—'}</td>
              <td>${typeBadge(o.LibTypOrg, o.IdTypOrg)}</td>
              <td>${statusBadge(o.IdStatut)}</td>
              <td style="text-align:center">${o.nbAdherents || 0}</td>
              <td style="text-align:center">${o.nbDocuments > 0
                ? `<span class="badge badge-blue">📄 ${o.nbDocuments}</span>` : '—'}</td>
              <td class="actions">
                <button class="btn-icon edit" data-id="${o.NumAgr}" title="Modifier">✏️</button>
                <button class="btn-icon del"  data-id="${o.NumAgr}" title="Supprimer"
                        ${o.IdStatut === 1 ? 'disabled style="opacity:.35"' : ''}>🗑️</button>
              </td>
            </tr>`).join('')
          : `<tr><td colspan="8" style="padding:40px;text-align:center;color:#9ca3af">
               Aucune organisation trouvée</td></tr>`}
          </tbody>
        </table>
      </div>`;

    // Filtres
    let searchTimer;
    document.getElementById('orgSearch').addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { searchQuery = e.target.value.trim(); render(); }, 400);
    });
    document.getElementById('orgFilterPays').onchange   = e => { filterPays   = e.target.value; render(); };
    document.getElementById('orgFilterType').onchange   = e => { filterType   = e.target.value; render(); };
    document.getElementById('orgFilterStatut').onchange = e => { filterStatut = e.target.value; render(); };

    document.getElementById('btnAddOrg').onclick = () => openModal(null);

    document.querySelectorAll('.btn-icon.edit').forEach(btn => {
      btn.onclick = async () => {
        try {
          const o = await api.get(`/organisations/${btn.dataset.id}`);
          openModal(o);
        } catch (e) { toast(e.message, 'error'); }
      };
    });
    document.querySelectorAll('.btn-icon.del').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm(`Supprimer l'organisation ${btn.dataset.id} ?`)) return;
        try { await api.delete(`/organisations/${btn.dataset.id}`); render(); }
        catch (e) { toast(e.message, 'error'); }
      };
    });
  }

  // ── Icône selon extension ──────────────────────────────────
  function docIcon(chemin) {
    if (!chemin) return '📄';
    const ext = (chemin.split('.').pop() || '').toLowerCase();
    return { pdf: '📕', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', doc: '📝', docx: '📝' }[ext] || '📄';
  }

  // ── Rendu liste documents ──────────────────────────────────
  function renderDocs(docs) {
    if (!docs.length) return `<div style="text-align:center;color:#9ca3af;padding:24px 0;font-size:13px">
      Aucun document joint</div>`;
    return `<div class="doc-list">${docs.map(d => `
      <div class="doc-item">
        <span class="doc-item-icon">${docIcon(d.CheminFichier)}</span>
        <div class="doc-item-info">
          <div class="doc-item-name">${d.LibDoc}</div>
          <div class="doc-item-meta">${d.TypeDoc || 'Autre'} · ${d.DateDocument || d.DateCreation || ''}</div>
        </div>
        <div class="doc-item-actions">
          <a href="${d.CheminFichier}" target="_blank">📥 Voir</a>
          <button type="button" class="btn-icon doc-del-btn" data-docid="${d.IdDoc}"
                  style="color:#ef4444;font-size:13px">🗑️</button>
        </div>
      </div>`).join('')}</div>`;
  }

  // ── Construction HTML modal ────────────────────────────────
  function buildModalHtml(org) {
    const isEdit    = !!org;
    const statCfg   = isEdit ? (STATUT_CFG[org.IdStatut] || {}) : {};
    const transList = isEdit ? (TRANSITIONS_FE[org.IdStatut] || []) : [];

    return `<div class="modal" style="max-width:660px;width:95vw;max-height:92vh;
                                      display:flex;flex-direction:column;overflow:hidden">
      <!-- En-tête -->
      <div class="modal-header" style="padding:18px 24px 0;flex-shrink:0">
        <div>
          <h3 style="margin:0 0 2px;font-size:16px">
            ${isEdit ? `✏️ ${org.LibOrg}` : '➕ Nouvelle organisation'}
          </h3>
          ${isEdit ? `<code style="font-size:11px;color:#6b7280">${org.NumAgr}</code>` : ''}
        </div>
        <button class="modal-close" id="orgModalClose">&times;</button>
      </div>

      <!-- Onglets -->
      <div class="org-tabs" style="flex-shrink:0">
        <button class="org-tab active" data-tab="info">📋 Informations</button>
        <button class="org-tab" data-tab="rep">👤 Représentant</button>
        ${isEdit ? `<button class="org-tab" data-tab="docs">
          📄 Documents${org.documents?.length ? ` (${org.documents.length})` : ''}</button>` : ''}
      </div>

      <form id="orgForm" style="overflow-y:auto;flex:1">
        <div style="padding:18px 24px 0">

          <!-- ══ TAB INFORMATIONS ══ -->
          <div class="org-tab-panel" data-panel="info">

            ${!isEdit ? `
            <!-- Sélecteur de type -->
            <div class="form-group" style="margin-bottom:6px">
              <label style="font-size:12px;font-weight:600;color:#374151">Type d'organisation *</label>
            </div>
            <div class="org-type-selector">
              <button type="button" class="org-type-btn" data-type="1">
                <span class="type-icon">🏛️</span>
                <span class="type-lib">Association</span>
                <span class="type-code">ASS</span>
              </button>
              <button type="button" class="org-type-btn" data-type="2">
                <span class="type-icon">🌍</span>
                <span class="type-lib">ONG</span>
                <span class="type-code">ONG</span>
              </button>
              <button type="button" class="org-type-btn" data-type="6">
                <span class="type-icon">🤝</span>
                <span class="type-lib">Mutuelle</span>
                <span class="type-code">MUT</span>
              </button>
            </div>

            <!-- Prévisualisation de l'identifiant -->
            <div class="org-id-preview" style="margin-bottom:14px">
              <span class="id-label">Identifiant</span>
              <span class="id-value" id="orgPreviewId"><span style="color:#d1d5db">—</span></span>
              <span class="id-note" id="orgPreviewNote" style="display:none">Généré à la création</span>
            </div>
            ` : `
            <!-- Identifiant existant + statut -->
            <div class="org-id-preview" style="margin-bottom:14px">
              <span class="id-label">Identifiant</span>
              <span class="id-value">${org.NumAgr}</span>
              <span class="badge ${statCfg.cls || ''}" style="font-size:12px">
                ${statCfg.icon || ''} ${statCfg.lib || ''}
              </span>
            </div>
            `}

            <!-- Pays -->
            <div class="form-group">
              <label>Pays *</label>
              <select name="CodePays" id="orgModalPays" ${isEdit ? 'disabled' : 'required'}>
                <option value="">Sélectionner le pays…</option>
                ${paysOpts(org?.CodePays)}
              </select>
            </div>
            <div id="orgModalPaysCard" style="display:none;margin-bottom:12px"></div>

            <!-- Nom -->
            <div class="form-group">
              <label>Nom de l'organisation *</label>
              <input type="text" name="LibOrg" required minlength="3" maxlength="150"
                     value="${org?.LibOrg || ''}"
                     placeholder="Ex : Association Entraide Mali">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Siège social / Ville</label>
                <input type="text" name="SiegeOrg" value="${org?.SiegeOrg || ''}"
                       placeholder="Ex : Abidjan, Plateau">
              </div>
              <div class="form-group">
                <label>Date de création</label>
                <input type="date" name="DateCreOrg"
                       value="${org?.DateCreOrg ? org.DateCreOrg.split('T')[0] : ''}">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Email</label>
                <input type="email" name="EmailOrg" value="${org?.EmailOrg || ''}"
                       placeholder="contact@organisation.org">
              </div>
              <div class="form-group">
                <label>Téléphone</label>
                <input type="text" name="TelOrg" id="orgModalTel" value="${org?.TelOrg || ''}"
                       placeholder="+225 07 00 00 00">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Site web</label>
                <input type="url" name="SiteWeb" value="${org?.SiteWeb || ''}"
                       placeholder="https://…">
              </div>
              <div class="form-group">
                <label>Vocation</label>
                <select name="IdVocOrg">
                  <option value="">—</option>${selOpts(vocations, org?.IdVocOrg)}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Description / Objet social</label>
              <textarea name="Description" rows="3"
                        placeholder="Mission et activités de l'organisation…">${org?.Description || ''}</textarea>
            </div>

            ${isEdit ? `
            <!-- Workflow -->
            <div class="org-workflow">
              <h4>⚙️ Workflow</h4>
              <div class="org-workflow-actions">
                <span class="org-workflow-cur">Statut actuel :
                  <strong>${statCfg.icon || ''} ${statCfg.lib || ''}</strong>
                </span>
                ${transList.length
                  ? transList.map(t => `<button type="button" class="btn-wf ${t.cls} btn-wf-action"
                      data-action="${t.action}">${t.label}</button>`).join('')
                  : '<span style="font-size:12px;color:#9ca3af">Aucune transition disponible</span>'}
              </div>
            </div>` : ''}
          </div>

          <!-- ══ TAB REPRÉSENTANT ══ -->
          <div class="org-tab-panel" data-panel="rep" style="display:none">
            <div class="form-row">
              <div class="form-group">
                <label>Nom du représentant légal</label>
                <input type="text" name="NomRepresentant" value="${org?.NomRepresentant || ''}"
                       placeholder="Nom complet">
              </div>
              <div class="form-group">
                <label>Fonction</label>
                <select name="FonctionRepresentant">
                  ${fonctionOpts(org?.FonctionRepresentant)}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Règlement intérieur</label>
              <select name="IdRegleInt">
                <option value="">—</option>${selOpts(reglements, org?.IdRegleInt)}
              </select>
            </div>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;
                        padding:12px 14px;font-size:12px;color:#166534;margin-top:4px">
              ℹ️ Le représentant légal est la personne habilitée à engager l'organisation
              auprès des autorités compétentes.
            </div>
          </div>

          <!-- ══ TAB DOCUMENTS (edit only) ══ -->
          ${isEdit ? `
          <div class="org-tab-panel" data-panel="docs" style="display:none">
            <!-- Upload form -->
            <div class="doc-form-row">
              <div class="form-group">
                <label>Nom du document *</label>
                <input type="text" id="docLibInput" placeholder="Ex : Statuts 2024">
              </div>
              <div class="form-group">
                <label>Type</label>
                <select id="docTypeInput">
                  <option value="">Autre</option>${typeDocOpts()}
                </select>
              </div>
            </div>
            <label class="doc-upload-zone" id="orgDocZone">
              <input type="file" id="orgDocFile" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
              <span class="doc-upload-icon">📎</span>
              <span class="doc-upload-text" id="orgDocText">Cliquer pour sélectionner un fichier</span>
              <span class="doc-upload-hint">PDF, JPG, PNG, DOC, DOCX — max 10 Mo</span>
            </label>
            <button type="button" class="btn btn-primary" id="orgDocUploadBtn"
                    style="width:100%;margin-bottom:14px">📤 Ajouter le document</button>
            <div id="orgDocsMsg" class="msg" style="display:none;margin-bottom:10px"></div>

            <!-- Liste des documents -->
            <div id="orgDocsList">${renderDocs(org.documents || [])}</div>
          </div>` : ''}

        </div><!-- /padding -->

        <!-- Footer -->
        <div class="form-actions" style="padding:12px 24px;border-top:1px solid #f3f4f6;
                                         margin-top:4px;flex-shrink:0">
          <div id="orgModalErr" class="msg error" style="display:none;flex:1;margin:0 12px 0 0;
               text-align:left;font-size:13px"></div>
          <button type="button" class="btn btn-secondary" id="orgModalCancel">Annuler</button>
          <button type="submit" class="btn btn-primary" id="orgModalSubmit">💾 Enregistrer</button>
        </div>
      </form>
    </div>`;
  }

  // ── Ouverture du modal ─────────────────────────────────────
  function openModal(org) {
    const isEdit = !!org;
    let selectedType = org ? org.IdTypOrg : null;
    let selectedPays = org ? org.CodePays  : null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'orgModalOverlay';
    overlay.innerHTML = buildModalHtml(org);
    document.body.appendChild(overlay);

    // ── Verrouillage si issu d'une demande d'adhésion ────────
    if (org?.fromAdhesion) {
      overlay.querySelectorAll('#orgForm input, #orgForm textarea').forEach(el => el.setAttribute('readonly', ''));
      overlay.querySelectorAll('#orgForm select').forEach(el => el.setAttribute('disabled', ''));
      const submitBtn = document.getElementById('orgModalSubmit');
      if (submitBtn) submitBtn.style.display = 'none';
      const tabs = overlay.querySelector('.org-tabs');
      if (tabs) tabs.insertAdjacentHTML('afterend', `
        <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;
                    padding:8px 14px;font-size:12px;color:#92400e;margin:10px 24px 0">
          🔒 Informations verrouillées — issues d'une demande d'adhésion approuvée.
        </div>`);
    }

    // ── Tab switch ───────────────────────────────────────────
    function switchTab(tab) {
      overlay.querySelectorAll('.org-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === tab)
      );
      overlay.querySelectorAll('.org-tab-panel').forEach(p => {
        p.style.display = p.dataset.panel === tab ? '' : 'none';
      });
    }
    overlay.querySelectorAll('.org-tab').forEach(t => {
      t.onclick = () => switchTab(t.dataset.tab);
    });

    // ── Fermeture ────────────────────────────────────────────
    const close = () => overlay.remove();
    document.getElementById('orgModalClose').onclick  = close;
    document.getElementById('orgModalCancel').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // ── Sélecteur de type (création seulement) ───────────────
    if (!isEdit) {
      overlay.querySelectorAll('.org-type-btn').forEach(btn => {
        btn.onclick = () => {
          overlay.querySelectorAll('.org-type-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedType = parseInt(btn.dataset.type);
          updateIdPreview();
        };
      });
    }

    // ── Changement de pays ────────────────────────────────────
    const paysEl = document.getElementById('orgModalPays');
    const applyPaysChange = (code) => {
      selectedPays = code;
      updateIdPreview();
      onPaysChange(code, false, {
        cardId:     'orgModalPaysCard',
        ministereId: '',
        telOrgId:   'orgModalTel',
        telRepId:   '',
        langueId:   '',
        deviseId:   '',
      });
    };

    if (paysEl) {
      paysEl.onchange = () => applyPaysChange(paysEl.value);
      // En mode édition, afficher la carte du pays existant
      if (isEdit && org.CodePays) applyPaysChange(org.CodePays);
    }

    // ── Prévisualisation de l'identifiant ────────────────────
    function updateIdPreview() {
      const previewEl = document.getElementById('orgPreviewId');
      const noteEl    = document.getElementById('orgPreviewNote');
      if (!previewEl) return;
      if (selectedPays && selectedType && TYPE_MAP[selectedType]) {
        const tc = TYPE_MAP[selectedType].code;
        previewEl.innerHTML = `${selectedPays}-${tc}-<span style="color:#9ca3af;letter-spacing:2px">????</span>`;
        if (noteEl) noteEl.style.display = '';
      } else {
        previewEl.innerHTML = '<span style="color:#d1d5db">—</span>';
        if (noteEl) noteEl.style.display = 'none';
      }
    }

    // ── Soumission du formulaire ──────────────────────────────
    document.getElementById('orgForm').onsubmit = async e => {
      e.preventDefault();
      const form   = e.target;
      const errEl  = document.getElementById('orgModalErr');
      const submitBtn = document.getElementById('orgModalSubmit');

      if (!isEdit && !selectedType) {
        errEl.textContent  = "Sélectionnez un type d'organisation";
        errEl.style.display = 'block';
        switchTab('info');
        return;
      }

      const body = {
        LibOrg:               form.LibOrg?.value.trim(),
        SiegeOrg:             form.SiegeOrg?.value || '',
        DateCreOrg:           form.DateCreOrg?.value || '',
        EmailOrg:             form.EmailOrg?.value || '',
        TelOrg:               form.TelOrg?.value || '',
        SiteWeb:              form.SiteWeb?.value || '',
        Description:          form.Description?.value || '',
        NomRepresentant:      form.NomRepresentant?.value || '',
        FonctionRepresentant: form.FonctionRepresentant?.value || '',
        IdVocOrg:             form.IdVocOrg?.value || '',
        IdRegleInt:           form.IdRegleInt?.value || '',
      };
      if (!isEdit) {
        body.CodePays = selectedPays;
        body.IdTypOrg = selectedType;
      }

      errEl.style.display = 'none';
      submitBtn.disabled  = true;
      submitBtn.textContent = 'Enregistrement…';

      try {
        if (isEdit) {
          await api.put(`/organisations/${org.NumAgr}`, body);
          toast('Organisation mise à jour', 'success');
        } else {
          const res = await api.post('/organisations', body);
          toast(`Organisation créée : ${res.NumAgr}`, 'success');
        }
        close();
        render();
      } catch (err) {
        errEl.textContent   = err.message;
        errEl.style.display = 'block';
        submitBtn.disabled  = false;
        submitBtn.textContent = '💾 Enregistrer';
      }
    };

    // ── Actions workflow ──────────────────────────────────────
    if (isEdit) {
      overlay.querySelectorAll('.btn-wf-action').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm(`Confirmer : ${btn.textContent.trim()} ?`)) return;
          try {
            await api.post(`/organisations/${org.NumAgr}/statut`, { action: btn.dataset.action });
            close();
            render();
          } catch (err) { toast(err.message, 'error'); }
        };
      });

      // ── Documents ────────────────────────────────────────────
      setupDocTab(org.NumAgr, overlay);
    }
  }

  // ── Onglet documents ────────────────────────────────────────
  function setupDocTab(numAgr, overlay) {
    const fileInput = overlay.querySelector('#orgDocFile');
    const docText   = overlay.querySelector('#orgDocText');
    const docZone   = overlay.querySelector('#orgDocZone');
    const uploadBtn = overlay.querySelector('#orgDocUploadBtn');
    const docsMsg   = overlay.querySelector('#orgDocsMsg');
    const docsList  = overlay.querySelector('#orgDocsList');

    if (!fileInput) return;

    fileInput.onchange = () => {
      const f = fileInput.files[0];
      if (f) {
        docText.textContent = `✅ ${f.name} (${(f.size / 1024 / 1024).toFixed(2)} Mo)`;
        docZone.classList.add('drag-over');
      }
    };

    uploadBtn.onclick = async () => {
      const lib  = overlay.querySelector('#docLibInput').value.trim();
      const type = overlay.querySelector('#docTypeInput').value;
      const file = fileInput.files[0];

      if (!lib)  { showDocMsg('Nom du document requis', 'error');  return; }
      if (!file) { showDocMsg('Sélectionnez un fichier', 'error'); return; }

      uploadBtn.disabled    = true;
      uploadBtn.textContent = 'Envoi…';
      docsMsg.style.display = 'none';

      const fd = new FormData();
      fd.append('fichier', file);
      fd.append('LibDoc',  lib);
      fd.append('TypeDoc', type || 'Autre');

      try {
        const resp = await fetch(`/api/organisations/${numAgr}/documents`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('gpo_token')}` },
          body:    fd,
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message);

        // Rafraîchissement de la liste
        const docs = await api.get(`/organisations/${numAgr}/documents`);
        docsList.innerHTML = renderDocs(docs);
        bindDocDeletes(numAgr, overlay);

        overlay.querySelector('#docLibInput').value  = '';
        overlay.querySelector('#docTypeInput').value = '';
        fileInput.value = '';
        docText.textContent = 'Cliquer pour sélectionner un fichier';
        docZone.classList.remove('drag-over');
        showDocMsg('Document ajouté avec succès', 'success');
        setTimeout(() => { docsMsg.style.display = 'none'; }, 3000);
      } catch (err) {
        showDocMsg(err.message, 'error');
      } finally {
        uploadBtn.disabled    = false;
        uploadBtn.textContent = '📤 Ajouter le document';
      }
    };

    function showDocMsg(msg, type) {
      docsMsg.textContent = msg;
      docsMsg.className   = `msg ${type}`;
      docsMsg.style.display = 'block';
    }

    bindDocDeletes(numAgr, overlay);
  }

  // ── Suppression de documents ────────────────────────────────
  function bindDocDeletes(numAgr, overlay) {
    overlay.querySelectorAll('.doc-del-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Supprimer ce document ?')) return;
        try {
          await api.delete(`/organisations/${numAgr}/documents/${btn.dataset.docid}`);
          const docs = await api.get(`/organisations/${numAgr}/documents`);
          const list = overlay.querySelector('#orgDocsList');
          if (list) {
            list.innerHTML = renderDocs(docs);
            bindDocDeletes(numAgr, overlay);
          }
        } catch (e) { toast(e.message, 'error'); }
      };
    });
  }

  // ── Init ───────────────────────────────────────────────────
  await loadRefs();
  render();
});
