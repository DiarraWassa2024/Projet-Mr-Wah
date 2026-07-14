router.register('configuration', async () => {
  const app = document.getElementById('app');
  let activeTab = 'taux';

  function shell() {
    app.innerHTML = `
      <div class="page-header"><h1>⚙️ Configuration de la plateforme</h1></div>
      <div class="hab-main-tabs">
        <button class="hab-main-tab ${activeTab==='taux'?'active':''}" data-t="taux">📊 Taux</button>
        <button class="hab-main-tab ${activeTab==='pages'?'active':''}" data-t="pages">📄 Pages statiques</button>
        <button class="hab-main-tab ${activeTab==='themes'?'active':''}" data-t="themes">🎨 Thèmes par pays</button>
      </div>
      <div id="configBody"></div>`;

    document.querySelectorAll('.hab-main-tab').forEach(btn => {
      btn.onclick = () => { activeTab = btn.dataset.t; shell(); };
    });

    if (activeTab === 'taux') renderTaux();
    else if (activeTab === 'pages') renderPages();
    else renderThemes();
  }

  /* ── Taux ─────────────────────────────────────────────── */
  async function renderTaux() {
    const body = document.getElementById('configBody');
    body.innerHTML = `<div id="tauxList" style="margin-top:16px">Chargement…</div>`;
    try {
      const rows = await api.get('/config-plateforme');
      document.getElementById('tauxList').innerHTML = `<div class="ra-list">${rows.map(c => `
        <div class="ra-item">
          <div>
            <strong>${c.description || c.cle}</strong>
            <div style="font-size:11px;color:#94a3b8">${c.cle}${c.dateMaj ? ' · modifié le ' + new Date(c.dateMaj).toLocaleDateString('fr-FR') : ' · valeur par défaut (jamais modifiée)'}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="number" data-cle="${c.cle}" value="${c.valeur}" style="width:80px;padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;text-align:right">
            <span>%</span>
            <button class="dp-btn" data-action="save" data-cle="${c.cle}">Enregistrer</button>
          </div>
        </div>`).join('')}</div>`;

      document.querySelectorAll('[data-action="save"]').forEach(btn => {
        btn.onclick = async () => {
          const input = document.querySelector(`input[data-cle="${btn.dataset.cle}"]`);
          const valeur = input.value.trim();
          if (!valeur) { showToast('Valeur requise', 'error'); return; }
          try {
            await api.put(`/config-plateforme/${btn.dataset.cle}`, { valeur });
            showToast('Réglage mis à jour');
            renderTaux();
          } catch (e) { showToast(e.message, 'error'); }
        };
      });
    } catch (err) {
      document.getElementById('tauxList').innerHTML = `<p class="dt-empty">${err.message}</p>`;
    }
  }

  /* ── Pages statiques ──────────────────────────────────── */
  async function renderPages() {
    const body = document.getElementById('configBody');
    body.innerHTML = `
      <div class="page-header" style="margin-top:16px">
        <span></span>
        <button class="btn btn-primary" id="btnAddPage">+ Nouvelle page</button>
      </div>
      <div id="pagesList">Chargement…</div>`;
    document.getElementById('btnAddPage').onclick = () => openPageModal();

    try {
      const rows = await api.get('/config-plateforme/pages');
      const list = document.getElementById('pagesList');
      if (!rows.length) { list.innerHTML = `<p class="dt-empty">Aucune page statique créée (ex : À propos, CGU, Confidentialité).</p>`; return; }
      list.innerHTML = `<div class="ra-list">${rows.map(p => `
        <div class="ra-item">
          <div>
            <strong>${p.titre}</strong>
            <div style="font-size:11px;color:#94a3b8">/${p.slug} · ${p.langue}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn-icon" data-action="edit" data-id="${p.idPage}" title="Modifier">✏️</button>
            <button class="btn-icon" data-action="del" data-id="${p.idPage}" title="Supprimer">🗑️</button>
          </div>
        </div>`).join('')}</div>`;

      list.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.onclick = () => openPageModal(rows.find(p => p.idPage == btn.dataset.id));
      });
      list.querySelectorAll('[data-action="del"]').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Supprimer cette page ?')) return;
          try { await api.delete(`/config-plateforme/pages/${btn.dataset.id}`); renderPages(); }
          catch (e) { showToast(e.message, 'error'); }
        };
      });
    } catch (err) {
      document.getElementById('pagesList').innerHTML = `<p class="dt-empty">${err.message}</p>`;
    }
  }

  function openPageModal(p = {}) {
    const isEdit = !!p.idPage;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="pageModal">
        <div class="modal" style="max-width:560px">
          <div class="modal-header">
            <h3>${isEdit ? '✏️ Modifier la page' : '+ Nouvelle page statique'}</h3>
            <button class="modal-close" id="closePageModal">×</button>
          </div>
          <div style="padding:20px">
            <div class="form-group">
              <label>Titre *</label>
              <input type="text" id="pageTitre" value="${p.titre || ''}" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px">
            </div>
            ${!isEdit ? `
            <div class="form-group">
              <label>Slug (URL) *</label>
              <input type="text" id="pageSlug" placeholder="a-propos, cgu, confidentialite…" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px">
            </div>` : ''}
            <div class="form-group">
              <label>Contenu</label>
              <textarea id="pageContenu" rows="8" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px">${p.contenu || ''}</textarea>
            </div>
            <div class="form-actions">
              <button class="btn btn-secondary" id="cancelPageModal">Annuler</button>
              <button class="btn btn-primary" id="savePageModal">${isEdit ? 'Enregistrer' : 'Créer'}</button>
            </div>
          </div>
        </div>
      </div>`);
    const close = () => document.getElementById('pageModal')?.remove();
    document.getElementById('closePageModal').onclick = close;
    document.getElementById('cancelPageModal').onclick = close;
    document.getElementById('savePageModal').onclick = async () => {
      const titre = document.getElementById('pageTitre').value.trim();
      const contenu = document.getElementById('pageContenu').value;
      if (!titre) { showToast('Titre requis', 'error'); return; }
      try {
        if (isEdit) {
          await api.put(`/config-plateforme/pages/${p.idPage}`, { titre, contenu, langue: p.langue || 'fr' });
        } else {
          const slug = document.getElementById('pageSlug').value.trim();
          if (!slug) { showToast('Slug requis', 'error'); return; }
          await api.post('/config-plateforme/pages', { titre, slug, contenu, langue: 'fr' });
        }
        showToast(isEdit ? 'Page mise à jour' : 'Page créée');
        close();
        renderPages();
      } catch (e) { showToast(e.message, 'error'); }
    };
  }

  /* ── Thèmes par pays ──────────────────────────────────── */
  async function renderThemes() {
    const body = document.getElementById('configBody');
    body.innerHTML = `<div id="themesList" style="margin-top:16px">Chargement…</div>`;
    try {
      const [themes, pays] = await Promise.all([
        api.get('/config-plateforme/themes'),
        api.get('/ref/pays'),
      ]);
      const parPays = Object.fromEntries(themes.map(t => [t.codePays, t]));
      document.getElementById('themesList').innerHTML = `<div class="ra-list">${pays.map(p => {
        const t = parPays[p.id] || {};
        return `
        <div class="ra-item" style="flex-wrap:wrap;gap:10px">
          <div style="min-width:120px"><strong>${p.lib}</strong></div>
          <div style="display:flex;gap:8px;align-items:center;flex:1;flex-wrap:wrap">
            <label style="font-size:11px;color:#64748b">Primaire <input type="color" data-field="couleurPrimaire" data-pays="${p.id}" value="${t.couleurPrimaire || '#145c56'}"></label>
            <label style="font-size:11px;color:#64748b">Secondaire <input type="color" data-field="couleurSecondaire" data-pays="${p.id}" value="${t.couleurSecondaire || '#2f8f7f'}"></label>
            <button class="dp-btn" data-action="save-theme" data-pays="${p.id}">Enregistrer</button>
          </div>
        </div>`;
      }).join('')}</div>`;

      document.querySelectorAll('[data-action="save-theme"]').forEach(btn => {
        btn.onclick = async () => {
          const codePays = btn.dataset.pays;
          const couleurPrimaire = document.querySelector(`input[data-field="couleurPrimaire"][data-pays="${codePays}"]`).value;
          const couleurSecondaire = document.querySelector(`input[data-field="couleurSecondaire"][data-pays="${codePays}"]`).value;
          try {
            await api.put(`/config-plateforme/themes/${codePays}`, { couleurPrimaire, couleurSecondaire });
            showToast('Thème mis à jour');
          } catch (e) { showToast(e.message, 'error'); }
        };
      });
    } catch (err) {
      document.getElementById('themesList').innerHTML = `<p class="dt-empty">${err.message}</p>`;
    }
  }

  shell();
});
