/**
 * Génère le HTML de la carte officielle (adhérent ou bénéficiaire) — page autonome
 * ouverte dans une fenêtre popup, avec ses propres boutons Retour / Imprimer.
 */
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}

function abbrevOrg(nom) {
  if (!nom) return 'SD';
  const words = nom.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map(w => w[0]).join('').slice(0, 4).toUpperCase();
}

/**
 * @param {object} opts
 *   type: 'adherent' | 'beneficiaire'
 *   orgName, roleLabel (fonction/rôle pour l'adhérent, "Bénéficiaire · LienParente" pour l'autre)
 *   idCode (NumAdherent / NumBenef), nom, prenom, dateNaissance, sexe, lieuNaissance
 *   lienAdherent (pour bénéficiaire uniquement : "Nom Prénom (NumAdherent)")
 *   photoUrl, initiales, qrDataUrl
 *   dateEtablissement, dateExpiration
 */
function buildCarteOfficielle(opts) {
  const {
    type, orgName, orgLogoUrl, roleLabel, idCode, nom, prenom, dateNaissance, sexe, lieuNaissance,
    lienAdherent, photoUrl, initiales, qrDataUrl, dateEtablissement, dateExpiration,
  } = opts;

  const isAdh = type === 'adherent';
  const orgAbbrev = abbrevOrg(orgName);
  const pillLabel = isAdh ? "CARTE D'ADHÉSION" : 'CARTE DE BÉNÉFICIAIRE';
  const titleBand = isAdh ? "CARTE D'ADHÉRENT OFFICIELLE" : 'CARTE DE BÉNÉFICIAIRE OFFICIELLE';
  const pageTitle = isAdh ? 'Carte d\'adhérent' : 'Carte de bénéficiaire';

  const photoHtml = photoUrl
    ? `<img src="${esc(photoUrl)}" class="cf-photo" alt="photo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <div class="cf-photo cf-photo-init" style="display:none">${esc(initiales)}</div>`
    : `<div class="cf-photo cf-photo-init">${esc(initiales)}</div>`;

  const fieldRow = (label, value) => `
    <div class="cf-field">
      <span class="cf-field-label">${esc(label)}</span>
      <span class="cf-field-val">${esc(value) || '—'}</span>
    </div>`;

  const identityFields = isAdh ? `
      ${fieldRow('Nom', nom)}
      ${fieldRow('Prénom', prenom)}
      ${fieldRow('Naissance', fmtDate(dateNaissance))}
      ${fieldRow('Sexe', sexe === 'Homme' ? 'Masculin' : sexe === 'Femme' ? 'Féminin' : sexe)}
      ${fieldRow('Lieu naiss.', lieuNaissance)}
    ` : `
      ${fieldRow('Nom', nom)}
      ${fieldRow('Prénom', prenom)}
      ${fieldRow('Naissance', fmtDate(dateNaissance))}
      ${fieldRow('Lien de parenté', roleLabel)}
      ${fieldRow('Adhérent responsable', lienAdherent)}
    `;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle} — ${esc(idCode || '')}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#eef1f5;font-family:'Segoe UI',Arial,sans-serif;min-height:100vh;padding:24px}
  .cf-topbar{max-width:560px;margin:0 auto 18px;display:flex;justify-content:space-between;align-items:center;gap:10px}
  .cf-topbar h1{font-size:20px;color:#0f172a}
  .cf-btn{padding:9px 18px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap}
  .cf-btn-back{background:#e2e8f0;color:#334155}
  .cf-btn-print{background:#0f172a;color:#fff}

  .cf-wrap{max-width:560px;margin:0 auto}
  .cf-card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,.14);margin-bottom:18px}

  .cf-hd{background:linear-gradient(135deg,#0284c7,#38bdf8);padding:18px 22px;display:flex;justify-content:space-between;align-items:flex-start;color:#fff}
  .cf-hd-left{display:flex;gap:12px;align-items:center}
  .cf-hd-icon{width:40px;height:40px;border-radius:10px;background:#0c4a6e;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0}
  .cf-hd-org{font-weight:800;font-size:16px;letter-spacing:.5px}
  .cf-hd-role{font-size:11px;color:#e0f2fe;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
  .cf-hd-pill{background:rgba(255,255,255,.2);color:#fff;font-size:10px;font-weight:700;letter-spacing:1px;padding:6px 12px;border-radius:20px;white-space:nowrap}

  .cf-title-band{background:#fff;border-bottom:1px solid #f1f5f9;padding:10px;text-align:center}
  .cf-title-band span{font-size:11px;font-weight:700;letter-spacing:2.5px;color:#1e3a5f}

  .cf-body{display:flex;gap:20px;padding:20px 22px}
  .cf-left{flex:1;min-width:0}
  .cf-id-box{background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;padding:9px 14px;margin-bottom:14px;display:inline-block}
  .cf-id-box span{font-family:'Courier New',monospace;font-weight:800;font-size:14px;color:#1e40af;letter-spacing:1px}
  .cf-field{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;border-bottom:1px solid #f1f5f9;gap:12px}
  .cf-field-label{font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#94a3b8;white-space:nowrap}
  .cf-field-val{font-size:14px;font-weight:700;color:#0f172a;text-align:right}

  .cf-right{width:112px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:8px}
  .cf-photo{width:108px;height:130px;border-radius:10px;object-fit:cover;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:#64748b;border:1px solid #e2e8f0}
  .cf-photo-badge{background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:4px 10px;border-radius:12px;white-space:nowrap}

  .cf-footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 22px;display:flex;justify-content:space-between;align-items:center;gap:16px}
  .cf-qr-wrap{text-align:center;flex-shrink:0}
  .cf-qr-wrap img{width:66px;height:66px;display:block;background:#fff;border-radius:6px;padding:2px}
  .cf-qr-label{font-size:8px;color:#94a3b8;letter-spacing:.8px;margin-top:4px;font-weight:700}
  .cf-dates{display:flex;gap:22px}
  .cf-date-item{text-align:left}
  .cf-date-label{font-size:9px;font-weight:700;letter-spacing:.5px;color:#94a3b8;text-transform:uppercase}
  .cf-date-val{font-size:13px;font-weight:700;color:#0f172a;margin-top:2px}
  .cf-date-val.exp{color:#0d9488}
  .cf-sig{text-align:center;flex-shrink:0}
  .cf-sig-label{font-size:8px;font-weight:700;letter-spacing:.5px;color:#94a3b8;text-transform:uppercase;margin-bottom:6px}
  .cf-sig-script{font-family:'Segoe Script','Brush Script MT',cursive;font-size:20px;color:#1e3a5f;border-bottom:1px solid #cbd5e1;padding:0 8px 4px;min-width:90px}
  .cf-sig-org{font-size:8px;color:#cbd5e1;margin-top:4px;font-weight:700;letter-spacing:1px}

  @media (max-width: 480px) {
    body{padding:14px}
    .cf-topbar{flex-wrap:wrap;justify-content:center;text-align:center}
    .cf-topbar h1{order:-1;width:100%;font-size:17px;margin-bottom:6px}
    .cf-btn{padding:8px 14px;font-size:12px}
    .cf-body{flex-direction:column-reverse;align-items:center}
    .cf-right{width:100%}
    .cf-photo{width:120px;height:140px}
    .cf-left{width:100%}
    .cf-footer{flex-wrap:wrap;justify-content:center;gap:14px}
    .cf-dates{gap:16px}
  }

  @media print {
    body{background:#fff;padding:0}
    .cf-topbar{display:none}
    .cf-card{box-shadow:none;border:1px solid #e2e8f0}
  }
</style>
</head>
<body>
  <div class="cf-topbar">
    <button class="cf-btn cf-btn-back" onclick="window.close()">← Retour</button>
    <h1>${pageTitle}</h1>
    <button class="cf-btn cf-btn-print" onclick="window.print()">🖨️ Imprimer / PDF</button>
  </div>

  <div class="cf-wrap">
    <div class="cf-card">
      <div class="cf-hd">
        <div class="cf-hd-left">
          <div class="cf-hd-icon">${orgLogoUrl ? `<img src="${esc(orgLogoUrl)}" alt="${esc(orgName)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : esc(orgAbbrev[0] || 'S')}</div>
          <div>
            <div class="cf-hd-org">${esc(orgAbbrev)}</div>
            ${isAdh ? `<div class="cf-hd-role">${esc(roleLabel || 'Membre')}</div>` : ''}
          </div>
        </div>
        <div class="cf-hd-pill">${pillLabel}</div>
      </div>

      <div class="cf-title-band"><span>${titleBand}</span></div>

      <div class="cf-body">
        <div class="cf-left">
          <div class="cf-id-box"><span>${esc(idCode || '—')}</span></div>
          ${identityFields}
        </div>
        <div class="cf-right">
          ${photoHtml}
          <div class="cf-photo-badge">${photoUrl ? '✓ Photo enregistrée' : 'Photo non fournie'}</div>
        </div>
      </div>

      <div class="cf-footer">
        <div class="cf-qr-wrap">
          <img src="${qrDataUrl}" alt="QR">
          <div class="cf-qr-label">SCANNER POUR<br>VÉRIFIER</div>
        </div>
        <div class="cf-dates">
          <div class="cf-date-item">
            <div class="cf-date-label">Établissement</div>
            <div class="cf-date-val">${fmtDate(dateEtablissement)}</div>
          </div>
          <div class="cf-date-item">
            <div class="cf-date-label">Expiration</div>
            <div class="cf-date-val exp">${fmtDate(dateExpiration)}</div>
          </div>
        </div>
        <div class="cf-sig">
          <div class="cf-sig-label">Signature du président</div>
          <div class="cf-sig-script">Le Président</div>
          <div class="cf-sig-org"><img src="/images/logo.svg" alt="SoliDev" style="width:14px;height:14px;vertical-align:middle;border-radius:3px;margin-right:3px"> SOLIDEV</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { buildCarteOfficielle };
