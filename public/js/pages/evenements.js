router.register('evenements', async () => {
  const app = document.getElementById('app');
  let orgs = [], evens = [], filterOrg = '';

  async function loadRefs() { orgs = await api.get('/organisations'); }
  async function load() {
    evens = await api.get(dateFilter.buildUrl('/evenements', { org: filterOrg }));
  }
  function selO(sel='') { return orgs.map(o=>`<option value="${o.NumAgr}" ${o.NumAgr===sel?'selected':''}>${o.LibOrg}</option>`).join(''); }

  function openModal(ev = {}) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal">
          <div class="modal-header"><h3>${ev.IdEven?i18n.t('edit'):i18n.t('add')} ${i18n.t('evenements')}</h3>
            <button class="modal-close" id="closeModal">&times;</button></div>
          <form id="evenForm">
            <div class="form-group"><label>${i18n.t('name')} *</label>
              <input type="text" name="LibEven" value="${ev.LibEven||''}" required></div>
            <div class="form-row">
              <div class="form-group"><label>${i18n.t('organisations')} *</label>
                <select name="NumAgr" required><option value="">—</option>${selO(ev.NumAgr)}</select></div>
              <div class="form-group"><label>${i18n.t('eventDate')}</label>
                <input type="datetime-local" name="Heuraux" value="${ev.Heuraux?ev.Heuraux.replace(' ','T').split('.')[0]:''}"></div>
            </div>
            <div class="form-group"><label>${i18n.t('location')}</label>
              <input type="text" name="LieuEven" value="${ev.LieuEven||''}"></div>
            <div class="form-group"><label>${i18n.t('description')}</label>
              <textarea name="DescEven" rows="3">${ev.DescEven||''}</textarea></div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" id="closeModal2">${i18n.t('cancel')}</button>
              <button type="submit" class="btn btn-primary">${i18n.t('save')}</button>
            </div>
          </form>
        </div>
      </div>`);
    const close = () => document.getElementById('modalOverlay').remove();
    document.getElementById('closeModal').onclick  = close;
    document.getElementById('closeModal2').onclick = close;
    document.getElementById('evenForm').onsubmit = async e => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      try {
        if (ev.IdEven) await api.put(`/evenements/${ev.IdEven}`, body);
        else           await api.post('/evenements', body);
        close(); render();
      } catch(err){ showToast(err.message, 'error'); }
    };
  }

  async function render() {
    await load();
    app.innerHTML = `
      <div class="page-header">
        <h2>${i18n.t('evenements')}</h2>
        <div class="header-actions">
          <select id="orgFil" class="select-sm">
            <option value="">Toutes les organisations</option>${selO(filterOrg)}
          </select>
          <button class="btn btn-primary" id="btnAdd">+ ${i18n.t('add')}</button>
        </div>
      </div>
      ${dateFilter.renderBar()}
      <div class="cards-grid">
        ${evens.length ? evens.map(ev=>`
          <div class="event-card">
            <div class="event-date">${ev.Heuraux?new Date(ev.Heuraux).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'—'}</div>
            <h4>${ev.LibEven}</h4>
            <div class="event-org">${ev.LibOrg||'—'}</div>
            ${ev.LieuEven ? `<div class="event-loc">📍 ${ev.LieuEven}</div>` : ''}
            ${ev.DescEven ? `<p class="event-desc">${ev.DescEven}</p>` : ''}
            <div class="event-actions">
              <button class="btn-icon edit" data-idx="${evens.indexOf(ev)}">✏️</button>
              <button class="btn-icon del"  data-id="${ev.IdEven}">🗑️</button>
            </div>
          </div>`).join('')
        : `<div class="no-data">${i18n.t('noData')}</div>`}
      </div>`;

    document.getElementById('orgFil').onchange = e => { filterOrg = e.target.value; render(); };
    document.getElementById('btnAdd').onclick = () => openModal();
    dateFilter.initBar(() => render());
    document.querySelectorAll('.btn-icon.edit').forEach(btn => {
      btn.onclick = () => openModal(evens[btn.dataset.idx]);
    });
    document.querySelectorAll('.btn-icon.del').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm(i18n.t('confirmDelete'))) return;
        try { await api.delete(`/evenements/${btn.dataset.id}`); render(); } catch(e){ alert(e.message); }
      };
    });
  }

  await loadRefs();
  render();
});
