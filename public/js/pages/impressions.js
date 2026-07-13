// ================================================================
// Module Impressions — cartes, fiches, listes, QR, PDF, Excel
// ================================================================

// ── Constantes ───────────────────────────────────────────────────
const IMP_TYPES = [
  { key:'carte-adh',    icon:'🪪',  label:'Cartes Adhérents',    cat:'adh'  },
  { key:'carte-ben',    icon:'💳',  label:'Cartes Bénéficiaires', cat:'ben'  },
  { key:'fiche-adh',    icon:'📋',  label:'Fiches Adhérents',     cat:'adh'  },
  { key:'fiche-ben',    icon:'📋',  label:'Fiches Bénéficiaires', cat:'ben'  },
  { key:'liste-adh',    icon:'📄',  label:'Liste Adhérents',      cat:'adh'  },
  { key:'liste-ben',    icon:'📄',  label:'Liste Bénéficiaires',  cat:'ben'  },
  { key:'liste-fiches', icon:'📑',  label:'Liste + Fiches',       cat:'both' },
  { key:'qr-adh',       icon:'⬛', label:'QR Codes Adhérents',   cat:'adh'  },
  { key:'qr-ben',       icon:'⬛', label:'QR Codes Bénéficiaires',cat:'ben'  },
];

const ORG_COLORS = {
  'Association': { from:'#1e40af', to:'#3b82f6', text:'#fff', badge:'#dbeafe', badgeText:'#1e40af' },
  'ONG':         { from:'#065f46', to:'#10b981', text:'#fff', badge:'#d1fae5', badgeText:'#065f46' },
  'Mutuelle':    { from:'#92400e', to:'#f59e0b', text:'#fff', badge:'#fef3c7', badgeText:'#92400e' },
  'default':     { from:'#312e81', to:'#818cf8', text:'#fff', badge:'#e0e7ff', badgeText:'#312e81' },
};

// ── State ─────────────────────────────────────────────────────────
let impState = {
  type:      'carte-adh',
  orgFilter: '',
  search:    '',
  statutFilter: '',
  selected:  new Set(),
  selectAll: true,
  data:      [],
  loading:   false,
  orgs:      [],
};

// ── Route ─────────────────────────────────────────────────────────
router.register('impressions', async () => {
  document.getElementById('app').innerHTML = '<div class="imp-page" id="impPage"></div>';
  await loadOrgs();
  renderImp();
  await loadData();
});

// ── Render principal ──────────────────────────────────────────────
function renderImp() {
  const page = document.getElementById('impPage');
  if (!page) return;

  const t = IMP_TYPES.find(t => t.key === impState.type) || IMP_TYPES[0];

  page.innerHTML = `
  <div class="imp-layout">

    <!-- SIDEBAR -->
    <aside class="imp-sidebar">
      <div class="imp-sidebar-title">
        <span>🖨️</span><span>Impressions</span>
      </div>
      <div class="imp-sidebar-section">Cartes</div>
      ${IMP_TYPES.slice(0,2).map(renderSidebarItem).join('')}
      <div class="imp-sidebar-section">Fiches</div>
      ${IMP_TYPES.slice(2,4).map(renderSidebarItem).join('')}
      <div class="imp-sidebar-section">Listes</div>
      ${IMP_TYPES.slice(4,7).map(renderSidebarItem).join('')}
      <div class="imp-sidebar-section">QR Codes</div>
      ${IMP_TYPES.slice(7,9).map(renderSidebarItem).join('')}
    </aside>

    <!-- MAIN -->
    <div class="imp-main">

      <!-- HEADER -->
      <div class="imp-header">
        <div class="imp-header-left">
          <div class="imp-header-icon">${t.icon}</div>
          <div>
            <h2 class="imp-header-title">${t.label}</h2>
            <p class="imp-header-sub">
              ${impState.data.length} enregistrement${impState.data.length !== 1 ? 's' : ''} ·
              ${impState.selected.size || impState.data.length} sélectionné${(impState.selected.size || impState.data.length) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div class="imp-actions">
          ${['liste-adh','liste-ben','liste-fiches'].includes(impState.type) ? `
          <button class="imp-btn imp-btn-green" onclick="exportExcel()">
            📊 Excel
          </button>
          <button class="imp-btn imp-btn-gray" onclick="exportCSV()">
            ⬇️ CSV
          </button>
          ` : ''}
          <button class="imp-btn imp-btn-blue" onclick="openPDF()">
            📄 PDF
          </button>
          <button class="imp-btn imp-btn-primary" onclick="printNow()">
            🖨️ Imprimer
          </button>
        </div>
      </div>

      <!-- FILTRES -->
      <div class="imp-filters">
        <div class="imp-filter-left">
          <div class="imp-search-wrap">
            <span class="imp-search-ico">🔍</span>
            <input class="imp-search" id="impSearch" placeholder="Rechercher…"
                   value="${impState.search}" oninput="impDebounceSearch(this.value)">
          </div>
          <select class="imp-select" id="impOrgFilter" onchange="impFilter('org', this.value)">
            <option value="">Toutes les organisations</option>
            ${impState.orgs.map(o => `
              <option value="${o.NumAgr}" ${o.NumAgr === impState.orgFilter ? 'selected' : ''}>
                ${o.LibOrg}
              </option>`).join('')}
          </select>
          <select class="imp-select" onchange="impFilter('statut', this.value)">
            <option value="">Tous les statuts</option>
            <option value="1" ${impState.statutFilter==='1'?'selected':''}>Actif</option>
            <option value="2" ${impState.statutFilter==='2'?'selected':''}>Inactif</option>
            <option value="3" ${impState.statutFilter==='3'?'selected':''}>Suspendu</option>
          </select>
          <button class="imp-clear-btn" onclick="clearImpFilters()">✕ Réinitialiser</button>
        </div>
        <div class="imp-filter-right">
          <label class="imp-select-all">
            <input type="checkbox" id="impSelectAll"
                   ${impState.selectAll ? 'checked' : ''}
                   onchange="toggleSelectAll(this.checked)">
            <span>Tout sélectionner</span>
          </label>
        </div>
      </div>

      <!-- PRINT PREVIEW ZONE -->
      <div class="imp-preview-wrap">
        ${impState.loading
          ? '<div class="imp-loading"><div class="imp-spinner"></div> Chargement…</div>'
          : renderPreview()
        }
      </div>

    </div>
  </div>`;
}

function renderSidebarItem(t) {
  const active = t.key === impState.type;
  return `
    <button class="imp-sidebar-item${active ? ' active' : ''}" onclick="switchType('${t.key}')">
      <span class="imp-sidebar-ico">${t.icon}</span>
      <span>${t.label}</span>
    </button>`;
}

// ── Preview router ─────────────────────────────────────────────
function renderPreview() {
  const d = impState.selectAll
    ? impState.data
    : impState.data.filter(r => impState.selected.has(String(r.idAdh || r.idBenef)));

  if (!d.length) return '<div class="imp-empty">Aucune donnée à afficher</div>';

  switch (impState.type) {
    case 'carte-adh':    return renderCartes(d, 'adh');
    case 'carte-ben':    return renderCartes(d, 'ben');
    case 'fiche-adh':    return renderFiches(d, 'adh');
    case 'fiche-ben':    return renderFiches(d, 'ben');
    case 'liste-adh':    return renderListe(d, 'adh');
    case 'liste-ben':    return renderListe(d, 'ben');
    case 'liste-fiches': return renderListeFiches(d);
    case 'qr-adh':       return renderQRGrid(d, 'adh');
    case 'qr-ben':       return renderQRGrid(d, 'ben');
    default:             return '';
  }
}

// ================================================================
// CARTES (85.6 × 54 mm — format ISO ID-1)
// ================================================================
function renderCartes(data, type) {
  const cards = data.map(r => renderCard(r, type)).join('');
  return `
    <div class="imp-print-zone imp-cards-zone" id="impPrintZone">
      <div class="imp-page-header-print">
        <div>Cartes ${type === 'adh' ? 'Adhérents' : 'Bénéficiaires'} — SoliDev</div>
        <div>${new Date().toLocaleDateString('fr-FR')}</div>
      </div>
      <div class="imp-cards-grid">
        ${cards}
      </div>
    </div>`;
}

function renderCard(r, type) {
  const isAdh = type === 'adh';
  const nom    = isAdh ? r.NomAdh       : r.NomBenef;
  const prenom = isAdh ? r.PrenAdh      : r.PrenomBenef;
  const num    = isAdh ? r.NumAdherent  : r.NumBenef;
  const org    = r.LibOrg || 'SoliDev';
  const statut = r.LibStatut || 'Actif';
  const orgType = r.TypeOrg ? r.TypeOrg : r.LibOrg?.includes('ONG') ? 'ONG' : r.LibOrg?.includes('Mutuelle') ? 'Mutuelle' : 'Association';
  const col = ORG_COLORS[orgType] || ORG_COLORS.default;
  const initials = `${(nom||'?')[0]}${(prenom||'')[0]||''}`.toUpperCase();
  const photo = isAdh && r.Photo ? `/uploads/adherents/photos/${r.Photo}` : null;
  const dateStr = r.DateAdhesion ? new Date(r.DateAdhesion).toLocaleDateString('fr-FR',{month:'2-digit',year:'2-digit'}) : '--/--';
  const validity = r.DateAdhesion
    ? new Date(new Date(r.DateAdhesion).setFullYear(new Date(r.DateAdhesion).getFullYear()+1))
        .toLocaleDateString('fr-FR',{month:'2-digit',year:'2-digit'})
    : '--/--';

  const idKey = isAdh ? r.idAdh : r.idBenef;

  return `
  <div class="imp-card-wrap">
    <div class="imp-card" data-id="${idKey}">

      <!-- RECTO -->
      <div class="imp-card-face imp-card-front"
           style="background:linear-gradient(135deg,${col.from},${col.to})">

        <!-- Bandeau -->
        <div class="imp-card-band">
          <img src="/images/logo.svg" class="imp-card-logo" alt="SoliDev">
          <div class="imp-card-org">${escH(org)}</div>
          <div class="imp-card-type-badge" style="background:rgba(255,255,255,.2)">
            ${isAdh ? 'ADHÉRENT' : 'BÉNÉFICIAIRE'}
          </div>
        </div>

        <!-- Corps -->
        <div class="imp-card-body">
          <div class="imp-card-photo">
            ${photo
              ? `<img src="${photo}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                 <div class="imp-card-initials" style="display:none">${initials}</div>`
              : `<div class="imp-card-initials">${initials}</div>`
            }
          </div>
          <div class="imp-card-info">
            <div class="imp-card-name">${escH(nom)} ${escH(prenom)}</div>
            <div class="imp-card-num">${escH(num||'—')}</div>
            <div class="imp-card-statut" style="background:${col.badge};color:${col.badgeText}">
              ${escH(statut)}
            </div>
            <div class="imp-card-date">Depuis ${dateStr}</div>
          </div>
        </div>

        <!-- Pied -->
        <div class="imp-card-footer">
          <div class="imp-card-validity">Valide jusqu'au ${validity}</div>
          <div class="imp-card-qr-mini" id="qrMini_${type}_${idKey}">
            <div class="imp-qr-loading">⬛</div>
          </div>
        </div>
      </div>

      <!-- VERSO -->
      <div class="imp-card-face imp-card-back">
        <div class="imp-card-back-band" style="background:${col.from}">
          <div class="imp-card-back-stripe"></div>
        </div>
        <div class="imp-card-back-body">
          <div class="imp-card-back-logo">
            <img src="/images/logo.svg" class="imp-card-back-sd" alt="SoliDev">
            <div>
              <div class="imp-card-back-title">SoliDev</div>
              <div class="imp-card-back-sub">Solidarité &amp; Développement</div>
            </div>
          </div>
          <div class="imp-card-back-info">
            <div class="imp-card-back-row"><span>N°</span><strong>${escH(num||'—')}</strong></div>
            <div class="imp-card-back-row"><span>Org</span><strong>${escH(org)}</strong></div>
            ${isAdh && r.EmailAdh ? `<div class="imp-card-back-row"><span>Email</span><strong>${escH(r.EmailAdh)}</strong></div>` : ''}
            ${isAdh && r.TelAdh ? `<div class="imp-card-back-row"><span>Tél.</span><strong>${escH(r.TelAdh)}</strong></div>` : ''}
            ${!isAdh && r.LienParente ? `<div class="imp-card-back-row"><span>Lien</span><strong>${escH(r.LienParente)}</strong></div>` : ''}
            <div class="imp-card-back-row"><span>Statut</span><strong>${escH(statut)}</strong></div>
          </div>
        </div>
        <div class="imp-card-back-footer">
          <div class="imp-card-back-barcode">${escH(num||'—')}</div>
          <div style="font-size:7px;color:#94a3b8">En cas de perte, contacter votre organisation</div>
        </div>
      </div>
    </div>
    <!-- Checkbox sélection -->
    <label class="imp-card-select" onclick="event.stopPropagation()">
      <input type="checkbox" ${impState.selectAll || impState.selected.has(String(idKey)) ? 'checked' : ''}
             onchange="toggleOne('${idKey}', this.checked)">
    </label>
  </div>`;
}

// ================================================================
// FICHES (format A4)
// ================================================================
function renderFiches(data, type) {
  return `
    <div class="imp-print-zone" id="impPrintZone">
      ${data.map((r, i) => renderFiche(r, type, i)).join('<div class="imp-page-break"></div>')}
    </div>`;
}

function renderFiche(r, type, idx) {
  const isAdh  = type === 'adh';
  const nom    = isAdh ? r.NomAdh       : r.NomBenef;
  const prenom = isAdh ? r.PrenAdh      : r.PrenomBenef;
  const num    = isAdh ? r.NumAdherent  : r.NumBenef;
  const org    = r.LibOrg || 'SoliDev';
  const initials = `${(nom||'?')[0]}${(prenom||'')[0]||''}`.toUpperCase();
  const photo = isAdh && r.Photo ? `/uploads/adherents/photos/${r.Photo}` : null;
  const col = ORG_COLORS['Association'];
  const idKey = isAdh ? r.idAdh : r.idBenef;

  const dateNaiss = isAdh
    ? (r.DateNaissAdh ? new Date(r.DateNaissAdh).toLocaleDateString('fr-FR') : '—')
    : (r.DateNaissBenef ? new Date(r.DateNaissBenef).toLocaleDateString('fr-FR') : '—');

  const paiements = r.paiements || [];

  return `
  <div class="imp-fiche">

    <!-- EN-TÊTE -->
    <div class="imp-fiche-header" style="background:linear-gradient(135deg,${col.from},${col.to})">
      <div class="imp-fiche-header-left">
        <img src="/images/logo.svg" class="imp-fiche-logo" alt="SoliDev">
        <div>
          <div class="imp-fiche-header-title">SoliDev</div>
          <div class="imp-fiche-header-sub">Solidarité &amp; Développement</div>
          <div class="imp-fiche-header-org">${escH(org)}</div>
        </div>
      </div>
      <div class="imp-fiche-header-right">
        <div class="imp-fiche-type-label">${isAdh ? 'FICHE ADHÉRENT' : 'FICHE BÉNÉFICIAIRE'}</div>
        <div class="imp-fiche-num">${escH(num || '—')}</div>
        <div class="imp-fiche-date-print">Imprimé le ${new Date().toLocaleDateString('fr-FR')}</div>
      </div>
    </div>

    <!-- CORPS PRINCIPAL -->
    <div class="imp-fiche-body">

      <!-- SECTION IDENTITÉ -->
      <div class="imp-fiche-section">
        <div class="imp-fiche-section-title">Informations personnelles</div>
        <div class="imp-fiche-identity">

          <div class="imp-fiche-photo-wrap">
            ${photo
              ? `<img src="${photo}" class="imp-fiche-photo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                 <div class="imp-fiche-initials" style="display:none;background:${col.from}">${initials}</div>`
              : `<div class="imp-fiche-initials" style="background:${col.from}">${initials}</div>`
            }
            <div class="imp-fiche-statut-pill" style="background:${col.badge};color:${col.badgeText}">
              ${escH(r.LibStatut || 'Actif')}
            </div>
          </div>

          <div class="imp-fiche-grid">
            <div class="imp-fiche-row"><span class="imp-fiche-label">Nom</span><span class="imp-fiche-val">${escH(nom||'—')}</span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Prénom</span><span class="imp-fiche-val">${escH(prenom||'—')}</span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Date de naissance</span><span class="imp-fiche-val">${dateNaiss}</span></div>
            ${isAdh ? `
            <div class="imp-fiche-row"><span class="imp-fiche-label">Sexe</span><span class="imp-fiche-val">${escH(r.Sexe||'—')}</span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Email</span><span class="imp-fiche-val">${escH(r.EmailAdh||'—')}</span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Téléphone</span><span class="imp-fiche-val">${escH(r.TelAdh||'—')}</span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Fonction</span><span class="imp-fiche-val">${escH(r.FonctionAdh||'—')}</span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Profession</span><span class="imp-fiche-val">${escH(r.Profession||'—')}</span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Date d'adhésion</span><span class="imp-fiche-val">
              ${r.DateAdhesion ? new Date(r.DateAdhesion).toLocaleDateString('fr-FR') : '—'}
            </span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Rôle</span><span class="imp-fiche-val">${escH(r.LibRole||'—')}</span></div>
            ` : `
            <div class="imp-fiche-row"><span class="imp-fiche-label">Email</span><span class="imp-fiche-val">${escH(r.EmailBenef||'—')}</span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Téléphone</span><span class="imp-fiche-val">${escH(r.TelBenef||'—')}</span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Lien de parenté</span><span class="imp-fiche-val">${escH(r.LienParente||'—')}</span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Type</span><span class="imp-fiche-val">${escH(r.TypeBenef||'—')}</span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Adhérent responsable</span><span class="imp-fiche-val">
              ${r.NomAdh ? `${escH(r.NomAdh)} ${escH(r.PrenAdh)} (${escH(r.NumAdherent||'')})` : '—'}
            </span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Observations</span><span class="imp-fiche-val">${escH(r.Observations||'—')}</span></div>
            `}
            <div class="imp-fiche-row"><span class="imp-fiche-label">Pays</span><span class="imp-fiche-val">${escH(r.CodePays||'—')}</span></div>
            <div class="imp-fiche-row"><span class="imp-fiche-label">Organisation</span><span class="imp-fiche-val">${escH(org)}</span></div>
          </div>
        </div>
      </div>

      ${paiements.length ? `
      <!-- SECTION PAIEMENTS -->
      <div class="imp-fiche-section">
        <div class="imp-fiche-section-title">Historique des paiements</div>
        <table class="imp-fiche-table">
          <thead>
            <tr>
              <th>Référence</th><th>Type</th><th>Montant</th><th>Devise</th><th>Date</th><th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${paiements.slice(0,8).map(p => `
            <tr>
              <td>${escH(p.RefPaiement||p.idPaiement)}</td>
              <td>${escH(p.TypePaiement||'—')}</td>
              <td class="imp-fiche-td-right">${escH(p.Montant ? Number(p.Montant).toLocaleString('fr-FR') : '—')}</td>
              <td>${escH(p.CodeDevise||'XOF')}</td>
              <td>${p.DatePaiement ? new Date(p.DatePaiement).toLocaleDateString('fr-FR') : '—'}</td>
              <td>${escH(p.LibStatutPaiement||p.Statut||'—')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${paiements.length > 8 ? `<p class="imp-fiche-more">… et ${paiements.length - 8} paiement(s) supplémentaire(s)</p>` : ''}
      </div>` : ''}

    </div>

    <!-- QR + SIGNATURE -->
    <div class="imp-fiche-footer">
      <div class="imp-fiche-qr-wrap">
        <div id="ficheQR_${type}_${idKey}" class="imp-fiche-qr-ph">⬛</div>
        <div class="imp-fiche-qr-label">${escH(num||'—')}</div>
      </div>
      <div class="imp-fiche-sig">
        <div class="imp-fiche-sig-box"></div>
        <div class="imp-fiche-sig-label">Signature &amp; Cachet</div>
      </div>
    </div>

  </div>`;
}

// ================================================================
// LISTES (format A4)
// ================================================================
function renderListe(data, type) {
  const isAdh = type === 'adh';
  const headers = isAdh
    ? ['N°','N° Adhérent','Nom','Prénom','Téléphone','Email','Organisation','Rôle','Statut','Adhésion']
    : ['N°','N° Bénéf.','Nom','Prénom','Lien','Organisation','Adhérent','Statut','Naissance'];

  const now = new Date().toLocaleDateString('fr-FR');

  return `
  <div class="imp-print-zone imp-liste-zone" id="impPrintZone">
    <!-- EN-TÊTE LISTE -->
    <div class="imp-liste-header">
      <div class="imp-liste-hd-left">
        <img src="/images/logo.svg" class="imp-liste-logo" alt="SoliDev">
        <div>
          <div class="imp-liste-title">SoliDev — ${isAdh ? 'Registre des Adhérents' : 'Registre des Bénéficiaires'}</div>
          <div class="imp-liste-sub">${data.length} enregistrement${data.length!==1?'s':''} · Imprimé le ${now}</div>
        </div>
      </div>
      <div class="imp-liste-hd-right">
        ${impState.orgFilter ? `<div class="imp-liste-org-badge">${impState.orgs.find(o=>o.NumAgr===impState.orgFilter)?.LibOrg||''}</div>` : ''}
      </div>
    </div>

    <!-- TABLEAU -->
    <table class="imp-liste-table">
      <thead>
        <tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${data.map((r, i) => {
          const nom    = isAdh ? r.NomAdh      : r.NomBenef;
          const prenom = isAdh ? r.PrenAdh     : r.PrenomBenef;
          const num    = isAdh ? r.NumAdherent : r.NumBenef;
          if (isAdh) return `
            <tr class="${i%2===0?'imp-liste-row-even':''}">
              <td class="imp-liste-td-num">${i+1}</td>
              <td class="imp-liste-td-id"><strong>${escH(num||'—')}</strong></td>
              <td>${escH(nom||'—')}</td>
              <td>${escH(prenom||'—')}</td>
              <td>${escH(r.TelAdh||'—')}</td>
              <td class="imp-liste-td-email">${escH(r.EmailAdh||'—')}</td>
              <td>${escH(r.LibOrg||'—')}</td>
              <td>${escH(r.LibRole||'—')}</td>
              <td><span class="imp-stat-chip imp-stat-${(r.LibStatut||'').toLowerCase().replace(/\s/g,'-')}">${escH(r.LibStatut||'—')}</span></td>
              <td>${r.DateAdhesion ? new Date(r.DateAdhesion).toLocaleDateString('fr-FR') : '—'}</td>
            </tr>`;
          else return `
            <tr class="${i%2===0?'imp-liste-row-even':''}">
              <td class="imp-liste-td-num">${i+1}</td>
              <td class="imp-liste-td-id"><strong>${escH(num||'—')}</strong></td>
              <td>${escH(nom||'—')}</td>
              <td>${escH(prenom||'—')}</td>
              <td>${escH(r.LienParente||'—')}</td>
              <td>${escH(r.LibOrg||'—')}</td>
              <td>${r.NomAdh ? `${escH(r.NomAdh)} ${escH(r.PrenAdh)}` : '—'}</td>
              <td><span class="imp-stat-chip imp-stat-${(r.LibStatut||'').toLowerCase().replace(/\s/g,'-')}">${escH(r.LibStatut||'—')}</span></td>
              <td>${r.DateNaissBenef ? new Date(r.DateNaissBenef).toLocaleDateString('fr-FR') : '—'}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>

    <!-- FOOTER LISTE -->
    <div class="imp-liste-footer">
      <div>Total : <strong>${data.length}</strong> ${isAdh ? 'adhérent' : 'bénéficiaire'}${data.length!==1?'s':''}</div>
      <div>SoliDev · Plateforme panafricaine · ${now}</div>
    </div>
  </div>`;
}

// ================================================================
// LISTE + FICHES combinées
// ================================================================
function renderListeFiches(data) {
  return `
    <div class="imp-print-zone" id="impPrintZone">
      ${renderListe(data, 'adh').replace('id="impPrintZone"','').replace('<div class="imp-print-zone imp-liste-zone" ','<div class="imp-liste-inner" ')}
      <div class="imp-page-break"></div>
      ${data.map((r, i) => renderFiche(r, 'adh', i) + (i < data.length-1 ? '<div class="imp-page-break"></div>' : '')).join('')}
    </div>`;
}

// ================================================================
// QR CODES (grille)
// ================================================================
function renderQRGrid(data, type) {
  const isAdh = type === 'adh';
  return `
  <div class="imp-print-zone imp-qr-zone" id="impPrintZone">
    <div class="imp-qr-header">
      <img src="/images/logo.svg" class="imp-qr-header-logo" alt="SoliDev">
      <div>
        <div class="imp-qr-header-title">QR Codes — ${isAdh ? 'Adhérents' : 'Bénéficiaires'}</div>
        <div class="imp-qr-header-sub">SoliDev · ${data.length} code${data.length!==1?'s':''} · ${new Date().toLocaleDateString('fr-FR')}</div>
      </div>
    </div>
    <div class="imp-qr-grid">
      ${data.map(r => {
        const nom    = isAdh ? r.NomAdh      : r.NomBenef;
        const prenom = isAdh ? r.PrenAdh     : r.PrenomBenef;
        const num    = isAdh ? r.NumAdherent : r.NumBenef;
        const idKey  = isAdh ? r.idAdh       : r.idBenef;
        const initials = `${(nom||'?')[0]}${(prenom||'')[0]||''}`.toUpperCase();
        return `
          <div class="imp-qr-tile">
            <div id="qrTile_${type}_${idKey}" class="imp-qr-img-ph">⬛</div>
            <div class="imp-qr-tile-name">${escH(nom||'—')} ${escH(prenom||'—')}</div>
            <div class="imp-qr-tile-num">${escH(num||'—')}</div>
            <div class="imp-qr-tile-org">${escH((r.LibOrg||'').slice(0,20))}</div>
          </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ================================================================
// QR CODE INJECTION (async, post-render)
// ================================================================
async function injectQRCodes() {
  const data = impState.selectAll
    ? impState.data
    : impState.data.filter(r => impState.selected.has(String(r.idAdh || r.idBenef)));

  const type = impState.type;
  const isAdh = type.includes('adh');
  const entityType = isAdh ? 'adh' : 'ben';

  const qrPromises = data.map(async r => {
    const idKey = isAdh ? r.idAdh : r.idBenef;
    const num   = isAdh ? r.NumAdherent : r.NumBenef;
    const text  = `SOLIDEV:${entityType.toUpperCase()}:${num||idKey}`;

    // Generate QR client-side using canvas (or fetch from server)
    const qrDataURL = await generateQRClientSide(text);

    const imgTag = `<img src="${qrDataURL}" style="width:100%;height:100%">`;

    // Inject into all matching placeholders
    const mini   = document.getElementById(`qrMini_${entityType}_${idKey}`);
    const fiche  = document.getElementById(`ficheQR_${entityType}_${idKey}`);
    const tile   = document.getElementById(`qrTile_${entityType}_${idKey}`);

    if (mini)  mini.innerHTML  = imgTag;
    if (fiche) fiche.innerHTML = imgTag;
    if (tile)  tile.innerHTML  = imgTag;
  });

  await Promise.allSettled(qrPromises);
}

// Client-side QR generation via server endpoint
async function generateQRClientSide(text) {
  try {
    // Try server-side first (best quality)
    const res = await fetch(`/api/impressions/qr-png/adh/0?text=${encodeURIComponent(text)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('gpo_token')}` }
    });
    if (res.ok) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  } catch (_) {}

  // Fallback: canvas-based QR using tiny QR library included below
  return generateQRCanvas(text);
}

// Very lightweight QR code generator using canvas
function generateQRCanvas(text) {
  try {
    // Use SVG-based approach if QRious or similar is loaded
    // For now return a data URI placeholder SVG
    const encoded = encodeURIComponent(text);
    // Use Google Charts API as absolute fallback (if network available)
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`;
  } catch(_) {
    return '';
  }
}

// ================================================================
// DATA LOADING
// ================================================================
async function loadData() {
  const type = impState.type;
  const isAdh = !type.includes('ben');
  const endpoint = type.includes('qr')
    ? (isAdh ? '/api/impressions/adherents-qr' : '/api/impressions/beneficiaires-qr')
    : (isAdh ? '/api/impressions/adherents'     : '/api/impressions/beneficiaires');

  impState.loading = true;
  const pv = document.querySelector('.imp-preview-wrap');
  if (pv) pv.innerHTML = '<div class="imp-loading"><div class="imp-spinner"></div> Chargement des données…</div>';

  try {
    const params = new URLSearchParams();
    if (impState.orgFilter)    params.set('org',    impState.orgFilter);
    if (impState.search)       params.set('search', impState.search);
    if (impState.statutFilter) params.set('statut', impState.statutFilter);

    const res  = await api.get(`${endpoint.replace('/api','')  }?${params}`);
    impState.data    = res || [];
    impState.loading = false;
    impState.selectAll = true;
    impState.selected.clear();

    renderImp();

    // Inject QR codes asynchronously after render
    if (['carte-adh','carte-ben','fiche-adh','fiche-ben','qr-adh','qr-ben'].includes(impState.type)) {
      setTimeout(() => injectQRCodesFromData(), 100);
    }

  } catch(e) {
    impState.loading = false;
    const pv2 = document.querySelector('.imp-preview-wrap');
    if (pv2) pv2.innerHTML = `<div class="imp-empty">Erreur : ${e.message}</div>`;
  }
}

async function injectQRCodesFromData() {
  const data = impState.selectAll
    ? impState.data
    : impState.data.filter(r => impState.selected.has(String(r.idAdh || r.idBenef)));

  const isAdh = !impState.type.includes('ben');
  const prefix = isAdh ? 'adh' : 'ben';

  for (const r of data) {
    const idKey = isAdh ? r.idAdh : r.idBenef;
    const num   = isAdh ? r.NumAdherent : r.NumBenef;

    // If server already provided QR code (qr-type endpoints)
    if (r.qrCode) {
      const imgTag = `<img src="${r.qrCode}" style="width:100%;height:100%;object-fit:contain">`;
      ['qrMini','ficheQR','qrTile'].forEach(pfx => {
        const el = document.getElementById(`${pfx}_${prefix}_${idKey}`);
        if (el) el.innerHTML = imgTag;
      });
      continue;
    }

    // Otherwise fetch QR from server
    try {
      const qrRes = await fetch(`/api/impressions/qr-png/${prefix}/${idKey}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('gpo_token')}` }
      });
      if (qrRes.ok) {
        const blob = await qrRes.blob();
        const url = URL.createObjectURL(blob);
        const imgTag = `<img src="${url}" style="width:100%;height:100%;object-fit:contain">`;
        ['qrMini','ficheQR','qrTile'].forEach(pfx => {
          const el = document.getElementById(`${pfx}_${prefix}_${idKey}`);
          if (el) el.innerHTML = imgTag;
        });
      }
    } catch(_) {}
  }
}

async function loadOrgs() {
  try {
    const res = await api.get('/ref/organisations');
    impState.orgs = res || [];
  } catch(_) { impState.orgs = []; }
}

// ================================================================
// ACTIONS
// ================================================================
function printNow() {
  logImpression('IMPRESSION', impState.type);
  window.print();
}

function openPDF() {
  logImpression('EXPORT_PDF', impState.type);
  // Set a body class to hint the user to "Print to PDF"
  const tip = document.createElement('div');
  tip.className = 'imp-pdf-tip';
  tip.innerHTML = `
    <div class="imp-pdf-tip-box">
      <div class="imp-pdf-tip-icon">📄</div>
      <h3>Exporter en PDF</h3>
      <p>Dans la boîte de dialogue d'impression :</p>
      <ol>
        <li>Sélectionner l'imprimante <strong>"Enregistrer en PDF"</strong></li>
        <li>Format : <strong>A4</strong></li>
        <li>Marges : <strong>Minimales</strong></li>
        <li>Cocher <strong>"Arrière-plan"</strong></li>
      </ol>
      <button class="imp-btn imp-btn-primary" onclick="this.closest('.imp-pdf-tip').remove(); window.print()">
        🖨️ Ouvrir l'impression
      </button>
      <button class="imp-btn imp-btn-gray" onclick="this.closest('.imp-pdf-tip').remove()" style="margin-top:8px">
        Annuler
      </button>
    </div>`;
  document.body.appendChild(tip);
}

function exportExcel() {
  logImpression('EXPORT_EXCEL', impState.type);
  const isAdh = !impState.type.includes('ben');
  const base  = isAdh ? '/api/impressions/excel/adherents' : '/api/impressions/excel/beneficiaires';
  const p = new URLSearchParams();
  if (impState.orgFilter)    p.set('org',    impState.orgFilter);
  if (impState.statutFilter) p.set('statut', impState.statutFilter);
  if (impState.search)       p.set('search', impState.search);
  const url = `${base}?${p}`;
  const token = localStorage.getItem('gpo_token');
  // Fetch with auth then trigger download
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${isAdh ? 'Adherents' : 'Beneficiaires'}_${new Date().toISOString().slice(0,10)}.xls`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(e => alert('Erreur export : ' + e.message));
}

function exportCSV() {
  logImpression('EXPORT_CSV', impState.type);
  const isAdh = !impState.type.includes('ben');
  const data  = impState.selectAll
    ? impState.data
    : impState.data.filter(r => impState.selected.has(String(r.idAdh || r.idBenef)));

  let csv;
  const BOM = '﻿';
  if (isAdh) {
    const headers = ['N° Adhérent','Nom','Prénom','Email','Téléphone','Fonction','Organisation','Rôle','Statut','Date Adhésion','Pays'];
    csv = BOM + headers.join(';') + '\n' + data.map(r =>
      [r.NumAdherent,r.NomAdh,r.PrenAdh,r.EmailAdh||'',r.TelAdh||'',r.FonctionAdh||'',
       r.LibOrg||'',r.LibRole||'',r.LibStatut||'',
       r.DateAdhesion?r.DateAdhesion.slice(0,10):'',r.CodePays||'']
      .map(v => `"${String(v).replace(/"/g,'""')}"`)
      .join(';')).join('\n');
  } else {
    const headers = ['N° Bénéf.','Nom','Prénom','Date Naiss.','Email','Téléphone','Lien','Type','Organisation','Adhérent','Statut'];
    csv = BOM + headers.join(';') + '\n' + data.map(r =>
      [r.NumBenef,r.NomBenef,r.PrenomBenef,r.DateNaissBenef?r.DateNaissBenef.slice(0,10):'',
       r.EmailBenef||'',r.TelBenef||'',r.LienParente||'',r.TypeBenef||'',
       r.LibOrg||'',r.NomAdh?`${r.NomAdh} ${r.PrenAdh}`:'',r.LibStatut||'']
      .map(v => `"${String(v).replace(/"/g,'""')}"`)
      .join(';')).join('\n');
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `${isAdh ? 'Adherents' : 'Beneficiaires'}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function logImpression(action, type) {
  try {
    await api.post('/piste-audit/event', {
      action: 'IMPRESSION',
      module: 'impressions',
      details: `${action} — ${type}`,
    });
  } catch(_) {}
}

// ================================================================
// INTERACTIONS
// ================================================================
let _debounceTimer = null;
function impDebounceSearch(val) {
  clearTimeout(_debounceTimer);
  impState.search = val;
  _debounceTimer = setTimeout(() => loadData(), 350);
}

function impFilter(key, val) {
  if (key === 'org')    impState.orgFilter    = val;
  if (key === 'statut') impState.statutFilter  = val;
  loadData();
}

function clearImpFilters() {
  impState.orgFilter    = '';
  impState.statutFilter = '';
  impState.search       = '';
  const s = document.getElementById('impSearch');
  if (s) s.value = '';
  loadData();
}

function switchType(key) {
  impState.type = key;
  impState.data = [];
  renderImp();
  loadData();
}

function toggleSelectAll(checked) {
  impState.selectAll = checked;
  impState.selected.clear();
  renderImp();
  if (['carte-adh','carte-ben','fiche-adh','fiche-ben','qr-adh','qr-ben'].includes(impState.type)) {
    setTimeout(() => injectQRCodesFromData(), 100);
  }
}

function toggleOne(id, checked) {
  impState.selectAll = false;
  const cb = document.getElementById('impSelectAll');
  if (cb) cb.checked = false;
  if (checked) impState.selected.add(String(id));
  else         impState.selected.delete(String(id));
  // Update header count without full reload
  const sub = document.querySelector('.imp-header-sub');
  if (sub) sub.textContent = `${impState.data.length} enregistrements · ${impState.selected.size} sélectionné(s)`;
}

// ── Helper ────────────────────────────────────────────────────
function escH(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
