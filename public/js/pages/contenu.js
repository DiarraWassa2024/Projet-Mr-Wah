router.register('contenu', async () => {
  const app  = document.getElementById('app');
  const user = auth.getUser() || {};
  const isAdmin = user.role === 'admin';
  let activeTab = 'actualites';

  function shell() {
    app.innerHTML = `
      <div class="page-header"><h1>📰 Contenu</h1></div>
      <div class="hab-main-tabs">
        <button class="hab-main-tab ${activeTab==='actualites'?'active':''}" data-t="actualites">📰 Actualités</button>
        ${isAdmin ? `<button class="hab-main-tab ${activeTab==='faq'?'active':''}" data-t="faq">❓ FAQ</button>` : ''}
      </div>
      <div id="contenuBody"></div>`;

    document.querySelectorAll('.hab-main-tab').forEach(btn => {
      btn.onclick = () => { activeTab = btn.dataset.t; shell(); };
    });

    if (activeTab === 'actualites') renderActualites();
    else renderFaq();
  }

  /* ── Actualités ──────────────────────────────────────────── */
  async function renderActualites() {
    const body = document.getElementById('contenuBody');
    body.innerHTML = `
      <div class="page-header" style="margin-top:16px">
        <span></span>
        <button class="btn btn-primary" id="btnAddActu">+ Nouvelle actualité</button>
      </div>
      <div id="actuList">Chargement…</div>`;
    document.getElementById('btnAddActu').onclick = () => openActuModal();

    try {
      const rows = await api.get('/actualites');
      const list = document.getElementById('actuList');
      if (!rows.length) { list.innerHTML = `<p class="dt-empty">Aucune actualité créée.</p>`; return; }
      list.innerHTML = `<div class="ra-list">${rows.map(a => `
        <div class="ra-item" style="flex-direction:column;align-items:stretch;gap:6px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>${a.titre}</strong>
            <span class="badge ${a.statut==='Publiée'?'badge-green':'badge-grey'}">${a.statut}</span>
          </div>
          <div style="font-size:13px;color:#64748b">${a.LibOrg ? a.LibOrg + ' · ' : 'Plateforme · '}${new Date(a.datePublication).toLocaleDateString('fr-FR')}</div>
          <div style="font-size:13px;color:#374151">${a.contenu.slice(0, 140)}${a.contenu.length > 140 ? '…' : ''}</div>
          <div style="display:flex;gap:8px">
            <button class="btn-icon" data-action="edit" data-id="${a.idActu}" title="Modifier">✏️</button>
            <button class="btn-icon" data-action="del"  data-id="${a.idActu}" title="Supprimer">🗑️</button>
          </div>
        </div>`).join('')}</div>`;

      list.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.onclick = () => openActuModal(rows.find(a => a.idActu == btn.dataset.id));
      });
      list.querySelectorAll('[data-action="del"]').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Supprimer cette actualité ?')) return;
          try { await api.delete(`/actualites/${btn.dataset.id}`); renderActualites(); }
          catch (e) { showToast(e.message, 'error'); }
        };
      });
    } catch (err) {
      document.getElementById('actuList').innerHTML = `<p class="dt-empty">${err.message}</p>`;
    }
  }

  function openActuModal(a = null) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="actuModal">
        <div class="modal" style="max-width:520px">
          <div class="modal-header">
            <h3>${a ? 'Modifier' : '+ Nouvelle'} actualité</h3>
            <button class="modal-close" id="closeActuModal">×</button>
          </div>
          <div style="padding:20px">
            <div class="form-group">
              <label>Titre *</label>
              <input type="text" id="actuTitre" value="${a?.titre || ''}">
            </div>
            <div class="form-group">
              <label>Contenu *</label>
              <textarea id="actuContenu" rows="5">${a?.contenu || ''}</textarea>
            </div>
            <div class="form-group">
              <label>Statut</label>
              <select id="actuStatut" class="select-sm" style="width:100%">
                <option value="Publiée" ${a?.statut!=='Brouillon'?'selected':''}>Publiée</option>
                <option value="Brouillon" ${a?.statut==='Brouillon'?'selected':''}>Brouillon</option>
              </select>
            </div>
            <div class="form-actions">
              <button class="btn btn-secondary" id="cancelActuModal">Annuler</button>
              <button class="btn btn-primary" id="saveActuModal">${a ? 'Enregistrer' : 'Créer'}</button>
            </div>
          </div>
        </div>
      </div>`);
    const close = () => document.getElementById('actuModal')?.remove();
    document.getElementById('closeActuModal').onclick  = close;
    document.getElementById('cancelActuModal').onclick = close;
    document.getElementById('saveActuModal').onclick = async () => {
      const titre   = document.getElementById('actuTitre').value.trim();
      const contenu = document.getElementById('actuContenu').value.trim();
      const statut  = document.getElementById('actuStatut').value;
      if (!titre || !contenu) { showToast('Titre et contenu requis', 'error'); return; }
      try {
        if (a) await api.put(`/actualites/${a.idActu}`, { titre, contenu, statut });
        else   await api.post('/actualites', { titre, contenu, statut });
        showToast(a ? 'Actualité mise à jour' : 'Actualité créée', 'success');
        close();
        renderActualites();
      } catch (e) { showToast(e.message, 'error'); }
    };
  }

  /* ── FAQ (admin uniquement) ──────────────────────────────── */
  async function renderFaq() {
    const body = document.getElementById('contenuBody');
    if (!isAdmin) { body.innerHTML = `<p class="dt-empty">Accès réservé aux administrateurs.</p>`; return; }
    body.innerHTML = `
      <div class="page-header" style="margin-top:16px">
        <span></span>
        <button class="btn btn-primary" id="btnAddFaq">+ Nouvelle question</button>
      </div>
      <div id="faqList">Chargement…</div>`;
    document.getElementById('btnAddFaq').onclick = () => openFaqModal();

    try {
      const rows = await api.get('/faq');
      const list = document.getElementById('faqList');
      if (!rows.length) { list.innerHTML = `<p class="dt-empty">Aucune question créée.</p>`; return; }
      list.innerHTML = `<div class="ra-list">${rows.map(f => `
        <div class="ra-item" style="flex-direction:column;align-items:stretch;gap:6px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>${f.question}</strong>
            <span class="badge ${f.actif?'badge-green':'badge-grey'}">${f.actif ? 'Active' : 'Masquée'}</span>
          </div>
          <div style="font-size:13px;color:#374151">${f.reponse}</div>
          <div style="display:flex;gap:8px">
            <button class="btn-icon" data-action="edit" data-id="${f.idFAQ}" title="Modifier">✏️</button>
            <button class="btn-icon" data-action="del"  data-id="${f.idFAQ}" title="Supprimer">🗑️</button>
          </div>
        </div>`).join('')}</div>`;

      list.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.onclick = () => openFaqModal(rows.find(f => f.idFAQ == btn.dataset.id));
      });
      list.querySelectorAll('[data-action="del"]').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Supprimer cette question ?')) return;
          try { await api.delete(`/faq/${btn.dataset.id}`); renderFaq(); }
          catch (e) { showToast(e.message, 'error'); }
        };
      });
    } catch (err) {
      document.getElementById('faqList').innerHTML = `<p class="dt-empty">${err.message}</p>`;
    }
  }

  function openFaqModal(f = null) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="faqModal">
        <div class="modal" style="max-width:520px">
          <div class="modal-header">
            <h3>${f ? 'Modifier' : '+ Nouvelle'} question</h3>
            <button class="modal-close" id="closeFaqModal">×</button>
          </div>
          <div style="padding:20px">
            <div class="form-group">
              <label>Question *</label>
              <input type="text" id="faqQuestion" value="${f?.question || ''}">
            </div>
            <div class="form-group">
              <label>Réponse *</label>
              <textarea id="faqReponse" rows="4">${f?.reponse || ''}</textarea>
            </div>
            <div class="form-actions">
              <button class="btn btn-secondary" id="cancelFaqModal">Annuler</button>
              <button class="btn btn-primary" id="saveFaqModal">${f ? 'Enregistrer' : 'Créer'}</button>
            </div>
          </div>
        </div>
      </div>`);
    const close = () => document.getElementById('faqModal')?.remove();
    document.getElementById('closeFaqModal').onclick  = close;
    document.getElementById('cancelFaqModal').onclick = close;
    document.getElementById('saveFaqModal').onclick = async () => {
      const question = document.getElementById('faqQuestion').value.trim();
      const reponse  = document.getElementById('faqReponse').value.trim();
      if (!question || !reponse) { showToast('Question et réponse requises', 'error'); return; }
      try {
        if (f) await api.put(`/faq/${f.idFAQ}`, { question, reponse, actif: 1 });
        else   await api.post('/faq', { question, reponse });
        showToast(f ? 'FAQ mise à jour' : 'FAQ créée', 'success');
        close();
        renderFaq();
      } catch (e) { showToast(e.message, 'error'); }
    };
  }

  shell();
});
