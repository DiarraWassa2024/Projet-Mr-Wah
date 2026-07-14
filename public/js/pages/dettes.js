router.register('dettes', async () => {
  const app  = document.getElementById('app');
  const user = auth.getUser() || {};

  const STATUT_CFG = {
    'En cours': { cls: 'badge-blue',  icon: '⏳' },
    'Réglée':   { cls: 'badge-green', icon: '✅' },
    'En retard':{ cls: 'badge-red',   icon: '⚠️' },
  };
  const fmt  = n => Number(n || 0).toLocaleString('fr-FR');
  const fmtD = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  app.innerHTML = `
    <div class="page-header">
      <h1>💳 Dettes des membres</h1>
      <button class="btn btn-primary" id="btnAddDette">+ Nouvelle dette</button>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Adhérent</th>
            <th>Organisation</th>
            <th>Montant total</th>
            <th>Restant dû</th>
            <th>Échéance</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="detteTbody">
          <tr><td colspan="7">Chargement…</td></tr>
        </tbody>
      </table>
    </div>`;

  async function load() {
    const tbody = document.getElementById('detteTbody');
    try {
      const rows = await api.get('/dettes');
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Aucune dette enregistrée.</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(d => {
        const statutAffiche = d.enRetard ? 'En retard' : d.statut;
        const st = STATUT_CFG[statutAffiche] || { cls: 'badge-grey', icon: '' };
        return `
          <tr>
            <td>${d.PrenAdh || ''} ${d.NomAdh || '—'}</td>
            <td>${d.LibOrg || '—'}</td>
            <td>${fmt(d.montantDette)}</td>
            <td><strong>${fmt(d.montantRestant)}</strong></td>
            <td>${fmtD(d.dateEcheance)}</td>
            <td><span class="badge ${st.cls}">${st.icon} ${statutAffiche}</span></td>
            <td class="actions">
              ${d.statut !== 'Réglée' ? `<button class="btn-icon" data-action="rembourser" data-id="${d.idDette}" title="Enregistrer un remboursement">💰</button>` : '—'}
            </td>
          </tr>`;
      }).join('');

      document.querySelectorAll('[data-action="rembourser"]').forEach(btn => {
        btn.onclick = async () => {
          const montant = prompt('Montant remboursé :');
          if (!montant || Number(montant) <= 0) return;
          try {
            await api.post(`/dettes/${btn.dataset.id}/rembourser`, { montant: Number(montant) });
            showToast('Remboursement enregistré', 'success');
            load();
          } catch (e) { showToast(e.message, 'error'); }
        };
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-muted">${err.message}</td></tr>`;
    }
  }

  document.getElementById('btnAddDette').onclick = () => openAddModal();

  async function openAddModal() {
    let adherents = [];
    try { adherents = await api.get('/adherents'); }
    catch (_) { adherents = []; }

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="detteModal">
        <div class="modal" style="max-width:440px">
          <div class="modal-header">
            <h3>+ Nouvelle dette</h3>
            <button class="modal-close" id="closeDetteModal">×</button>
          </div>
          <div style="padding:20px">
            <div class="form-group">
              <label>Adhérent *</label>
              <select id="detteAdh" class="select-sm" style="width:100%">
                <option value="">— Sélectionner —</option>
                ${adherents.map(a => `
                  <option value="${a.idAdh}" data-numagr="${a.NumAgr || ''}">${a.PrenAdh || ''} ${a.NomAdh} ${a.LibOrg ? '— ' + a.LibOrg : ''}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Montant *</label>
              <input type="number" id="detteMontant" min="1" placeholder="Ex : 5000">
            </div>
            <div class="form-group">
              <label>Échéance</label>
              <input type="date" id="detteEcheance">
            </div>
            <div class="form-group">
              <label>Motif</label>
              <textarea id="detteMotif" rows="2" placeholder="Ex : cotisation impayée"></textarea>
            </div>
            <div class="form-actions">
              <button class="btn btn-secondary" id="cancelDetteModal">Annuler</button>
              <button class="btn btn-primary" id="saveDetteModal">Enregistrer</button>
            </div>
          </div>
        </div>
      </div>`);

    const close = () => document.getElementById('detteModal')?.remove();
    document.getElementById('closeDetteModal').onclick  = close;
    document.getElementById('cancelDetteModal').onclick = close;
    document.getElementById('saveDetteModal').onclick = async () => {
      const idAdh   = document.getElementById('detteAdh').value;
      const opt     = document.getElementById('detteAdh').selectedOptions[0];
      const numAgr  = opt?.dataset.numagr || user.NumAgr || '';
      const montant = document.getElementById('detteMontant').value;
      if (!idAdh || !montant) { showToast('Adhérent et montant requis', 'error'); return; }
      try {
        await api.post('/dettes', {
          idAdh, numAgr,
          montantDette: Number(montant),
          dateEcheance: document.getElementById('detteEcheance').value || null,
          motif: document.getElementById('detteMotif').value || null,
        });
        showToast('Dette enregistrée', 'success');
        close();
        load();
      } catch (e) { showToast(e.message, 'error'); }
    };
  }

  load();
});
