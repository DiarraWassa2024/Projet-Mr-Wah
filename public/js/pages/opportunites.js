router.register('opportunites', async () => {
  const app = document.getElementById('app');

  /* ── constantes ──────────────────────────────────────────── */
  const CATS = ['Financement','Partenariat','Formation','Emploi','Appel à projets','Autre'];
  const CAT_COLORS = {
    'Financement':    { bg:'#eff6ff', text:'#2563eb', border:'#bfdbfe' },
    'Partenariat':    { bg:'#f0fdf4', text:'#16a34a', border:'#bbf7d0' },
    'Formation':      { bg:'#fffbeb', text:'#d97706', border:'#fde68a' },
    'Emploi':         { bg:'#f5f3ff', text:'#7c3aed', border:'#ddd6fe' },
    'Appel à projets':{ bg:'#fff7ed', text:'#ea580c', border:'#fed7aa' },
    'Autre':          { bg:'#f8fafc', text:'#475569', border:'#e2e8f0' },
  };
  const DOMAINES = ['Agriculture','Eau & Assainissement','Santé','Éducation','Environnement',
    'Société civile','Protection sociale','Emploi','Technologie','Microfinance','Développement rural',
    'Droits humains','Enfance et jeunesse','Énergie','Autre'];
  const PAYS_AFRIQUE = ['Bénin','Burkina Faso','Cameroun','Côte d\'Ivoire','Ghana','Guinée',
    'Madagascar','Mali','Maroc','Maurice','Mozambique','Niger','Nigeria','RDC','Rwanda',
    'Sénégal','Sierra Leone','Togo','Tunisie','Zambie','Zimbabwe','Autre'];
  const PRIORITE_CFG = {
    'Faible':  { cls:'prio-faible',  icon:'↓' },
    'Normale': { cls:'prio-normale', icon:'→' },
    'Haute':   { cls:'prio-haute',   icon:'↑' },
    'Urgente': { cls:'prio-urgente', icon:'‼' },
  };
  const STATUT_OPP = { 'Active':'st-ok','Clôturée':'st-info','Annulée':'st-err' };

  /* ── état ────────────────────────────────────────────────── */
  let activeTab  = 'opportunites';
  let opps       = [];
  let besoins    = [];
  let orgs       = [];
  let stats      = {};
  let filterCat  = '';
  let filterStat = 'Active';
  let filterPays = '';
  let searchQ    = '';
  let aiPanelOpen = false;
  let iaRunning   = false;

  /* ── helpers ─────────────────────────────────────────────── */
  const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const isExpired = d => d && new Date(d) < new Date();
  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  function catBadge(cat) {
    const c = CAT_COLORS[cat] || CAT_COLORS['Autre'];
    return `<span class="opp2-cat-badge" style="background:${c.bg};color:${c.text};border-color:${c.border}">${cat||'Autre'}</span>`;
  }

  /* ── chargement données ──────────────────────────────────── */
  async function loadAll() {
    let url = '/opportunites?';
    if (filterCat)  url += `&categorie=${encodeURIComponent(filterCat)}`;
    if (filterStat) url += `&statut=${encodeURIComponent(filterStat)}`;
    if (filterPays) url += `&pays=${encodeURIComponent(filterPays)}`;
    if (searchQ)    url += `&search=${encodeURIComponent(searchQ)}`;
    [opps, besoins, orgs, stats] = await Promise.all([
      api.get(url),
      api.get('/besoins-admin').catch(() => []),
      api.get('/organisations').catch(() => []),
      api.get('/opportunites/stats').catch(() => ({})),
    ]);
  }

  /* ── rendu shell principal ───────────────────────────────── */
  function renderShell() {
    app.innerHTML = `
      <div class="opp2-page">
        <!-- Header -->
        <div class="opp2-header">
          <div class="opp2-hd-left">
            <h2 class="opp2-title">Opportunités de Développement</h2>
            <div class="opp2-sub">Gérez et découvrez des opportunités adaptées à votre profil</div>
          </div>
          <div class="opp2-hd-right">
            <button class="opp2-btn-ia ${aiPanelOpen?'active':''}" id="btnToggleIA">
              <span class="ia-spark">✨</span> Recherche IA
            </button>
            <button class="btn btn-primary" id="btnAdd">+ Nouvelle opportunité</button>
          </div>
        </div>

        <!-- Stats band -->
        <div class="opp2-stats-band">
          <div class="opp2-stat-item">
            <div class="opp2-stat-val">${stats.total||0}</div>
            <div class="opp2-stat-lbl">Total</div>
          </div>
          <div class="opp2-stat-sep"></div>
          <div class="opp2-stat-item opp2-stat-green">
            <div class="opp2-stat-val">${stats.actives||0}</div>
            <div class="opp2-stat-lbl">Actives</div>
          </div>
          <div class="opp2-stat-sep"></div>
          <div class="opp2-stat-item opp2-stat-amber">
            <div class="opp2-stat-val">${stats.expirees||0}</div>
            <div class="opp2-stat-lbl">Expirées</div>
          </div>
          <div class="opp2-stat-sep"></div>
          <div class="opp2-stat-item opp2-stat-violet">
            <div class="opp2-stat-val">${besoins.filter?.(b=>b.statut==='En attente').length||0}</div>
            <div class="opp2-stat-lbl">Besoins en attente</div>
          </div>
        </div>

        <!-- Main tabs -->
        <div class="opp2-tabs">
          <button class="opp2-tab ${activeTab==='opportunites'?'active':''}" data-tab="opportunites">
            🔍 Opportunités <span class="opp2-tab-count">${opps.length}</span>
          </button>
          <button class="opp2-tab ${activeTab==='besoins'?'active':''}" data-tab="besoins">
            📋 Expression des Besoins <span class="opp2-tab-count">${besoins.length||0}</span>
          </button>
        </div>

        <!-- Body: tab content + IA panel -->
        <div class="opp2-body ${aiPanelOpen?'ia-open':''}">
          <div class="opp2-main" id="opp2Main">
            ${activeTab === 'opportunites' ? renderOppsTab() : renderBesoinsTab()}
          </div>
          <div class="opp2-ia-panel ${aiPanelOpen?'open':''}" id="iaPanel">
            ${renderIAPanel()}
          </div>
        </div>
      </div>`;

    bindEvents();
  }

  /* ── onglet Opportunités ─────────────────────────────────── */
  function renderOppsTab() {
    return `
      <!-- Filters -->
      <div class="opp2-filters">
        <div class="opp2-search-wrap">
          <span class="opp2-search-icon">🔎</span>
          <input type="text" id="searchInp" class="opp2-search" placeholder="Rechercher une opportunité..." value="${esc(searchQ)}">
        </div>
        <select id="filtCat" class="select-sm">
          <option value="">Toutes catégories</option>
          ${CATS.map(c=>`<option value="${c}" ${filterCat===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <select id="filtPays" class="select-sm">
          <option value="">Tous pays</option>
          ${PAYS_AFRIQUE.map(p=>`<option value="${p}" ${filterPays===p?'selected':''}>${p}</option>`).join('')}
        </select>
        <select id="filtStat" class="select-sm">
          <option value="">Tous statuts</option>
          <option value="Active" ${filterStat==='Active'?'selected':''}>Active</option>
          <option value="Clôturée" ${filterStat==='Clôturée'?'selected':''}>Clôturée</option>
          <option value="Annulée" ${filterStat==='Annulée'?'selected':''}>Annulée</option>
        </select>
        ${filterCat||filterPays||filterStat||searchQ ? `<button class="opp2-clear-btn" id="clearFilters">✕ Effacer</button>` : ''}
      </div>

      <!-- Grid -->
      ${opps.length ? `
        <div class="opp2-grid">
          ${opps.map((o,i) => renderOppCard(o, i)).join('')}
        </div>
      ` : `
        <div class="opp2-empty">
          <div class="opp2-empty-icon">🔍</div>
          <div class="opp2-empty-title">Aucune opportunité trouvée</div>
          <div class="opp2-empty-sub">Modifiez vos filtres ou cliquez sur "Nouvelle opportunité" pour en créer une.</div>
          <button class="btn btn-primary" id="btnAddEmpty">+ Ajouter une opportunité</button>
        </div>
      `}`;
  }

  function renderOppCard(o, i) {
    const expired = isExpired(o.dateLimite);
    const urgente = o.dateLimite && !expired && (new Date(o.dateLimite) - new Date()) < 7*24*3600*1000;
    return `
      <div class="opp2-card" style="animation-delay:${i*40}ms" data-id="${o.id}">
        <div class="opp2-card-top">
          <div class="opp2-card-badges">
            ${catBadge(o.categorie)}
            ${o.statut ? `<span class="opp2-statut-badge ${STATUT_OPP[o.statut]||'st-pend'}">${o.statut}</span>` : ''}
          </div>
          <div class="opp2-card-actions">
            <button class="btn-icon edit opp-edit" data-id="${o.id}" title="Modifier">✏️</button>
            <button class="btn-icon del  opp-del"  data-id="${o.id}" title="Supprimer">🗑️</button>
          </div>
        </div>

        <h4 class="opp2-card-title">${esc(o.titre)}</h4>

        ${o.domaine ? `<div class="opp2-card-domaine">📌 ${esc(o.domaine)}</div>` : ''}
        ${o.LibOrg  ? `<div class="opp2-card-org">🏢 ${esc(o.LibOrg)}</div>` : ''}
        ${o.pays    ? `<div class="opp2-card-pays">🌍 ${esc(o.pays)}</div>` : ''}

        ${o.description ? `<p class="opp2-card-desc">${esc(o.description.substring(0,140))}${o.description.length>140?'…':''}</p>` : ''}

        <div class="opp2-card-footer">
          <div class="opp2-card-meta">
            ${o.budget ? `<span class="opp2-budget">💰 ${Number(o.budget).toLocaleString('fr-FR')} ${o.codeDevise||''}</span>` : ''}
            <span class="opp2-deadline ${expired?'expired':''}${urgente?' urgente':''}">
              📅 ${expired ? 'Expiré · ' : urgente ? '⚠️ Urgent · ' : ''}${fmt(o.dateLimite)}
            </span>
          </div>
          ${o.lien ? `<a href="${esc(o.lien)}" target="_blank" rel="noopener" class="opp2-link-btn">Voir →</a>` : ''}
        </div>
      </div>`;
  }

  /* ── onglet Besoins ──────────────────────────────────────── */
  function renderBesoinsTab() {
    return `
      <div class="opp2-besoins-layout">
        <!-- Formulaire nouveau besoin -->
        <div class="opp2-besoin-form-panel">
          <div class="opp2-bf-title">📝 Exprimer un besoin</div>
          <form id="besoinForm">
            <div class="form-group">
              <label>Nom / Responsable *</label>
              <input type="text" name="nom" placeholder="Nom du responsable" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Email</label>
                <input type="email" name="email" placeholder="email@exemple.com">
              </div>
              <div class="form-group">
                <label>Organisation</label>
                <select name="numAgr">
                  <option value="">— Sélectionner —</option>
                  ${orgs.map(o=>`<option value="${o.NumAgr}">${esc(o.LibOrg)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Type de besoin</label>
                <select name="typeBesoin">
                  <option value="">— Type —</option>
                  <option>Financement</option>
                  <option>Partenariat</option>
                  <option>Formation</option>
                  <option>Equipement</option>
                  <option>Expertise technique</option>
                  <option>Autre</option>
                </select>
              </div>
              <div class="form-group">
                <label>Domaine</label>
                <select name="domaine">
                  <option value="">— Domaine —</option>
                  ${DOMAINES.map(d=>`<option>${d}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Pays</label>
                <select name="codePays">
                  <option value="">— Pays —</option>
                  ${PAYS_AFRIQUE.map(p=>`<option>${p}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Priorité</label>
                <select name="priorite">
                  <option value="Normale">Normale</option>
                  <option value="Haute">Haute</option>
                  <option value="Urgente">Urgente</option>
                  <option value="Faible">Faible</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Description du besoin *</label>
              <textarea name="description" rows="4" placeholder="Décrivez en détail votre besoin..."></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Budget estimatif</label>
                <input type="number" name="budgetEstimatif" placeholder="Ex: 5000000">
              </div>
              <div class="form-group">
                <label>Devise</label>
                <select name="codeDevise">
                  <option value="FCFA">FCFA</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" id="besoinSubmitBtn">📤 Soumettre le besoin</button>
            </div>
          </form>
        </div>

        <!-- Liste des besoins -->
        <div class="opp2-besoins-list-panel">
          <div class="opp2-bl-header">
            <div class="opp2-bf-title">📋 Besoins exprimés</div>
            <select id="filtBesoinStatut" class="select-sm">
              <option value="">Tous</option>
              <option value="En attente">En attente</option>
              <option value="Traité">Traité</option>
              <option value="Archivé">Archivé</option>
            </select>
          </div>
          <div class="opp2-besoins-scroll" id="besoinsList">
            ${renderBesoinsList()}
          </div>
        </div>
      </div>`;
  }

  function renderBesoinsList() {
    if (!besoins || !besoins.length) {
      return `<div class="opp2-empty" style="padding:40px 20px">
        <div class="opp2-empty-icon">📭</div>
        <div class="opp2-empty-title">Aucun besoin enregistré</div>
      </div>`;
    }
    return besoins.map((b,i) => {
      const p = PRIORITE_CFG[b.priorite] || PRIORITE_CFG['Normale'];
      const statBadge = b.statut === 'Traité' ? 'st-ok' : b.statut === 'Archivé' ? 'st-info' : 'st-pend';
      return `
        <div class="opp2-besoin-card" style="animation-delay:${i*30}ms">
          <div class="opp2-bc-top">
            <div class="opp2-bc-meta">
              <span class="opp2-prio ${p.cls}">${p.icon} ${b.priorite||'Normale'}</span>
              <span class="dem-badge ${statBadge}">${b.statut||'En attente'}</span>
              ${b.typeBesoin ? `<span class="opp2-type-tag">${b.typeBesoin}</span>` : ''}
            </div>
            <div class="opp2-bc-actions">
              ${b.statut !== 'Traité' ? `<button class="btn-sm btn-success opp2-traiter" data-id="${b.idBesoin||b.IdDemande}" title="Marquer traité">✓</button>` : ''}
              <button class="btn-sm btn-ghost opp2-ia-opp" data-id="${b.idBesoin||b.IdDemande}" title="Chercher opportunités IA">✨</button>
              <button class="btn-sm btn-danger opp2-del-besoin" data-id="${b.idBesoin||b.IdDemande}" title="Supprimer">🗑</button>
            </div>
          </div>
          <div class="opp2-bc-name">${esc(b.nom)}</div>
          ${b.description ? `<div class="opp2-bc-desc">${esc(b.description.substring(0,100))}${b.description.length>100?'…':''}</div>` : ''}
          <div class="opp2-bc-footer">
            ${b.domaine ? `<span>📌 ${b.domaine}</span>` : ''}
            <span>📅 ${fmt(b.dateDemande)}</span>
            ${b.budgetEstimatif ? `<span>💰 ${Number(b.budgetEstimatif).toLocaleString('fr-FR')} ${b.codeDevise||'FCFA'}</span>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  /* ── panneau IA ──────────────────────────────────────────── */
  function renderIAPanel() {
    return `
      <div class="ia-panel-inner">
        <div class="ia-panel-hd">
          <div class="ia-panel-title">
            <span class="ia-spark-lg">✨</span>
            <div>
              <div style="font-weight:700;font-size:14px;color:#0f172a">Recherche IA</div>
              <div style="font-size:11px;color:#94a3b8">Analyse intelligente d'opportunités</div>
            </div>
          </div>
          <button class="ia-close-btn" id="iaClose">×</button>
        </div>

        <div class="ia-form-wrap">
          <div class="form-group">
            <label class="ia-label">🌍 Pays cible</label>
            <select id="ia_pays" class="ia-input">
              <option value="">— Tous pays —</option>
              ${PAYS_AFRIQUE.map(p=>`<option>${p}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="ia-label">🎯 Domaine</label>
            <select id="ia_domaine" class="ia-input">
              <option value="">— Tous domaines —</option>
              ${DOMAINES.map(d=>`<option>${d}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="ia-label">🏢 Organisation</label>
            <select id="ia_org" class="ia-input">
              <option value="">— Sélectionner —</option>
              ${orgs.map(o=>`<option value="${o.NumAgr}">${esc(o.LibOrg)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="ia-label">📝 Décrivez vos besoins</label>
            <textarea id="ia_besoins" class="ia-input" rows="4"
              placeholder="Ex: Nous sommes une association de femmes agricultrices cherchant du financement pour l'irrigation et la formation..."></textarea>
          </div>
          <button class="ia-search-btn" id="iaSearchBtn" ${iaRunning?'disabled':''}>
            ${iaRunning ? '<span class="ia-dots"><span></span><span></span><span></span></span> Analyse en cours...' : '🔍 Analyser avec l\'IA'}
          </button>
        </div>

        <!-- Zone résultats streaming -->
        <div class="ia-results-zone" id="iaResultsZone" style="display:none">
          <div class="ia-progress-wrap">
            <div class="ia-progress-bar" id="iaProgressBar" style="width:0%"></div>
          </div>
          <div class="ia-status-msg" id="iaStatusMsg"></div>
          <div id="iaMatchesSection" style="display:none">
            <div class="ia-section-title">🗃️ Correspondances dans votre base</div>
            <div id="iaMatchesList"></div>
          </div>
          <div id="iaSuggestionsSection" style="display:none">
            <div class="ia-section-title">💡 Suggestions IA</div>
            <div id="iaSuggestionsList"></div>
          </div>
        </div>
      </div>`;
  }

  /* ── liaison événements ──────────────────────────────────── */
  function bindEvents() {
    /* tabs */
    document.querySelectorAll('.opp2-tab').forEach(btn => {
      btn.onclick = () => {
        activeTab = btn.dataset.tab;
        document.getElementById('opp2Main').innerHTML =
          activeTab === 'opportunites' ? renderOppsTab() : renderBesoinsTab();
        document.querySelectorAll('.opp2-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
        bindTabEvents();
      };
    });

    /* IA panel toggle */
    document.getElementById('btnToggleIA').onclick = () => {
      aiPanelOpen = !aiPanelOpen;
      renderShell();
    };
    document.getElementById('iaClose')?.addEventListener('click', () => {
      aiPanelOpen = false; renderShell();
    });

    /* Add new opp */
    document.getElementById('btnAdd').onclick = () => openOppModal();
    document.getElementById('btnAddEmpty')?.addEventListener('click', () => openOppModal());

    bindTabEvents();
    bindIAEvents();
  }

  function bindTabEvents() {
    if (activeTab === 'opportunites') {
      /* filters */
      document.getElementById('searchInp').oninput = debounce(e => { searchQ = e.target.value; reloadTab(); }, 350);
      document.getElementById('filtCat').onchange  = e => { filterCat = e.target.value; reloadTab(); };
      document.getElementById('filtPays').onchange = e => { filterPays = e.target.value; reloadTab(); };
      document.getElementById('filtStat').onchange = e => { filterStat = e.target.value; reloadTab(); };
      document.getElementById('clearFilters')?.addEventListener('click', () => {
        filterCat = filterPays = filterStat = searchQ = ''; reloadTab();
      });
      /* card actions */
      document.querySelectorAll('.opp-edit').forEach(btn => {
        btn.onclick = e => { e.stopPropagation(); openOppModal(opps.find(x=>x.id==btn.dataset.id)||{}); };
      });
      document.querySelectorAll('.opp-del').forEach(btn => {
        btn.onclick = async e => {
          e.stopPropagation();
          if (!confirm('Supprimer cette opportunité ?')) return;
          try { await api.delete(`/opportunites/${btn.dataset.id}`); reloadTab(); } catch(e) { showToast(e.message, 'error'); }
        };
      });
    } else {
      /* besoin form */
      document.getElementById('besoinForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('besoinSubmitBtn');
        btn.disabled = true; btn.textContent = 'Envoi...';
        const body = Object.fromEntries(new FormData(e.target).entries());
        try {
          await api.post('/besoins-admin', body);
          e.target.reset();
          await reloadBesoins();
        } catch(err) { showToast(err.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = '📤 Soumettre le besoin'; }
      });

      /* besoins filter */
      document.getElementById('filtBesoinStatut')?.addEventListener('change', async e => {
        const s = e.target.value;
        if (s) besoins = (await api.get(`/besoins-admin?statut=${s}`).catch(()=>[]));
        else   besoins = await api.get('/besoins-admin').catch(()=>[]);
        document.getElementById('besoinsList').innerHTML = renderBesoinsList();
        bindBesoinActions();
      });

      bindBesoinActions();
    }
  }

  function bindBesoinActions() {
    document.querySelectorAll('.opp2-traiter').forEach(btn => {
      btn.onclick = async () => {
        try {
          await api.put(`/besoins-admin/${btn.dataset.id}/traiter`, {});
          await reloadBesoins();
        } catch(e) { showToast(e.message, 'error'); }
      };
    });
    document.querySelectorAll('.opp2-del-besoin').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Supprimer ce besoin ?')) return;
        try {
          await api.delete(`/besoins-admin/${btn.dataset.id}`);
          await reloadBesoins();
        } catch(e) { showToast(e.message, 'error'); }
      };
    });
    document.querySelectorAll('.opp2-ia-opp').forEach(btn => {
      btn.onclick = () => {
        const b = besoins.find(x => (x.idBesoin||x.IdDemande) == btn.dataset.id);
        if (!b) return;
        aiPanelOpen = true;
        renderShell();
        setTimeout(() => {
          if (b.domaine) { const s = document.getElementById('ia_domaine'); if(s) s.value = b.domaine; }
          const ta = document.getElementById('ia_besoins');
          if (ta) ta.value = b.description || '';
          bindIAEvents();
        }, 100);
      };
    });
  }

  /* ── recherche IA streaming ──────────────────────────────── */
  function bindIAEvents() {
    const btn = document.getElementById('iaSearchBtn');
    if (!btn) return;
    btn.onclick = () => launchIASearch();
  }

  async function launchIASearch() {
    const pays     = document.getElementById('ia_pays')?.value    || '';
    const domaine  = document.getElementById('ia_domaine')?.value || '';
    const besoinsText = document.getElementById('ia_besoins')?.value || '';
    const numAgr   = document.getElementById('ia_org')?.value    || '';

    if (!domaine && !besoinsText && !pays) {
      showToast('Précisez au moins un pays, un domaine ou vos besoins.', 'warn');
      return;
    }

    iaRunning = true;
    const btn  = document.getElementById('iaSearchBtn');
    const zone = document.getElementById('iaResultsZone');
    const prog = document.getElementById('iaProgressBar');
    const msg  = document.getElementById('iaStatusMsg');
    const matchSec  = document.getElementById('iaMatchesSection');
    const matchList = document.getElementById('iaMatchesList');
    const suggSec   = document.getElementById('iaSuggestionsSection');
    const suggList  = document.getElementById('iaSuggestionsList');

    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ia-dots"><span></span><span></span><span></span></span> Analyse en cours...'; }
    if (zone) { zone.style.display = 'block'; }
    if (matchSec) { matchSec.style.display = 'none'; matchList.innerHTML = ''; }
    if (suggSec)  { suggSec.style.display  = 'none'; suggList.innerHTML  = ''; }

    try {
      const token = localStorage.getItem('gpo_token');
      const response = await fetch('/api/ia-opportunites/recherche', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
        body: JSON.stringify({ pays, domaine, besoinsText, numAgr }),
      });

      if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';
      let suggestCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            handleIAEvent(evt, { prog, msg, matchSec, matchList, suggSec, suggList });
            if (evt.type === 'suggestion') suggestCount++;
          } catch(_) {}
        }
      }

    } catch (err) {
      if (msg) { msg.innerHTML = `<div class="ia-error">❌ ${err.message}</div>`; }
    } finally {
      iaRunning = false;
      if (btn) { btn.disabled = false; btn.textContent = '🔍 Analyser avec l\'IA'; }
    }
  }

  function handleIAEvent(evt, { prog, msg, matchSec, matchList, suggSec, suggList }) {
    switch (evt.type) {
      case 'status':
        if (msg)  msg.innerHTML  = `<span class="ia-status-text">${evt.message}</span>`;
        if (prog) prog.style.width = (evt.progress||0) + '%';
        break;

      case 'ai_thinking':
        if (msg) msg.innerHTML = `<span class="ia-status-text ia-thinking">${evt.message}</span>`;
        if (prog) prog.style.width = (evt.progress||55) + '%';
        break;

      case 'matches':
        if (!evt.data?.length) break;
        matchSec.style.display = 'block';
        matchList.innerHTML = evt.data.map(o => renderIAOppCard(o, 'match')).join('');
        if (msg) msg.innerHTML = `<span class="ia-status-text">${evt.message||''}</span>`;
        bindIACardActions(matchList);
        break;

      case 'suggestion': {
        if (!evt.data) break;
        suggSec.style.display = 'block';
        const card = document.createElement('div');
        card.innerHTML = renderIAOppCard(evt.data, 'suggestion');
        const cardEl = card.querySelector('.ia-opp-card');
        if (cardEl) {
          cardEl.style.animationDelay = (evt.index||0)*80 + 'ms';
          suggList.appendChild(cardEl);
        }
        if (prog) prog.style.width = (evt.progress||80) + '%';
        bindIACardActions(suggList);
        break;
      }

      case 'done':
        if (prog) prog.style.width = '100%';
        if (msg)  msg.innerHTML = '<span class="ia-status-text ia-done">✅ Analyse terminée</span>';
        break;

      case 'error':
        if (msg) msg.innerHTML = `<div class="ia-error">❌ ${evt.message}</div>`;
        break;
    }
  }

  function renderIAOppCard(o, type) {
    const isMatch = type === 'match';
    const score = o.score || 0;
    const scorePct = Math.min(Math.round((score / 10) * 100), 100);
    return `
      <div class="ia-opp-card ${isMatch ? 'ia-match' : 'ia-suggestion'}">
        <div class="ia-opp-top">
          ${catBadge(o.categorie)}
          ${score > 0 ? `<div class="ia-score"><div class="ia-score-bar" style="width:${scorePct}%"></div><span>${score}/10</span></div>` : ''}
          ${isMatch ? '<span class="ia-badge-match">📂 En base</span>' : '<span class="ia-badge-ia">🤖 IA</span>'}
        </div>
        <div class="ia-opp-title">${esc(o.titre||'—')}</div>
        ${o.domaine ? `<div class="ia-opp-meta">📌 ${esc(o.domaine)}</div>` : ''}
        ${o.description ? `<div class="ia-opp-desc">${esc((o.description||'').substring(0,120))}${(o.description||'').length>120?'…':''}</div>` : ''}
        <div class="ia-opp-footer">
          ${o.budget ? `<span class="ia-opp-budget">💰 ${Number(o.budget).toLocaleString('fr-FR')} ${o.codeDevise||''}</span>` : ''}
          ${o.lien ? `<a href="${esc(o.lien)}" target="_blank" rel="noopener" class="ia-opp-link">Voir →</a>` : ''}
          ${!isMatch ? `<button class="ia-opp-add" data-opp="${esc(JSON.stringify({titre:o.titre,categorie:o.categorie,domaine:o.domaine,description:o.description,budget:o.budget,codeDevise:o.codeDevise,lien:o.lien}))}">+ Ajouter</button>` : ''}
        </div>
      </div>`;
  }

  function bindIACardActions(container) {
    container.querySelectorAll('.ia-opp-add').forEach(btn => {
      btn.onclick = async () => {
        try {
          const data = JSON.parse(btn.dataset.opp);
          await api.post('/opportunites', { ...data, statut:'Active' });
          btn.textContent = '✓ Ajouté';
          btn.disabled = true;
          btn.classList.add('ia-opp-added');
          await reloadOpps();
        } catch(e) { showToast(e.message, 'error'); }
      };
    });
  }

  /* ── modal Opportunité ───────────────────────────────────── */
  function openOppModal(o = {}) {
    const isEdit = !!o.id;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="oppModal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3>${isEdit ? 'Modifier l\'opportunité' : 'Nouvelle opportunité'}</h3>
            <button class="modal-close" id="closeOppModal">×</button>
          </div>
          <form id="oppModalForm">
            <div class="form-group">
              <label>Titre *</label>
              <input type="text" name="titre" value="${esc(o.titre||'')}" required placeholder="Titre de l'opportunité">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Catégorie</label>
                <select name="categorie">
                  ${CATS.map(c=>`<option value="${c}" ${o.categorie===c?'selected':''}>${c}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Statut</label>
                <select name="statut">
                  <option value="Active"    ${(o.statut||'Active')==='Active'   ?'selected':''}>Active</option>
                  <option value="Clôturée"  ${o.statut==='Clôturée' ?'selected':''}>Clôturée</option>
                  <option value="Annulée"   ${o.statut==='Annulée'  ?'selected':''}>Annulée</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Domaine</label>
                <select name="domaine">
                  <option value="">— Domaine —</option>
                  ${DOMAINES.map(d=>`<option value="${d}" ${o.domaine===d?'selected':''}>${d}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Pays cible</label>
                <select name="pays">
                  <option value="">— Tous pays —</option>
                  ${PAYS_AFRIQUE.map(p=>`<option value="${p}" ${o.pays===p?'selected':''}>${p}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea name="description" rows="3" placeholder="Description détaillée...">${esc(o.description||'')}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Date limite</label>
                <input type="date" name="dateLimite" value="${o.dateLimite?o.dateLimite.split('T')[0]:''}">
              </div>
              <div class="form-group">
                <label>Organisation liée</label>
                <select name="numAgr">
                  <option value="">—</option>
                  ${orgs.map(og=>`<option value="${og.NumAgr}" ${o.numAgr===og.NumAgr?'selected':''}>${esc(og.LibOrg)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Budget</label>
                <input type="number" name="budget" value="${o.budget||''}" placeholder="Montant">
              </div>
              <div class="form-group">
                <label>Devise</label>
                <select name="codeDevise">
                  <option value="FCFA" ${(o.codeDevise||'FCFA')==='FCFA'?'selected':''}>FCFA</option>
                  <option value="EUR"  ${o.codeDevise==='EUR' ?'selected':''}>EUR</option>
                  <option value="USD"  ${o.codeDevise==='USD' ?'selected':''}>USD</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Lien externe</label>
              <input type="url" name="lien" value="${esc(o.lien||'')}" placeholder="https://...">
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" id="closeOppModal2">Annuler</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Mettre à jour' : 'Créer l\'opportunité'}</button>
            </div>
          </form>
        </div>
      </div>`);

    const close = () => document.getElementById('oppModal')?.remove();
    document.getElementById('closeOppModal').onclick  = close;
    document.getElementById('closeOppModal2').onclick = close;

    document.getElementById('oppModalForm').onsubmit = async e => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      try {
        if (isEdit) await api.put(`/opportunites/${o.id}`, body);
        else        await api.post('/opportunites', body);
        close();
        await reloadOpps();
      } catch(err) { showToast(err.message, 'error'); }
    };
  }

  /* ── reloads partiels ────────────────────────────────────── */
  async function reloadTab() {
    document.getElementById('opp2Main').innerHTML = '<div class="dash-loading"><div class="dash-spinner"></div></div>';
    await loadAll();
    document.getElementById('opp2Main').innerHTML =
      activeTab === 'opportunites' ? renderOppsTab() : renderBesoinsTab();
    document.querySelectorAll('.opp2-tab').forEach(t => {
      t.querySelector('.opp2-tab-count').textContent =
        t.dataset.tab === 'opportunites' ? opps.length : (besoins.length||0);
    });
    bindTabEvents();
    if (activeTab === 'besoins') bindBesoinActions();
  }

  async function reloadOpps() {
    let url = '/opportunites?';
    if (filterCat)  url += `&categorie=${encodeURIComponent(filterCat)}`;
    if (filterStat) url += `&statut=${encodeURIComponent(filterStat)}`;
    opps = await api.get(url).catch(() => []);
    const main = document.getElementById('opp2Main');
    if (main && activeTab === 'opportunites') {
      main.innerHTML = renderOppsTab();
      bindTabEvents();
    }
  }

  async function reloadBesoins() {
    besoins = await api.get('/besoins-admin').catch(() => []);
    const list = document.getElementById('besoinsList');
    if (list) { list.innerHTML = renderBesoinsList(); bindBesoinActions(); }
    document.querySelectorAll('.opp2-tab').forEach(t => {
      if (t.dataset.tab === 'besoins') t.querySelector('.opp2-tab-count').textContent = besoins.length||0;
    });
  }

  /* ── utilitaires ─────────────────────────────────────────── */
  function debounce(fn, delay) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  /* ── lancement ───────────────────────────────────────────── */
  app.innerHTML = '<div class="dash-loading"><div class="dash-spinner"></div></div>';
  await loadAll();
  renderShell();
});
