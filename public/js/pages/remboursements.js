router.register('remboursements', async () => {
  const app  = document.getElementById('app');
  const user = auth.getUser() || {};
  const isAdmin = user.role === 'admin';

  const STATUT_CFG = {
    'En attente': { cls: 'badge-amber', icon: '⏳', label: 'En attente' },
    'Approuvé':   { cls: 'badge-blue',  icon: '💬', label: 'Offre proposée' },
    'Effectué':   { cls: 'badge-green', icon: '↩️', label: 'Remboursé' },
    'Rejeté':     { cls: 'badge-red',   icon: '❌', label: 'Rejeté / refusé' },
  };
  const fmt  = n => Number(n || 0).toLocaleString('fr-FR');
  const fmtD = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  app.innerHTML = `
    <div class="page-header">
      <h1>↩️ Remboursements</h1>
    </div>
    ${!isAdmin ? `<p class="dt-empty" style="text-align:left;margin-bottom:12px">
      En cas de remboursement, ${TAUX_INFO_TEXT()} du montant payé vous est proposé — le solde reste acquis.
      Vous devez accepter explicitement l'offre pour que le remboursement soit versé.
    </p>` : ''}
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Référence paiement</th>
            <th>${isAdmin ? 'Demandeur' : 'Objet'}</th>
            <th>Montant payé</th>
            <th>Montant proposé</th>
            <th>Motif</th>
            <th>Date demande</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="rembTbody">
          <tr><td colspan="8">Chargement…</td></tr>
        </tbody>
      </table>
    </div>`;

  function TAUX_INFO_TEXT() { return '80%'; } // aligné sur config/remboursement.js (TAUX_REMBOURSEMENT_PCT)

  async function load() {
    const tbody = document.getElementById('rembTbody');
    try {
      const rows = await api.get('/remboursements');
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-muted">Aucune demande de remboursement.</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(r => {
        const st = STATUT_CFG[r.statut] || { cls: 'badge-grey', icon: '', label: r.statut };
        const qui = r.NomAdh ? `${r.PrenAdh || ''} ${r.NomAdh}`.trim() : (r.LibOrg || '—');
        return `
          <tr>
            <td>${r.NumRecu || `#${r.idPaiement}`}</td>
            <td>${isAdmin ? qui : (r.ObjetPaiement || '—')}</td>
            <td>${fmt(r.montantRembourse)} ${r.CodeDevise || 'FCFA'}</td>
            <td>${r.montantOffert != null ? `<strong>${fmt(r.montantOffert)}</strong> ${r.CodeDevise || 'FCFA'}` : '—'}</td>
            <td>${r.motif || '—'}</td>
            <td>${fmtD(r.dateDemande)}</td>
            <td><span class="badge ${st.cls}">${st.icon} ${st.label}</span></td>
            <td class="actions">${actions(r)}</td>
          </tr>`;
      }).join('');

      bindActions();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-muted">${err.message}</td></tr>`;
    }
  }

  function actions(r) {
    if (isAdmin && r.statut === 'En attente') {
      return `
        <button class="btn-icon" data-action="approuver" data-id="${r.idRemboursement}" title="Approuver — proposer 80%">✅</button>
        <button class="btn-icon" data-action="rejeter"   data-id="${r.idRemboursement}" title="Rejeter">✖️</button>`;
    }
    if (!isAdmin && r.statut === 'Approuvé') {
      const estPaiementOrg = !r.idAdh && r.numAgr;
      return `
        <button class="btn-icon" data-action="accepter-offre" data-id="${r.idRemboursement}" data-org-level="${estPaiementOrg ? '1' : ''}" title="Accepter l'offre">✅</button>
        <button class="btn-icon" data-action="refuser-offre"  data-id="${r.idRemboursement}" title="Refuser l'offre">✖️</button>`;
    }
    if (isAdmin && r.statut === 'Approuvé') return `<span class="text-muted">En attente de la décision du demandeur</span>`;
    return '—';
  }

  function bindActions() {
    document.querySelectorAll('[data-action="approuver"]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Approuver cette demande et proposer 80% du montant au demandeur ?")) return;
        try {
          const res = await api.put(`/remboursements/${btn.dataset.id}/approuver`);
          showToast(`Offre envoyée : ${Number(res.montantOffert).toLocaleString('fr-FR')} proposés`, 'success');
          load();
        } catch (e) { showToast(e.message, 'error'); }
      };
    });
    document.querySelectorAll('[data-action="rejeter"]').forEach(btn => {
      btn.onclick = async () => {
        const motif = prompt('Motif du rejet (optionnel) :') || '';
        try { await api.put(`/remboursements/${btn.dataset.id}/rejeter`, { motif }); showToast('Demande rejetée', 'success'); load(); }
        catch (e) { showToast(e.message, 'error'); }
      };
    });
    document.querySelectorAll('[data-action="accepter-offre"]').forEach(btn => {
      btn.onclick = async () => {
        const confirmMsg = btn.dataset.orgLevel
          ? "Accepter cette offre ? Le remboursement partiel sera versé immédiatement ET VOTRE ORGANISATION SERA DÉFINITIVEMENT RETIRÉE DE LA PLATEFORME (ses adhérents seront prévenus par email). Cette action est irréversible."
          : "Accepter cette offre ? Le remboursement partiel sera versé immédiatement.";
        if (!confirm(confirmMsg)) return;
        try {
          const res = await api.put(`/remboursements/${btn.dataset.id}/accepter-offre`);
          showToast(res.organisationFermee ? 'Remboursement effectué — organisation retirée de la plateforme' : 'Offre acceptée — remboursement effectué', 'success');
          load();
        } catch (e) { showToast(e.message, 'error'); }
      };
    });
    document.querySelectorAll('[data-action="refuser-offre"]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Refuser cette offre ? Aucun remboursement ne sera effectué.")) return;
        try { await api.put(`/remboursements/${btn.dataset.id}/refuser-offre`); showToast('Offre refusée', 'success'); load(); }
        catch (e) { showToast(e.message, 'error'); }
      };
    });
  }

  load();
});
