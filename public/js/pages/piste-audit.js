router.register('piste-audit', async () => {
  const app = document.getElementById('app');

  /* ── Config actions ──────────────────────────────────────────── */
  const ACTIONS = {
    CONNEXION:    { label:'Connexion',    icon:'🔐', color:'#2563eb', bg:'#dbeafe' },
    DECONNEXION:  { label:'Déconnexion',  icon:'🚪', color:'#64748b', bg:'#f1f5f9' },
    CREATION:     { label:'Création',     icon:'➕', color:'#059669', bg:'#d1fae5' },
    MODIFICATION: { label:'Modification', icon:'✏️', color:'#d97706', bg:'#fef3c7' },
    SUPPRESSION:  { label:'Suppression',  icon:'🗑️', color:'#dc2626', bg:'#fee2e2' },
    PAIEMENT:     { label:'Paiement',     icon:'💳', color:'#7c3aed', bg:'#ede9fe' },
    VALIDATION:   { label:'Validation',   icon:'✅', color:'#0891b2', bg:'#cffafe' },
    IMPRESSION:   { label:'Impression',   icon:'🖨️', color:'#0f766e', bg:'#ccfbf1' },
    EXPORT:       { label:'Export',       icon:'⬇️', color:'#1d4ed8', bg:'#bfdbfe' },
    RECHERCHE:    { label:'Recherche',    icon:'🔎', color:'#9333ea', bg:'#f3e8ff' },
  };

  /* ── État ────────────────────────────────────────────────────── */
  let filterAction = '', filterModule = '', filterUser = '', filterIP = '',
      dateFrom = '', dateTo = '', searchQ = '', page = 0;
  const PAGE_SIZE = 50;
  let data = { rows: [], total: 0 }, stats = {};

  /* ── Helpers ─────────────────────────────────────────────────── */
  const esc  = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const fmtDT = d => d ? new Date(d).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—';
  const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; };

  function actionBadge(a) {
    const c = ACTIONS[a] || { label: a||'—', icon:'•', color:'#64748b', bg:'#f1f5f9' };
    return `<span class="aud-badge" style="background:${c.bg};color:${c.color}">${c.icon} ${c.label}</span>`;
  }

  /* ── Chargement ──────────────────────────────────────────────── */
  async function loadAll() {
    const qs = new URLSearchParams();
    if (filterAction) qs.set('action', filterAction);
    if (filterModule) qs.set('module', filterModule);
    if (filterUser)   qs.set('userId', filterUser);
    if (filterIP)     qs.set('ip',     filterIP);
    if (dateFrom)     qs.set('dateFrom', dateFrom);
    if (dateTo)       qs.set('dateTo',   dateTo);
    if (searchQ)      qs.set('search',   searchQ);
    qs.set('limit',  PAGE_SIZE);
    qs.set('offset', page * PAGE_SIZE);

    [data, stats] = await Promise.all([
      api.get(`/piste-audit?${qs}`),
      api.get(`/piste-audit/stats?${dateFrom?'dateFrom='+dateFrom:''}${dateTo?'&dateTo='+dateTo:''}`).catch(()=>({})),
    ]);
  }

  /* ── Logger un événement client (impression, export, recherche) ─ */
  async function logEvent(action, module, details) {
    try { await api.post('/piste-audit/event', { action, module, details }); } catch(_) {}
  }

  /* ── Render ──────────────────────────────────────────────────── */
  function render() {
    const rows  = data.rows  || [];
    const total = data.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const modules = [...new Set((stats.byModule||[]).map(m=>m.module).filter(m=>m&&m!=='—'))];
    const users   = [...new Set((stats.byUser||[]).map(u=>u.user).filter(Boolean))];

    app.innerHTML = `
      <div class="aud-page">

        <!-- Header -->
        <div class="aud-header">
          <div>
            <h2 class="aud-title">📋 Piste d'Audit</h2>
            <div class="aud-sub">${total.toLocaleString('fr-FR')} événement${total>1?'s':''} enregistré${total>1?'s':''}</div>
          </div>
          <div class="aud-hd-actions">
            <button class="btn btn-secondary" id="audExport">⬇ Export CSV</button>
            <button class="btn btn-secondary" id="audPrint">🖨️ Imprimer</button>
          </div>
        </div>

        <!-- KPI Stats -->
        <div class="aud-kpi-row">
          ${renderKpiStrip(stats)}
        </div>

        <!-- Breakdown charts -->
        <div class="aud-breakdown-row">
          ${renderBreakdown('📊 Par action',  stats.byAction||[], 'action', ACTIONS)}
          ${renderBreakdown('🗂️ Par module',  stats.byModule||[], 'module')}
          ${renderBreakdown('👤 Par utilisateur', stats.byUser||[], 'user')}
          ${renderCalendar(stats.byDay||[])}
        </div>

        <!-- Filtres -->
        <div class="aud-filters">
          <div class="aud-search-wrap">
            <span>🔎</span>
            <input id="audSearch" type="text" class="aud-search"
              placeholder="Recherche dans tous les champs..." value="${esc(searchQ)}">
          </div>
          <select id="audFiltAction" class="select-sm">
            <option value="">Toutes les actions</option>
            ${Object.entries(ACTIONS).map(([k,v])=>`<option value="${k}"${filterAction===k?' selected':''}>${v.icon} ${v.label}</option>`).join('')}
          </select>
          <select id="audFiltModule" class="select-sm">
            <option value="">Tous les modules</option>
            ${modules.map(m=>`<option value="${m}"${filterModule===m?' selected':''}>${esc(m)}</option>`).join('')}
          </select>
          <select id="audFiltUser" class="select-sm">
            <option value="">Tous les utilisateurs</option>
            ${users.map(u=>`<option value="${u}"${filterUser===u?' selected':''}>${esc(u)}</option>`).join('')}
          </select>
          <div class="aud-date-range">
            <input type="date" id="audDateFrom" value="${dateFrom}" title="Du">
            <span>→</span>
            <input type="date" id="audDateTo" value="${dateTo}" title="Au">
          </div>
          <input id="audIP" type="text" class="select-sm" placeholder="IP..." value="${esc(filterIP)}" style="width:130px">
          ${filterAction||filterModule||filterUser||filterIP||dateFrom||dateTo||searchQ
            ? `<button class="aud-clear-btn" id="audClear">✕ Effacer</button>` : ''}
        </div>

        <!-- Table -->
        <div class="aud-tbl-wrap">
          ${rows.length ? `
          <table class="aud-tbl" id="audTable">
            <thead>
              <tr>
                <th style="width:160px">Date &amp; Heure</th>
                <th style="width:130px">Utilisateur</th>
                <th style="width:120px">Action</th>
                <th style="width:130px">Module / Programme</th>
                <th style="width:120px">Adresse IP</th>
                <th>Navigateur</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r,i) => renderRow(r, i)).join('')}
            </tbody>
          </table>
          ` : `
          <div class="aud-empty">
            <div class="aud-empty-icon">📋</div>
            <div class="aud-empty-title">Aucun événement trouvé</div>
            <div class="aud-empty-sub">Affinez vos filtres ou attendez de nouvelles actions.</div>
          </div>
          `}
        </div>

        <!-- Pagination -->
        ${total > PAGE_SIZE ? renderPagination(page, totalPages, total) : ''}

      </div>`;

    bindEvents();
  }

  function renderRow(r, i) {
    const a    = ACTIONS[r.action] || { icon:'•', color:'#64748b', bg:'#f1f5f9', label:r.action||'—' };
    const user = r.nomUtilisateur || r.adminUser || 'système';
    const initials = user.slice(0,2).toUpperCase();
    const hue  = [...user].reduce((h,c)=>h+c.charCodeAt(0),0) % 360;
    return `
      <tr class="aud-row" style="animation-delay:${Math.min(i,20)*15}ms">
        <td class="aud-td-date">
          <div class="aud-date">${fmtDate(r.dateAction)}</div>
          <div class="aud-time">${r.dateAction ? new Date(r.dateAction).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—'}</div>
        </td>
        <td>
          <div class="aud-user">
            <div class="aud-avatar" style="background:hsl(${hue},60%,45%)">${initials}</div>
            <div>
              <div class="aud-username">${esc(user)}</div>
              ${r.userId ? `<div class="aud-uid">#${r.userId}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${actionBadge(r.action)}</td>
        <td>
          ${r.module ? `<span class="aud-module">${esc(r.module)}</span>` : '<span class="aud-muted">—</span>'}
          ${r.table_cible ? `<div class="aud-table-cible">${esc(r.table_cible)}${r.id_cible?` #${r.id_cible}`:''}</div>` : ''}
        </td>
        <td>
          <span class="aud-ip">${esc(r.ipAdresse||'—')}</span>
        </td>
        <td>
          <span class="aud-nav" title="${esc(r.navigateur||'')}">${esc((r.navigateur||'—').slice(0,25))}${(r.navigateur||'').length>25?'…':''}</span>
        </td>
        <td class="aud-td-details">
          <span title="${esc(r.details||'')}">${esc((r.details||'—').slice(0,80))}${(r.details||'').length>80?'…':''}</span>
        </td>
      </tr>`;
  }

  function renderKpiStrip(s) {
    const total = s.total || 0;
    const byAct = s.byAction || [];
    const get   = a => (byAct.find(x=>x.action===a)||{}).nb || 0;
    const kpis  = [
      { icon:'📊', val:total,          lbl:'Total événements',  cls:'kpi-blue'   },
      { icon:'🔐', val:get('CONNEXION'),lbl:'Connexions',        cls:'kpi-indig'  },
      { icon:'➕', val:get('CREATION'), lbl:'Créations',         cls:'kpi-green'  },
      { icon:'✏️', val:get('MODIFICATION'),lbl:'Modifications',  cls:'kpi-orange' },
      { icon:'🗑️', val:get('SUPPRESSION'),lbl:'Suppressions',   cls:'kpi-red'    },
      { icon:'💳', val:get('PAIEMENT'), lbl:'Paiements',         cls:'kpi-violet' },
    ];
    return kpis.map(k=>`
      <div class="aud-kpi ${k.cls}">
        <div class="aud-kpi-icon">${k.icon}</div>
        <div class="aud-kpi-val">${k.val.toLocaleString('fr-FR')}</div>
        <div class="aud-kpi-lbl">${k.lbl}</div>
      </div>`).join('');
  }

  function renderBreakdown(titre, data, key, cfg = {}) {
    if (!data.length) return `<div class="aud-bd"><div class="aud-bd-title">${titre}</div><div class="aud-empty-sub" style="padding:10px">—</div></div>`;
    const max = Math.max(...data.map(d=>d.nb)) || 1;
    const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6'];
    return `
      <div class="aud-bd">
        <div class="aud-bd-title">${titre}</div>
        ${data.slice(0,6).map((d,i) => {
          const label = cfg[d[key]]?.label || d[key] || '—';
          const icon  = cfg[d[key]]?.icon  || '';
          const pct   = Math.round(d.nb/max*100);
          return `<div class="aud-bd-row">
            <div class="aud-bd-label" title="${esc(label)}">${icon} ${esc(String(label).slice(0,18))}</div>
            <div class="aud-bd-bar-wrap"><div class="aud-bd-bar" style="width:${pct}%;background:${colors[i%colors.length]}"></div></div>
            <div class="aud-bd-nb">${d.nb}</div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function renderCalendar(days) {
    if (!days.length) return `<div class="aud-bd"><div class="aud-bd-title">📅 Activité récente</div><div class="aud-empty-sub" style="padding:10px">—</div></div>`;
    const max = Math.max(...days.map(d=>d.nb)) || 1;
    return `
      <div class="aud-bd">
        <div class="aud-bd-title">📅 Activité récente (30 j.)</div>
        <div class="aud-calendar">
          ${days.slice(0,30).reverse().map(d => {
            const pct  = Math.round(d.nb/max*100);
            const heat = pct > 75 ? '#1e40af' : pct > 50 ? '#3b82f6' : pct > 25 ? '#93c5fd' : '#dbeafe';
            return `<div class="aud-cal-cell" style="background:${heat}" title="${d.jour} — ${d.nb} événement(s)"></div>`;
          }).join('')}
        </div>
        <div class="aud-cal-legend">
          <span>— actif</span>
          <div class="aud-cal-cell" style="background:#dbeafe;display:inline-block"></div>
          <div class="aud-cal-cell" style="background:#93c5fd;display:inline-block"></div>
          <div class="aud-cal-cell" style="background:#3b82f6;display:inline-block"></div>
          <div class="aud-cal-cell" style="background:#1e40af;display:inline-block"></div>
          <span>très actif —</span>
        </div>
      </div>`;
  }

  function renderPagination(cur, total, nb) {
    const from = cur * PAGE_SIZE + 1;
    const to   = Math.min((cur + 1) * PAGE_SIZE, nb);
    return `
      <div class="aud-pagination">
        <span class="aud-page-info">Affichage ${from}–${to} sur ${nb.toLocaleString('fr-FR')}</span>
        <div class="aud-page-btns">
          <button class="aud-page-btn" id="audPrev" ${cur===0?'disabled':''}>‹ Précédent</button>
          <span class="aud-page-cur">Page ${cur+1} / ${total}</span>
          <button class="aud-page-btn" id="audNext" ${cur>=total-1?'disabled':''}>Suivant ›</button>
        </div>
      </div>`;
  }

  /* ── Events ──────────────────────────────────────────────────── */
  function bindEvents() {
    // Recherche
    document.getElementById('audSearch')?.addEventListener('input', debounce(e => {
      searchQ = e.target.value; page = 0; reload();
    }, 350));

    // Filtres selects
    document.getElementById('audFiltAction')?.addEventListener('change', e => { filterAction = e.target.value; page = 0; reload(); });
    document.getElementById('audFiltModule')?.addEventListener('change', e => { filterModule = e.target.value; page = 0; reload(); });
    document.getElementById('audFiltUser')?.addEventListener('change', e => { filterUser = e.target.value; page = 0; reload(); });

    // Dates
    document.getElementById('audDateFrom')?.addEventListener('change', e => { dateFrom = e.target.value; page = 0; reload(); });
    document.getElementById('audDateTo')?.addEventListener('change',   e => { dateTo   = e.target.value; page = 0; reload(); });

    // IP
    document.getElementById('audIP')?.addEventListener('input', debounce(e => { filterIP = e.target.value; page = 0; reload(); }, 400));

    // Effacer filtres
    document.getElementById('audClear')?.addEventListener('click', () => {
      filterAction = filterModule = filterUser = filterIP = dateFrom = dateTo = searchQ = '';
      page = 0; reload();
    });

    // Pagination
    document.getElementById('audPrev')?.addEventListener('click', () => { page--; reload(); });
    document.getElementById('audNext')?.addEventListener('click', () => { page++; reload(); });

    // Export CSV (log l'action)
    document.getElementById('audExport')?.addEventListener('click', async () => {
      await logEvent('EXPORT', 'Piste d\'audit', `Export CSV — ${data.total} entrées`);
      exportCSV();
    });

    // Impression (log l'action)
    document.getElementById('audPrint')?.addEventListener('click', async () => {
      await logEvent('IMPRESSION', 'Piste d\'audit', `Impression — ${data.total} entrées`);
      window.print();
    });
  }

  /* ── Export CSV ──────────────────────────────────────────────── */
  function exportCSV() {
    const rows = data.rows || [];
    if (!rows.length) return;
    const headers = ['Date/Heure','Utilisateur','ID Utilisateur','Action','Module','Adresse IP','Navigateur','Table cible','ID cible','Détails'];
    const lines = rows.map(r => [
      r.dateAction||'', r.adminUser||'', r.userId||'', r.action||'', r.module||'',
      r.ipAdresse||'', r.navigateur||'', r.table_cible||'', r.id_cible||'', r.details||''
    ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ── Reload ──────────────────────────────────────────────────── */
  async function reload() {
    const wrap = document.querySelector('.aud-tbl-wrap, .aud-empty');
    if (wrap) wrap.style.opacity = '0.5';
    await loadAll();
    render();
  }

  /* ── Init ────────────────────────────────────────────────────── */
  app.innerHTML = '<div class="dash-loading"><div class="dash-spinner"></div></div>';
  await loadAll();
  render();
});
