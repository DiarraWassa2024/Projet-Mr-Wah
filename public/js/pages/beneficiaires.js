router.register('beneficiaires', async () => {
  const app = document.getElementById('app');
  let orgs = [], adhs = [], benefs = [];
  let filterOrg = '', filterAdh = '', filterSearch = '';

  const STATUT_CFG = {
    1: { lib: 'Actif',    cls: 'badge-actif',    icon: '✅' },
    2: { lib: 'Inactif',  cls: 'badge-inactif',  icon: '⚫' },
    3: { lib: 'Suspendu', cls: 'badge-suspendu',  icon: '⚠️' },
  };

  const LIENS = ['Conjoint(e)', 'Enfant', 'Parent', 'Frère/Sœur', 'Grand-parent', 'Petit-enfant', 'Autre'];
  const PAYS_CODES = ['BEN','BFA','CIV','MDG','MLI','NGA'];
  const LIEN_ICONS = { 'Conjoint(e)':'💑','Enfant':'👶','Parent':'👨‍👩‍👦','Frère/Sœur':'👫','Grand-parent':'👴','Petit-enfant':'🧒','Autre':'👤' };

  async function loadRefs() {
    [orgs, adhs] = await Promise.all([
      api.get('/organisations'),
      api.get('/adherents'),
    ]);
  }

  async function loadBenefs() {
    const p = new URLSearchParams();
    if (filterOrg)    p.set('org', filterOrg);
    if (filterAdh)    p.set('adherent', filterAdh);
    if (filterSearch) p.set('search', filterSearch);
    benefs = await api.get(`/beneficiaires?${p}`);
  }

  function avatarHtml(b) {
    if (b.Photo) return `<img src="${b.Photo}" class="adh-avatar-img" alt="">`;
    const c = ((b.PrenomBenef || b.NomBenef || '?')[0]).toUpperCase();
    const h = [...(b.NomBenef || '')].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 360;
    return `<div class="adh-avatar-init benef-avatar" style="--hue:${h}">${c}</div>`;
  }

  function statutBadge(s) {
    const cfg = STATUT_CFG[s] || { lib: '—', cls: '' };
    return `<span class="badge ${cfg.cls}">${cfg.icon} ${cfg.lib}</span>`;
  }

  function lienBadge(lien) {
    return `<span class="benef-lien-badge">${LIEN_ICONS[lien] || '👤'} ${lien || 'Autre'}</span>`;
  }

  function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `gpo-toast gpo-toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function ouvrirCarte(idBenef) {
    const token = localStorage.getItem('gpo_token');
    const w = window.open('', '_blank', 'width=620,height=780');
    fetch(`/api/beneficiaires/${idBenef}/carte`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.text())
      .then(html => { w.document.open(); w.document.write(html); w.document.close(); })
      .catch(() => { w.close(); toast('Erreur lors de la génération de la carte', 'error'); });
  }

  // ── MODAL ─────────────────────────────────────────────────────
  async function openModal(light = {}) {
    const isEdit = !!light.idBenef;
    let b = isEdit ? await api.get(`/beneficiaires/${light.idBenef}`) : {};

    document.body.insertAdjacentHTML('beforeend', buildModalHtml(b, isEdit));
    const overlay = document.getElementById('benfModalOverlay');
    const close = () => overlay.remove();

    document.getElementById('benfCloseBtn').onclick  = close;
    document.getElementById('benfCloseBtn2').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // Tabs
    overlay.querySelectorAll('.adh-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        overlay.querySelectorAll('.adh-tab, .adh-tab-pane').forEach(el => el.classList.remove('active'));
        tab.classList.add('active');
        overlay.querySelector(`#bpane-${tab.dataset.tab}`).classList.add('active');
      });
    });

    // Adhérent select — compteur bénéficiaires
    if (!isEdit) {
      const adhSelect = overlay.querySelector('#benfAdhSelect');
      const counterEl = overlay.querySelector('#adhBenefCounter');
      adhSelect?.addEventListener('change', async () => {
        if (!adhSelect.value) { counterEl.innerHTML = ''; return; }
        try {
          const list = await api.get(`/beneficiaires?adherent=${adhSelect.value}`);
          const n = list.length;
          counterEl.innerHTML = `<span class="benef-counter${n >= 10 ? ' benef-counter-full' : n >= 7 ? ' benef-counter-warn' : ''}">${n}/10 bénéficiaires</span>`;
        } catch (_) {}
      });
    }

    // Photo preview
    overlay.querySelector('#benfPhotoInput')?.addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const prev = overlay.querySelector('#benfPhotoPreview');
        prev.src = e.target.result;
        prev.style.display = 'block';
        overlay.querySelector('.adh-photo-placeholder')?.remove();
      };
      reader.readAsDataURL(file);
    });

    // Submit
    overlay.querySelector('#benfForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = overlay.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        if (isEdit) {
          const fd = new FormData(e.target);
          const body = Object.fromEntries(fd.entries());
          delete body.photo;
          await api.put(`/beneficiaires/${b.idBenef}`, body);

          const photoFile = overlay.querySelector('#benfPhotoInput')?.files[0];
          if (photoFile) {
            const pfd = new FormData();
            pfd.append('photo', photoFile);
            const r = await fetch(`/api/beneficiaires/${b.idBenef}/photo`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${localStorage.getItem('gpo_token')}` },
              body: pfd,
            });
            if (!r.ok) { const d = await r.json(); throw new Error(d.message || 'Erreur photo'); }
          }
          toast('Bénéficiaire mis à jour');
        } else {
          const fd = new FormData(e.target);
          const r = await fetch('/api/beneficiaires', {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('gpo_token')}` },
            body: fd,
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.message || 'Erreur création');
          toast(`Bénéficiaire créé — ID : ${d.NumBenef || d.data?.NumBenef || ''}`);
        }
        close(); render();
      } catch (err) { toast(err.message, 'error'); }
      finally { btn.disabled = false; }
    });
  }

  // ── Modal HTML ────────────────────────────────────────────────
  function buildModalHtml(b, isEdit) {
    const paneInfo = `
      <div class="adh-tab-pane active" id="bpane-info">
        <div class="form-row">
          <div class="form-group">
            <label>Nom *</label>
            <input type="text" name="NomBenef" value="${b.NomBenef || ''}" required minlength="2" maxlength="100">
          </div>
          <div class="form-group">
            <label>Prénom</label>
            <input type="text" name="PrenomBenef" value="${b.PrenomBenef || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Lien de parenté</label>
            <select name="LienParente">
              ${LIENS.map(l => `<option value="${l}"${(b.LienParente || 'Autre') === l ? ' selected' : ''}>${LIEN_ICONS[l] || ''} ${l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Date de naissance</label>
            <input type="date" name="DateNaissBenef" value="${b.DateNaissBenef ? b.DateNaissBenef.split('T')[0] : ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="EmailBenef" value="${b.EmailBenef || ''}">
          </div>
          <div class="form-group">
            <label>Téléphone</label>
            <input type="text" name="TelBenef" value="${b.TelBenef || ''}">
          </div>
        </div>
        ${isEdit ? `
        <div class="form-row">
          <div class="form-group">
            <label>Statut</label>
            <select name="IdStatut">
              ${Object.entries(STATUT_CFG).map(([k,v]) => `<option value="${k}"${b.IdStatut == k ? ' selected' : ''}>${v.icon} ${v.lib}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Type</label>
            <select name="TypeBenef">
              <option value="Personne"${b.TypeBenef === 'Personne' ? ' selected' : ''}>Personne physique</option>
              <option value="Famille"${b.TypeBenef === 'Famille' ? ' selected' : ''}>Famille</option>
            </select>
          </div>
        </div>` : ''}
        <div class="form-group">
          <label>Observations</label>
          <textarea name="Observations" rows="2" style="width:100%;resize:vertical;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px">${b.Observations || ''}</textarea>
        </div>
      </div>`;

    const paneIdentite = `
      <div class="adh-tab-pane" id="bpane-identite">
        <div class="adh-photo-section">
          <div class="adh-photo-wrap">
            ${b.Photo
              ? `<img id="benfPhotoPreview" src="${b.Photo}" class="adh-photo-preview">`
              : `<img id="benfPhotoPreview" src="" class="adh-photo-preview" style="display:none">
                 <div class="adh-photo-placeholder">📷</div>`}
          </div>
          <div class="adh-photo-info">
            <label class="label-sm">Photo du bénéficiaire</label>
            <input type="file" id="benfPhotoInput" name="photo" accept="image/jpeg,image/png,image/webp" style="margin-top:8px;width:100%">
            <p style="margin-top:4px;color:#9ca3af;font-size:11px">JPG / PNG / WEBP — max 5 Mo</p>
          </div>
        </div>
        <div class="form-row" style="margin-top:16px">
          <div class="form-group">
            <label>N° CNI / Passeport</label>
            <input type="text" name="NumCNI" value="${b.NumCNI || ''}" placeholder="Numéro de pièce d'identité">
          </div>
          <div class="form-group">
            <label>Nationalité</label>
            <input type="text" name="Nationalite" value="${b.Nationalite || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Pays de résidence</label>
            <select name="CodePays">
              <option value="">—</option>
              ${PAYS_CODES.map(c => `<option value="${c}"${b.CodePays === c ? ' selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>`;

    const paneAdherent = isEdit ? `
      <div class="adh-tab-pane" id="bpane-adherent">
        <div class="benef-adh-card">
          <div class="benef-adh-icon">👤</div>
          <div>
            <div class="benef-adh-nom">${b.PrenAdh ? b.PrenAdh + ' ' : ''}${b.NomAdh || '—'}</div>
            <div class="benef-adh-id"><code>${b.NumAdherent || '—'}</code></div>
            <div class="benef-adh-org">${b.LibOrg || ''}</div>
          </div>
        </div>
        <p style="font-size:12px;color:#9ca3af;margin-top:10px">L'adhérent titulaire ne peut pas être modifié après la création.</p>
      </div>` : `
      <div class="adh-tab-pane" id="bpane-adherent">
        <div class="form-group">
          <label>Adhérent titulaire *</label>
          <select name="idAdh" id="benfAdhSelect" required>
            <option value="">— Sélectionner un adhérent —</option>
            ${adhs.filter(a => a.NumAdherent).map(a =>
              `<option value="${a.idAdh}">${a.NomAdh}${a.PrenAdh ? ' ' + a.PrenAdh : ''} — ${a.NumAdherent}</option>`
            ).join('')}
          </select>
          <div id="adhBenefCounter" style="margin-top:8px"></div>
          <p style="font-size:11px;color:#9ca3af;margin-top:6px">
            ℹ️ Seuls les adhérents avec un identifiant validé apparaissent ici.<br>
            Maximum 10 bénéficiaires par adhérent (identifiant KK de 01 à 10).
          </p>
        </div>
      </div>`;

    return `
    <div class="modal-overlay" id="benfModalOverlay" style="z-index:1100">
      <div class="modal" style="max-width:640px;width:95%;max-height:92vh;display:flex;flex-direction:column">
        <div class="modal-header" style="border-bottom:3px solid #7c3aed">
          <h3>${isEdit ? '✏️ Modifier bénéficiaire' : '➕ Nouveau bénéficiaire'}${b.NumBenef ? ` <code style="font-size:11px;background:#f5f3ff;padding:2px 7px;border-radius:4px;color:#7c3aed">${b.NumBenef}</code>` : ''}</h3>
          <button class="modal-close" id="benfCloseBtn">&times;</button>
        </div>
        <div class="adh-tabs">
          <button type="button" class="adh-tab active" data-tab="info">📋 Informations</button>
          <button type="button" class="adh-tab" data-tab="identite">🪪 Identité</button>
          <button type="button" class="adh-tab" data-tab="adherent">👤 Adhérent</button>
        </div>
        <form id="benfForm" enctype="multipart/form-data" style="flex:1;overflow-y:auto;padding:16px 20px">
          ${paneInfo}
          ${paneIdentite}
          ${paneAdherent}
        </form>
        <div class="form-actions" style="padding:14px 20px;border-top:1px solid #e5e7eb;flex-shrink:0">
          <button type="button" class="btn btn-secondary" id="benfCloseBtn2">Annuler</button>
          <button type="submit" form="benfForm" class="btn btn-primary" style="background:#7c3aed;border-color:#7c3aed">💾 Enregistrer</button>
        </div>
      </div>
    </div>`;
  }

  // ── RENDER ────────────────────────────────────────────────────
  async function render() {
    await loadBenefs();
    app.innerHTML = `
      <div class="page-header">
        <h2>🛡️ Bénéficiaires <span class="adh-count">${benefs.length}</span></h2>
        <div class="header-actions">
          <input type="search" id="searchBenef" class="input-sm" placeholder="🔍 Nom, ID…" value="${filterSearch}" style="width:160px">
          <select id="orgFil" class="select-sm">
            <option value="">Toutes les orgs</option>
            ${orgs.map(o => `<option value="${o.NumAgr}"${o.NumAgr === filterOrg ? ' selected' : ''}>${o.LibOrg}</option>`).join('')}
          </select>
          <select id="adhFil" class="select-sm" style="max-width:190px">
            <option value="">Tous les adhérents</option>
            ${adhs.filter(a => a.NumAdherent).map(a =>
              `<option value="${a.idAdh}"${a.idAdh == filterAdh ? ' selected' : ''}>${a.NomAdh}${a.PrenAdh ? ' ' + a.PrenAdh : ''}</option>`
            ).join('')}
          </select>
          <button class="btn btn-primary" id="btnAdd" style="background:#7c3aed;border-color:#7c3aed">+ Ajouter</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th style="width:44px"></th>
            <th>Bénéficiaire</th>
            <th>Lien</th>
            <th>Adhérent titulaire</th>
            <th>Organisation</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>
            ${benefs.length ? benefs.map(b => `
              <tr>
                <td class="adh-avatar-cell">${avatarHtml(b)}</td>
                <td>
                  <strong>${b.NomBenef}${b.PrenomBenef ? ' ' + b.PrenomBenef : ''}</strong>
                  ${b.NumBenef ? `<br><code class="id-code" style="color:#7c3aed">${b.NumBenef}</code>` : ''}
                  ${b.DateNaissBenef ? `<br><span class="adh-sub">${new Date(b.DateNaissBenef).toLocaleDateString('fr-FR')}</span>` : ''}
                </td>
                <td>${lienBadge(b.LienParente)}</td>
                <td>
                  ${b.NomAdh ? `<strong>${b.NomAdh}${b.PrenAdh ? ' ' + b.PrenAdh : ''}</strong>` : '—'}
                  ${b.NumAdherent ? `<br><code class="id-code" style="font-size:10px">${b.NumAdherent}</code>` : ''}
                </td>
                <td>${b.LibOrg || '—'}</td>
                <td>${statutBadge(b.IdStatut)}</td>
                <td class="actions">
                  <button class="btn-icon edit"  data-id="${b.idBenef}" title="Modifier">✏️</button>
                  <button class="btn-icon carte" data-id="${b.idBenef}" title="Carte bénéficiaire">🛡️</button>
                  <button class="btn-icon del"   data-id="${b.idBenef}" title="Supprimer">🗑️</button>
                </td>
              </tr>`).join('')
            : `<tr><td colspan="7" class="text-center" style="padding:48px;color:#9ca3af">Aucun bénéficiaire trouvé</td></tr>`}
          </tbody>
        </table>
      </div>`;

    let searchTimer = null;
    document.getElementById('searchBenef').addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { filterSearch = e.target.value.trim(); render(); }, 400);
    });
    document.getElementById('orgFil').addEventListener('change', e => { filterOrg = e.target.value; render(); });
    document.getElementById('adhFil').addEventListener('change', e => { filterAdh = e.target.value; render(); });
    document.getElementById('btnAdd').addEventListener('click', () => openModal());

    document.querySelectorAll('.btn-icon.edit').forEach(btn => {
      btn.addEventListener('click', () => openModal({ idBenef: btn.dataset.id }));
    });
    document.querySelectorAll('.btn-icon.carte').forEach(btn => {
      btn.addEventListener('click', () => ouvrirCarte(btn.dataset.id));
    });
    document.querySelectorAll('.btn-icon.del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Supprimer ce bénéficiaire ?')) return;
        try { await api.delete(`/beneficiaires/${btn.dataset.id}`); toast('Bénéficiaire supprimé'); render(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
  }

  await loadRefs();
  render();
});
