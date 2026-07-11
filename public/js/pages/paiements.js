router.register('paiements', async () => {
  const app = document.getElementById('app');

  /* ── Constantes ─────────────────────────────────────── */
  const TYPES = ['Tous','Adhésion','Cotisation','Don','Abonnement','Prestation','Autres'];
  const TYPE_CFG = {
    'Adhésion':   { bg:'#eff6ff', text:'#2563eb', icon:'🆕' },
    'Cotisation': { bg:'#f0fdf4', text:'#16a34a', icon:'💰' },
    'Don':        { bg:'#fdf4ff', text:'#9333ea', icon:'🎁' },
    'Abonnement': { bg:'#fff7ed', text:'#ea580c', icon:'🔄' },
    'Prestation': { bg:'#f0f9ff', text:'#0284c7', icon:'🛠️' },
    'Autres':     { bg:'#f8fafc', text:'#475569', icon:'📌' },
  };
  const STATUT_CFG = {
    'Payé':       { cls:'pay-st-paye',     label:'Payé',       icon:'✅' },
    'Impayé':     { cls:'pay-st-impaye',   label:'Impayé',     icon:'❌' },
    'En attente': { cls:'pay-st-attente',  label:'En attente', icon:'⏳' },
    'Validé':     { cls:'pay-st-valide',   label:'Validé',     icon:'✔️' },
    'Rejeté':     { cls:'pay-st-rejete',   label:'Rejeté',     icon:'🚫' },
    'Remboursé':  { cls:'pay-st-rembourse',label:'Remboursé',  icon:'↩️' },
  };
  const DEVISES = ['FCFA','EUR','USD','GBP','XOF','MAD','TND'];
  const PAYS_AF = ['Bénin','Burkina Faso','Cameroun','Côte d\'Ivoire','Ghana','Guinée',
    'Madagascar','Mali','Maroc','Maurice','Mozambique','Niger','Nigeria','RDC','Rwanda',
    'Sénégal','Sierra Leone','Togo','Tunisie','Zambie','Zimbabwe'];

  /* ── État ────────────────────────────────────────────── */
  let activeType   = 'Tous';
  let filterStatut = '';
  let filterOrg    = '';
  let filterPays   = '';
  let filterDevise = '';
  let searchQ      = '';
  let paiements    = [];
  let orgs         = [];
  let adhs         = [];
  let moyens       = [];
  let stats        = {};

  /* ── Helpers ─────────────────────────────────────────── */
  const fmt  = d => d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const fmtM = n => Number(n||0).toLocaleString('fr-FR');
  const esc  = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; };

  function typeBadge(type) {
    const c = TYPE_CFG[type] || TYPE_CFG['Autres'];
    return `<span class="pay-tp-badge" style="background:${c.bg};color:${c.text}">${c.icon} ${type||'—'}</span>`;
  }
  function statutBadge(st) {
    const c = STATUT_CFG[st] || { cls:'pay-st-attente', label:st||'—', icon:'•' };
    return `<span class="pay-st-badge ${c.cls}">${c.icon} ${c.label}</span>`;
  }

  /* ── Chargement ──────────────────────────────────────── */
  async function loadAll() {
    let url = '/paiements?_=1';
    if (activeType !== 'Tous') url += `&type=${encodeURIComponent(activeType)}`;
    if (filterStatut) url += `&statut=${encodeURIComponent(filterStatut)}`;
    if (filterOrg)    url += `&org=${encodeURIComponent(filterOrg)}`;
    if (filterPays)   url += `&pays=${encodeURIComponent(filterPays)}`;
    if (filterDevise) url += `&devise=${encodeURIComponent(filterDevise)}`;
    if (searchQ)      url += `&search=${encodeURIComponent(searchQ)}`;

    [paiements, orgs, moyens, stats] = await Promise.all([
      api.get(url),
      api.get('/organisations').catch(()=>[]),
      api.get('/ref/moyens_pay').catch(()=>[]),
      api.get('/paiements/stats').catch(()=>({})),
    ]);
  }

  /* ── Render principal ────────────────────────────────── */
  function render() {
    const topDevise = (stats.byDevise||[])[0]?.devise || 'FCFA';

    app.innerHTML = `
      <div class="pay2-page">

        <!-- Header -->
        <div class="pay2-header">
          <div class="pay2-hd-left">
            <h2 class="pay2-title">💳 Gestion des Paiements</h2>
            <div class="pay2-sub">Adhésions · Cotisations · Dons · Abonnements · Devises · Pays</div>
          </div>
          <div class="pay2-hd-right">
            <button class="btn btn-secondary" id="btnExport">⬇ Export CSV</button>
            <button class="btn btn-primary"   id="btnAdd">+ Nouveau paiement</button>
          </div>
        </div>

        <!-- KPI Strip -->
        <div class="pay2-kpi-strip">
          <div class="pay2-kpi kpi-blue">
            <div class="pay2-kpi-icon">💳</div>
            <div class="pay2-kpi-val">${fmtM(stats.total||0)}</div>
            <div class="pay2-kpi-lbl">Total paiements</div>
          </div>
          <div class="pay2-kpi kpi-green">
            <div class="pay2-kpi-icon">✅</div>
            <div class="pay2-kpi-val">${fmtM(stats.montantPaye||0)}</div>
            <div class="pay2-kpi-lbl">Payé (${topDevise})</div>
            <div class="pay2-kpi-sub">${stats.nbPaye||0} paiement(s)</div>
          </div>
          <div class="pay2-kpi kpi-red">
            <div class="pay2-kpi-icon">❌</div>
            <div class="pay2-kpi-val">${fmtM(stats.montantImpaye||0)}</div>
            <div class="pay2-kpi-lbl">Impayé</div>
            <div class="pay2-kpi-sub">${stats.nbImpaye||0} en retard</div>
          </div>
          <div class="pay2-kpi kpi-orange">
            <div class="pay2-kpi-icon">⏳</div>
            <div class="pay2-kpi-val">${fmtM(stats.montantAttente||0)}</div>
            <div class="pay2-kpi-lbl">En attente</div>
            <div class="pay2-kpi-sub">${stats.nbAttente||0} à traiter</div>
          </div>
          <div class="pay2-kpi kpi-violet">
            <div class="pay2-kpi-icon">🎁</div>
            <div class="pay2-kpi-val">${stats.nbDons||0}</div>
            <div class="pay2-kpi-lbl">Dons</div>
            <div class="pay2-kpi-sub">${stats.nbAdhesions||0} adhésions · ${stats.nbCotisations||0} cotis.</div>
          </div>
        </div>

        <!-- Type Tabs -->
        <div class="pay2-type-tabs">
          ${TYPES.map(t => {
            const cnt = t==='Tous' ? (stats.total||0)
              : (stats.byType||[]).find(x=>x.type===t)?.nb || 0;
            return `<button class="pay2-type-tab${activeType===t?' active':''}" data-type="${t}">
              ${TYPE_CFG[t]?.icon||''} ${t} <span class="pay2-tab-cnt">${cnt}</span>
            </button>`;
          }).join('')}
        </div>

        <!-- Filters -->
        <div class="pay2-filters">
          <div class="pay2-search-wrap">
            <span>🔎</span>
            <input id="paySearch" type="text" class="pay2-search" placeholder="Réf, adhérent, organisation..." value="${esc(searchQ)}">
          </div>
          <select id="filtStatut" class="select-sm">
            <option value="">Tous statuts</option>
            ${Object.keys(STATUT_CFG).map(s=>`<option value="${s}"${filterStatut===s?' selected':''}>${STATUT_CFG[s].icon} ${s}</option>`).join('')}
          </select>
          <select id="filtOrg" class="select-sm">
            <option value="">Toutes orgs</option>
            ${orgs.map(o=>`<option value="${o.NumAgr}"${filterOrg===o.NumAgr?' selected':''}>${esc(o.LibOrg)}</option>`).join('')}
          </select>
          <select id="filtPays" class="select-sm">
            <option value="">Tous pays</option>
            ${PAYS_AF.map(p=>`<option value="${p}"${filterPays===p?' selected':''}>${p}</option>`).join('')}
          </select>
          <select id="filtDevise" class="select-sm">
            <option value="">Toutes devises</option>
            ${DEVISES.map(d=>`<option value="${d}"${filterDevise===d?' selected':''}>${d}</option>`).join('')}
          </select>
          ${filterStatut||filterOrg||filterPays||filterDevise||searchQ||activeType!=='Tous' ?
            `<button class="pay2-clear-btn" id="clearFilters">✕ Effacer</button>` : ''}
        </div>

        <!-- Table -->
        <div class="pay2-tbl-wrap">
          ${paiements.length ? `
          <table class="pay2-tbl">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Date</th>
                <th>Type</th>
                <th>Bénéficiaire</th>
                <th>Organisation</th>
                <th>Pays</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Échéance</th>
                <th class="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${paiements.map(p => renderRow(p)).join('')}
            </tbody>
          </table>
          <div class="pay2-tbl-footer">
            <span>${paiements.length} paiement(s) affiché(s)</span>
          </div>
          ` : `
          <div class="pay2-empty">
            <div class="pay2-empty-icon">💳</div>
            <div class="pay2-empty-title">Aucun paiement trouvé</div>
            <div class="pay2-empty-sub">Modifiez vos filtres ou créez un nouveau paiement.</div>
            <button class="btn btn-primary" id="btnAddEmpty">+ Nouveau paiement</button>
          </div>
          `}
        </div>

        <!-- Breakdown row -->
        <div class="pay2-breakdown-grid">
          ${renderBreakdownCard('🌍 Par pays',   stats.byPays||[],   'pays',   'montant')}
          ${renderBreakdownCard('💱 Par devise', stats.byDevise||[], 'devise', 'montant')}
          ${renderBreakdownCard('📊 Par type',   stats.byType||[],   'type',   'montant')}
          ${renderBreakdownCard('📈 Par statut', stats.byStatut||[], 'statut', 'montant')}
        </div>
      </div>`;

    bindEvents();
  }

  function renderRow(p) {
    const exp = p.DateEcheance && new Date(p.DateEcheance) < new Date() && p.Statut !== 'Payé';
    const sym = p.SymDevise || p.CodeDevise || 'FCFA';
    return `
      <tr class="pay2-row${exp?' pay2-row-exp':''}" data-id="${p.IdPaiement}">
        <td><span class="pay-ref">${esc(p.NumRecu||p.Reference||'—')}</span></td>
        <td>${fmt(p.DatePaiement)}</td>
        <td>${typeBadge(p.TypePaiement)}</td>
        <td>
          ${p.NomAdh ? `<div class="pay-adh">${esc(p.NomAdh)} ${esc(p.PrenAdh||'')}</div>` : '<span class="text-muted">—</span>'}
          ${p.EmailAdh ? `<div class="pay-adh-email">${esc(p.EmailAdh)}</div>` : ''}
        </td>
        <td>${p.LibOrg ? `<span class="pay-org">${esc(p.LibOrg)}</span>` : '—'}</td>
        <td>${p.CodePays ? `🌍 ${esc(p.LibPays||p.CodePays)}` : '—'}</td>
        <td class="pay-montant${p.Statut==='Payé'?' pay-montant-ok':p.Statut==='Impayé'?' pay-montant-ko':''}">
          <strong>${fmtM(p.MontantPaiement)}</strong> <span class="pay-sym">${sym}</span>
        </td>
        <td>${statutBadge(p.Statut)}</td>
        <td class="${exp?'pay-exp-date':''}">
          ${p.DateEcheance ? `${exp?'⚠️ ':''}${fmt(p.DateEcheance)}` : '—'}
        </td>
        <td class="pay-actions">
          <button class="pay-btn pay-btn-recu"   data-id="${p.IdPaiement}" title="Reçu PDF">📄</button>
          <button class="pay-btn pay-btn-edit"   data-id="${p.IdPaiement}" title="Modifier">✏️</button>
          <button class="pay-btn pay-btn-statut" data-id="${p.IdPaiement}" data-statut="${esc(p.Statut||'')}" title="Changer statut">🔄</button>
          ${p.EmailAdh ? `<button class="pay-btn pay-btn-email" data-id="${p.IdPaiement}" title="Email">${p.EmailEnvoye?'📧':'📨'}</button>` : ''}
          <button class="pay-btn pay-btn-del"    data-id="${p.IdPaiement}" title="Supprimer">🗑️</button>
        </td>
      </tr>`;
  }

  function renderBreakdownCard(titre, data, keyField, valField) {
    if (!data.length) return `<div class="pay2-bd-card"><div class="pay2-bd-title">${titre}</div><div class="pay2-bd-empty">Aucune donnée</div></div>`;
    const max = Math.max(...data.map(d => Number(d[valField])||0)) || 1;
    const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
    return `
      <div class="pay2-bd-card">
        <div class="pay2-bd-title">${titre}</div>
        ${data.slice(0,6).map((d,i) => {
          const pct = Math.round((Number(d[valField])||0)/max*100);
          return `<div class="pay2-bd-row">
            <div class="pay2-bd-label">${esc(String(d[keyField]||'—'))}</div>
            <div class="pay2-bd-bar-wrap">
              <div class="pay2-bd-bar" style="width:${pct}%;background:${colors[i%colors.length]}"></div>
            </div>
            <div class="pay2-bd-val">${fmtM(d[valField])} <span style="color:#94a3b8;font-size:11px">(${d.nb})</span></div>
          </div>`;
        }).join('')}
      </div>`;
  }

  /* ── Events ──────────────────────────────────────────── */
  function bindEvents() {
    document.querySelectorAll('.pay2-type-tab').forEach(btn => {
      btn.onclick = () => { activeType = btn.dataset.type; reload(); };
    });

    const searchEl = document.getElementById('paySearch');
    if (searchEl) searchEl.oninput = debounce(e => { searchQ = e.target.value; reload(); }, 350);

    const filtStatutEl = document.getElementById('filtStatut');
    if (filtStatutEl) filtStatutEl.onchange = e => { filterStatut = e.target.value; reload(); };

    const filtOrgEl = document.getElementById('filtOrg');
    if (filtOrgEl) filtOrgEl.onchange = e => { filterOrg = e.target.value; reload(); };

    const filtPaysEl = document.getElementById('filtPays');
    if (filtPaysEl) filtPaysEl.onchange = e => { filterPays = e.target.value; reload(); };

    const filtDeviseEl = document.getElementById('filtDevise');
    if (filtDeviseEl) filtDeviseEl.onchange = e => { filterDevise = e.target.value; reload(); };

    document.getElementById('clearFilters')?.addEventListener('click', () => {
      activeType='Tous'; filterStatut=filterOrg=filterPays=filterDevise=searchQ=''; reload();
    });

    document.getElementById('btnAdd')?.addEventListener('click', () => openModal());
    document.getElementById('btnAddEmpty')?.addEventListener('click', () => openModal());
    document.getElementById('btnExport')?.addEventListener('click', exportCSV);

    document.querySelectorAll('.pay-btn-recu').forEach(btn => {
      btn.onclick = () => {
        const p = paiements.find(x => String(x.IdPaiement) === String(btn.dataset.id));
        if (p) openRecu(p);
      };
    });
    document.querySelectorAll('.pay-btn-edit').forEach(btn => {
      btn.onclick = () => {
        const p = paiements.find(x => String(x.IdPaiement) === String(btn.dataset.id));
        if (p) openModal(p);
      };
    });
    document.querySelectorAll('.pay-btn-statut').forEach(btn => {
      btn.onclick = () => openStatutModal(btn.dataset.id, btn.dataset.statut);
    });
    document.querySelectorAll('.pay-btn-email').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Envoyer un email de notification à l\'adhérent ?')) return;
        try {
          await api.post(`/paiements/${btn.dataset.id}/email`, {});
          btn.textContent = '📧';
          showToast('Email envoyé avec succès', 'success');
        } catch(e) { showToast(e.message||'Erreur envoi email', 'error'); }
      };
    });
    document.querySelectorAll('.pay-btn-del').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Supprimer ce paiement définitivement ?')) return;
        try {
          await api.delete(`/paiements/${btn.dataset.id}`);
          showToast('Paiement supprimé', 'success');
          reload();
        } catch(e) { showToast(e.message, 'error'); }
      };
    });
  }

  /* ── Modal Nouveau/Modifier ──────────────────────────── */
  function openModal(p = {}) {
    const isEdit = !!p.IdPaiement;
    const selOrg = orgs.map(o=>`<option value="${o.NumAgr}"${o.NumAgr===p.NumAgr?' selected':''}>${esc(o.LibOrg)}</option>`).join('');
    const selMoy = (moyens||[]).map(m=>`<option value="${m.id||m.IdMoyPay}"${(m.id||m.IdMoyPay)==p.IdMoyPay?' selected':''}>${esc(m.lib||m.LibMoyPay||'')}</option>`).join('');
    const selDev = DEVISES.map(d=>`<option value="${d}"${d===(p.CodeDevise||'FCFA')?' selected':''}>${d}</option>`).join('');
    const todayStr = new Date().toISOString().split('T')[0];

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="payModal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3>${isEdit ? '✏️ Modifier le paiement' : '+ Nouveau paiement'}</h3>
            <button class="modal-close" id="closePayModal">×</button>
          </div>
          <form id="payForm">
            <div class="form-row">
              <div class="form-group">
                <label>Type de paiement *</label>
                <select name="TypePaiement" required>
                  ${TYPES.filter(t=>t!=='Tous').map(t=>`<option value="${t}"${(p.TypePaiement||'Cotisation')===t?' selected':''}>${TYPE_CFG[t]?.icon||''} ${t}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Statut</label>
                <select name="Statut">
                  ${Object.keys(STATUT_CFG).map(s=>`<option value="${s}"${(p.Statut||'En attente')===s?' selected':''}>${STATUT_CFG[s].icon} ${s}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Organisation</label>
                <select name="NumAgr" id="payOrg">
                  <option value="">— Sélectionner —</option>${selOrg}
                </select>
              </div>
              <div class="form-group">
                <label>Adhérent</label>
                <select name="idAdh" id="payAdh">
                  <option value="">— Sélectionner —</option>
                  ${adhs.map(a=>`<option value="${a.idAdh}"${a.idAdh==p.idAdh?' selected':''}>${esc(a.NomAdh)} ${esc(a.PrenAdh||'')}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Montant *</label>
                <input type="number" name="MontantPaiement" step="0.01" min="0" value="${p.MontantPaiement||''}" required>
              </div>
              <div class="form-group">
                <label>Devise</label>
                <select name="CodeDevise">${selDev}</select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Date de paiement</label>
                <input type="date" name="DatePaiement" value="${p.DatePaiement ? p.DatePaiement.split('T')[0] : todayStr}">
              </div>
              <div class="form-group">
                <label>Date d'échéance</label>
                <input type="date" name="DateEcheance" value="${p.DateEcheance ? p.DateEcheance.split('T')[0] : ''}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Moyen de paiement</label>
                <select name="IdMoyPay"><option value="">—</option>${selMoy}</select>
              </div>
              <div class="form-group">
                <label>Pays</label>
                <select name="CodePays">
                  <option value="">— Pays —</option>
                  ${PAYS_AF.map(pa=>`<option value="${pa}"${pa===p.CodePays?' selected':''}>${pa}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Référence externe</label>
                <input type="text" name="Reference" value="${esc(p.Reference||'')}" placeholder="REF-XXX, N° chèque...">
              </div>
              <div class="form-group">
                <label>Objet du paiement</label>
                <input type="text" name="ObjetPaiement" value="${esc(p.ObjetPaiement||'')}" placeholder="Ex: Adhésion 2026">
              </div>
            </div>
            <div class="form-group">
              <label>Note</label>
              <textarea name="NotePaiement" rows="2" placeholder="Informations complémentaires...">${esc(p.NotePaiement||'')}</textarea>
            </div>
            ${!isEdit ? `
            <div class="form-group pay2-email-opt">
              <label class="pay2-check-label">
                <input type="checkbox" name="sendEmail" value="1">
                📧 Envoyer un email de confirmation à l'adhérent
              </label>
            </div>` : ''}
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" id="closePayModal2">Annuler</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Mettre à jour' : 'Enregistrer le paiement'}</button>
            </div>
          </form>
        </div>
      </div>`);

    const close = () => document.getElementById('payModal')?.remove();
    document.getElementById('closePayModal').onclick  = close;
    document.getElementById('closePayModal2').onclick = close;

    document.getElementById('payOrg').onchange = async e => {
      if (!e.target.value) return;
      const list = await api.get(`/adherents?org=${e.target.value}`).catch(()=>[]);
      adhs = list;
      document.getElementById('payAdh').innerHTML =
        `<option value="">—</option>` +
        list.map(a=>`<option value="${a.idAdh}">${esc(a.NomAdh)} ${esc(a.PrenAdh||'')}</option>`).join('');
    };

    document.getElementById('payForm').onsubmit = async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      data.sendEmail = data.sendEmail === '1';
      try {
        if (isEdit) {
          await api.put(`/paiements/${p.IdPaiement}`, data);
          showToast('Paiement mis à jour', 'success');
        } else {
          const r = await api.post('/paiements', data);
          showToast(`Paiement créé · Réf: ${r.numRecu||''}`, 'success');
        }
        close();
        reload();
      } catch(err) { showToast(err.message||'Erreur serveur', 'error'); }
    };
  }

  /* ── Modal changement de statut ─────────────────────── */
  function openStatutModal(id, currentStatut) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="statutModal">
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h3>🔄 Changer le statut</h3>
            <button class="modal-close" id="closeStatutModal">×</button>
          </div>
          <div style="padding:20px">
            <div class="form-group">
              <label>Nouveau statut</label>
              <select id="newStatut" class="form-select">
                ${Object.keys(STATUT_CFG).map(s=>`<option value="${s}"${s===currentStatut?' selected':''}>${STATUT_CFG[s].icon} ${s}</option>`).join('')}
              </select>
            </div>
            <div class="form-group pay2-email-opt" style="margin-top:12px">
              <label class="pay2-check-label">
                <input type="checkbox" id="notifEmail">
                📧 Notifier l'adhérent par email
              </label>
            </div>
            <div class="form-actions">
              <button class="btn btn-secondary" id="closeStatutModal2">Annuler</button>
              <button class="btn btn-primary"   id="confirmStatut">Confirmer</button>
            </div>
          </div>
        </div>
      </div>`);

    const close = () => document.getElementById('statutModal')?.remove();
    document.getElementById('closeStatutModal').onclick  = close;
    document.getElementById('closeStatutModal2').onclick = close;
    document.getElementById('confirmStatut').onclick = async () => {
      const statut    = document.getElementById('newStatut').value;
      const sendEmail = document.getElementById('notifEmail').checked;
      try {
        await api.put(`/paiements/${id}/statut`, { statut, sendEmail });
        showToast(`Statut mis à jour : ${statut}`, 'success');
        close();
        reload();
      } catch(err) { showToast(err.message||'Erreur serveur', 'error'); }
    };
  }

  /* ── Reçu PDF client-side ────────────────────────────── */
  function openRecu(p) {
    const sym     = p.SymDevise || p.CodeDevise || 'FCFA';
    const ref     = p.NumRecu || p.Reference || `#${p.IdPaiement}`;
    const nom     = `${p.PrenAdh||''} ${p.NomAdh||''}`.trim() || '—';
    const cfg     = STATUT_CFG[p.Statut] || { label:p.Statut||'—', icon:'•' };
    const statColor = {
      'Payé':'#059669','Impayé':'#dc2626','En attente':'#d97706',
      'Validé':'#2563eb','Rejeté':'#6b7280','Remboursé':'#7c3aed'
    };
    const sc = statColor[p.Statut] || '#374151';

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Reçu ${esc(ref)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;padding:30px;color:#1e293b}
.recu{background:#fff;max-width:680px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.12)}
.recu-hdr{background:linear-gradient(135deg,#1e40af,#6366f1);color:#fff;padding:28px 36px;display:flex;justify-content:space-between;align-items:center}
.recu-hdr h1{font-size:20px;font-weight:800;letter-spacing:1px}
.recu-hdr .sub{font-size:12px;opacity:.8;margin-top:4px}
.recu-ref{text-align:right}
.ref-num{font-family:monospace;font-size:18px;font-weight:700;background:rgba(255,255,255,.2);padding:6px 14px;border-radius:8px}
.ref-lbl{font-size:11px;opacity:.7;margin-bottom:4px}
.recu-body{padding:32px 36px}
.recu-statut{text-align:center;margin-bottom:24px}
.st-badge{display:inline-block;background:${sc}22;color:${sc};border:2px solid ${sc};border-radius:100px;padding:8px 24px;font-size:16px;font-weight:700}
.recu-montant{text-align:center;background:linear-gradient(135deg,#f0f9ff,#eff6ff);border-radius:14px;padding:24px;margin-bottom:24px}
.recu-montant .lbl{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
.recu-montant .val{font-size:40px;font-weight:800;color:#1e40af}
.recu-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.recu-field{background:#f8fafc;border-radius:10px;padding:14px 18px}
.recu-field .fl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.recu-field .fv{font-size:14px;font-weight:600;color:#1e293b}
.recu-note{background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 18px;border-radius:8px;font-size:13px;color:#92400e;margin-bottom:24px}
.recu-ftr{background:#f8fafc;padding:18px 36px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b}
.sig-line{width:160px;height:1px;background:#cbd5e1;margin-top:20px}
@media print{body{background:#fff;padding:0}.recu{box-shadow:none;border-radius:0}}
</style></head><body>
<div class="recu">
  <div class="recu-hdr">
    <div>
      <h1>💳 REÇU DE PAIEMENT</h1>
      <div class="sub">SoliDev – Plateforme Panafricaine des Associations</div>
      <div class="sub" style="margin-top:8px">Émis le ${fmt(new Date().toISOString())}</div>
    </div>
    <div class="recu-ref">
      <div class="ref-lbl">N° de reçu</div>
      <div class="ref-num">${esc(ref)}</div>
    </div>
  </div>
  <div class="recu-body">
    <div class="recu-statut"><div class="st-badge">${cfg.icon||''} ${cfg.label}</div></div>
    <div class="recu-montant">
      <div class="lbl">Montant du paiement</div>
      <div class="val">${fmtM(p.MontantPaiement)} <span style="font-size:22px;color:#64748b">${sym}</span></div>
    </div>
    <div class="recu-grid">
      <div class="recu-field"><div class="fl">Type</div><div class="fv">${esc(p.TypePaiement||'—')}</div></div>
      <div class="recu-field"><div class="fl">Date</div><div class="fv">${fmt(p.DatePaiement)}</div></div>
      <div class="recu-field"><div class="fl">Payé par</div><div class="fv">${esc(nom)}</div></div>
      <div class="recu-field"><div class="fl">Organisation</div><div class="fv">${esc(p.LibOrg||'—')}</div></div>
      <div class="recu-field"><div class="fl">Moyen de paiement</div><div class="fv">${esc(p.LibMoyPay||'—')}</div></div>
      <div class="recu-field"><div class="fl">Pays</div><div class="fv">${esc(p.LibPays||p.CodePays||'—')}</div></div>
      ${p.DateEcheance ? `<div class="recu-field"><div class="fl">Échéance</div><div class="fv">${fmt(p.DateEcheance)}</div></div>` : ''}
      ${p.ObjetPaiement ? `<div class="recu-field"><div class="fl">Objet</div><div class="fv">${esc(p.ObjetPaiement)}</div></div>` : ''}
    </div>
    ${p.NotePaiement ? `<div class="recu-note">📝 ${esc(p.NotePaiement)}</div>` : ''}
    <div class="recu-ftr">
      <div><span>Signature &amp; Cachet officiel</span><div class="sig-line"></div></div>
      <div style="text-align:right">
        <div>Référence : <strong>${esc(ref)}</strong></div>
        <div>Émis par SoliDev</div>
      </div>
    </div>
  </div>
</div>
<script>window.onload = () => window.print();<\/script>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    else showToast('Autoriser les pop-ups pour générer le reçu', 'error');
  }

  /* ── Export CSV ──────────────────────────────────────── */
  function exportCSV() {
    if (!paiements.length) { showToast('Aucune donnée à exporter', 'error'); return; }
    const headers = ['Référence','Date','Type','Statut','Adhérent','Organisation','Pays','Montant','Devise','Échéance','Moyen','Note'];
    const rows = paiements.map(p => [
      p.NumRecu||p.Reference||'', p.DatePaiement||'', p.TypePaiement||'', p.Statut||'',
      `${p.NomAdh||''} ${p.PrenAdh||''}`.trim(), p.LibOrg||'', p.CodePays||'',
      p.MontantPaiement||0, p.CodeDevise||'FCFA', p.DateEcheance||'', p.LibMoyPay||'', p.NotePaiement||''
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `paiements_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ── Toast ───────────────────────────────────────────── */
  function showToast(msg, type='success') {
    const t = document.createElement('div');
    t.className = `pay2-toast pay2-toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('pay2-toast-show'), 10);
    setTimeout(() => { t.classList.remove('pay2-toast-show'); setTimeout(()=>t.remove(), 300); }, 3200);
  }

  /* ── Reload ──────────────────────────────────────────── */
  async function reload() {
    await loadAll();
    render();
  }

  /* ── Init ────────────────────────────────────────────── */
  app.innerHTML = '<div class="dash-loading"><div class="dash-spinner"></div></div>';
  await loadAll();
  render();
});
