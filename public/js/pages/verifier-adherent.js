router.register('verifier-adherent', async (params = {}) => {
  if (!document.getElementById('app')) document.body.innerHTML = '<div id="app"></div>';
  document.body.className = '';

  const code = params.code || '';
  document.body.innerHTML = `
    <div class="pub-form-wrap">
      <button class="pub-form-back" onclick="landingNav('landing')">← Retour à l'accueil</button>
      <div class="pub-form-card" id="vaCard" style="max-width:600px">
        <div class="pub-form-logo">
          <img src="/images/logo.svg" class="logo-sm" alt="SoliDev">
          <span>SoliDev</span>
        </div>
        <h2 style="text-align:center;margin-bottom:4px">🪪 Vérification de carte de membre</h2>
        <p class="sub-desc" style="text-align:center">Résultat du scan de la carte d'adhérent</p>
        <div id="vaBody" style="margin-top:20px">⏳ Vérification en cours…</div>
      </div>
    </div>`;

  const body = document.getElementById('vaBody');
  if (!code) { body.innerHTML = `<div class="msg error">Aucun code de carte fourni.</div>`; return; }

  try {
    const res  = await fetch(`/api/public/verifier-adherent?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur de vérification');
    render(data);
  } catch (err) {
    body.innerHTML = `<div class="msg error">❌ ${err.message}</div>`;
  }

  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  }
  function fmtMoney(n) { return Number(n || 0).toLocaleString('fr-FR'); }
  function row(label, val) {
    return `<div class="dem-info-item"><span>${label}</span><strong>${val ?? '—'}</strong></div>`;
  }

  function render(a) {
    const photo = a.Photo
      ? `<img src="${a.Photo}" alt="${a.NomAdh}" style="width:90px;height:90px;border-radius:16px;object-fit:cover">`
      : `<div style="width:90px;height:90px;border-radius:16px;background:linear-gradient(135deg,#145c56,#2f8f7f);display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff">${(a.PrenAdh||a.NomAdh||'?').charAt(0).toUpperCase()}</div>`;

    const orgLogo = a.OrgLogo
      ? `<img src="${a.OrgLogo}" alt="${a.LibOrg}" style="width:28px;height:28px;border-radius:8px;object-fit:cover">`
      : '🏢';

    const beneficiairesHtml = (a.beneficiaires || []).length
      ? a.beneficiaires.map(b => `
          <div class="dem-info-item"><span>${b.LienParente || 'Bénéficiaire'}</span><strong>${b.PrenomBenef || ''} ${b.NomBenef || ''}</strong></div>
        `).join('')
      : `<p style="color:#94a3b8;font-size:13px">Aucun bénéficiaire déclaré.</p>`;

    const paiementsHtml = (a.paiements || []).length
      ? `<div class="table-wrap"><table class="table">
           <thead><tr><th>Date</th><th>Objet</th><th>Montant</th><th>Statut</th></tr></thead>
           <tbody>${a.paiements.map(p => `
             <tr>
               <td>${fmtDate(p.DatePaiement)}</td>
               <td>${p.ObjetPaiement || p.TypePaiement || '—'}</td>
               <td>${fmtMoney(p.MontantPaiement)} ${p.CodeDevise || 'FCFA'}</td>
               <td>${p.Statut || '—'}</td>
             </tr>`).join('')}</tbody>
         </table></div>`
      : `<p style="color:#94a3b8;font-size:13px">Aucun paiement enregistré.</p>`;

    document.getElementById('vaBody').innerHTML = `
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px">
        ${photo}
        <div>
          <div style="font-size:20px;font-weight:800;color:#0f172a">${a.PrenAdh || ''} ${a.NomAdh || ''}</div>
          <div style="font-size:13px;color:#64748b;display:flex;align-items:center;gap:6px;margin-top:4px">
            ${orgLogo} ${a.LibOrg || '—'} ${a.LibTypOrg ? '· ' + a.LibTypOrg : ''}
          </div>
          <div style="margin-top:6px">
            <span class="badge badge-green">${a.LibRole || a.FonctionAdh || 'Membre'}</span>
            <span class="badge ${a.LibStatut === 'Actif' ? 'badge-green' : 'badge-grey'}">${a.LibStatut || '—'}</span>
          </div>
        </div>
      </div>

      <div class="dash-section-hd"><div class="dsh-line"></div><div class="dsh-title">👤 Identité</div><div class="dsh-line"></div></div>
      <div class="dem-info-grid" style="margin-bottom:20px">
        ${row('Numéro adhérent', a.NumAdherent)}
        ${row('Date de naissance', fmtDate(a.DateNaissAdh))}
        ${row('Lieu de naissance', a.LieuNaissAdh)}
        ${row('Sexe', a.Sexe)}
        ${row('Nationalité', a.Nationalite)}
        ${row('Pays', a.CodePays)}
        ${row('N° CNI / Passeport', a.NumCNI)}
        ${row('Profession', a.Profession)}
      </div>

      <div class="dash-section-hd"><div class="dsh-line"></div><div class="dsh-title">📞 Coordonnées</div><div class="dsh-line"></div></div>
      <div class="dem-info-grid" style="margin-bottom:20px">
        ${row('Téléphone', a.TelAdh)}
        ${row('Email', a.EmailAdh)}
        ${row('Adresse', a.AdrAdh)}
      </div>

      <div class="dash-section-hd"><div class="dsh-line"></div><div class="dsh-title">🏢 Organisation</div><div class="dsh-line"></div></div>
      <div class="dem-info-grid" style="margin-bottom:20px">
        ${row('Organisation', a.LibOrg)}
        ${row('Type', a.LibTypOrg)}
        ${row('Siège', a.SiegeOrg)}
        ${row("Date d'adhésion", fmtDate(a.DateAdhesion))}
      </div>

      <div class="dash-section-hd"><div class="dsh-line"></div><div class="dsh-title">🤝 Bénéficiaires déclarés</div><div class="dsh-line"></div></div>
      <div style="margin-bottom:20px">${beneficiairesHtml}</div>

      <div class="dash-section-hd"><div class="dsh-line"></div><div class="dsh-title">💰 Historique des paiements</div><div class="dsh-line"></div></div>
      <div>${paiementsHtml}</div>
    `;
  }
});
