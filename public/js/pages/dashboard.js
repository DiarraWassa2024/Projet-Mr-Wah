router.register('dashboard', async () => {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="dash-loading"><div class="dash-spinner"></div></div>`;

  try {
    const [stats, demandesStats, user] = await Promise.all([
      api.get(dateFilter.buildUrl('/ref/dashboard/stats')),
      api.get('/demandes/stats').catch(() => ({ pending:0, total:0 })),
      Promise.resolve(auth.getUser()),
    ]);

    /* ── helpers ─────────────────────────────────────────── */
    const fmt  = n => Number(n||0).toLocaleString('fr-FR');
    const fmtK = n => {
      const v = Number(n||0);
      if (v >= 1e6) return (v/1e6).toFixed(1).replace('.0','') + 'M';
      if (v >= 1e3) return (v/1e3).toFixed(1).replace('.0','') + 'k';
      return fmt(v);
    };
    const fmtDate = (d, opts) => d ? new Date(d).toLocaleDateString('fr-FR', opts||{day:'2-digit',month:'short'}) : '—';
    const now  = new Date();
    const hour = now.getHours();
    const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

    /* ── monthly data ────────────────────────────────────── */
    function last6Months() {
      return Array.from({length:6}, (_,i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        return {
          key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
          label: d.toLocaleString('fr-FR',{month:'short'})
        };
      });
    }
    const months  = last6Months();
    const labels  = months.map(m => m.label);
    const payMap  = Object.fromEntries((stats.monthlyPaiements||[]).map(r => [r.mois, +r.montant]));
    const adhMap  = Object.fromEntries((stats.monthlyAdherents||[]).map(r => [r.mois, +r.nb]));
    const donMap  = Object.fromEntries((stats.monthlyDons||[]).map(r => [r.mois, +r.montant]));
    const payData = months.map(m => payMap[m.key] || 0);
    const adhData = months.map(m => adhMap[m.key] || 0);
    const donData = months.map(m => donMap[m.key] || 0);

    /* ── SVG area chart ──────────────────────────────────── */
    function areaChart(data, c1, c2, id, suffix) {
      suffix = suffix || '';
      const W=420, H=140, pad={t:16,r:10,b:28,l:44};
      const iW=W-pad.l-pad.r, iH=H-pad.t-pad.b;
      const max = Math.max(...data, 1);
      const n = data.length;
      const xs = data.map((_,i) => pad.l + (i/(n-1||1))*iW);
      const ys = data.map(d => pad.t + iH - (d/max)*iH);
      const line = xs.map((x,i) => `${i===0?'M':'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
      const area = line + ` L${xs[n-1].toFixed(1)},${(pad.t+iH).toFixed(1)} L${xs[0].toFixed(1)},${(pad.t+iH).toFixed(1)} Z`;
      const gridLines = Array.from({length:4},(_,i)=>{
        const y = pad.t + iH*(1-i/3);
        const v = (i/3)*max;
        const vf = v>=1000?(v/1000).toFixed(0)+'k':Math.round(v);
        return `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W-pad.r}" y2="${y.toFixed(1)}" stroke="rgba(0,0,0,.04)" stroke-width="1"/>
                <text x="${pad.l-5}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="9" fill="#94a3b8">${vf}</text>`;
      }).join('');
      const xLabels = xs.map((x,i) => `<text x="${x.toFixed(1)}" y="${H-3}" text-anchor="middle" font-size="9" fill="#94a3b8">${labels[i]}</text>`).join('');
      const dots = xs.map((x,i) => `<circle class="chart-dot" cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="3.5" fill="${c1}" stroke="#fff" stroke-width="2" data-val="${fmt(data[i])}${suffix}" data-lbl="${labels[i]}"/>`).join('');
      return `<svg id="${id}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;overflow:visible">
        <defs>
          <linearGradient id="ag${id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${c1}" stop-opacity=".18"/>
            <stop offset="100%" stop-color="${c1}" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="lg${id}" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="100%" stop-color="${c2}"/>
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${area}" fill="url(#ag${id})"/>
        <path id="lp${id}" d="${line}" fill="none" stroke="url(#lg${id})" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${xLabels}${dots}
      </svg>`;
    }

    /* ── SVG donut chart ─────────────────────────────────── */
    function donutChart(segments, id) {
      if (!segments || !segments.length) return '<p class="dt-empty" style="padding:24px">Aucune donnée</p>';
      const R=50, cx=64, cy=64, sw=16;
      const circum = 2*Math.PI*R;
      const total = segments.reduce((s,g) => s+(g.value||0), 0) || 1;
      let offset = 0;
      const arcs = segments.map((seg, i) => {
        const len = (seg.value / total) * circum;
        const gap = 2;
        const adjLen = Math.max(len - gap, 0);
        const dash = `${adjLen.toFixed(2)} ${(circum - adjLen).toFixed(2)}`;
        const arc = `<circle class="donut-seg" r="${R}" cx="${cx}" cy="${cy}"
          fill="none" stroke="${seg.color}" stroke-width="${sw}"
          stroke-dasharray="${dash}"
          stroke-dashoffset="${(-offset + gap/2).toFixed(2)}"
          transform="rotate(-90 ${cx} ${cy})"
          style="transition:stroke-width .2s;cursor:pointer"
          onmouseenter="this.setAttribute('stroke-width','${sw+4}')"
          onmouseleave="this.setAttribute('stroke-width','${sw}')"/>`;
        offset += len;
        return arc;
      }).join('');
      const totalVal = segments.reduce((s,g) => s+(g.value||0), 0);
      const legend = segments.map(seg => `
        <div class="donut-item">
          <span class="donut-dot" style="background:${seg.color}"></span>
          <span class="donut-lbl">${seg.label}</span>
          <span class="donut-pct">${Math.round((seg.value/total)*100)}%</span>
          <span class="donut-nb">${seg.value}</span>
        </div>`).join('');
      return `<div class="donut-wrap">
        <div style="position:relative;flex-shrink:0">
          <svg id="${id}" viewBox="0 0 128 128" style="width:120px;height:120px">
            <circle r="${R}" cx="${cx}" cy="${cy}" fill="none" stroke="#f1f5f9" stroke-width="${sw}"/>
            ${arcs}
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
            <div style="font-size:18px;font-weight:800;color:#0f172a">${totalVal}</div>
            <div style="font-size:9px;color:#94a3b8;letter-spacing:.3px">TOTAL</div>
          </div>
        </div>
        <div class="donut-legend">${legend}</div>
      </div>`;
    }

    /* ── horizontal bar chart ────────────────────────────── */
    function hBarChart(rows, labelKey, valueKey, colors) {
      if (!rows || !rows.length) return '<p class="dt-empty" style="padding:24px">Aucune donnée</p>';
      const max = Math.max(...rows.map(r => +(r[valueKey]||0)), 1);
      return rows.slice(0,7).map((r,i) => `
        <div class="bc-row" style="animation-delay:${i*55}ms">
          <div class="bc-label">${r[labelKey]||'—'}</div>
          <div class="bc-track">
            <div class="bc-fill" data-w="${Math.round(((r[valueKey]||0)/max)*100)}" style="width:0;background:${colors[i%colors.length]}"></div>
          </div>
          <div class="bc-val">${r[valueKey]||0}</div>
        </div>`).join('');
    }

    /* ── KPI cards ───────────────────────────────────────── */
    const devises = stats.paiementsByDevise || [];
    const multiDevise = devises.length > 1;
    // Les montants dans des devises différentes ne peuvent pas être additionnés :
    // on affiche soit le montant dans l'unique devise utilisée, soit le nombre de paiements si plusieurs devises coexistent.
    const paiementsVal  = multiDevise ? (stats.recentPaiements ? devises.reduce((s,d)=>s+d.nb,0) : 0) : (stats.totalPaiements||0);
    const paiementsUnit = multiDevise ? '' : (devises[0]?.symbole || 'F CFA');
    const paiementsSub  = multiDevise
      ? devises.map(d => `${fmtK(d.montant)} ${d.symbole}`).join(' · ')
      : 'collectés';

    const kpis = [
      { label:'Organisations',  val:stats.organisations||0,       icon:'🏢', col:'blue',   sub:'associations actives' },
      { label:'Adhérents',      val:stats.adherents||0,           icon:'👥', col:'violet', sub:'membres enregistrés' },
      { label:'Bénéficiaires',  val:stats.beneficiaires||0,       icon:'🤝', col:'green',  sub:'personnes aidées' },
      { label:'Paiements',      val:paiementsVal,                 icon:'💰', col:'amber',  sub:paiementsSub, isCur:!multiDevise, curUnit:paiementsUnit },
      { label:'Dons reçus',     val:stats.donsTotal||0,           icon:'🎁', col:'pink',   sub:'FCFA de dons',     isCur:true },
      { label:'Prestations',    val:stats.prestations||0,         icon:'🛠️', col:'orange', sub:'services fournis' },
      { label:'Opportunités',   val:stats.opportunitesActives||0, icon:'🌟', col:'teal',   sub:'actives', nav:'opportunites' },
      { label:'Événements',     val:stats.evenements||0,          icon:'📅', col:'indigo', sub:'organisés', nav:'evenements' },
      { label:'Demandes',       val:demandesStats.pending||0,     icon:'📨', col:'rose',   sub:'en attente', nav:'demandes' },
      { label:'Cotisations',    val:stats.cotisationsNb||0,       icon:'📋', col:'sky',    sub:'enregistrées', nav:'paiements' },
    ];

    const kpiHTML = kpis.map((k,i) => `
      <div class="dk-card dk-${k.col}" style="animation-delay:${i*45}ms${k.nav?';cursor:pointer':''}"
           ${k.nav ? `onclick="nav('${k.nav}')"` : ''}>
        <div class="dk-header">
          <div class="dk-icon dk-i${k.col}">${k.icon}</div>
          ${k.nav && k.val > 0 ? `<div class="dk-alert-dot"></div>` : ''}
        </div>
        <div class="dk-value" data-target="${k.val}" data-cur="${!!k.isCur}">0</div>
        ${k.isCur ? `<div class="dk-unit">${k.curUnit || 'FCFA'}</div>` : ''}
        <div class="dk-label">${k.label}</div>
        <div class="dk-sub">${k.sub}</div>
        <div class="dk-bar"><div class="dk-bar-fill dk-fill-${k.col}" style="width:0"></div></div>
      </div>`).join('');

    /* ── donut segments ──────────────────────────────────── */
    const paysColors = ['#6366f1','#3b82f6','#10b981','#f59e0b','#f97316','#8b5cf6'];
    const paysSegs = (stats.orgsByPays||[]).filter(r=>+r.total>0).slice(0,6)
      .map((r,i) => ({label:r.LibPays, value:+r.total, color:paysColors[i]}));

    const oppStatutColors = { 'Active':'#10b981', 'Clôturée':'#6366f1', 'Annulée':'#ef4444' };
    const oppSegs = (stats.oppsByStatut||[]).filter(s=>+s.nb>0)
      .map(s => ({label:s.statut, value:+s.nb, color:oppStatutColors[s.statut]||'#94a3b8'}));

    /* ── recent payments table ───────────────────────────── */
    const payRows = (stats.recentPaiements||[]).map((p,i) => `
      <tr style="animation-delay:${i*30}ms">
        <td>
          <div class="dt-who">
            <div class="dt-avatar">${(p.NomAdh||p.LibOrg||'?').charAt(0).toUpperCase()}</div>
            <div>
              <div class="dt-name">${p.NomAdh||p.LibOrg||'—'}</div>
              ${p.LibOrg && p.NomAdh ? `<div class="dt-org">${p.LibOrg}</div>` : ''}
            </div>
          </div>
        </td>
        <td><span class="dt-amount">${fmt(p.MontantPaiement)}<small> ${p.DeviseSymbole || 'F CFA'}</small></span></td>
        <td><span class="dt-date">${fmtDate(p.DatePaiement,{day:'2-digit',month:'short',year:'numeric'})}</span></td>
        <td><span class="dt-status ${p.Statut==='Validé'?'st-ok':'st-pend'}">${p.Statut||'—'}</span></td>
      </tr>`).join('') || `<tr><td colspan="4" class="dt-empty">Aucun paiement enregistré</td></tr>`;

    /* ── recent adherents ────────────────────────────────── */
    const adhRows = (stats.recentAdherents||[]).map((a,i) => `
      <div class="ra-item" style="animation-delay:${i*40}ms">
        <div class="ra-avatar">${(a.NomAdh||'?').charAt(0).toUpperCase()}</div>
        <div class="ra-info">
          <div class="ra-name">${a.PrenAdh||''} ${a.NomAdh||'—'}</div>
          <div class="ra-org">${a.LibOrg||'Sans organisation'}</div>
        </div>
        <div class="ra-date">${fmtDate(a.DateAdhesion)}</div>
      </div>`).join('') || '<p class="dt-empty" style="padding:16px 20px">Aucun adhérent récent</p>';

    /* ── top orgs ────────────────────────────────────────── */
    const topOrgColors = ['#3b82f6','#6366f1','#10b981','#f59e0b','#f97316'];
    const topOrgHTML = (stats.topOrgs||[]).map((o,i) => `
      <div class="to-row">
        <div class="to-rank" style="background:${topOrgColors[i]}">${i+1}</div>
        <div class="to-info">
          <div class="to-name">${o.LibOrg||'—'}</div>
          <div class="to-meta">${o.nbPaiements} paiement${+o.nbPaiements!==1?'s':''}</div>
        </div>
        <div class="to-total">${fmtK(o.total)}<small> FCFA</small></div>
      </div>`).join('') || '<p class="dt-empty" style="padding:16px 20px">Aucune donnée</p>';

    /* ── recent dons ─────────────────────────────────────── */
    const donRows = (stats.recentDons||[]).map((d,i) => `
      <div class="don-item" style="animation-delay:${i*40}ms">
        <div class="don-icon">🎁</div>
        <div class="don-info">
          <div class="don-name">${d.anonyme ? 'Donateur anonyme' : (d.nom||'Donateur')}</div>
          <div class="don-cause">${d.cause||d.message||'Don général'}</div>
        </div>
        <div class="don-right">
          <div class="don-amount">${fmt(d.montant)} <small>FCFA</small></div>
          <div class="don-date">${fmtDate(d.dateDon)}</div>
        </div>
      </div>`).join('') || '<p class="dt-empty" style="padding:16px 20px">Aucun don enregistré</p>';

    /* ── recent opportunités ─────────────────────────────── */
    const oppRows = (stats.recentOpportunites||[]).map((o,i) => `
      <div class="opp-item" style="animation-delay:${i*40}ms">
        <div class="opp-header">
          <div class="opp-title">${o.titre||'—'}</div>
          <span class="opp-statut ${o.statut==='Active'?'opp-active':o.statut==='Clôturée'?'opp-closed':'opp-annul'}">${o.statut||'—'}</span>
        </div>
        <div class="opp-meta">
          ${o.categorie?`<span class="opp-cat">${o.categorie}</span>`:''}
          ${o.dateLimite?`<span class="opp-deadline">⏰ ${fmtDate(o.dateLimite,{day:'2-digit',month:'short',year:'numeric'})}</span>`:''}
          ${o.budget?`<span class="opp-budget">${fmtK(o.budget)} FCFA</span>`:''}
        </div>
      </div>`).join('') || '<p class="dt-empty" style="padding:16px 20px">Aucune opportunité publiée</p>';

    /* ── adhérents par pays bar chart colors ─────────────── */
    const adhPaysColors = ['#10b981','#6366f1','#3b82f6','#f59e0b','#f97316','#8b5cf6','#ec4899','#14b8a6'];

    /* ── summary stats row ───────────────────────────────── */
    const donsVariation = stats.donsNb > 0 ? '+' + stats.donsNb + ' don' + (stats.donsNb>1?'s':'') : 'Aucun don';
    const oppActPct = stats.opportunitesTotal > 0 ? Math.round((stats.opportunitesActives/stats.opportunitesTotal)*100) : 0;

    /* ── render ──────────────────────────────────────────── */
    app.innerHTML = `
      ${dateFilter.renderBar()}

      <!-- Welcome -->
      <div class="dash-welcome">
        <div>
          <div class="dw-greet">${greet}, <strong>${user.username}</strong> 👋</div>
          <div class="dw-date">${now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
        <div class="dw-actions">
          <span class="dw-badge">${user.role}</span>
          <div class="dw-live"><span class="dw-live-dot"></span>Données en temps réel</div>
        </div>
      </div>

      <!-- KPI grid 5×2 -->
      <div class="dk-grid dk-grid-5">${kpiHTML}</div>

      <!-- Summary stat strip -->
      <div class="dash-strip">
        <div class="strip-item">
          <span class="strip-icon" style="background:rgba(99,102,241,.1)">📊</span>
          <div><div class="strip-val">${fmt(stats.cotisationsMontant||0)} FCFA</div><div class="strip-lbl">Total cotisations</div></div>
        </div>
        <div class="strip-sep"></div>
        <div class="strip-item">
          <span class="strip-icon" style="background:rgba(236,72,153,.1)">🎁</span>
          <div><div class="strip-val">${donsVariation}</div><div class="strip-lbl">sur la période</div></div>
        </div>
        <div class="strip-sep"></div>
        <div class="strip-item">
          <span class="strip-icon" style="background:rgba(20,184,166,.1)">🌟</span>
          <div><div class="strip-val">${oppActPct}% actives</div><div class="strip-lbl">${stats.opportunitesTotal||0} opportunités total</div></div>
        </div>
        <div class="strip-sep"></div>
        <div class="strip-item">
          <span class="strip-icon" style="background:rgba(59,130,246,.1)">🏢</span>
          <div><div class="strip-val">${(stats.orgsByPays||[]).length} pays</div><div class="strip-lbl">couverts par les organisations</div></div>
        </div>
      </div>

      <!-- Section: Évolution temporelle -->
      <div class="dash-section-hd">
        <div class="dsh-line"></div>
        <div class="dsh-title">Évolution temporelle · 6 derniers mois</div>
        <div class="dsh-line"></div>
      </div>
      <div class="dash-charts-3">
        <div class="dash-panel">
          <div class="dp-head">
            <div>
              <div class="dp-title">💰 Paiements</div>
              <div class="dp-sub">Montants collectés${multiDevise ? '' : ' (' + (devises[0]?.symbole || 'FCFA') + ')'}</div>
            </div>
            <div class="dp-chip dp-chip-blue">${multiDevise ? paiementsSub : fmtK(stats.totalPaiements||0) + ' ' + (devises[0]?.symbole || 'FCFA')}</div>
          </div>
          <div class="dp-chart">${areaChart(payData,'#3b82f6','#6366f1','payChart',' FCFA')}</div>
        </div>
        <div class="dash-panel">
          <div class="dp-head">
            <div>
              <div class="dp-title">👥 Adhérents</div>
              <div class="dp-sub">Nouvelles inscriptions</div>
            </div>
            <div class="dp-chip dp-chip-green">${stats.adherents||0} membres</div>
          </div>
          <div class="dp-chart">${areaChart(adhData,'#10b981','#059669','adhChart','')}</div>
        </div>
        <div class="dash-panel">
          <div class="dp-head">
            <div>
              <div class="dp-title">🎁 Dons</div>
              <div class="dp-sub">Montants reçus (FCFA)</div>
            </div>
            <div class="dp-chip dp-chip-pink">${fmtK(stats.donsTotal||0)} FCFA</div>
          </div>
          <div class="dp-chart">${areaChart(donData,'#ec4899','#8b5cf6','donChart',' FCFA')}</div>
        </div>
      </div>

      <!-- Section: Répartition géographique -->
      <div class="dash-section-hd">
        <div class="dsh-line"></div>
        <div class="dsh-title">Répartition géographique</div>
        <div class="dsh-line"></div>
      </div>
      <div class="dash-charts-3">
        <div class="dash-panel">
          <div class="dp-head">
            <div><div class="dp-title">🌍 Organisations par pays</div><div class="dp-sub">Répartition en donut</div></div>
          </div>
          <div style="padding:0 20px 20px">${donutChart(paysSegs,'paysDonut')}</div>
        </div>
        <div class="dash-panel">
          <div class="dp-head">
            <div><div class="dp-title">👥 Adhérents par pays</div><div class="dp-sub">Distribution des membres</div></div>
          </div>
          <div class="dp-bars">${hBarChart(stats.adherentsByPays||[],'LibPays','nb',adhPaysColors)}</div>
        </div>
        <div class="dash-panel">
          <div class="dp-head">
            <div><div class="dp-title">🌟 Opportunités par statut</div><div class="dp-sub">Répartition</div></div>
            <button class="dp-btn" onclick="nav('opportunites')">Voir →</button>
          </div>
          <div style="padding:0 20px 20px">${donutChart(oppSegs,'oppDonut')}</div>
        </div>
      </div>

      <!-- Section: Performances -->
      <div class="dash-section-hd">
        <div class="dsh-line"></div>
        <div class="dsh-title">Performances & Classements</div>
        <div class="dsh-line"></div>
      </div>
      <div class="dash-row-2">
        <div class="dash-panel">
          <div class="dp-head">
            <div><div class="dp-title">🏆 Top organisations</div><div class="dp-sub">Par volume de paiements</div></div>
          </div>
          <div class="to-list">${topOrgHTML}</div>
        </div>
        <div class="dash-panel">
          <div class="dp-head">
            <div><div class="dp-title">🗺️ Distribution géographique</div><div class="dp-sub">Organisations par pays</div></div>
          </div>
          <div class="dp-bars">${hBarChart(stats.orgsByPays||[],'LibPays','total',paysColors)}</div>
        </div>
      </div>

      <!-- Section: Activité récente -->
      <div class="dash-section-hd">
        <div class="dsh-line"></div>
        <div class="dsh-title">Activité récente</div>
        <div class="dsh-line"></div>
      </div>
      <div class="dash-panel dash-full">
        <div class="dp-head">
          <div><div class="dp-title">💳 Paiements récents</div><div class="dp-sub">Dernières transactions enregistrées</div></div>
          <button class="dp-btn" onclick="nav('paiements')">Voir tout →</button>
        </div>
        <div class="dt-wrap">
          <table class="dt-table">
            <thead><tr><th>Membre / Organisation</th><th>Montant</th><th>Date</th><th>Statut</th></tr></thead>
            <tbody>${payRows}</tbody>
          </table>
        </div>
      </div>

      <!-- Activity 3-col -->
      <div class="dash-activity-row">
        <div class="dash-panel">
          <div class="dp-head">
            <div><div class="dp-title">👤 Nouveaux adhérents</div><div class="dp-sub">Inscrits récemment</div></div>
            <button class="dp-btn" onclick="nav('adherents')">Voir →</button>
          </div>
          <div class="ra-list">${adhRows}</div>
        </div>
        <div class="dash-panel">
          <div class="dp-head">
            <div><div class="dp-title">🎁 Dons récents</div><div class="dp-sub">Dernières contributions</div></div>
            <button class="dp-btn" onclick="nav('paiements')">Voir →</button>
          </div>
          <div class="don-list">${donRows}</div>
        </div>
        <div class="dash-panel">
          <div class="dp-head">
            <div><div class="dp-title">🌟 Opportunités récentes</div><div class="dp-sub">Dernières publiées</div></div>
            <button class="dp-btn" onclick="nav('opportunites')">Voir →</button>
          </div>
          <div class="opp-list">${oppRows}</div>
        </div>
      </div>`;

    /* ── post-render animations ──────────────────────────── */
    dateFilter.initBar(async () => {
      app.innerHTML = `<div class="dash-loading"><div class="dash-spinner"></div></div>`;
      router.navigate('dashboard');
    });

    // Count-up animation
    document.querySelectorAll('.dk-value').forEach(el => {
      const target = +el.dataset.target;
      const dur = 1200;
      const start = performance.now();
      function tick(t) {
        const p = Math.min((t-start)/dur, 1);
        const ease = 1 - Math.pow(1-p, 3);
        el.textContent = fmt(Math.round(ease*target));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });

    // KPI bar fill
    document.querySelectorAll('.dk-bar-fill').forEach((el, i) => {
      setTimeout(() => {
        el.style.transition = 'width 1s cubic-bezier(.4,0,.2,1)';
        el.style.width = '62%';
      }, i * 45 + 350);
    });

    // SVG path draw animation
    ['payChart','adhChart','donChart'].forEach(id => {
      const lp = document.getElementById('lp' + id);
      if (lp) {
        const len = lp.getTotalLength ? lp.getTotalLength() : 400;
        lp.style.strokeDasharray = len;
        lp.style.strokeDashoffset = len;
        lp.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)';
        setTimeout(() => { lp.style.strokeDashoffset = 0; }, 80);
      }
    });

    // Bar chart animate
    document.querySelectorAll('.bc-fill').forEach((el, i) => {
      const w = el.dataset.w + '%';
      setTimeout(() => {
        el.style.transition = 'width .7s cubic-bezier(.4,0,.2,1)';
        el.style.width = w;
      }, i * 60 + 350);
    });

    // Donut animate
    document.querySelectorAll('.donut-seg').forEach((seg, i) => {
      const parts = seg.getAttribute('stroke-dasharray').split(' ');
      const filled = parseFloat(parts[0]);
      const total  = filled + parseFloat(parts[1]);
      seg.style.strokeDashoffset = total;
      setTimeout(() => {
        seg.style.transition = `stroke-dashoffset 1s cubic-bezier(.4,0,.2,1) ${i*120}ms`;
        seg.style.strokeDashoffset = seg.getAttribute('stroke-dashoffset');
      }, 200);
    });

    // Chart dot tooltips
    document.querySelectorAll('.chart-dot').forEach(dot => {
      dot.style.cursor = 'crosshair';
      dot.addEventListener('mouseenter', () => {
        const tip = document.createElement('div');
        tip.className = 'chart-tip';
        tip.textContent = `${dot.dataset.lbl} : ${dot.dataset.val}`;
        document.body.appendChild(tip);
        const r = dot.getBoundingClientRect();
        tip.style.left = r.left + r.width/2 - tip.offsetWidth/2 + 'px';
        tip.style.top  = r.top - 40 + window.scrollY + 'px';
        dot._tip = tip;
      });
      dot.addEventListener('mouseleave', () => { dot._tip?.remove(); dot._tip = null; });
    });

  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="msg error">${err.message}</div>`;
  }
});
