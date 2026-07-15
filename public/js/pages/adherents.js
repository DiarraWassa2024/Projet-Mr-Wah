router.register('adherents', async () => {
  const app = document.getElementById('app');
  let orgs = [], roles = [], adhs = [];
  const _storedType = sessionStorage.getItem('adhTypeFilter');
  sessionStorage.removeItem('adhTypeFilter');
  let filterOrg = '', filterStatut = '', filterSearch = '', filterTypeOrg = _storedType || '';

  const STATUT_CFG = {
    1: { lib: 'Actif',      cls: 'badge-actif',    icon: '✅' },
    2: { lib: 'Inactif',    cls: 'badge-inactif',  icon: '⚫' },
    3: { lib: 'Suspendu',   cls: 'badge-suspendu', icon: '⚠️' },
    4: { lib: 'En attente', cls: 'badge-attente',  icon: '⏳' },
    5: { lib: 'Clôturé',    cls: 'badge-cloture',  icon: '🔒' },
  };

  const TRANSITIONS = {
    4: [{ action: 'valider',   label: 'Valider',   cls: 'btn-wf-valider'   },
        { action: 'refuser',   label: 'Refuser',   cls: 'btn-wf-rejeter'   }],
    1: [{ action: 'suspendre', label: 'Suspendre', cls: 'btn-wf-suspendre' },
        { action: 'resilier',  label: 'Résilier',  cls: 'btn-wf-cloturer'  }],
    3: [{ action: 'reactiver', label: 'Réactiver', cls: 'btn-wf-reactiver' }],
    2: [{ action: 'reactiver', label: 'Réactiver', cls: 'btn-wf-reactiver' }],
  };

  // L'adhérent doit avoir au moins 18 ans — recalculé à chaque chargement de page.
  const dateNaiss18ans = new Date();
  dateNaiss18ans.setFullYear(dateNaiss18ans.getFullYear() - 18);
  const DATE_NAISS_MAX = dateNaiss18ans.toISOString().split('T')[0];

  function paysOptsRiches(sel = '') {
    return `<option value="">— Sélectionner —</option>` + Object.values(PAYS_CONFIG).map(p =>
      `<option value="${p.code}"${sel === p.code ? ' selected' : ''}>${p.drapeau} ${p.nom}</option>`
    ).join('');
  }

  async function loadRefs() {
    [orgs, roles] = await Promise.all([api.get('/organisations'), api.get('/ref/roles')]);
  }

  async function loadAdhs() {
    const p = new URLSearchParams();
    if (filterOrg)     p.set('org', filterOrg);
    if (filterStatut)  p.set('statut', filterStatut);
    if (filterSearch)  p.set('search', filterSearch);
    if (filterTypeOrg) p.set('typeOrg', filterTypeOrg);
    adhs = await api.get(`/adherents?${p}`);
  }

  function avatarHtml(a) {
    if (a.Photo) return `<img src="${a.Photo}" class="adh-avatar-img" alt="">`;
    const c = ((a.PrenAdh || a.NomAdh || '?')[0]).toUpperCase();
    const h = [...(a.NomAdh || '')].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 360;
    return `<div class="adh-avatar-init" style="--hue:${h}">${c}</div>`;
  }

  function statutBadge(s) {
    const cfg = STATUT_CFG[s] || { lib: '—', cls: '' };
    return `<span class="badge ${cfg.cls}">${cfg.icon} ${cfg.lib}</span>`;
  }

  function selO(sel = '') {
    return orgs.map(o => `<option value="${o.NumAgr}"${o.NumAgr === sel ? ' selected' : ''}>${o.LibOrg}</option>`).join('');
  }
  function selR(sel = '') {
    return roles.map(r => `<option value="${r.id}"${r.id == sel ? ' selected' : ''}>${r.lib}</option>`).join('');
  }

  function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `gpo-toast gpo-toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ── CARTE ─────────────────────────────────────────────────────
  function ouvrirCarte(idAdh) {
    const token = localStorage.getItem('gpo_token');
    const w = window.open('', '_blank', 'width=620,height=780');
    fetch(`/api/adherents/${idAdh}/carte`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.text())
      .then(html => { w.document.open(); w.document.write(html); w.document.close(); })
      .catch(() => { w.close(); toast('Erreur lors de la génération de la carte', 'error'); });
  }

  // ── MODAL ─────────────────────────────────────────────────────
  async function openModal(adhLight = {}) {
    const isEdit = !!adhLight.idAdh;
    let adh = isEdit ? await api.get(`/adherents/${adhLight.idAdh}`) : {};

    document.body.insertAdjacentHTML('beforeend', buildModalHtml(adh, isEdit));
    const overlay = document.getElementById('adhModalOverlay');
    const close = () => overlay.remove();

    document.getElementById('adhCloseBtn').onclick  = close;
    document.getElementById('adhCloseBtn2').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // Tabs
    overlay.querySelectorAll('.adh-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        overlay.querySelectorAll('.adh-tab, .adh-tab-pane').forEach(el => el.classList.remove('active'));
        tab.classList.add('active');
        overlay.querySelector(`#pane-${tab.dataset.tab}`).classList.add('active');
      });
    });

    // Photo preview
    overlay.querySelector('#adhPhotoInput')?.addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const prev = overlay.querySelector('#adhPhotoPreview');
        prev.src = e.target.result;
        prev.style.display = 'block';
        overlay.querySelector('.adh-photo-placeholder')?.remove();
      };
      reader.readAsDataURL(file);
    });

    // Pays — fiche visuelle (drapeau/armoiries/devise)
    overlay.querySelector('#adhCodePaysSelect')?.addEventListener('change', function () {
      onPaysChange(this.value, true, { cardId: 'adhPaysCard' });
    });
    if (adh.CodePays) onPaysChange(adh.CodePays, true, { cardId: 'adhPaysCard' });

    // Wizard (mode création uniquement)
    let wizardCtl = null;
    if (!isEdit) {
      wizardCtl = createWizardController(overlay, 3);
      function renderRecap() {
        const fd = new FormData(document.getElementById('adhForm'));
        const val = k => fd.get(k) || '—';
        const org = orgs.find(o => o.NumAgr === fd.get('NumAgr'));
        const pays = getPays(fd.get('CodePays'));
        const recap = overlay.querySelector('#adhConfirmRecap');
        recap.innerHTML = `
          <ul class="adh-recap-list">
            <li><strong>Nom :</strong> ${val('NomAdh')} ${fd.get('PrenAdh') || ''}</li>
            <li><strong>Sexe :</strong> ${val('Sexe')}</li>
            <li><strong>Email :</strong> ${val('EmailAdh')}</li>
            <li><strong>Téléphone :</strong> ${val('TelAdh')}</li>
            <li><strong>Date de naissance :</strong> ${fd.get('DateNaissAdh') || '—'}</li>
            <li><strong>Organisation :</strong> ${org ? org.LibOrg : '—'}</li>
            <li><strong>Pays de résidence :</strong> ${pays ? pays.drapeau + ' ' + pays.nom : '—'}</li>
            <li><strong>N° CNI :</strong> ${val('NumCNI')}</li>
          </ul>
          <p class="form-hint" style="margin-top:8px;color:#9ca3af">Vérifiez les informations avant de confirmer la création.</p>`;
      }
      overlay.querySelector('[data-wizard-next]').addEventListener('click', () => {
        wizardCtl.next();
        if (wizardCtl.current() === 3) renderRecap();
      });
      overlay.querySelector('[data-wizard-prev]').addEventListener('click', () => wizardCtl.prev());
      wizardCtl.goTo(1);
    }

    // Workflow buttons
    overlay.querySelectorAll('.btn-wf-adh').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        let motif = '';
        if (action === 'refuser') {
          motif = prompt('Motif du refus (obligatoire) :');
          if (motif === null) return;
          if (!motif.trim()) { toast('Le motif est obligatoire', 'error'); return; }
        }
        btn.disabled = true;
        try {
          await api.post(`/adherents/${adh.idAdh}/statut`, { action, motif });
          toast('Statut mis à jour');
          close(); render();
        } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
      });
    });

    // Form submit
    document.getElementById('adhForm').addEventListener('submit', async e => {
      e.preventDefault();
      const submitBtn = overlay.querySelector('[type=submit]');
      submitBtn.disabled = true;
      try {
        if (isEdit) {
          const fd = new FormData(e.target);
          const body = Object.fromEntries(fd.entries());
          delete body.photo;
          await api.put(`/adherents/${adh.idAdh}`, body);

          const photoFile = overlay.querySelector('#adhPhotoInput')?.files[0];
          if (photoFile) {
            const pfd = new FormData();
            pfd.append('photo', photoFile);
            const r = await fetch(`/api/adherents/${adh.idAdh}/photo`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${localStorage.getItem('gpo_token')}` },
              body: pfd,
            });
            if (!r.ok) { const d = await r.json(); throw new Error(d.message || 'Erreur photo'); }
          }
          toast('Adhérent mis à jour');
        } else {
          const fd = new FormData(e.target);
          const r = await fetch('/api/adherents', {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('gpo_token')}` },
            body: fd,
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.message || 'Erreur création');
          toast(`Adhérent créé — ID : ${d.data?.NumAdherent || ''}`);
        }
        close(); render();
      } catch (err) { toast(err.message, 'error'); }
      finally { submitBtn.disabled = false; }
    });

    // Onglets dynamiques (paiements + documents)
    if (isEdit) {
      await refreshDocTab(adh.idAdh, overlay);
      renderPaiements(adh.paiements || [], overlay);
      bindPaiForm(adh, overlay);
      bindDocUpload(adh.idAdh, overlay);
    }
  }

  // ── Build modal HTML ──────────────────────────────────────────
  function buildModalHtml(adh, isEdit) {
    const sCfg = STATUT_CFG[adh.IdStatut] || {};
    const wfBtns = isEdit
      ? (TRANSITIONS[adh.IdStatut] || []).map(t =>
          `<button type="button" class="btn-wf ${t.cls} btn-wf-adh" data-action="${t.action}">${t.label}</button>`
        ).join('')
      : '';

    const wfBlock = isEdit && wfBtns ? `
      <div class="org-workflow" style="padding:10px 20px 0">
        <div class="org-workflow-cur">
          Statut : <span class="badge ${sCfg.cls}">${sCfg.icon || ''} ${sCfg.lib || '—'}</span>
        </div>
        <div class="org-workflow-actions">${wfBtns}</div>
      </div>` : '';

    const tabs = `
      <div class="adh-tabs">
        <button type="button" class="adh-tab active" data-tab="info">📋 Infos</button>
        <button type="button" class="adh-tab" data-tab="identite">🪪 Identité</button>
        ${isEdit ? `<button type="button" class="adh-tab" data-tab="paiements">💰 Paiements</button>` : ''}
        ${isEdit ? `<button type="button" class="adh-tab" data-tab="documents">📎 Documents</button>` : ''}
      </div>`;

    const paneInfo = `
      <div class="adh-tab-pane active" id="pane-info">
        <div class="form-row">
          <div class="form-group">
            <label>Nom *</label>
            <input type="text" name="NomAdh" value="${adh.NomAdh || ''}" required minlength="2" maxlength="100">
          </div>
          <div class="form-group">
            <label>Prénom</label>
            <input type="text" name="PrenAdh" value="${adh.PrenAdh || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="EmailAdh" value="${adh.EmailAdh || ''}">
          </div>
          <div class="form-group">
            <label>Téléphone</label>
            <input type="text" name="TelAdh" value="${adh.TelAdh || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Sexe${!isEdit ? ' *' : ''}</label>
            <select name="Sexe"${!isEdit ? ' required' : ''}>
              <option value="">— Sélectionner —</option>
              <option value="Homme"${adh.Sexe === 'Homme' ? ' selected' : ''}>Homme</option>
              <option value="Femme"${adh.Sexe === 'Femme' ? ' selected' : ''}>Femme</option>
            </select>
          </div>
          <div class="form-group">
            <label>Date de naissance</label>
            <input type="date" name="DateNaissAdh" value="${adh.DateNaissAdh ? adh.DateNaissAdh.split('T')[0] : ''}" max="${DATE_NAISS_MAX}">
            <p class="form-hint" style="margin-top:4px;color:#9ca3af;font-size:11px">L'adhérent doit avoir au moins 18 ans</p>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Lieu de naissance</label>
            <input type="text" name="LieuNaissAdh" value="${adh.LieuNaissAdh || ''}" placeholder="Ex : Abidjan">
          </div>
          <div class="form-group">
            <label>Date d'adhésion</label>
            <input type="date" name="DateAdhesion" value="${adh.DateAdhesion ? adh.DateAdhesion.split('T')[0] : new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Organisation *</label>
            <select name="NumAgr"${isEdit ? ' disabled' : ' required'}>
              <option value="">— Sélectionner —</option>${selO(adh.NumAgr)}
            </select>
            ${isEdit ? `<input type="hidden" name="NumAgr" value="${adh.NumAgr || ''}">` : ''}
          </div>
          <div class="form-group">
            <label>Rôle</label>
            <select name="IdRole">
              <option value="">—</option>${selR(adh.IdRole)}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Fonction</label>
            <input type="text" name="FonctionAdh" value="${adh.FonctionAdh || ''}" placeholder="ex: Secrétaire général">
          </div>
          <div class="form-group">
            <label>Profession</label>
            <input type="text" name="Profession" value="${adh.Profession || ''}" placeholder="ex: Enseignant">
          </div>
        </div>
        <div class="form-group">
          <label>Adresse</label>
          <input type="text" name="AdrAdh" value="${adh.AdrAdh || ''}">
        </div>
      </div>`;

    const paneIdentite = `
      <div class="adh-tab-pane" id="pane-identite">
        <div class="adh-photo-section adh-photo-right">
          <div class="adh-photo-wrap">
            ${adh.Photo
              ? `<img id="adhPhotoPreview" src="${adh.Photo}" class="adh-photo-preview">`
              : `<img id="adhPhotoPreview" src="" class="adh-photo-preview" style="display:none">
                 <div class="adh-photo-placeholder">📷</div>`}
          </div>
          <div class="adh-photo-info">
            <label class="label-sm">Photo de profil</label>
            <input type="file" id="adhPhotoInput" name="photo" accept="image/jpeg,image/png,image/webp" style="margin-top:8px;width:100%">
            <p class="form-hint" style="margin-top:4px;color:#9ca3af;font-size:11px">JPG / PNG / WEBP — max 5 Mo</p>
          </div>
        </div>
        <div class="form-row" style="margin-top:16px">
          <div class="form-group">
            <label>N° CNI / Passeport</label>
            <input type="text" name="NumCNI" value="${adh.NumCNI || ''}" placeholder="Numéro de pièce d'identité">
          </div>
          <div class="form-group">
            <label>Nationalité</label>
            <input type="text" name="Nationalite" value="${adh.Nationalite || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Pays de résidence</label>
            <select name="CodePays" id="adhCodePaysSelect">${paysOptsRiches(adh.CodePays)}</select>
          </div>
        </div>
        <div id="adhPaysCard" style="display:none;margin-top:10px"></div>
      </div>`;

    const panePaiements = isEdit ? `
      <div class="adh-tab-pane" id="pane-paiements">
        <div id="paiListWrap" style="margin-bottom:16px"></div>
        <div class="adh-pai-form">
          <h4 class="adh-section-title">Enregistrer un paiement</h4>
          <div class="form-row">
            <div class="form-group">
              <label>Montant *</label>
              <input type="number" id="paiMontant" step="0.01" min="0.01" placeholder="0.00">
            </div>
            <div class="form-group">
              <label>Devise</label>
              <input type="text" id="paiDevise" placeholder="XOF" maxlength="5">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Type</label>
              <select id="paiType">
                <option value="Cotisation">Cotisation</option>
                <option value="Don">Don</option>
                <option value="Inscription">Inscription</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            <div class="form-group">
              <label>Date</label>
              <input type="date" id="paiDate" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Référence</label>
              <input type="text" id="paiRef" placeholder="Reçu N°...">
            </div>
            <div class="form-group">
              <label>Note</label>
              <input type="text" id="paiNote">
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="btnSavePai" style="margin-top:4px">💾 Enregistrer</button>
        </div>
      </div>` : '';

    const paneDocuments = isEdit ? `
      <div class="adh-tab-pane" id="pane-documents">
        <div id="docAdhListWrap" style="margin-bottom:16px"></div>
        <div class="doc-upload-zone">
          <div class="doc-form-row">
            <input type="text" id="docAdhLib" placeholder="Nom du document *">
            <select id="docAdhType">
              <option value="CNI">CNI</option>
              <option value="Passeport">Passeport</option>
              <option value="Attestation">Attestation</option>
              <option value="Certificat">Certificat</option>
              <option value="Autre" selected>Autre</option>
            </select>
          </div>
          <input type="file" id="docAdhFile" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style="margin-top:8px;width:100%">
          <button type="button" class="btn btn-secondary" id="btnUploadDocAdh" style="margin-top:8px">📎 Ajouter le document</button>
        </div>
      </div>` : '';

    // ── Mode création : assistant (wizard) 3 étapes ──────────────
    if (!isEdit) {
      const paneConfirmation = `
        <div class="adh-tab-pane" id="pane-confirmation">
          <div id="adhConfirmRecap" class="adh-confirm-recap"></div>
        </div>`;

      return `
      <div class="modal-overlay" id="adhModalOverlay" style="z-index:1100">
        <div class="modal" style="max-width:680px;width:95%;max-height:92vh;display:flex;flex-direction:column">
          <div class="modal-header">
            <h3>➕ Nouvel adhérent</h3>
            <button class="modal-close" id="adhCloseBtn">&times;</button>
          </div>
          <div class="wizard-progress-slot" style="padding:14px 20px 0">${renderWizardProgressBar(
            [{ label: 'Infos' }, { label: 'Identité' }, { label: 'Confirmation' }], 1
          )}</div>
          <form id="adhForm" enctype="multipart/form-data" style="flex:1;overflow-y:auto;padding:16px 20px">
            <div class="wizard-pane" data-step="1" data-label="Infos">${paneInfo}</div>
            <div class="wizard-pane" data-step="2" data-label="Identité" style="display:none">${paneIdentite}</div>
            <div class="wizard-pane" data-step="3" data-label="Confirmation" style="display:none">${paneConfirmation}</div>
          </form>
          <div class="form-actions" style="padding:14px 20px;border-top:1px solid #e5e7eb;flex-shrink:0">
            <button type="button" class="btn btn-secondary" id="adhCloseBtn2">Annuler</button>
            <button type="button" class="btn btn-secondary" data-wizard-prev style="display:none">← Précédent</button>
            <button type="button" class="btn btn-primary" data-wizard-next>Suivant →</button>
            <button type="submit" form="adhForm" class="btn btn-primary" data-wizard-confirm style="display:none">💾 Confirmer</button>
          </div>
        </div>
      </div>`;
    }

    // ── Mode édition : onglets classiques (Infos/Identité/Paiements/Documents) ──
    return `
    <div class="modal-overlay" id="adhModalOverlay" style="z-index:1100">
      <div class="modal" style="max-width:680px;width:95%;max-height:92vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <h3>✏️ Modifier adhérent${adh.NumAdherent ? ` <code style="font-size:12px;background:#f1f5f9;padding:2px 6px;border-radius:4px">${adh.NumAdherent}</code>` : ''}</h3>
          <button class="modal-close" id="adhCloseBtn">&times;</button>
        </div>
        ${wfBlock}
        ${tabs}
        <form id="adhForm" enctype="multipart/form-data" style="flex:1;overflow-y:auto;padding:16px 20px">
          ${paneInfo}
          ${paneIdentite}
          ${panePaiements}
          ${paneDocuments}
        </form>
        <div class="form-actions" style="padding:14px 20px;border-top:1px solid #e5e7eb;flex-shrink:0">
          <button type="button" class="btn btn-secondary" id="adhCloseBtn2">Annuler</button>
          <button type="submit" form="adhForm" class="btn btn-primary">💾 Enregistrer</button>
        </div>
      </div>
    </div>`;
  }

  // ── Paiements ─────────────────────────────────────────────────
  function renderPaiements(pais, overlay) {
    const wrap = overlay.querySelector('#paiListWrap');
    if (!wrap) return;
    if (!pais.length) {
      wrap.innerHTML = '<p class="adh-empty-hint">Aucun paiement enregistré</p>';
      return;
    }
    wrap.innerHTML = `<div class="doc-list">${pais.map(p => `
      <div class="doc-item">
        <span class="doc-item-name">💶 ${parseFloat(p.MontantPaiement || 0).toLocaleString('fr-FR')} ${p.CodeDevise || ''}</span>
        <span class="doc-item-meta">${p.TypePaiement || '—'} · ${p.DatePaiement ? new Date(p.DatePaiement).toLocaleDateString('fr-FR') : '—'}</span>
        ${p.Reference ? `<span class="doc-item-meta">📄 ${p.Reference}</span>` : ''}
        ${p.NotePaiement ? `<span class="doc-item-meta">${p.NotePaiement}</span>` : ''}
      </div>`).join('')}</div>`;
  }

  function bindPaiForm(adh, overlay) {
    overlay.querySelector('#btnSavePai')?.addEventListener('click', async () => {
      const montant = parseFloat(overlay.querySelector('#paiMontant').value);
      if (!montant || montant <= 0) { toast('Montant invalide', 'error'); return; }
      const btn = overlay.querySelector('#btnSavePai');
      btn.disabled = true;
      try {
        await api.post(`/adherents/${adh.idAdh}/paiements`, {
          MontantPaiement: montant,
          CodeDevise:      overlay.querySelector('#paiDevise').value,
          TypePaiement:    overlay.querySelector('#paiType').value,
          DatePaiement:    overlay.querySelector('#paiDate').value,
          Reference:       overlay.querySelector('#paiRef').value,
          NotePaiement:    overlay.querySelector('#paiNote').value,
        });
        toast('Paiement enregistré');
        overlay.querySelector('#paiMontant').value = '';
        overlay.querySelector('#paiRef').value = '';
        overlay.querySelector('#paiNote').value = '';
        const updated = await api.get(`/adherents/${adh.idAdh}`);
        renderPaiements(updated.paiements || [], overlay);
      } catch (err) { toast(err.message, 'error'); }
      finally { btn.disabled = false; }
    });
  }

  // ── Documents ─────────────────────────────────────────────────
  function renderDocs(docs) {
    if (!docs.length) return '<p class="adh-empty-hint">Aucun document</p>';
    const ICONS = { pdf: '📄', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', doc: '📝', docx: '📝' };
    return `<div class="doc-list">${docs.map(d => {
      const ext = (d.CheminFichier || '').split('.').pop().toLowerCase();
      return `<div class="doc-item">
        <span class="doc-item-name">${ICONS[ext] || '📎'} ${d.LibDocAdh}</span>
        <span class="doc-item-meta">${d.TypeDocAdh} · ${d.DateCreation ? new Date(d.DateCreation).toLocaleDateString('fr-FR') : ''}</span>
        <div class="doc-item-actions">
          <a href="${d.CheminFichier}" target="_blank" class="btn-icon" title="Voir">👁️</a>
          <button type="button" class="btn-icon doc-del-adh" data-id="${d.IdDocAdh}" title="Supprimer">🗑️</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  async function refreshDocTab(idAdh, overlay) {
    const wrap = overlay.querySelector('#docAdhListWrap');
    if (!wrap) return;
    try {
      const docs = await api.get(`/adherents/${idAdh}/documents`);
      wrap.innerHTML = renderDocs(docs);
      overlay.querySelectorAll('.doc-del-adh').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Supprimer ce document ?')) return;
          try {
            await api.delete(`/adherents/${idAdh}/documents/${btn.dataset.id}`);
            toast('Document supprimé');
            await refreshDocTab(idAdh, overlay);
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (_) {}
  }

  function bindDocUpload(idAdh, overlay) {
    overlay.querySelector('#btnUploadDocAdh')?.addEventListener('click', async () => {
      const lib  = overlay.querySelector('#docAdhLib').value.trim();
      const type = overlay.querySelector('#docAdhType').value;
      const file = overlay.querySelector('#docAdhFile').files[0];
      if (!lib)  { toast('Nom du document requis', 'error'); return; }
      if (!file) { toast('Fichier requis', 'error'); return; }
      const btn = overlay.querySelector('#btnUploadDocAdh');
      btn.disabled = true;
      try {
        const fd = new FormData();
        fd.append('LibDocAdh', lib);
        fd.append('TypeDocAdh', type);
        fd.append('fichier', file);
        const r = await fetch(`/api/adherents/${idAdh}/documents`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('gpo_token')}` },
          body: fd,
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || 'Erreur upload');
        overlay.querySelector('#docAdhLib').value = '';
        overlay.querySelector('#docAdhFile').value = '';
        toast('Document ajouté');
        await refreshDocTab(idAdh, overlay);
      } catch (err) { toast(err.message, 'error'); }
      finally { btn.disabled = false; }
    });
  }

  // ── RENDER ────────────────────────────────────────────────────
  async function render() {
    await loadAdhs();
    app.innerHTML = `
      <div class="page-header">
        <h2>👤 Adhérents <span class="adh-count">${adhs.length}</span></h2>
        <div class="header-actions">
          <input type="search" id="searchAdh" class="input-sm" placeholder="🔍 Nom, ID, email…" value="${filterSearch}" style="width:190px">
          <select id="typeOrgFil" class="select-sm">
            <option value="">Tous les types</option>
            <option value="Association" ${filterTypeOrg === 'Association' ? 'selected' : ''}>🏛️ Association</option>
            <option value="ONG"         ${filterTypeOrg === 'ONG'         ? 'selected' : ''}>🌍 ONG</option>
            <option value="Mutuelle"    ${filterTypeOrg === 'Mutuelle'    ? 'selected' : ''}>🤝 Mutuelle</option>
          </select>
          <select id="orgFil" class="select-sm">
            <option value="">Toutes les orgs</option>
            ${orgs.map(o => `<option value="${o.NumAgr}"${o.NumAgr === filterOrg ? ' selected' : ''}>${o.LibOrg}</option>`).join('')}
          </select>
          <select id="statutFil" class="select-sm">
            <option value="">Tous statuts</option>
            ${Object.entries(STATUT_CFG).map(([k, v]) => `<option value="${k}"${k == filterStatut ? ' selected' : ''}>${v.icon} ${v.lib}</option>`).join('')}
          </select>
          <button class="btn btn-primary" id="btnAdd">+ Ajouter</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th style="width:44px"></th>
            <th>Adhérent</th>
            <th>Organisation</th>
            <th>Rôle / Fonction</th>
            <th>Statut</th>
            <th>Adhésion</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>
            ${adhs.length ? adhs.map(a => `
              <tr>
                <td class="adh-avatar-cell">${avatarHtml(a)}</td>
                <td>
                  <strong>${a.NomAdh}${a.PrenAdh ? ' ' + a.PrenAdh : ''}</strong>
                  ${a.Sexe ? `<span class="ref-badge-sm">${a.Sexe}</span>` : ''}
                  ${a.NumAdherent ? `<br><code class="id-code">${a.NumAdherent}</code>` : ''}
                  ${a.EmailAdh ? `<br><span class="adh-sub">${a.EmailAdh}</span>` : ''}
                </td>
                <td>${a.LibOrg || '—'}</td>
                <td>
                  ${a.LibRole || '—'}
                  ${a.FonctionAdh ? `<br><span class="adh-sub">${a.FonctionAdh}</span>` : ''}
                </td>
                <td>${statutBadge(a.IdStatut)}</td>
                <td>${a.DateAdhesion ? new Date(a.DateAdhesion).toLocaleDateString('fr-FR') : '—'}</td>
                <td class="actions">
                  <button class="btn-icon edit" data-id="${a.idAdh}" title="Modifier">✏️</button>
                  <button class="btn-icon carte" data-id="${a.idAdh}" title="Carte adhérent">🪪</button>
                  <button class="btn-icon del"  data-id="${a.idAdh}" title="${[3,5].includes(a.IdStatut) ? 'Supprimer définitivement' : 'Seul un adhérent suspendu ou clôturé peut être supprimé'}"
                          ${[3,5].includes(a.IdStatut) ? '' : 'disabled style="opacity:.35"'}>🗑️</button>
                </td>
              </tr>`).join('')
            : `<tr><td colspan="7" class="text-center" style="padding:48px;color:#9ca3af">Aucun adhérent trouvé</td></tr>`}
          </tbody>
        </table>
      </div>`;

    // Filtres
    let searchTimer = null;
    document.getElementById('searchAdh').addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { filterSearch = e.target.value.trim(); render(); }, 400);
    });
    document.getElementById('typeOrgFil').addEventListener('change', e => { filterTypeOrg = e.target.value; render(); });
    document.getElementById('orgFil').addEventListener('change', e => { filterOrg = e.target.value; render(); });
    document.getElementById('statutFil').addEventListener('change', e => { filterStatut = e.target.value; render(); });
    document.getElementById('btnAdd').addEventListener('click', () => openModal());

    document.querySelectorAll('.btn-icon.edit').forEach(btn => {
      btn.addEventListener('click', () => openModal({ idAdh: btn.dataset.id }));
    });
    document.querySelectorAll('.btn-icon.carte').forEach(btn => {
      btn.addEventListener('click', () => ouvrirCarte(btn.dataset.id));
    });
    document.querySelectorAll('.btn-icon.del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Supprimer DÉFINITIVEMENT cet adhérent et toutes ses données (paiements, bénéficiaires, compte de connexion...) ? Cette action est irréversible.')) return;
        try { await api.delete(`/adherents/${btn.dataset.id}`); toast('Adhérent supprimé'); render(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
  }

  await loadRefs();
  render();
});
