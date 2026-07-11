router.register('demandes', async () => {
  const app = document.getElementById('app');
  let allDemandes = [], allForOptions = [];
  let searchQ = '', filterStatut = '', filterType = '', filterPays = '';
  let filterVille = '', filterFonction = '', filterOrg = '';
  let filterOpen = false;
  let activeTab = 'liste';

  /* ── fetch ────────────────────────────────────────── */
  async function loadDemandes() {
    const url = dateFilter.buildUrl('/demandes', {
      ...(filterStatut   ? { statut:           filterStatut }   : {}),
      ...(filterType     ? { typeOrg:           filterType }     : {}),
      ...(filterPays     ? { codePays:          filterPays }     : {}),
      ...(filterVille    ? { ville:             filterVille }    : {}),
      ...(filterFonction ? { fonctionSouhaitee: filterFonction } : {}),
      ...(searchQ        ? { search:            searchQ }        : {}),
    });
    const raw = await api.get(url);
    allDemandes = filterOrg
      ? raw.filter(d => (d.nomOrg||'').toLowerCase().includes(filterOrg.toLowerCase())
                     || (d.nomOrgCible||'').toLowerCase().includes(filterOrg.toLowerCase()))
      : raw;
  }

  async function loadStats() {
    return api.get('/demandes/stats');
  }

  async function loadAllForOptions() {
    if (allForOptions.length) return;
    allForOptions = await api.get('/demandes');
  }

  async function loadLogs() {
    return api.get('/demandes/historique/logs');
  }

  /* ── statut badge ─────────────────────────────────── */
  const BADGE_CLASS = {
    'En attente de validation': 'badge-pend',
    'Actif':                    'badge-actif',
    'Suspendu':                 'badge-suspendu',
    'Radié':                    'badge-radie',
    'Exclu':                    'badge-exclu',
    'Démissionnaire':           'badge-dem',
    'Refusé':                   'badge-err',
    // legacy
    'En attente': 'badge-pend',
    'Acceptée':   'badge-actif',
    'Refusée':    'badge-err',
  };

  function badge(statut) {
    const cls = BADGE_CLASS[statut] || 'badge-pend';
    return `<span class="dem-badge ${cls}">${statut||'—'}</span>`;
  }

  function badgeSm(statut) {
    const cls = BADGE_CLASS[statut] || 'badge-pend';
    return `<span class="dem-badge dem-badge-sm ${cls}">${statut||'—'}</span>`;
  }

  function getNextStatuts(statutAdhesion) {
    const m = {
      'Actif':    ['Suspendu', 'Radié', 'Exclu', 'Démissionnaire'],
      'Suspendu': ['Actif',    'Radié', 'Exclu', 'Démissionnaire'],
    };
    return m[statutAdhesion] || [];
  }

  function typeIcon(t) {
    const m = { Association:'🏛️', ONG:'🌍', Mutuelle:'🤝', Individu:'👤' };
    return m[t] || '📋';
  }

  /* ── detail modal ─────────────────────────────────── */
  function openDetail(dem) {
    if (dem.typeOrg === 'Individu') return openIndividuModal(dem);
    return openOrgModal(dem);
  }

  /* ── modal INDIVIDU ───────────────────────────────── */
  function openIndividuModal(dem) {
    const sa          = dem.statutAdhesion || 'En attente de validation';
    const canAct      = sa === 'En attente de validation';
    const nextStatuts = getNextStatuts(sa);
    const canChange   = nextStatuts.length > 0;
    const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}) : '—';
    const prenom  = dem.repPrenom || '';
    const nom     = dem.repNom || dem.nomOrg || '—';
    const initials= `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '?';

    const avatarPhoto = dem.photo || (dem.typeOrg === 'Individu' ? dem.photoCNI : null);
    const avatarHtml = avatarPhoto
      ? `<img src="${avatarPhoto}" class="dem-avatar-img" alt="${prenom} ${nom}">`
      : `<div class="dem-avatar-init">${initials}</div>`;

    const docLink = (path, label, icon='📄') =>
      path ? `<a href="${path}" target="_blank" class="dem-doc-link"><span>${icon}</span><span>${label}</span></a>` : '';

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="demModal">
        <div class="modal dem-modal dem-modal-lg">

          <!-- En-tête -->
          <div class="modal-header dem-mhdr">
            <div class="dem-mhdr-left">
              <div class="dem-avatar-wrap">${avatarHtml}</div>
              <div>
                <h3>${prenom} ${nom}</h3>
                <div class="dem-mhdr-meta">Individu · ${dem.libPays||dem.codePays||'—'}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-left:auto">
              ${badge(sa)}
              <button class="modal-close" id="closeDemModal">&times;</button>
            </div>
          </div>

          <div class="dem-mdesc">

            <!-- Identité -->
            <div class="dem-section">
              <div class="dem-section-title">🪪 Identité</div>
              <div class="dem-info-grid">
                <div class="dem-info-item"><span>Prénom</span><strong>${dem.repPrenom||'—'}</strong></div>
                <div class="dem-info-item"><span>Nom</span><strong>${dem.repNom||'—'}</strong></div>
                <div class="dem-info-item"><span>Sexe</span><strong>${dem.sexe||'—'}</strong></div>
                <div class="dem-info-item"><span>Date de naissance</span><strong>${fmtDate(dem.dateCrea)}</strong></div>
                <div class="dem-info-item"><span>N° CNI / Passeport</span><strong>${dem.repCNI||'—'}</strong></div>
                <div class="dem-info-item"><span>Profession</span><strong>${dem.profession||'—'}</strong></div>
              </div>
            </div>

            <!-- Coordonnées -->
            <div class="dem-section">
              <div class="dem-section-title">📞 Coordonnées</div>
              <div class="dem-info-grid">
                <div class="dem-info-item"><span>Email</span><strong>${dem.emailOrg||'—'}</strong></div>
                <div class="dem-info-item"><span>Téléphone</span><strong>${dem.telOrg||'—'}</strong></div>
                <div class="dem-info-item"><span>Pays</span><strong>${dem.libPays||dem.codePays||'—'}</strong></div>
                <div class="dem-info-item"><span>Ville</span><strong>${dem.ville||'—'}</strong></div>
                ${dem.siegeOrg||dem.repAdresse ? `<div class="dem-info-item dem-info-full"><span>Adresse</span><strong>${dem.siegeOrg||dem.repAdresse}</strong></div>` : ''}
              </div>
            </div>

            <!-- Organisation ciblée -->
            <div class="dem-section">
              <div class="dem-section-title">🏢 Organisation ciblée</div>
              ${dem.nomOrgCible ? `
              <div class="dem-info-grid">
                <div class="dem-info-item"><span>Organisation</span><strong>${dem.nomOrgCible}</strong></div>
                <div class="dem-info-item"><span>Type</span><strong>${dem.typeOrgCible||'—'}</strong></div>
                <div class="dem-info-item"><span>Fonction souhaitée</span><strong>${dem.fonctionSouhaitee||'—'}</strong></div>
                <div class="dem-info-item"><span>N° agrément</span><strong>${dem.numAgr||'—'}</strong></div>
              </div>` : `
              <p class="dem-no-org">
                Organisation non trouvée dans le registre${dem.numAgr ? ` (réf. ${dem.numAgr})` : ''}.
                ${dem.fonctionSouhaitee ? `<br>Fonction souhaitée : <strong>${dem.fonctionSouhaitee}</strong>` : ''}
              </p>`}
            </div>

            <!-- Documents -->
            ${dem.docAgrement || dem.photoCNI ? `
            <div class="dem-section">
              <div class="dem-section-title">📎 Documents joints</div>
              <div class="dem-docs-list">
                ${docLink(dem.docAgrement, 'Document justificatif', '📄')}
                ${docLink(dem.photoCNI,    'Photo CNI / Passeport',  '🪪')}
              </div>
            </div>` : ''}

            <!-- Motivation -->
            ${dem.description ? `
            <div class="dem-section">
              <div class="dem-section-title">💬 Motivation</div>
              <p class="dem-desc-text">${dem.description}</p>
            </div>` : ''}

            <!-- Suivi -->
            <div class="dem-section">
              <div class="dem-section-title">📊 Suivi de la demande</div>
              <div class="dem-info-grid">
                <div class="dem-info-item"><span>Date soumission</span><strong>${fmtDate(dem.dateDemande)}</strong></div>
                <div class="dem-info-item"><span>Dernier traitement</span><strong>${fmtDate(dem.dateTraitement)}</strong></div>
                <div class="dem-info-item"><span>Traité par</span><strong>${dem.adminTraitement||'—'}</strong></div>
                ${dem.refDossier ? `<div class="dem-info-item"><span>Réf. dossier</span><strong class="ref-badge-sm">#${dem.refDossier}</strong></div>` : ''}
                ${dem.motifRefus ? `<div class="dem-info-item dem-info-full"><span>Motif</span><strong class="motif-text">${dem.motifRefus}</strong></div>` : ''}
              </div>
            </div>

            <!-- Historique des statuts -->
            <div class="dem-section">
              <div class="dem-section-title">📋 Historique des statuts</div>
              <div class="statut-timeline" id="statutTimeline">
                <div class="statut-tl-loading">Chargement…</div>
              </div>
            </div>

          </div>

          ${canAct ? `
          <div class="dem-mfooter">
            <button class="btn-dem-refuse" id="btnRefuse">✕ Refuser</button>
            <button class="btn-dem-accept" id="btnAccept">✓ Accepter</button>
          </div>` : canChange ? `
          <div class="dem-mfooter dem-mfooter-chg">
            <span class="statut-chg-label">Changer le statut :</span>
            <select id="newStatutSel" class="statut-chg-sel">
              <option value="">— Choisir —</option>
              ${nextStatuts.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <input id="motifStatut" type="text" class="statut-chg-motif" placeholder="Motif (optionnel)">
            <button id="btnChgStatut" class="btn-dem-chg">Appliquer</button>
          </div>` : `
          <div class="dem-mfooter-readonly">
            ${badge(sa)} — traité le ${fmtDate(dem.dateTraitement)} par <strong>${dem.adminTraitement||'—'}</strong>
          </div>`}
        </div>
      </div>`);

    const closeBtn = () => document.getElementById('demModal')?.remove();
    document.getElementById('closeDemModal').onclick = closeBtn;
    document.getElementById('demModal').onclick = e => { if (e.target.id === 'demModal') closeBtn(); };
    if (canAct) {
      document.getElementById('btnAccept').onclick = () => { closeBtn(); confirmAccept(dem); };
      document.getElementById('btnRefuse').onclick = () => { closeBtn(); confirmRefuse(dem); };
    }
    if (canChange) {
      document.getElementById('btnChgStatut').onclick = async () => {
        const newSt  = document.getElementById('newStatutSel').value;
        const motif  = document.getElementById('motifStatut').value.trim();
        if (!newSt) { showToast('Veuillez sélectionner un statut', 'err'); return; }
        const btn = document.getElementById('btnChgStatut');
        btn.disabled = true; btn.textContent = '…';
        try {
          await api.put(`/demandes/${dem.idDemande}/statut`, { statut: newSt, commentaire: motif });
          closeBtn();
          showToast(`Statut changé en "${newSt}"`, 'ok');
          render();
        } catch(e) { showToast(e.message, 'err'); btn.disabled = false; btn.textContent = 'Appliquer'; }
      };
    }
    loadHistoriqueModal(dem.idDemande);
  }

  /* ── modal ORGANISATION ───────────────────────────── */
  function openOrgModal(dem) {
    const sa          = dem.statutAdhesion || 'En attente de validation';
    const canAct      = sa === 'En attente de validation';
    const nextStatuts = getNextStatuts(sa);
    const canChange   = nextStatuts.length > 0;
    const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}) : '—';

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="demModal">
        <div class="modal dem-modal dem-modal-lg">

          <!-- En-tête -->
          <div class="modal-header dem-mhdr">
            <div class="dem-mhdr-left">
              <div class="dem-type-big">${typeIcon(dem.typeOrg)}</div>
              <div>
                <h3>${dem.nomOrg}</h3>
                <div class="dem-mhdr-meta">${dem.typeOrg} · ${dem.libPays||dem.codePays||'—'}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-left:auto">
              ${badge(sa)}
              <button class="modal-close" id="closeDemModal">&times;</button>
            </div>
          </div>

          <div class="dem-mdesc">

            <!-- Organisation -->
            <div class="dem-section">
              <div class="dem-section-title">🏢 Informations de l'organisation</div>
              <div class="dem-info-grid">
                <div class="dem-info-item"><span>Email</span><strong>${dem.emailOrg||'—'}</strong></div>
                <div class="dem-info-item"><span>Téléphone</span><strong>${dem.telOrg||'—'}</strong></div>
                <div class="dem-info-item"><span>Siège social</span><strong>${dem.siegeOrg||'—'}</strong></div>
                <div class="dem-info-item"><span>Site web</span><strong>${dem.siteWeb ? `<a href="${dem.siteWeb}" target="_blank">${dem.siteWeb}</a>` : '—'}</strong></div>
                <div class="dem-info-item"><span>N° agrément</span><strong>${dem.numAgr||'—'}</strong></div>
                <div class="dem-info-item"><span>Date de création</span><strong>${fmtDate(dem.dateCrea)}</strong></div>
                ${dem.ministere ? `<div class="dem-info-item dem-info-full"><span>Ministère de tutelle</span><strong>${dem.ministere}</strong></div>` : ''}
              </div>
            </div>

            ${dem.description ? `
            <div class="dem-section">
              <div class="dem-section-title">📝 Description / Objet social</div>
              <p class="dem-desc-text">${dem.description}</p>
            </div>` : ''}

            <!-- Responsable légal -->
            <div class="dem-section">
              <div class="dem-section-title">👤 Responsable légal (déclarant)</div>
              <div class="dem-info-grid">
                <div class="dem-info-item"><span>Nom complet</span><strong>${dem.repPrenom||''} ${dem.repNom||'—'}</strong></div>
                <div class="dem-info-item"><span>Sexe</span><strong>${dem.repSexe||'—'}</strong></div>
                <div class="dem-info-item"><span>Fonction</span><strong>${dem.repFonction||'—'}</strong></div>
                <div class="dem-info-item"><span>N° CNI</span><strong>${dem.repCNI||'—'}</strong></div>
                ${dem.repEmail ? `<div class="dem-info-item"><span>Email</span><strong>${dem.repEmail}</strong></div>` : ''}
                ${dem.repTel   ? `<div class="dem-info-item"><span>Téléphone</span><strong>${dem.repTel}</strong></div>` : ''}
                ${dem.repAdresse ? `<div class="dem-info-item dem-info-full"><span>Adresse</span><strong>${dem.repAdresse}</strong></div>` : ''}
              </div>
            </div>

            <!-- Documents -->
            ${dem.docAgrement ? `
            <div class="dem-section">
              <div class="dem-section-title">📎 Document d'agrément</div>
              <div class="dem-docs-list">
                <a href="${dem.docAgrement}" target="_blank" class="dem-doc-link">
                  <span>📄</span><span>Voir le document</span>
                </a>
              </div>
            </div>` : ''}

            <!-- Suivi -->
            <div class="dem-section">
              <div class="dem-section-title">📊 Suivi de la demande</div>
              <div class="dem-info-grid">
                <div class="dem-info-item"><span>Date soumission</span><strong>${fmtDate(dem.dateDemande)}</strong></div>
                <div class="dem-info-item"><span>Dernier traitement</span><strong>${fmtDate(dem.dateTraitement)}</strong></div>
                <div class="dem-info-item"><span>Traité par</span><strong>${dem.adminTraitement||'—'}</strong></div>
                ${dem.motifRefus ? `<div class="dem-info-item dem-info-full"><span>Motif</span><strong class="motif-text">${dem.motifRefus}</strong></div>` : ''}
              </div>
            </div>

            <!-- Historique des statuts -->
            <div class="dem-section">
              <div class="dem-section-title">📋 Historique des statuts</div>
              <div class="statut-timeline" id="statutTimeline">
                <div class="statut-tl-loading">Chargement…</div>
              </div>
            </div>

          </div>

          ${canAct ? `
          <div class="dem-mfooter">
            <button class="btn-dem-refuse" id="btnRefuse">✕ Refuser</button>
            <button class="btn-dem-accept" id="btnAccept">✓ Accepter</button>
          </div>` : canChange ? `
          <div class="dem-mfooter dem-mfooter-chg">
            <span class="statut-chg-label">Changer le statut :</span>
            <select id="newStatutSel" class="statut-chg-sel">
              <option value="">— Choisir —</option>
              ${nextStatuts.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <input id="motifStatut" type="text" class="statut-chg-motif" placeholder="Motif (optionnel)">
            <button id="btnChgStatut" class="btn-dem-chg">Appliquer</button>
          </div>` : `
          <div class="dem-mfooter-readonly">
            ${badge(sa)} — traité le ${fmtDate(dem.dateTraitement)} par <strong>${dem.adminTraitement||'—'}</strong>
          </div>`}
        </div>
      </div>`);

    const closeBtn = () => document.getElementById('demModal')?.remove();
    document.getElementById('closeDemModal').onclick = closeBtn;
    document.getElementById('demModal').onclick = e => { if (e.target.id === 'demModal') closeBtn(); };
    if (canAct) {
      document.getElementById('btnAccept').onclick = () => { closeBtn(); confirmAccept(dem); };
      document.getElementById('btnRefuse').onclick = () => { closeBtn(); confirmRefuse(dem); };
    }
    if (canChange) {
      document.getElementById('btnChgStatut').onclick = async () => {
        const newSt  = document.getElementById('newStatutSel').value;
        const motif  = document.getElementById('motifStatut').value.trim();
        if (!newSt) { showToast('Veuillez sélectionner un statut', 'err'); return; }
        const btn = document.getElementById('btnChgStatut');
        btn.disabled = true; btn.textContent = '…';
        try {
          await api.put(`/demandes/${dem.idDemande}/statut`, { statut: newSt, commentaire: motif });
          closeBtn();
          showToast(`Statut changé en "${newSt}"`, 'ok');
          render();
        } catch(e) { showToast(e.message, 'err'); btn.disabled = false; btn.textContent = 'Appliquer'; }
      };
    }
    loadHistoriqueModal(dem.idDemande);
  }

  /* ── confirm accept ───────────────────────────────── */
  function confirmAccept(dem) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="confModal">
        <div class="modal conf-modal">
          <div class="conf-icon conf-ok">✓</div>
          <h3>Accepter la demande ?</h3>
          <p>L'organisation <strong>${dem.nomOrg}</strong> sera acceptée et un email de confirmation
             sera envoyé à <strong>${dem.emailOrg}</strong>.</p>
          <div class="conf-actions">
            <button class="btn btn-secondary" id="confCancel">Annuler</button>
            <button class="btn-dem-accept" id="confOk">Confirmer l'acceptation</button>
          </div>
        </div>
      </div>`);
    document.getElementById('confCancel').onclick = () => document.getElementById('confModal').remove();
    document.getElementById('confOk').onclick = async () => {
      document.getElementById('confOk').disabled = true;
      document.getElementById('confOk').textContent = 'En cours…';
      try {
        await api.put(`/demandes/${dem.idDemande}/accepter`, {});
        document.getElementById('confModal').remove();
        showToast('Demande acceptée · Email envoyé', 'ok');
        render();
      } catch(e) { showToast(e.message, 'err'); document.getElementById('confModal').remove(); }
    };
  }

  /* ── confirm refuse ───────────────────────────────── */
  function confirmRefuse(dem) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="refModal">
        <div class="modal conf-modal">
          <div class="conf-icon conf-err">✕</div>
          <h3>Refuser la demande ?</h3>
          <p>Un email de refus sera envoyé à <strong>${dem.emailOrg}</strong>.</p>
          <div class="form-group" style="margin:16px 0 0">
            <label style="font-size:13px;color:#64748b;margin-bottom:6px;display:block">
              Motif de refus <span style="color:#94a3b8">(optionnel)</span>
            </label>
            <textarea id="motifInput" rows="3" placeholder="Expliquez la raison du refus…"
              style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;resize:vertical"></textarea>
          </div>
          <div class="conf-actions">
            <button class="btn btn-secondary" id="refCancel">Annuler</button>
            <button class="btn-dem-refuse" id="refOk">Confirmer le refus</button>
          </div>
        </div>
      </div>`);
    document.getElementById('refCancel').onclick = () => document.getElementById('refModal').remove();
    document.getElementById('refOk').onclick = async () => {
      const motif = document.getElementById('motifInput').value.trim();
      document.getElementById('refOk').disabled = true;
      document.getElementById('refOk').textContent = 'En cours…';
      try {
        await api.put(`/demandes/${dem.idDemande}/refuser`, { motif });
        document.getElementById('refModal').remove();
        showToast('Demande refusée · Email envoyé', 'ok');
        render();
      } catch(e) { showToast(e.message, 'err'); document.getElementById('refModal').remove(); }
    };
  }

  /* ── toast ────────────────────────────────────────── */
  function showToast(msg, type='ok') {
    const t = document.createElement('div');
    t.className = `dem-toast dem-toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('dem-toast-show'), 10);
    setTimeout(() => { t.classList.remove('dem-toast-show'); setTimeout(()=>t.remove(),300); }, 3500);
  }

  /* ── historique statut dans modal ────────────────── */
  async function loadHistoriqueModal(idDemande) {
    const tl = document.getElementById('statutTimeline');
    if (!tl) return;
    try {
      const rows = await api.get(`/demandes/${idDemande}/historique`);
      const fmt = d => d ? new Date(d).toLocaleString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
      if (!rows.length) {
        tl.innerHTML = '<div class="statut-tl-empty">Aucun changement enregistré</div>';
        return;
      }
      tl.innerHTML = rows.map(r => `
        <div class="statut-tl-item">
          <div class="statut-tl-dot"></div>
          <div class="statut-tl-body">
            <div class="statut-tl-change">
              ${r.ancienStatut ? `${badgeSm(r.ancienStatut)} → ` : ''}${badgeSm(r.nouveauStatut)}
            </div>
            <div class="statut-tl-meta">
              ${fmt(r.dateChangement)}${r.auteur ? ` · par <strong>${r.auteur}</strong>` : ''}
              ${r.commentaire ? `<br><em>${r.commentaire}</em>` : ''}
            </div>
          </div>
        </div>`).join('');
    } catch(_) {
      tl.innerHTML = '<div class="statut-tl-empty">Impossible de charger l\'historique</div>';
    }
  }

  /* ── historique tab ───────────────────────────────── */
  async function renderHistorique() {
    const logs = await loadLogs();
    const fmt = d => d ? new Date(d).toLocaleString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    const actionLabel = a => ({
      'ACCEPTER_DEMANDE': '<span class="badge-ok">Acceptée</span>',
      'REFUSER_DEMANDE':  '<span class="badge-err">Refusée</span>',
      'CHANGER_STATUT':   '<span class="badge-pend">Changement statut</span>',
    }[a] || `<span class="badge-pend">${a}</span>`);

    app.innerHTML = `
      <div class="page-header">
        <h2>Demandes d'adhésion</h2>
        <div class="dem-tabs">
          <button class="dem-tab" id="tabListe" onclick="nav('demandes')">Liste des demandes</button>
          <button class="dem-tab active" id="tabHisto">Historique</button>
        </div>
      </div>
      <div class="table-wrap">
        ${logs.length ? `
        <table class="table">
          <thead><tr>
            <th>Date</th><th>Organisation</th><th>Décision</th>
            <th>Traité par</th><th>Détails</th>
          </tr></thead>
          <tbody>
            ${logs.map(l=>`
              <tr>
                <td style="white-space:nowrap">${fmt(l.dateAction)}</td>
                <td><strong>${l.nomOrg||'—'}</strong><br><small style="color:#94a3b8">${l.typeOrg||''}</small></td>
                <td>${actionLabel(l.action)}</td>
                <td>${l.adminUser||'—'}</td>
                <td style="font-size:12px;color:#64748b">${l.details||'—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>` : `<div class="dem-empty"><div class="dem-empty-icon">📋</div><p>Aucun historique disponible</p></div>`}
      </div>`;
  }

  /* ── main render ──────────────────────────────────── */
  /* ── avatar helpers ──────────────────────────────── */
  function avatarColor(str) {
    const palette = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#14b8a6','#f97316','#06b6d4','#84cc16'];
    let h = 0;
    for (const c of (str||'')) h = ((h * 31) + c.charCodeAt(0)) & 0xffff;
    return palette[h % palette.length];
  }

  function avatarHtml(d) {
    const isInd  = d.typeOrg === 'Individu';
    const name   = isInd ? (d.repPrenom||'') + ' ' + (d.repNom||'') : (d.nomOrg||'');
    const color  = avatarColor(name.trim());
    const init   = name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase() || '?';
    const photo  = isInd ? (d.photoCNI||d.photo||null) : null;
    if (photo) return `<img src="${photo}" class="dem-av-img" alt="${init}">`;
    return `<div class="dem-av-init" style="background:${color}">${init}</div>`;
  }

  function sexeChip(s) {
    if (!s) return '<span class="dem-sexe-nd">—</span>';
    const m = ['M','m','Masculin','Homme','H'].includes(s);
    return `<span class="dem-sexe ${m?'dem-sexe-m':'dem-sexe-f'}">${m?'♂':'♀'} ${m?'M':'F'}</span>`;
  }

  /* ── main render ──────────────────────────────────── */
  async function render() {
    app.innerHTML = `<div class="dash-loading"><div class="dash-spinner"></div></div>`;
    if (activeTab === 'historique') { await renderHistorique(); return; }

    const [, stats] = await Promise.all([loadDemandes(), loadStats(), loadAllForOptions()]);

    const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—';

    /* ── derive dynamic filter options from full data ── */
    const uniq = (arr, key) => [...new Set(arr.map(x => x[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));

    const paysMap = {};
    allForOptions.forEach(d => { if (d.codePays) paysMap[d.codePays] = d.libPays || d.codePays; });
    const paysOpts = Object.entries(paysMap).sort(([,a],[,b])=>a.localeCompare(b))
      .map(([code,lib]) => `<option value="${code}" ${filterPays===code?'selected':''}>${lib}</option>`).join('');

    const villeOpts = uniq(allForOptions,'ville')
      .map(v => `<option value="${v}" ${filterVille===v?'selected':''}>${v}</option>`).join('');

    const orgOpts = uniq(allForOptions,'nomOrg')
      .map(v => `<option value="${v}" ${filterOrg===v?'selected':''}>${v}</option>`).join('');

    const fonctionOpts = uniq(allForOptions,'fonctionSouhaitee')
      .map(v => `<option value="${v}" ${filterFonction===v?'selected':''}>${v}</option>`).join('');

    /* ── active filters count + chips ────────────────── */
    const activeFilters = [
      filterStatut   && { k:'filterStatut',   label:`Statut : ${filterStatut}` },
      filterType     && { k:'filterType',     label:`Type : ${filterType}` },
      filterPays     && { k:'filterPays',     label:`Pays : ${paysMap[filterPays]||filterPays}` },
      filterVille    && { k:'filterVille',    label:`Ville : ${filterVille}` },
      filterOrg      && { k:'filterOrg',      label:`Org : ${filterOrg}` },
      filterFonction && { k:'filterFonction', label:`Rôle : ${filterFonction}` },
    ].filter(Boolean);
    const activeCount = activeFilters.length;

    app.innerHTML = `
      <!-- ══ Header ══════════════════════════════════ -->
      <div class="dem-page-hdr">
        <div class="dem-page-hdr-left">
          <div>
            <h2 class="dem-page-title">Demandes d'adhésion</h2>
            <p class="dem-page-sub">${stats.pending} en attente · ${stats.actif} actifs · ${stats.suspendu} suspendus · ${stats.cloture} clôturées</p>
          </div>
        </div>
        <div class="dem-tabs">
          <button class="dem-tab active" id="tabListe">📋 Liste</button>
          <button class="dem-tab" id="tabHisto">📊 Historique</button>
        </div>
      </div>

      <!-- ══ KPI strip ════════════════════════════════ -->
      <div class="dem-kpi-strip">
        <div class="dem-kpi-chip dem-kpi-total">
          <span class="dem-kpi-num">${stats.total}</span><span class="dem-kpi-lbl">Total</span>
        </div>
        <div class="dem-kpi-chip dem-kpi-pend">
          <span class="dem-kpi-num">${stats.pending}</span><span class="dem-kpi-lbl">En attente</span>
        </div>
        <div class="dem-kpi-chip dem-kpi-ok">
          <span class="dem-kpi-num">${stats.actif}</span><span class="dem-kpi-lbl">Actifs</span>
        </div>
        <div class="dem-kpi-chip dem-kpi-suspendu">
          <span class="dem-kpi-num">${stats.suspendu}</span><span class="dem-kpi-lbl">Suspendus</span>
        </div>
        <div class="dem-kpi-chip dem-kpi-err">
          <span class="dem-kpi-num">${stats.cloture}</span><span class="dem-kpi-lbl">Clôturées</span>
        </div>
      </div>

      <!-- ══ Date filter bar ══════════════════════════ -->
      ${dateFilter.renderBar()}

      <!-- ══ Control bar ══════════════════════════════ -->
      <div class="dem-ctrl-bar">
        <div class="dem-search-wrap">
          <svg class="dem-search-ico" width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.5" stroke="currentColor" stroke-width="1.6"/><path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <input type="text" id="searchInput" class="dem-search-v2"
            placeholder="Rechercher nom, email, organisation, ville…" value="${searchQ}" autocomplete="off">
          ${searchQ ? `<button class="dem-search-clr" id="clearSearch">✕</button>` : ''}
        </div>
        <button class="dem-btn-flt ${filterOpen?'open':''}" id="btnFilters">
          <svg viewBox="0 0 20 20" fill="none" width="14" height="14"><path d="M3 5h14M6 10h8M9 15h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          Filtres ${activeCount ? `<span class="dem-flt-cnt">${activeCount}</span>` : ''}
        </button>
        ${activeCount ? `<button class="dem-btn-rst" id="btnReset">Réinitialiser</button>` : ''}
      </div>

      <!-- ══ Advanced filter panel ════════════════════ -->
      <div class="dem-flt-panel ${filterOpen?'open':''}" id="filterPanel">
        <div class="dem-flt-grid">
          <div class="dem-flt-group">
            <label class="dem-flt-lbl">Statut</label>
            <select id="filtStatut" class="dem-flt-sel">
              <option value="">Tous les statuts</option>
              <option value="En attente de validation" ${filterStatut==='En attente de validation'?'selected':''}>En attente</option>
              <option value="Actif"          ${filterStatut==='Actif'?'selected':''}>Actif</option>
              <option value="Suspendu"       ${filterStatut==='Suspendu'?'selected':''}>Suspendu</option>
              <option value="Radié"          ${filterStatut==='Radié'?'selected':''}>Radié</option>
              <option value="Exclu"          ${filterStatut==='Exclu'?'selected':''}>Exclu</option>
              <option value="Démissionnaire" ${filterStatut==='Démissionnaire'?'selected':''}>Démissionnaire</option>
              <option value="Refusé"         ${filterStatut==='Refusé'?'selected':''}>Refusé</option>
            </select>
          </div>
          <div class="dem-flt-group">
            <label class="dem-flt-lbl">Type d'organisation</label>
            <select id="filtType" class="dem-flt-sel">
              <option value="">Tous les types</option>
              <option value="Association" ${filterType==='Association'?'selected':''}>Association</option>
              <option value="ONG"         ${filterType==='ONG'?'selected':''}>ONG</option>
              <option value="Mutuelle"    ${filterType==='Mutuelle'?'selected':''}>Mutuelle</option>
              <option value="Individu"    ${filterType==='Individu'?'selected':''}>Individu</option>
            </select>
          </div>
          <div class="dem-flt-group">
            <label class="dem-flt-lbl">Pays</label>
            <select id="filtPays" class="dem-flt-sel">
              <option value="">Tous les pays</option>
              ${paysOpts}
            </select>
          </div>
          <div class="dem-flt-group">
            <label class="dem-flt-lbl">Ville</label>
            <select id="filtVille" class="dem-flt-sel">
              <option value="">Toutes les villes</option>
              ${villeOpts}
            </select>
          </div>
          <div class="dem-flt-group">
            <label class="dem-flt-lbl">Organisation</label>
            <select id="filtOrg" class="dem-flt-sel">
              <option value="">Toutes</option>
              ${orgOpts}
            </select>
          </div>
          <div class="dem-flt-group">
            <label class="dem-flt-lbl">Rôle souhaité</label>
            <select id="filtFonction" class="dem-flt-sel">
              <option value="">Tous les rôles</option>
              ${fonctionOpts}
            </select>
          </div>
        </div>
      </div>

      <!-- ══ Active filter chips ═══════════════════════ -->
      ${activeFilters.length ? `
      <div class="dem-chips-row">
        ${activeFilters.map(f=>`
          <button class="dem-chip" data-filter="${f.k}">
            ${f.label} <span>✕</span>
          </button>`).join('')}
      </div>` : ''}

      <!-- ══ Results count ════════════════════════════ -->
      <div class="dem-results-bar">
        <span class="dem-results-n">${allDemandes.length} demande${allDemandes.length>1?'s':''}</span>
      </div>

      <!-- ══ Table ════════════════════════════════════ -->
      <div class="dem-table-wrap">
        ${allDemandes.length ? `
        <table class="dem-table-v2">
          <thead>
            <tr>
              <th class="dem-th-person">Demandeur</th>
              <th class="dem-th-sexe">Sexe</th>
              <th class="dem-th-fonc">Fonction souhaitée</th>
              <th class="dem-th-org">Organisation</th>
              <th class="dem-th-loc">Localisation</th>
              <th class="dem-th-date">Date</th>
              <th class="dem-th-stat">Statut</th>
              <th class="dem-th-act">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${allDemandes.map((d,i) => {
              const sa      = d.statutAdhesion || 'En attente de validation';
              const isPend  = sa === 'En attente de validation';
              const isInd   = d.typeOrg === 'Individu';
              const nomFull = isInd
                ? [d.repPrenom, d.repNom].filter(Boolean).join(' ') || d.nomOrg || '—'
                : (d.nomOrg || '—');
              const email   = d.emailOrg || '—';
              const sexe    = isInd ? (d.repSexe || d.sexe || '') : '';
              const orgAff  = isInd ? (d.nomOrgCible || '—') : (d.nomOrg || '—');
              const orgType = isInd ? (d.typeOrgCible || d.typeOrg) : d.typeOrg;
              return `
              <tr class="dem-row-v2" style="--di:${i}">
                <td>
                  <div class="dem-person-cell">
                    <div class="dem-avatar">${avatarHtml(d)}</div>
                    <div class="dem-person-info">
                      <span class="dem-person-name">${nomFull}</span>
                      <span class="dem-person-email">${email}</span>
                    </div>
                  </div>
                </td>
                <td>${sexeChip(sexe)}</td>
                <td><span class="dem-fn-tag">${d.fonctionSouhaitee||'—'}</span></td>
                <td>
                  <div class="dem-org-v2">
                    <span class="dem-org-v2-name">${orgAff}</span>
                    <span class="dem-type-pill">${typeIcon(d.typeOrg)} ${orgType}</span>
                  </div>
                </td>
                <td>
                  <div class="dem-loc-cell">
                    <span class="dem-loc-pays">${d.libPays||d.codePays||'—'}</span>
                    ${d.ville ? `<span class="dem-loc-ville">${d.ville}</span>` : ''}
                  </div>
                </td>
                <td><span class="dem-date-v2">${fmt(d.dateDemande)}</span></td>
                <td>${badge(sa)}</td>
                <td class="dem-act-cell">
                  <button class="dem-btn-see" data-id="${d.idDemande}" title="Voir le dossier">
                    <svg viewBox="0 0 20 20" fill="none" width="14"><ellipse cx="10" cy="10" rx="7" ry="5" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.6"/></svg>
                    Voir
                  </button>
                  ${isPend ? `
                  <button class="dem-btn-ok-sm" data-id="${d.idDemande}" title="Accepter la demande">
                    <svg viewBox="0 0 20 20" fill="none" width="13"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                  <button class="dem-btn-err-sm" data-id="${d.idDemande}" title="Refuser la demande">
                    <svg viewBox="0 0 20 20" fill="none" width="13"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                  </button>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>` : `
        <div class="dem-empty">
          <div class="dem-empty-ico">🔍</div>
          <p>Aucune demande trouvée</p>
          <small>${activeCount||searchQ ? 'Essayez de modifier vos critères de recherche' : 'Aucune demande soumise pour le moment'}</small>
          ${activeCount||searchQ ? `<button class="dem-btn-rst" id="btnResetEmpty" style="margin-top:14px">Réinitialiser les filtres</button>` : ''}
        </div>`}
      </div>`;

    /* ══ Events ══════════════════════════════════════ */
    document.getElementById('tabHisto').onclick = () => { activeTab = 'historique'; render(); };
    document.getElementById('tabListe').onclick = () => { activeTab = 'liste'; render(); };
    dateFilter.initBar(() => render());

    /* search */
    const si = document.getElementById('searchInput');
    let timer;
    si.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { searchQ = si.value.trim(); render(); }, 300);
    });
    document.getElementById('clearSearch')?.addEventListener('click', () => { searchQ = ''; render(); });

    /* filter toggle */
    document.getElementById('btnFilters').onclick = () => { filterOpen = !filterOpen; render(); };
    document.getElementById('btnReset')?.addEventListener('click', resetFilters);
    document.getElementById('btnResetEmpty')?.addEventListener('click', resetFilters);

    /* filter selects */
    document.getElementById('filtStatut')?.addEventListener('change', e => { filterStatut   = e.target.value; render(); });
    document.getElementById('filtType')?.addEventListener('change',   e => { filterType     = e.target.value; render(); });
    document.getElementById('filtPays')?.addEventListener('change',   e => { filterPays     = e.target.value; render(); });
    document.getElementById('filtVille')?.addEventListener('change',  e => { filterVille    = e.target.value; render(); });
    document.getElementById('filtOrg')?.addEventListener('change',   e => { filterOrg      = e.target.value; render(); });
    document.getElementById('filtFonction')?.addEventListener('change',e => { filterFonction = e.target.value; render(); });

    /* chip removal */
    document.querySelectorAll('.dem-chip').forEach(btn => {
      btn.onclick = () => {
        const k = btn.dataset.filter;
        if (k === 'filterStatut')   filterStatut   = '';
        if (k === 'filterType')     filterType     = '';
        if (k === 'filterPays')     filterPays     = '';
        if (k === 'filterVille')    filterVille    = '';
        if (k === 'filterOrg')      filterOrg      = '';
        if (k === 'filterFonction') filterFonction = '';
        render();
      };
    });

    /* table actions */
    document.querySelectorAll('.dem-btn-see').forEach(btn => {
      btn.onclick = () => { const d = allDemandes.find(x=>x.idDemande==btn.dataset.id); if(d) openDetail(d); };
    });
    document.querySelectorAll('.dem-btn-ok-sm').forEach(btn => {
      btn.onclick = () => { const d = allDemandes.find(x=>x.idDemande==btn.dataset.id); if(d) confirmAccept(d); };
    });
    document.querySelectorAll('.dem-btn-err-sm').forEach(btn => {
      btn.onclick = () => { const d = allDemandes.find(x=>x.idDemande==btn.dataset.id); if(d) confirmRefuse(d); };
    });
  }

  function resetFilters() {
    filterStatut = ''; filterType = ''; filterPays = '';
    filterVille = ''; filterOrg = ''; filterFonction = '';
    searchQ = '';
    render();
  }

  render();
});
