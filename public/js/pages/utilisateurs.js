router.register('utilisateurs', async () => {
  const app = document.getElementById('app');
  let users = [];

  async function load() { users = await api.get('/utilisateurs'); }

  function roleBadge(r) {
    const m = { admin:'badge-ok', gestionnaire:'badge-pend', adherent:'badge-err' };
    return `<span class="dem-badge ${m[r]||'badge-pend'}">${r}</span>`;
  }

  function openModal(u = {}) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="uModal">
        <div class="modal">
          <div class="modal-header">
            <h3>${u.idUser ? 'Modifier' : 'Nouvel'} utilisateur</h3>
            <button class="modal-close" id="closeUModal">&times;</button>
          </div>
          <form id="uForm">
            <div class="form-row">
              <div class="form-group"><label>Nom d'utilisateur *</label>
                <input type="text" name="username" value="${u.username||''}" required></div>
              <div class="form-group"><label>Email *</label>
                <input type="email" name="email" value="${u.email||''}" required></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Rôle</label>
                <select name="role">
                  <option value="gestionnaire" ${u.role==='gestionnaire'?'selected':''}>Gestionnaire</option>
                  <option value="admin"        ${u.role==='admin'?'selected':''}>Admin</option>
                  <option value="adherent"     ${u.role==='adherent'?'selected':''}>Adhérent</option>
                </select>
              </div>
              <div class="form-group"><label>${u.idUser ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe *'}</label>
                <input type="password" name="password" ${u.idUser?'':'required'} placeholder="${u.idUser?'••••••••':'Entrez un mot de passe'}"></div>
            </div>
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" name="isActive" value="1" ${u.idUser?(u.isActive?'checked':''):'checked'}>
                Compte actif
              </label>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" id="closeUModal2">Annuler</button>
              <button type="submit" class="btn btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>`);
    const close = () => document.getElementById('uModal').remove();
    document.getElementById('closeUModal').onclick = close;
    document.getElementById('closeUModal2').onclick = close;
    document.getElementById('uForm').onsubmit = async e => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      body.isActive = body.isActive ? 1 : 0;
      if (!body.password) delete body.password;
      try {
        if (u.idUser) await api.put(`/utilisateurs/${u.idUser}`, body);
        else          await api.post('/utilisateurs', body);
        close(); render();
      } catch(err) { showToast(err.message, 'error'); }
    };
  }

  async function render() {
    app.innerHTML = `<div class="dash-loading"><div class="dash-spinner"></div></div>`;
    await load();
    const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

    app.innerHTML = `
      <div class="page-header">
        <h2>Gestion des Utilisateurs</h2>
        <button class="btn btn-primary" id="btnAdd">+ Nouvel utilisateur</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Utilisateur</th><th>Email</th><th>Rôle</th>
            <th>Statut</th><th>Créé le</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${users.map((u,i)=>`
              <tr style="animation-delay:${i*30}ms">
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="dem-org-icon" style="font-size:16px">👤</div>
                    <strong>${u.username}</strong>
                  </div>
                </td>
                <td>${u.email}</td>
                <td>${roleBadge(u.role)}</td>
                <td>${u.isActive ? '<span class="badge-ok dem-badge">Actif</span>' : '<span class="badge-err dem-badge">Inactif</span>'}</td>
                <td>${fmt(u.createdAt)}</td>
                <td class="actions">
                  <button class="btn-icon edit" data-id="${u.idUser}">✏️</button>
                  <button class="btn-icon del"  data-id="${u.idUser}" ${u.role==='admin'&&users.filter(x=>x.role==='admin').length===1?'disabled title="Dernier admin"':''}>🗑️</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    document.getElementById('btnAdd').onclick = () => openModal();
    document.querySelectorAll('.btn-icon.edit').forEach(btn => {
      btn.onclick = () => openModal(users.find(u => u.idUser == btn.dataset.id) || {});
    });
    document.querySelectorAll('.btn-icon.del:not([disabled])').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Supprimer cet utilisateur ?')) return;
        try { await api.delete(`/utilisateurs/${btn.dataset.id}`); render(); }
        catch(e) { alert(e.message); }
      };
    });
  }

  render();
});
