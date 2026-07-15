router.register('besoins-admin', async () => {
  const app = document.getElementById('app');
  let besoins = [], filterStatut = '', searchQ = '';

  async function load() {
    const url = dateFilter.buildUrl('/besoins-admin', {
      ...(filterStatut ? { statut: filterStatut } : {}),
      ...(searchQ      ? { search: searchQ }       : {}),
    });
    besoins = (await api.get(url)) || [];
  }

  function badge(s) {
    const m = { 'En attente':'badge-pend', 'Traité':'badge-ok', 'Archivé':'badge-err' };
    return `<span class="dem-badge ${m[s]||'badge-pend'}">${s}</span>`;
  }

  function openDetail(b) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="bModal">
        <div class="modal dem-modal">
          <div class="modal-header dem-mhdr">
            <div class="dem-mhdr-left">
              <div class="dem-type-big">📋</div>
              <div>
                <h3>${b.nom}</h3>
                <div class="dem-mhdr-meta">${b.typeBesoin||'Besoin non précisé'} · ${b.typeEntite||'—'}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              ${badge(b.statut||'En attente')}
              <button class="modal-close" id="closeBModal">&times;</button>
            </div>
          </div>
          <div class="dem-mdesc">
            <div class="dem-section">
              <div class="dem-section-title">Contact</div>
              <div class="dem-info-grid">
                <div class="dem-info-item"><span>Nom</span><strong>${b.nom}</strong></div>
                <div class="dem-info-item"><span>Email</span><strong>${b.email||'—'}</strong></div>
                <div class="dem-info-item"><span>Organisation ciblée</span><strong>${b.organisation||'—'}</strong></div>
                <div class="dem-info-item"><span>Type besoin</span><strong>${b.typeBesoin||'—'}</strong></div>
                <div class="dem-info-item"><span>Date soumission</span><strong>${b.dateDemande?new Date(b.dateDemande).toLocaleDateString('fr-FR'):'—'}</strong></div>
              </div>
            </div>
            <div class="dem-section">
              <div class="dem-section-title">Description du besoin</div>
              <p class="dem-desc-text">${b.description||'—'}</p>
            </div>
          </div>
          <div class="dem-mfooter">
            ${b.statut !== 'Traité' ? `<button class="btn-dem-accept" id="btnTraite">✓ Marquer comme traité</button>` : ''}
            <button class="btn btn-secondary" id="closeBModal2">Fermer</button>
          </div>
        </div>
      </div>`);

    const close = () => document.getElementById('bModal').remove();
    document.getElementById('closeBModal').onclick = close;
    document.getElementById('closeBModal2').onclick = close;
    document.getElementById('bModal').onclick = e => { if (e.target.id==='bModal') close(); };
    const btnT = document.getElementById('btnTraite');
    if (btnT) btnT.onclick = async () => {
      await api.put(`/besoins-admin/${b.idBesoin}/traiter`, {});
      close(); render();
    };
  }

  async function render() {
    app.innerHTML = `<div class="dash-loading"><div class="dash-spinner"></div></div>`;
    await load();
    const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—';

    app.innerHTML = `
      <div class="page-header">
        <h2>Expression des Besoins</h2>
        <div class="header-actions">
          <select id="filtStatut" class="select-sm">
            <option value="">Tous les statuts</option>
            <option value="En attente" ${filterStatut==='En attente'?'selected':''}>En attente</option>
            <option value="Traité"     ${filterStatut==='Traité'?'selected':''}>Traités</option>
          </select>
        </div>
      </div>
      ${dateFilter.renderBar()}
      <div class="dem-filter-row">
        <div class="dem-search-wrap">
          <span class="dem-search-icon">🔍</span>
          <input type="text" id="searchInput" class="dem-search" placeholder="Rechercher par nom ou email…" value="${searchQ}">
        </div>
      </div>
      <div class="table-wrap">
        ${besoins.length ? `
        <table class="table">
          <thead><tr><th>Nom</th><th>Email</th><th>Organisation ciblée</th><th>Type de besoin</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            ${besoins.map((b,i)=>`
              <tr style="animation-delay:${i*25}ms">
                <td><strong>${b.nom}</strong></td>
                <td>${b.email||'—'}</td>
                <td>${b.organisation||'—'}</td>
                <td>${b.typeBesoin||'—'}</td>
                <td>${fmt(b.dateDemande)}</td>
                <td>${badge(b.statut||'En attente')}</td>
                <td><button class="btn-icon view" data-id="${b.idBesoin}">👁️</button></td>
              </tr>`).join('')}
          </tbody>
        </table>` :
        `<div class="dem-empty"><div class="dem-empty-icon">📭</div><p>Aucun besoin enregistré</p></div>`}
      </div>`;

    dateFilter.initBar(() => render());
    document.getElementById('filtStatut').onchange = e => { filterStatut = e.target.value; render(); };
    const si = document.getElementById('searchInput');
    let t; si.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { searchQ = si.value; render(); }, 300); });
    document.querySelectorAll('.btn-icon.view').forEach(btn => {
      btn.onclick = () => openDetail(besoins.find(x => x.idBesoin == btn.dataset.id) || {});
    });
  }

  render();
});
