router.register('prestations', async () => {
  const app = document.getElementById('app');
  let orgs = [], types = [], prest = [], filterOrg = '';

  async function loadRefs() {
    [orgs, types] = await Promise.all([api.get('/organisations'), api.get('/ref/types_prest')]);
  }

  async function load() {
    prest = await api.get(dateFilter.buildUrl('/prestations', { org: filterOrg }));
  }

  function selO(sel='') { return orgs.map(o=>`<option value="${o.NumAgr}" ${o.NumAgr===sel?'selected':''}>${o.LibOrg}</option>`).join(''); }
  function selT(sel='') { return types.map(t=>`<option value="${t.id}" ${t.id==sel?'selected':''}>${t.lib}</option>`).join(''); }

  function openModal(p = {}) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal">
          <div class="modal-header"><h3>${p.IdPrest ? i18n.t('edit') : i18n.t('add')} ${i18n.t('prestations')}</h3>
            <button class="modal-close" id="closeModal">&times;</button></div>
          <form id="prestForm">
            <div class="form-group"><label>${i18n.t('description')} *</label>
              <input type="text" name="LibPrest" value="${p.LibPrest||''}" required></div>
            <div class="form-row">
              <div class="form-group"><label>${i18n.t('prestType')}</label>
                <select name="IdTypPrest"><option value="">—</option>${selT(p.IdTypPrest)}</select></div>
              <div class="form-group"><label>${i18n.t('organisations')} *</label>
                <select name="NumAgr" required><option value="">—</option>${selO(p.NumAgr)}</select></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>${i18n.t('amount')} (FCFA)</label>
                <input type="number" name="MontantPrest" value="${p.MontantPrest||''}" step="0.01"></div>
              <div class="form-group"><label>${i18n.t('date')}</label>
                <input type="date" name="DatePrest" value="${p.DatePrest?p.DatePrest.split('T')[0]:''}"></div>
            </div>
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
    document.getElementById('prestForm').onsubmit = async e => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      try {
        if (p.IdPrest) await api.put(`/prestations/${p.IdPrest}`, body);
        else           await api.post('/prestations', body);
        close(); render();
      } catch(err){ showToast(err.message, 'error'); }
    };
  }

  async function render() {
    await load();
    app.innerHTML = `
      <div class="page-header">
        <h2>${i18n.t('prestations')}</h2>
        <div class="header-actions">
          <select id="orgFil" class="select-sm">
            <option value="">Toutes les organisations</option>${selO(filterOrg)}
          </select>
          <button class="btn btn-primary" id="btnAdd">+ ${i18n.t('add')}</button>
        </div>
      </div>
      ${dateFilter.renderBar()}
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>${i18n.t('description')}</th><th>${i18n.t('prestType')}</th>
            <th>${i18n.t('organisations')}</th><th>${i18n.t('amount')}</th>
            <th>${i18n.t('date')}</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${prest.length ? prest.map(p=>`
              <tr>
                <td>${p.LibPrest}</td>
                <td>${p.LibTypPrest||'—'}</td>
                <td>${p.LibOrg||'—'}</td>
                <td>${p.MontantPrest?Number(p.MontantPrest).toLocaleString('fr-FR')+' FCFA':'—'}</td>
                <td>${p.DatePrest?new Date(p.DatePrest).toLocaleDateString('fr-FR'):'—'}</td>
                <td class="actions">
                  <button class="btn-icon edit" data-id="${p.IdPrest}">✏️</button>
                  <button class="btn-icon del"  data-id="${p.IdPrest}">🗑️</button>
                </td>
              </tr>`).join('')
            : `<tr><td colspan="6" class="text-center">${i18n.t('noData')}</td></tr>`}
          </tbody>
        </table>
      </div>`;

    document.getElementById('orgFil').onchange = e => { filterOrg = e.target.value; render(); };
    document.getElementById('btnAdd').onclick = () => openModal();
    dateFilter.initBar(() => render());
    document.querySelectorAll('.btn-icon.edit').forEach(btn => {
      btn.onclick = async () => { const p = prest.find(x=>x.IdPrest==btn.dataset.id); openModal(p||{}); };
    });
    document.querySelectorAll('.btn-icon.del').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm(i18n.t('confirmDelete'))) return;
        try { await api.delete(`/prestations/${btn.dataset.id}`); render(); } catch(e){ alert(e.message); }
      };
    });
  }

  await loadRefs();
  render();
});
