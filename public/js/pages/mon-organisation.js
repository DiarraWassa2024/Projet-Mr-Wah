router.register('mon-organisation', async () => {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="dash-loading"><div class="dash-spinner"></div></div>`;

  const user = auth.getUser();
  if (!user || !user.NumAgr) {
    app.innerHTML = `<div class="msg error">Aucune organisation associée à ce compte.</div>`;
    return;
  }

  async function load() {
    try {
      const org = await api.get(`/organisations/${user.NumAgr}`);
      render(org);
    } catch (err) {
      app.innerHTML = `<div class="msg error">${err.message}</div>`;
    }
  }

  const STATUT_BADGE = {
    1: { label: 'Active',        color: '#059669', bg: '#ecfdf5' },
    2: { label: 'Désactivée',    color: '#6b7280', bg: '#f3f4f6' },
    3: { label: 'Suspendue',     color: '#d97706', bg: '#fffbeb' },
    4: { label: 'En attente',    color: '#2563eb', bg: '#eff6ff' },
    5: { label: 'Clôturée',      color: '#dc2626', bg: '#fef2f2' },
  };

  function render(org) {
    const statut = STATUT_BADGE[org.IdStatut] || { label: org.LibStatut || '—', color: '#6b7280', bg: '#f3f4f6' };

    const logoHtml = org.Logo
      ? `<img src="${org.Logo}" alt="${org.LibOrg}" style="width:48px;height:48px;border-radius:12px;object-fit:cover">`
      : `<div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#145c56,#2f8f7f);display:flex;align-items:center;justify-content:center;font-size:22px">🏢</div>`;

    app.innerHTML = `
      <div class="dash-welcome">
        <div style="display:flex;align-items:center;gap:14px">
          ${logoHtml}
          <div>
            <div class="dw-greet"><strong>${org.LibOrg}</strong></div>
            <div class="dw-date">${org.LibTypOrg || ''} · ${org.LibPays || org.CodePays || ''} · ${org.NumAgr}</div>
          </div>
        </div>
        <div class="dw-actions">
          <span class="dw-badge" style="background:${statut.bg};color:${statut.color}">${statut.label}</span>
        </div>
      </div>

      <div class="dk-grid dk-grid-5">
        <div class="dk-card dk-blue">
          <div class="dk-header"><div class="dk-icon dk-iblue">👥</div></div>
          <div class="dk-value">${org.nbAdherents || 0}</div>
          <div class="dk-label">Adhérents</div>
          <div class="dk-sub">membres enregistrés</div>
        </div>
        <div class="dk-card dk-green">
          <div class="dk-header"><div class="dk-icon dk-igreen">🤝</div></div>
          <div class="dk-value">${org.nbBeneficiaires || 0}</div>
          <div class="dk-label">Bénéficiaires</div>
          <div class="dk-sub">personnes aidées</div>
        </div>
        <div class="dk-card dk-violet">
          <div class="dk-header"><div class="dk-icon dk-iviolet">📄</div></div>
          <div class="dk-value">${(org.documents||[]).length}</div>
          <div class="dk-label">Documents</div>
          <div class="dk-sub">dossier organisation</div>
        </div>
      </div>

      <div class="dash-panel dash-full" style="margin-top:20px">
        <div class="dp-head">
          <div><div class="dp-title">📋 Profil de l'organisation</div><div class="dp-sub">Informations visibles par les adhérents et l'administration</div></div>
          <div style="display:flex;gap:8px">
            <label class="dp-btn" style="cursor:pointer">
              🖼️ Changer le logo
              <input type="file" id="logoFileInput" accept=".jpg,.jpeg,.png,.webp,.svg" style="display:none">
            </label>
            <button class="dp-btn" id="btnCarteOrg">🪪 Carte organisation</button>
            <button class="dp-btn" id="btnEditOrg">✏️ Modifier</button>
          </div>
        </div>
        <div id="orgViewWrap" style="padding:20px">
          ${viewHtml(org)}
        </div>
        <div id="orgEditWrap" style="padding:20px;display:none">
          ${editFormHtml(org)}
        </div>
      </div>

      <div class="dash-panel dash-full" style="margin-top:20px">
        <div class="dp-head">
          <div><div class="dp-title">🎯 Mes campagnes de dons</div><div class="dp-sub">Objectifs de collecte proposés aux donateurs</div></div>
          <button class="dp-btn" id="btnAddCampagne">+ Nouvelle campagne</button>
        </div>
        <div id="campagnesWrap" style="padding:20px">Chargement…</div>
      </div>`;

    loadCampagnes();

    document.getElementById('btnEditOrg').addEventListener('click', () => {
      document.getElementById('orgViewWrap').style.display = 'none';
      document.getElementById('orgEditWrap').style.display = 'block';
    });

    document.getElementById('btnCarteOrg').addEventListener('click', () => {
      const token = localStorage.getItem('gpo_token');
      const w = window.open('', '_blank', 'width=620,height=780');
      fetch(`/api/organisations/${org.NumAgr}/carte`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.text())
        .then(html => { w.document.open(); w.document.write(html); w.document.close(); })
        .catch(() => { w.close(); toast('Erreur lors de la génération de la carte', 'error'); });
    });

    document.getElementById('logoFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('logo', file);
      try {
        const token = localStorage.getItem('gpo_token');
        const res = await fetch(`/api/organisations/${org.NumAgr}/logo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur');
        showToast('Logo mis à jour', 'success');
        load();
      } catch (err) { showToast(err.message, 'error'); }
    });

    const form = document.getElementById('orgEditForm');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const body = Object.fromEntries(fd.entries());
      try {
        await api.put(`/organisations/${org.NumAgr}`, body);
        showToast('Profil mis à jour', 'success');
        load();
      } catch (err) { showToast(err.message, 'error'); }
    });
    document.getElementById('btnCancelEdit')?.addEventListener('click', () => {
      document.getElementById('orgViewWrap').style.display = 'block';
      document.getElementById('orgEditWrap').style.display = 'none';
    });

    document.getElementById('btnAddCampagne').addEventListener('click', () => openCampagneModal());
  }

  const CAMP_STATUT_CFG = {
    'Active':    { cls: 'badge-blue',  icon: '🟢' },
    'Clôturée':  { cls: 'badge-green', icon: '🏁' },
    'Annulée':   { cls: 'badge-grey',  icon: '⛔' },
  };

  async function loadCampagnes() {
    const wrap = document.getElementById('campagnesWrap');
    if (!wrap) return;
    try {
      const rows = await api.get('/campagnes');
      if (!rows.length) { wrap.innerHTML = `<p class="dt-empty">Aucune campagne créée pour le moment.</p>`; return; }
      wrap.innerHTML = `<div class="ra-list">${rows.map(c => {
        const st  = CAMP_STATUT_CFG[c.statut] || { cls: 'badge-grey', icon: '' };
        const pct = c.objectifMontant ? Math.min(100, Math.round(c.montantCollecte / c.objectifMontant * 100)) : 0;
        return `
        <div class="ra-item" style="flex-direction:column;align-items:stretch;gap:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>${c.titre}</strong>
            <span class="badge ${st.cls}">${st.icon} ${c.statut}</span>
          </div>
          <div class="don-campagne-bar"><div class="don-campagne-fill" style="width:${pct}%"></div></div>
          <div class="don-campagne-label">${Number(c.montantCollecte).toLocaleString('fr-FR')} / ${Number(c.objectifMontant).toLocaleString('fr-FR')} XOF (${pct}%)</div>
          ${c.statut === 'Active' ? `<button class="dp-btn" data-action="cloturer" data-id="${c.idCampagne}" style="align-self:flex-start">🏁 Clôturer</button>` : ''}
        </div>`;
      }).join('')}</div>`;

      wrap.querySelectorAll('[data-action="cloturer"]').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Clôturer cette campagne ?')) return;
          try { await api.put(`/campagnes/${btn.dataset.id}/statut`, { statut: 'Clôturée' }); loadCampagnes(); }
          catch (e) { showToast(e.message, 'error'); }
        };
      });
    } catch (err) {
      wrap.innerHTML = `<p class="dt-empty">${err.message}</p>`;
    }
  }

  function openCampagneModal() {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="campagneModal">
        <div class="modal" style="max-width:440px">
          <div class="modal-header">
            <h3>+ Nouvelle campagne</h3>
            <button class="modal-close" id="closeCampagneModal">×</button>
          </div>
          <div style="padding:20px">
            <div class="form-group">
              <label>Titre *</label>
              <input type="text" id="campTitre" placeholder="Ex : Construction d'un puits">
            </div>
            <div class="form-group">
              <label>Objectif (XOF) *</label>
              <input type="number" id="campObjectif" min="1" placeholder="Ex : 500000">
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea id="campDescription" rows="2"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Début</label><input type="date" id="campDebut"></div>
              <div class="form-group"><label>Fin</label><input type="date" id="campFin"></div>
            </div>
            <div class="form-actions">
              <button class="btn btn-secondary" id="cancelCampagneModal">Annuler</button>
              <button class="btn btn-primary" id="saveCampagneModal">Créer</button>
            </div>
          </div>
        </div>
      </div>`);

    const close = () => document.getElementById('campagneModal')?.remove();
    document.getElementById('closeCampagneModal').onclick  = close;
    document.getElementById('cancelCampagneModal').onclick = close;
    document.getElementById('saveCampagneModal').onclick = async () => {
      const titre     = document.getElementById('campTitre').value.trim();
      const objectif  = document.getElementById('campObjectif').value;
      if (!titre || !objectif) { showToast('Titre et objectif requis', 'error'); return; }
      try {
        await api.post('/campagnes', {
          titre, objectifMontant: Number(objectif),
          description: document.getElementById('campDescription').value || null,
          dateDebut: document.getElementById('campDebut').value || null,
          dateFin: document.getElementById('campFin').value || null,
        });
        showToast('Campagne créée', 'success');
        close();
        loadCampagnes();
      } catch (e) { showToast(e.message, 'error'); }
    };
  }

  function viewHtml(org) {
    const row = (label, val) => `
      <div class="dem-info-item"><span>${label}</span><strong>${val || '—'}</strong></div>`;
    return `
      <div class="dem-info-grid">
        ${row('Email', org.EmailOrg)}
        ${row('Téléphone', org.TelOrg)}
        ${row('Siège / Ville', org.SiegeOrg)}
        ${row('Site web', org.SiteWeb)}
        ${row('Représentant', [org.NomRepresentant, org.FonctionRepresentant].filter(Boolean).join(' — '))}
        ${row('Date de création', org.DateCreOrg ? new Date(org.DateCreOrg).toLocaleDateString('fr-FR') : null)}
      </div>
      ${org.Description ? `<p style="margin-top:16px;color:#475569;font-size:14px;line-height:1.6">${org.Description}</p>` : ''}
    `;
  }

  function editFormHtml(org) {
    return `
      <form id="orgEditForm">
        <div class="form-group">
          <label>Nom de l'organisation *</label>
          <input type="text" name="LibOrg" required minlength="3" maxlength="150" value="${org.LibOrg || ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Siège social / Ville</label>
            <input type="text" name="SiegeOrg" value="${org.SiegeOrg || ''}">
          </div>
          <div class="form-group">
            <label>Site web</label>
            <input type="text" name="SiteWeb" value="${org.SiteWeb || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="EmailOrg" value="${org.EmailOrg || ''}">
          </div>
          <div class="form-group">
            <label>Téléphone</label>
            <input type="text" name="TelOrg" value="${org.TelOrg || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Nom du représentant</label>
            <input type="text" name="NomRepresentant" value="${org.NomRepresentant || ''}">
          </div>
          <div class="form-group">
            <label>Fonction</label>
            <input type="text" name="FonctionRepresentant" value="${org.FonctionRepresentant || ''}">
          </div>
        </div>
        <div class="form-group">
          <label>Description / Objet social</label>
          <textarea name="Description" rows="3">${org.Description || ''}</textarea>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px">
          <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
          <button type="button" id="btnCancelEdit" class="btn btn-secondary">Annuler</button>
        </div>
      </form>`;
  }

  load();
});
