router.register('dashboard', async () => {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="dash-loading"><div class="dash-spinner"></div></div>`;

  const currentUser = auth.getUser();
  if (currentUser && currentUser.role === 'gestionnaire') {
    return renderGestionnaireDashboard(app, currentUser);
  }
  if (currentUser && currentUser.role === 'adherent') {
    return renderAdherentDashboard(app, currentUser);
  }

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
      { label:'Commission plateforme', val:stats.donsCommission||0, icon:'💼', col:'gold', sub:'reçue sur les dons', isCur:true },
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
          <div class="don-cause">${d.orgLibOrg ? `→ ${d.orgLibOrg}` : (d.message||'Don général — SoliDev')}</div>
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

/* ── Tableau de bord — vue gestionnaire (une seule organisation) ─────────── */
async function renderGestionnaireDashboard(app, user) {
  const fmtDate = (d, opts) => d ? new Date(d).toLocaleDateString('fr-FR', opts||{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const STATUT_BADGE = {
    1: { label: 'Active',     color: '#059669', bg: '#ecfdf5' },
    2: { label: 'Désactivée', color: '#6b7280', bg: '#f3f4f6' },
    3: { label: 'Suspendue',  color: '#d97706', bg: '#fffbeb' },
    4: { label: 'En attente', color: '#2563eb', bg: '#eff6ff' },
    5: { label: 'Clôturée',   color: '#dc2626', bg: '#fef2f2' },
  };

  async function load() {
    app.innerHTML = `<div class="dash-loading"><div class="dash-spinner"></div></div>`;
    try {
      const [org, demStats, pendingDemandes, opportunites, donsData] = await Promise.all([
        user.NumAgr ? api.get(`/organisations/${user.NumAgr}`) : Promise.resolve(null),
        api.get('/demandes/stats').catch(() => ({ pending: 0, total: 0, actif: 0 })),
        api.get('/demandes?statut=' + encodeURIComponent('En attente de validation')).catch(() => []),
        api.get('/opportunites?statut=Active').catch(() => []),
        api.get('/dons').catch(() => ({ dons: [], total: 0, totalOrg: 0 })),
      ]);
      render(org, demStats, pendingDemandes, opportunites, donsData);
    } catch (err) {
      app.innerHTML = `<div class="msg error">${err.message}</div>`;
    }
  }

  function render(org, demStats, pendingDemandes, opportunites, donsData) {
    const statut = org ? (STATUT_BADGE[org.IdStatut] || { label: org.LibStatut || '—', color: '#6b7280', bg: '#f3f4f6' }) : null;

    const demandeRows = (pendingDemandes || []).map((d, i) => `
      <div class="dash-panel" style="margin-bottom:12px;animation-delay:${i*40}ms">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:16px 20px;gap:16px;flex-wrap:wrap">
          <div>
            <div style="font-weight:700;font-size:15px;color:#0f172a">${(d.repPrenom||'')} ${(d.repNom||'—')}</div>
            <div style="font-size:13px;color:#64748b;margin-top:2px">
              ${d.emailOrg ? `✉️ ${d.emailOrg}` : ''} ${d.telOrg ? ` · ☎️ ${d.telOrg}` : ''}
            </div>
            <div style="font-size:13px;color:#64748b;margin-top:2px">
              ${d.ville ? `📍 ${d.ville}` : ''} ${d.fonctionSouhaitee ? ` · Fonction souhaitée : <strong>${d.fonctionSouhaitee}</strong>` : ''}
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px">Demande du ${fmtDate(d.dateDemande)}</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="btn btn-primary" style="padding:8px 16px;font-size:13px" onclick="gestDashAccepter(${d.idDemande})">✅ Accepter</button>
            <button class="btn btn-secondary" style="padding:8px 16px;font-size:13px" onclick="gestDashRefuser(${d.idDemande})">✖️ Refuser</button>
          </div>
        </div>
      </div>`).join('') || `<p class="dt-empty" style="padding:24px">Aucune demande en attente pour le moment.</p>`;

    const oppRows = (opportunites || []).slice(0, 6).map((o, i) => `
      <div class="opp-item" style="animation-delay:${i*40}ms">
        <div class="opp-header">
          <div class="opp-title">${o.titre||'—'}</div>
          <span class="opp-statut opp-active">${o.statut||'—'}</span>
        </div>
        <div class="opp-meta">
          ${o.categorie?`<span class="opp-cat">${o.categorie}</span>`:''}
          ${o.dateLimite?`<span class="opp-deadline">⏰ ${fmtDate(o.dateLimite)}</span>`:''}
          ${o.budget?`<span class="opp-budget">${Number(o.budget).toLocaleString('fr-FR')} FCFA</span>`:''}
        </div>
      </div>`).join('') || '<p class="dt-empty" style="padding:16px 20px">Aucune opportunité active pour le moment.</p>';

    const donRows = (donsData?.dons || []).slice(0, 6).map((d, i) => `
      <div class="don-item" style="animation-delay:${i*40}ms">
        <div class="don-icon">🎁</div>
        <div class="don-info">
          <div class="don-name">${d.anonyme ? 'Donateur anonyme' : (d.nom||'Donateur')}</div>
          <div class="don-cause">${d.message || 'Don reçu'} · commission plateforme ${d.tauxCommission}%</div>
        </div>
        <div class="don-right">
          <div class="don-amount">${Number(d.montantOrg||0).toLocaleString('fr-FR')} <small>FCFA net</small></div>
          <div class="don-date">${fmtDate(d.dateDon)}</div>
        </div>
      </div>`).join('') || '<p class="dt-empty" style="padding:16px 20px">Aucun don reçu pour le moment.</p>';

    app.innerHTML = `
      <div class="dash-welcome">
        <div>
          <div class="dw-greet">${greet}, <strong>${org ? org.LibOrg : user.username}</strong> 👋</div>
          <div class="dw-date">${now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
        <div class="dw-actions">
          ${statut ? `<span class="dw-badge" style="background:${statut.bg};color:${statut.color}">${statut.label}</span>` : ''}
          <div class="dw-live"><span class="dw-live-dot"></span>Données en temps réel</div>
        </div>
      </div>

      <div class="dk-grid dk-grid-6">
        <div class="dk-card dk-green"><div class="dk-header"><div class="dk-icon dk-igreen">👥</div></div><div class="dk-value">${org?.nbAdherents||0}</div><div class="dk-label">Adhérents</div><div class="dk-sub">membres de mon organisation</div></div>
        <div class="dk-card dk-amber"><div class="dk-header"><div class="dk-icon dk-iamber">🤝</div></div><div class="dk-value">${org?.nbBeneficiaires||0}</div><div class="dk-label">Bénéficiaires</div><div class="dk-sub">personnes aidées</div></div>
        <div class="dk-card dk-rose" style="cursor:pointer" onclick="nav('demandes')"><div class="dk-header"><div class="dk-icon dk-irose">📨</div>${demStats.pending>0?'<div class="dk-alert-dot"></div>':''}</div><div class="dk-value">${demStats.pending||0}</div><div class="dk-label">Demandes en attente</div><div class="dk-sub">à traiter</div></div>
        <div class="dk-card dk-teal" style="cursor:pointer" onclick="nav('opportunites')"><div class="dk-header"><div class="dk-icon dk-iteal">🌟</div></div><div class="dk-value">${(opportunites||[]).length}</div><div class="dk-label">Opportunités</div><div class="dk-sub">actives</div></div>
        <div class="dk-card dk-blue" style="cursor:pointer" onclick="nav('paiements')"><div class="dk-header"><div class="dk-icon dk-iblue">💰</div></div><div class="dk-value">${demStats.actif||0}</div><div class="dk-label">Adhésions actives</div><div class="dk-sub">total accepté</div></div>
        <div class="dk-card dk-pink"><div class="dk-header"><div class="dk-icon dk-ipink">🎁</div></div><div class="dk-value">${Number(donsData?.totalOrg||0).toLocaleString('fr-FR')}</div><div class="dk-label">Dons reçus (net)</div><div class="dk-sub">${donsData?.total||0} don${(donsData?.total||0)!==1?'s':''} au total</div></div>
      </div>

      <div class="dash-section-hd">
        <div class="dsh-line"></div>
        <div class="dsh-title">📨 Demandes d'adhésion en attente</div>
        <div class="dsh-line"></div>
      </div>
      <div id="gestDemandesList">${demandeRows}</div>

      <div class="dash-section-hd">
        <div class="dsh-line"></div>
        <div class="dsh-title">🌟 Opportunités qui peuvent vous intéresser</div>
        <div class="dsh-line"></div>
      </div>
      <div class="dash-panel dash-full">
        <div class="dp-head">
          <div><div class="dp-title">Opportunités actives</div><div class="dp-sub">Publiées par l'administration</div></div>
          <button class="dp-btn" onclick="nav('opportunites')">Voir tout →</button>
        </div>
        <div class="opp-list" style="padding:0 4px 12px">${oppRows}</div>
      </div>

      <div class="dash-section-hd">
        <div class="dsh-line"></div>
        <div class="dsh-title">🎁 Dons reçus par mon organisation</div>
        <div class="dsh-line"></div>
      </div>
      <div class="dash-panel dash-full">
        <div class="dp-head">
          <div><div class="dp-title">Derniers dons</div><div class="dp-sub">Montant net après commission plateforme (${(donsData?.dons||[])[0]?.tauxCommission ?? 20}%)</div></div>
        </div>
        <div class="don-list" style="padding:0 4px 12px">${donRows}</div>
      </div>`;
  }

  window.gestDashAccepter = async (id) => {
    if (!confirm('Accepter cette demande d\'adhésion ? Un email avec les identifiants de connexion sera envoyé à l\'adhérent.')) return;
    try {
      await api.put(`/demandes/${id}/accepter`);
      showToast('Demande acceptée', 'success');
      load();
      updatePendingBadge();
    } catch (err) { showToast(err.message, 'error'); }
  };

  window.gestDashRefuser = async (id) => {
    const motif = prompt('Motif du refus (optionnel) :') || '';
    try {
      await api.put(`/demandes/${id}/refuser`, { motif });
      showToast('Demande refusée', 'success');
      load();
      updatePendingBadge();
    } catch (err) { showToast(err.message, 'error'); }
  };

  load();
}

/* ── Tableau de bord — vue adhérent (individu, une seule fiche personnelle) ─────────── */
async function renderAdherentDashboard(app, user) {
  const fmtDate = (d, opts) => d ? new Date(d).toLocaleDateString('fr-FR', opts||{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const fmt = n => Number(n||0).toLocaleString('fr-FR');
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const STATUT_BADGE = {
    1: { label: 'Actif',      color: '#059669', bg: '#ecfdf5' },
    2: { label: 'Désactivé',  color: '#6b7280', bg: '#f3f4f6' },
    3: { label: 'Suspendu',   color: '#d97706', bg: '#fffbeb' },
    4: { label: 'En attente', color: '#2563eb', bg: '#eff6ff' },
    5: { label: 'Résilié',    color: '#dc2626', bg: '#fef2f2' },
  };
  const PAY_STATUT_CLS = {
    'Payé':       { bg:'#ecfdf5', color:'#059669', icon:'✅' },
    'Validé':     { bg:'#ecfdf5', color:'#059669', icon:'✔️' },
    'En attente': { bg:'#fffbeb', color:'#d97706', icon:'⏳' },
    'Impayé':     { bg:'#fef2f2', color:'#dc2626', icon:'❌' },
    'Rejeté':     { bg:'#fef2f2', color:'#dc2626', icon:'🚫' },
    'Remboursé':  { bg:'#f5f3ff', color:'#7c3aed', icon:'↩️' },
  };

  app.innerHTML = `<div class="dash-loading"><div class="dash-spinner"></div></div>`;
  try {
    const [adhRows, mesOrganisations, paiements, beneficiaires, dettes] = await Promise.all([
      api.get('/adherents').catch(() => []),
      api.get('/adherents/mes-organisations').catch(() => []),
      api.get('/paiements').catch(() => []),
      api.get('/beneficiaires').catch(() => []),
      api.get('/dettes').catch(() => []),
    ]);
    const adh = adhRows[0] || null;
    render(adh, mesOrganisations || [], paiements, beneficiaires, dettes);
  } catch (err) {
    app.innerHTML = `<div class="msg error">${err.message}</div>`;
  }

  function render(adh, mesOrganisations, paiements, beneficiaires, dettes) {
    const statut = adh ? (STATUT_BADGE[adh.IdStatut] || { label: '—', color: '#6b7280', bg: '#f3f4f6' }) : null;
    const nomComplet = adh ? [adh.PrenAdh, adh.NomAdh].filter(Boolean).join(' ') : user.username;
    const totalPaye = (paiements||[]).filter(p => p.Statut === 'Payé' || p.Statut === 'Validé')
      .reduce((s,p) => s + Number(p.MontantPaiement||0), 0);
    const topDevise = (paiements||[])[0]?.SymDevise || (paiements||[])[0]?.CodeDevise || 'FCFA';

    const infoRow = (label, val) => `<div class="dem-info-item"><span>${label}</span><strong>${val || '—'}</strong></div>`;

    const paiementRows = (paiements||[]).map((p,i) => `
      <tr style="animation-delay:${i*30}ms">
        <td><span class="dt-org">${p.NumRecu || p.Reference || '#'+p.IdPaiement}</span></td>
        <td>${p.TypePaiement||'—'}</td>
        <td><span class="dt-amount">${fmt(p.MontantPaiement)}<small> ${p.SymDevise||p.CodeDevise||'FCFA'}</small></span></td>
        <td><span class="dt-date">${fmtDate(p.DatePaiement)}</span></td>
        <td>${(() => { const c = PAY_STATUT_CLS[p.Statut]||{bg:'#f3f4f6',color:'#6b7280',icon:'•'};
          return `<span class="pay-st-badge" style="background:${c.bg};color:${c.color}">${c.icon} ${p.Statut||'—'}</span>`; })()}</td>
      </tr>`).join('') || `<tr><td colspan="5" class="dt-empty">Aucun paiement enregistré</td></tr>`;

    const detteRows = (dettes||[]).map((d,i) => {
      const statutAffiche = d.enRetard ? 'En retard' : d.statut;
      const c = statutAffiche === 'Réglée' ? { bg:'#ecfdf5', color:'#059669', icon:'✅' }
              : statutAffiche === 'En retard' ? { bg:'#fef2f2', color:'#dc2626', icon:'⚠️' }
              : { bg:'#fffbeb', color:'#d97706', icon:'⏳' };
      return `
      <tr style="animation-delay:${i*30}ms">
        <td>${d.motif || 'Dette'}</td>
        <td><span class="dt-amount">${fmt(d.montantRestant)}<small> / ${fmt(d.montantDette)}</small></span></td>
        <td>${d.dateEcheance ? fmtDate(d.dateEcheance) : '—'}</td>
        <td><span class="pay-st-badge" style="background:${c.bg};color:${c.color}">${c.icon} ${statutAffiche}</span></td>
      </tr>`;
    }).join('') || `<tr><td colspan="4" class="dt-empty">Aucune dette en cours</td></tr>`;

    window._monAdhId = adh?.idAdh || null;
    window._monAdhProfil = adh || null;
    window._mesBeneficiaires = beneficiaires || [];

    const benefRows = (beneficiaires||[]).map((b,i) => `
      <div class="ra-item" style="animation-delay:${i*40}ms;cursor:pointer" onclick="voirBeneficiaire(${b.idBenef})">
        <div class="ra-avatar">${(b.PrenomBenef||b.NomBenef||'?').charAt(0).toUpperCase()}</div>
        <div class="ra-info">
          <div class="ra-name">${b.PrenomBenef||''} ${b.NomBenef||'—'}</div>
          <div class="ra-org">${b.LienParente||'Bénéficiaire'}${b.TelBenef ? ' · ☎️ '+b.TelBenef : ''}${b.EmailBenef ? ' · ✉️ '+b.EmailBenef : ''}</div>
        </div>
        <button class="dp-btn" onclick="event.stopPropagation();ouvrirCarteBenef(${b.idBenef})">🪪 Carte</button>
      </div>`).join('') || '<p class="dt-empty" style="padding:16px 20px">Aucun bénéficiaire enregistré</p>';

    app.innerHTML = `
      <div class="dash-welcome">
        <div>
          <div class="dw-greet">${greet}, <strong>${nomComplet}</strong> 👋</div>
          <div class="dw-date">${now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
        <div class="dw-actions">
          ${statut ? `<span class="dw-badge" style="background:${statut.bg};color:${statut.color}">${statut.label}</span>` : ''}
          <div class="dw-live"><span class="dw-live-dot"></span>Données en temps réel</div>
        </div>
      </div>

      <div class="dk-grid dk-grid-5">
        <div class="dk-card dk-violet"><div class="dk-header"><div class="dk-icon dk-iviolet">🏢</div></div><div class="dk-value">${mesOrganisations.length}</div><div class="dk-label">Organisation${mesOrganisations.length > 1 ? 's' : ''}</div><div class="dk-sub">${mesOrganisations.length ? (mesOrganisations.length > 1 ? `${mesOrganisations.length} organisations` : mesOrganisations[0].LibOrg) : 'aucune'}</div></div>
        <div class="dk-card dk-amber" style="cursor:pointer" onclick="nav('paiements')"><div class="dk-header"><div class="dk-icon dk-iamber">💰</div></div><div class="dk-value">${(paiements||[]).length}</div><div class="dk-label">Paiements</div><div class="dk-sub">${fmt(totalPaye)} ${topDevise} réglés</div></div>
        <div class="dk-card dk-green"><div class="dk-header"><div class="dk-icon dk-igreen">🤝</div></div><div class="dk-value">${(beneficiaires||[]).length}</div><div class="dk-label">Bénéficiaires</div><div class="dk-sub">déclarés à ma charge</div></div>
      </div>

      <div class="dash-section-hd">
        <div class="dsh-line"></div>
        <div class="dsh-title">👤 Mes informations</div>
        <div class="dsh-line"></div>
      </div>
      <div class="dash-panel dash-full" style="margin-bottom:20px">
        <div class="dp-head">
          <div><div class="dp-title">Profil</div><div class="dp-sub">Informations personnelles enregistrées</div></div>
          <div style="display:flex;gap:8px">
            ${adh ? `<button class="dp-btn" onclick="ouvrirModifierProfilAdh(${adh.idAdh})">✏️ Modifier</button>` : ''}
            ${adh ? `<button class="dp-btn" onclick="ouvrirCarteAdh(${adh.idAdh})">🪪 Voir ma carte</button>` : ''}
          </div>
        </div>
        <div style="padding:20px">
          <div class="dem-info-grid">
            ${infoRow('Email', adh?.EmailAdh)}
            ${infoRow('Téléphone', adh?.TelAdh)}
            ${infoRow('Adresse', adh?.AdrAdh)}
            ${infoRow('Profession', adh?.Profession)}
            ${infoRow('Numéro adhérent', adh?.NumAdherent)}
            ${infoRow("Date d'adhésion", adh?.DateAdhesion ? fmtDate(adh.DateAdhesion) : null)}
          </div>
        </div>
      </div>

      ${mesOrganisations.length ? `
      <div class="dash-section-hd">
        <div class="dsh-line"></div>
        <div class="dsh-title">🏢 Mes organisations</div>
        <div class="dsh-line"></div>
      </div>
      ${mesOrganisations.map(o => `
      <div class="dash-panel dash-full" style="margin-bottom:20px">
        <div class="dp-head">
          <div><div class="dp-title">${o.LibOrg || o.NumAgr}</div><div class="dp-sub">${o.LibTypOrg || 'Organisation'}</div></div>
          ${(() => { const st = STATUT_BADGE[o.IdStatut] || { label: o.LibStatut || '—', color: '#6b7280', bg: '#f3f4f6' };
            return `<span class="dw-badge" style="background:${st.bg};color:${st.color}">${st.label}</span>`; })()}
        </div>
        <div style="padding:20px">
          <div class="dem-info-grid">
            ${infoRow('Mon rôle', o.FonctionAdh)}
            ${infoRow('Pays', o.LibPays)}
            ${infoRow('Email', o.EmailOrg)}
            ${infoRow('Téléphone', o.TelOrg)}
            ${infoRow('Siège', o.SiegeOrg)}
            ${infoRow("Date d'adhésion", o.DateAdhesion ? fmtDate(o.DateAdhesion) : null)}
          </div>
        </div>
      </div>`).join('')}` : ''}

      <div class="dash-section-hd">
        <div class="dsh-line"></div>
        <div class="dsh-title">💰 Mes paiements</div>
        <div class="dsh-line"></div>
      </div>
      <div class="dash-panel dash-full" style="margin-bottom:20px">
        <div class="dt-wrap">
          <table class="dt-table">
            <thead><tr><th>Référence</th><th>Type</th><th>Montant</th><th>Date</th><th>Statut</th></tr></thead>
            <tbody>${paiementRows}</tbody>
          </table>
        </div>
      </div>

      <div class="dash-section-hd">
        <div class="dsh-line"></div>
        <div class="dsh-title">💳 Mes dettes</div>
        <div class="dsh-line"></div>
      </div>
      <div class="dash-panel dash-full" style="margin-bottom:20px">
        <div class="dt-wrap">
          <table class="dt-table">
            <thead><tr><th>Motif</th><th>Restant dû</th><th>Échéance</th><th>Statut</th></tr></thead>
            <tbody>${detteRows}</tbody>
          </table>
        </div>
      </div>

      <div class="dash-section-hd">
        <div class="dsh-line"></div>
        <div class="dsh-title">🤝 Mes bénéficiaires</div>
        <div class="dsh-line"></div>
      </div>
      <div class="dash-panel dash-full">
        <div class="dp-head">
          <div><div class="dp-title">Personnes à ma charge</div><div class="dp-sub">Cliquez sur un bénéficiaire pour voir ses informations</div></div>
          ${adh ? `<button class="dp-btn" onclick="ouvrirAjoutBeneficiaire()">+ Ajouter un bénéficiaire</button>` : ''}
        </div>
        <div class="ra-list">${benefRows}</div>
      </div>`;
  }
}

/* ── Modification du profil adhérent (auto-service, depuis le tableau de bord) ─────────── */
function ouvrirModifierProfilAdh(idAdh) {
  const adh = window._monAdhProfil;
  if (!adh) { showToast('Profil adhérent introuvable', 'error'); return; }

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="editProfilModal">
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <h3>✏️ Modifier mes informations</h3>
          <button class="modal-close" id="closeEditProfilModal">×</button>
        </div>
        <div style="padding:20px">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="epEmail" value="${adh.EmailAdh || ''}">
          </div>
          <div class="form-group">
            <label>Téléphone</label>
            <input type="text" id="epTel" value="${adh.TelAdh || ''}">
          </div>
          <div class="form-group">
            <label>Adresse</label>
            <input type="text" id="epAdresse" value="${adh.AdrAdh || ''}">
          </div>
          <div class="form-group">
            <label>Profession</label>
            <input type="text" id="epProfession" value="${adh.Profession || ''}">
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" id="cancelEditProfilModal">Annuler</button>
            <button class="btn btn-primary" id="saveEditProfilModal">Enregistrer</button>
          </div>
        </div>
      </div>
    </div>`);

  const close = () => document.getElementById('editProfilModal')?.remove();
  document.getElementById('closeEditProfilModal').onclick  = close;
  document.getElementById('cancelEditProfilModal').onclick = close;
  document.getElementById('saveEditProfilModal').onclick = async () => {
    const email = document.getElementById('epEmail').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Email invalide', 'error'); return; }

    try {
      // Le PUT /api/adherents/:id remplace l'intégralité de la fiche — on renvoie donc toutes
      // les valeurs existantes (non éditables ici) en plus des 4 champs modifiables, pour ne pas
      // écraser DateAdhesion, FonctionAdh, DateNaissAdh, etc. avec des null.
      await api.put(`/adherents/${idAdh}`, {
        NomAdh: adh.NomAdh, PrenAdh: adh.PrenAdh,
        DateNaissAdh: adh.DateNaissAdh, LieuNaissAdh: adh.LieuNaissAdh,
        NumAgr: adh.NumAgr, IdRole: adh.IdRole, DateAdhesion: adh.DateAdhesion,
        FonctionAdh: adh.FonctionAdh, Nationalite: adh.Nationalite,
        CodePays: adh.CodePays, NumCNI: adh.NumCNI, Sexe: adh.Sexe,
        EmailAdh: email, TelAdh: document.getElementById('epTel').value.trim(),
        AdrAdh: document.getElementById('epAdresse').value.trim(),
        Profession: document.getElementById('epProfession').value.trim(),
      });
      showToast('Informations mises à jour', 'success');
      close();
      router.navigate('dashboard');
    } catch (e) { showToast(e.message, 'error'); }
  };
}

/* ── Ouverture de la carte officielle (adhérent / bénéficiaire) dans une fenêtre popup ─── */
function ouvrirCarteAdh(idAdh) {
  const token = localStorage.getItem('gpo_token');
  const w = window.open('', '_blank', 'width=620,height=780');
  fetch(`/api/adherents/${idAdh}/carte`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.text())
    .then(html => { w.document.open(); w.document.write(html); w.document.close(); })
    .catch(() => { w.close(); showToast('Erreur lors de la génération de la carte', 'error'); });
}

function ouvrirCarteBenef(idBenef) {
  const token = localStorage.getItem('gpo_token');
  const w = window.open('', '_blank', 'width=620,height=780');
  fetch(`/api/beneficiaires/${idBenef}/carte`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.text())
    .then(html => { w.document.open(); w.document.write(html); w.document.close(); })
    .catch(() => { w.close(); showToast('Erreur lors de la génération de la carte', 'error'); });
}

/* ── Fiche détaillée d'un bénéficiaire (tableau de bord adhérent) ────── */
const BENEF_LIENS      = ['Conjoint(e)', 'Enfant', 'Parent', 'Frère/Sœur', 'Grand-parent', 'Petit-enfant', 'Autre'];
const BENEF_PAYS_CODES = ['BEN','BFA','CIV','MDG','MLI','NGA'];

function voirBeneficiaire(idBenef) {
  const b = (window._mesBeneficiaires || []).find(x => x.idBenef === idBenef);
  if (!b) return;
  const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) : '—';
  const row = (label, val) => `<div class="dem-info-item"><span>${label}</span><strong>${val || '—'}</strong></div>`;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="benefDetailModal">
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <h3>🤝 ${b.PrenomBenef||''} ${b.NomBenef||''}</h3>
          <button class="modal-close" id="closeBenefDetailModal">×</button>
        </div>
        <div style="padding:20px">
          <div class="dem-info-grid">
            ${row('Lien de parenté', b.LienParente)}
            ${row('Date de naissance', fmtDate(b.DateNaissBenef))}
            ${row('Téléphone', b.TelBenef)}
            ${row('Email', b.EmailBenef)}
            ${row('N° CNI / Passeport', b.NumCNI)}
            ${row('Nationalité', b.Nationalite)}
            ${row('N° bénéficiaire', b.NumBenef)}
          </div>
          ${b.Observations ? `<p style="margin-top:14px;color:#475569;font-size:13px;line-height:1.6">${b.Observations}</p>` : ''}
          <div class="form-actions" style="margin-top:16px">
            <button class="btn btn-secondary" id="cancelBenefDetailModal">Fermer</button>
            <button class="btn btn-primary" onclick="ouvrirCarteBenef(${b.idBenef})">🪪 Voir la carte</button>
          </div>
        </div>
      </div>
    </div>`);
  const close = () => document.getElementById('benefDetailModal')?.remove();
  document.getElementById('closeBenefDetailModal').onclick = close;
  document.getElementById('cancelBenefDetailModal').onclick = close;
}

function ouvrirAjoutBeneficiaire() {
  const idAdh = window._monAdhId;
  if (!idAdh) { showToast('Profil adhérent introuvable', 'error'); return; }

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="addBenefModal">
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <h3>+ Ajouter un bénéficiaire</h3>
          <button class="modal-close" id="closeAddBenefModal">×</button>
        </div>
        <div style="padding:20px">
          <div class="form-row">
            <div class="form-group">
              <label>Nom *</label>
              <input type="text" id="abNom" required minlength="2" maxlength="100">
            </div>
            <div class="form-group">
              <label>Prénom(s)</label>
              <input type="text" id="abPrenom">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Lien de parenté</label>
              <select id="abLien">
                ${BENEF_LIENS.map(l => `<option value="${l}">${l}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Date de naissance</label>
              <input type="date" id="abDateNaiss" max="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Téléphone</label>
              <input type="text" id="abTel">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="abEmail">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>N° CNI / Passeport</label>
              <input type="text" id="abCni">
            </div>
            <div class="form-group">
              <label>Pays</label>
              <select id="abPays">
                <option value="">—</option>
                ${BENEF_PAYS_CODES.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Photo (optionnel)</label>
            <input type="file" id="abPhoto" accept=".jpg,.jpeg,.png,.webp">
          </div>
          <div class="form-group">
            <label>Observations</label>
            <textarea id="abObs" rows="2"></textarea>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" id="cancelAddBenefModal">Annuler</button>
            <button class="btn btn-primary" id="saveAddBenefModal">Ajouter</button>
          </div>
        </div>
      </div>
    </div>`);

  const close = () => document.getElementById('addBenefModal')?.remove();
  document.getElementById('closeAddBenefModal').onclick  = close;
  document.getElementById('cancelAddBenefModal').onclick = close;
  document.getElementById('saveAddBenefModal').onclick = async () => {
    const nom = document.getElementById('abNom').value.trim();
    if (!nom || nom.length < 2) { showToast('Le nom est obligatoire (2 caractères min.)', 'error'); return; }

    const fd = new FormData();
    fd.append('idAdh', idAdh);
    fd.append('NomBenef', nom);
    fd.append('PrenomBenef', document.getElementById('abPrenom').value.trim());
    fd.append('LienParente', document.getElementById('abLien').value);
    fd.append('DateNaissBenef', document.getElementById('abDateNaiss').value);
    fd.append('TelBenef', document.getElementById('abTel').value.trim());
    fd.append('EmailBenef', document.getElementById('abEmail').value.trim());
    fd.append('NumCNI', document.getElementById('abCni').value.trim());
    fd.append('CodePays', document.getElementById('abPays').value);
    fd.append('Observations', document.getElementById('abObs').value.trim());
    const photo = document.getElementById('abPhoto').files[0];
    if (photo) fd.append('photo', photo);

    try {
      const token = localStorage.getItem('gpo_token');
      const res  = await fetch('/api/beneficiaires', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Erreur');
      showToast('Bénéficiaire ajouté', 'success');
      close();
      router.navigate('dashboard');
    } catch (e) { showToast(e.message, 'error'); }
  };
}
