router.register('verifier-organisation', async (params = {}) => {
  if (!document.getElementById('app')) document.body.innerHTML = '<div id="app"></div>';
  document.body.className = '';

  const code = params.code || '';
  document.body.innerHTML = `
    <div class="pub-form-wrap">
      <button class="pub-form-back" onclick="landingNav('landing')">← Retour à l'accueil</button>
      <div class="pub-form-card" id="voCard" style="max-width:600px">
        <div class="pub-form-logo">
          <img src="/images/logo.svg" class="logo-sm" alt="SoliDev">
          <span>SoliDev</span>
        </div>
        <h2 style="text-align:center;margin-bottom:4px">🏢 Vérification d'organisation</h2>
        <p class="sub-desc" style="text-align:center">Résultat du scan de la carte d'organisation</p>
        <div id="voBody" style="margin-top:20px">⏳ Vérification en cours…</div>
      </div>
    </div>`;

  const body = document.getElementById('voBody');
  if (!code) { body.innerHTML = `<div class="msg error">Aucun code d'organisation fourni.</div>`; return; }

  try {
    const res  = await fetch(`/api/public/verifier-organisation?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur de vérification');
    render(data);
  } catch (err) {
    body.innerHTML = `<div class="msg error">❌ ${err.message}</div>`;
  }

  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  }
  function row(label, val) {
    return `<div class="dem-info-item"><span>${label}</span><strong>${val ?? '—'}</strong></div>`;
  }

  function render(o) {
    const logo = o.Logo
      ? `<img src="${o.Logo}" alt="${o.LibOrg}" style="width:90px;height:90px;border-radius:16px;object-fit:cover">`
      : `<div style="width:90px;height:90px;border-radius:16px;background:linear-gradient(135deg,#145c56,#2f8f7f);display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff">${(o.LibOrg||'?').charAt(0).toUpperCase()}</div>`;

    document.getElementById('voBody').innerHTML = `
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px">
        ${logo}
        <div>
          <div style="font-size:20px;font-weight:800;color:#0f172a">${o.LibOrg || ''}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">${o.LibTypOrg || ''} ${o.LibPays ? '· ' + o.LibPays : ''}</div>
          <div style="margin-top:6px">
            <span class="badge ${o.LibStatut === 'Actif' ? 'badge-green' : 'badge-grey'}">${o.LibStatut || '—'}</span>
          </div>
        </div>
      </div>

      <div class="dash-section-hd"><div class="dsh-line"></div><div class="dsh-title">🏛️ Informations</div><div class="dsh-line"></div></div>
      <div class="dem-info-grid" style="margin-bottom:20px">
        ${row('Identifiant', o.NumAgr)}
        ${row('Siège social', o.SiegeOrg)}
        ${row('Créée le', fmtDate(o.DateCreOrg))}
        ${row('Représentant', [o.NomRepresentant, o.FonctionRepresentant].filter(Boolean).join(' — '))}
      </div>

      <div class="dash-section-hd"><div class="dsh-line"></div><div class="dsh-title">📞 Coordonnées</div><div class="dsh-line"></div></div>
      <div class="dem-info-grid" style="margin-bottom:20px">
        ${row('Email', o.EmailOrg)}
        ${row('Téléphone', o.TelOrg)}
        ${row('Site web', o.SiteWeb)}
      </div>

      <div class="dash-section-hd"><div class="dsh-line"></div><div class="dsh-title">📊 Activité</div><div class="dsh-line"></div></div>
      <div class="dem-info-grid">
        ${row('Adhérents', o.nbAdherents)}
        ${row('Bénéficiaires', o.nbBeneficiaires)}
      </div>
    `;
  }
});
