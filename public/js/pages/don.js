router.register('don', async () => {
  if (!document.getElementById('app')) document.body.innerHTML = '<div id="app"></div>';
  document.body.className = '';

  document.body.innerHTML = `
    <div class="pub-form-wrap">
      <button class="pub-form-back" onclick="landingNav('landing')">← Retour à l'accueil</button>

      <div class="pub-form-card don-card">
        <div class="pub-form-logo">
          <img src="/images/logo.svg" class="logo-sm" alt="SoliDev">
          <span>SoliDev</span>
        </div>

        <div class="don-hero">
          <h2>Faire un don</h2>
          <p>Votre générosité soutient les associations et les communautés africaines.<br>
             Chaque contribution compte, quelle que soit sa taille.</p>
        </div>

        <!-- Montants rapides -->
        <div class="don-amounts">
          <button class="don-amt" data-val="1000"  onclick="selectDonAmt(1000)">1 000 XOF</button>
          <button class="don-amt" data-val="5000"  onclick="selectDonAmt(5000)">5 000 XOF</button>
          <button class="don-amt" data-val="10000" onclick="selectDonAmt(10000)">10 000 XOF</button>
          <button class="don-amt" data-val="25000" onclick="selectDonAmt(25000)">25 000 XOF</button>
          <button class="don-amt don-amt-custom" onclick="focusDonCustom()">Autre montant</button>
        </div>

        <form id="donForm">
          <div class="adh-section adh-section-ind">
            <div class="adh-section-header adh-header-don">
              <div class="adh-section-num">1</div>
              <div>
                <div class="adh-section-title">Votre don</div>
                <div class="adh-section-sub">Choisissez le montant et la destination de votre contribution</div>
              </div>
            </div>
            <div class="adh-section-body">
              <div class="form-row">
                <div class="form-group">
                  <label>Montant du don *</label>
                  <div class="don-input-wrap">
                    <input type="number" name="montant" id="donMontant" required min="100" placeholder="Ex : 5000"
                           oninput="syncAmt(this.value)">
                    <span class="don-currency" id="donCurrencySymbol">XOF</span>
                  </div>
                </div>
                <div class="form-group">
                  <label>Organisation bénéficiaire</label>
                  <select name="numAgr" id="donOrgSelect">
                    <option value="">Général — SoliDev</option>
                    <option value="" disabled>⏳ Chargement des organisations…</option>
                  </select>
                  <div class="don-org-hint" id="donOrgHint"></div>
                </div>
              </div>
              <div class="form-group" id="donCampagneGroup" style="display:none">
                <label>Campagne (optionnel)</label>
                <select name="idCampagne" id="donCampagneSelect">
                  <option value="">Don général à l'organisation</option>
                </select>
                <div id="donCampagneProgress"></div>
              </div>
              <div class="form-group">
                <label>Message (optionnel)</label>
                <textarea name="message" rows="2" placeholder="Un mot pour accompagner votre don…"></textarea>
              </div>
            </div>
          </div>

          <div class="adh-section adh-section-rep">
            <div class="adh-section-header adh-header-purple">
              <div class="adh-section-num">2</div>
              <div>
                <div class="adh-section-title">Vos coordonnées</div>
                <div class="adh-section-sub">Pour votre reçu de don (optionnel mais recommandé)</div>
              </div>
            </div>
            <div class="adh-section-body">
              <div class="form-row">
                <div class="form-group">
                  <label>Nom complet</label>
                  <input type="text" name="nom" placeholder="Nom et prénom">
                </div>
                <div class="form-group">
                  <label>Email</label>
                  <input type="email" name="email" placeholder="votre@email.com">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>🌍 Votre pays</label>
                  <select id="donPaysSelect">
                    ${Object.values(PAYS_CONFIG).map(p => `<option value="${p.code}">${p.drapeau} ${p.nom}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label>Téléphone (Mobile Money)</label>
                  <input type="text" name="tel" id="donTel" placeholder="+225 07 00 00 00">
                </div>
              </div>
              <div class="form-group">
                <label>Mode de paiement</label>
                <input type="hidden" name="modePaiement" id="donModePaiement" value="">
                <div class="don-pay-methods" id="donPayMethods">
                  <div class="don-pay-loading">⏳ Chargement des moyens de paiement…</div>
                </div>
              </div>
              <label class="don-anon">
                <input type="checkbox" name="anonyme"> Don anonyme (vos coordonnées ne seront pas publiées)
              </label>
            </div>
          </div>

          <div class="don-total-row" id="donTotal">
            <span>Montant à verser :</span>
            <strong id="donTotalVal">—</strong>
          </div>
          <div class="don-split-hint" id="donSplitHint"></div>

          <div id="donMsg" class="msg" style="display:none"></div>

          <div class="form-actions" style="margin-top:8px">
            <button type="button" class="btn btn-secondary" onclick="landingNav('landing')">Annuler</button>
            <button type="submit" class="btn btn-don-submit">💝 Confirmer mon don</button>
          </div>
        </form>
      </div>
    </div>`;

  // ── Organisations bénéficiaires (liste complète, orgs déjà inscrites) ──
  (async () => {
    const sel = document.getElementById('donOrgSelect');
    try {
      const res  = await fetch('/api/public/organisations?all=1');
      const data = await res.json();
      const orgs = data.orgs || [];
      sel.innerHTML = `<option value="">Général — SoliDev</option>` + orgs.map(o => `
        <option value="${o.NumAgr}" data-name="${o.LibOrg}">${o.LibOrg}${o.Ville ? ' — ' + o.Ville : ''}</option>
      `).join('');
    } catch (_) {
      sel.innerHTML = `<option value="">Général — SoliDev</option>`;
    }
  })();
  document.getElementById('donOrgSelect').addEventListener('change', updateSplitHint);

  // ── Campagnes actives de l'organisation sélectionnée ──────────
  async function loadCampagnes(numAgr) {
    const group    = document.getElementById('donCampagneGroup');
    const sel      = document.getElementById('donCampagneSelect');
    const progress = document.getElementById('donCampagneProgress');
    if (!numAgr) { group.style.display = 'none'; sel.innerHTML = `<option value="">Don général à l'organisation</option>`; progress.innerHTML = ''; return; }

    try {
      const res  = await fetch(`/api/public/campagnes?numAgr=${encodeURIComponent(numAgr)}`);
      const camps = res.ok ? await res.json() : [];
      if (!camps.length) { group.style.display = 'none'; sel.innerHTML = `<option value="">Don général à l'organisation</option>`; progress.innerHTML = ''; return; }

      group.style.display = '';
      sel.innerHTML = `<option value="">Don général à l'organisation</option>` + camps.map(c => `
        <option value="${c.idCampagne}" data-objectif="${c.objectifMontant}" data-collecte="${c.montantCollecte}">${c.titre}</option>
      `).join('');
      updateCampagneProgress();
    } catch (_) { group.style.display = 'none'; }
  }

  function updateCampagneProgress() {
    const sel      = document.getElementById('donCampagneSelect');
    const progress = document.getElementById('donCampagneProgress');
    const opt      = sel.selectedOptions[0];
    if (!opt?.value) { progress.innerHTML = ''; return; }
    const objectif = Number(opt.dataset.objectif) || 0;
    const collecte = Number(opt.dataset.collecte) || 0;
    const pct = objectif ? Math.min(100, Math.round(collecte / objectif * 100)) : 0;
    progress.innerHTML = `
      <div class="don-campagne-bar"><div class="don-campagne-fill" style="width:${pct}%"></div></div>
      <div class="don-campagne-label">${collecte.toLocaleString('fr-FR')} / ${objectif.toLocaleString('fr-FR')} XOF collectés (${pct}%)</div>`;
  }
  document.getElementById('donCampagneSelect').addEventListener('change', updateCampagneProgress);
  document.getElementById('donOrgSelect').addEventListener('change', e => loadCampagnes(e.target.value));

  // ── Moyens de paiement (opérateurs du pays sélectionné + virement/espèces) ──
  let selectedMode = '';
  async function loadPaymentMethods(codePays) {
    const box = document.getElementById('donPayMethods');
    box.innerHTML = `<div class="don-pay-loading">⏳ Chargement des moyens de paiement…</div>`;
    let operateurs = [];
    try {
      const res  = await fetch(`/api/public/paiement-operateurs/${codePays}`);
      if (res.ok) { const cfg = await res.json(); operateurs = cfg.operateurs || []; }
    } catch (_) { /* pas d'opérateurs mobile money pour ce pays — reste virement/espèces */ }

    const extra = [
      { code: 'virement', label: 'Virement bancaire', icon: '🏦' },
      { code: 'especes',  label: 'Espèces (au siège)', icon: '💵' },
    ];
    const all = [...operateurs, ...extra];
    selectedMode = all[0]?.code || '';
    document.getElementById('donModePaiement').value = selectedMode;

    box.innerHTML = all.map(o => `
      <button type="button" class="don-pay-btn${o.code === selectedMode ? ' active' : ''}" data-code="${o.code}">
        <span class="don-pay-logo">${(typeof paymentLogo === 'function' && paymentLogo(o.code)) || o.icon || ''}</span>
        <span>${o.label}</span>
      </button>`).join('');

    box.querySelectorAll('.don-pay-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedMode = btn.dataset.code;
        document.getElementById('donModePaiement').value = selectedMode;
        box.querySelectorAll('.don-pay-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
  }

  const paysSelect = document.getElementById('donPaysSelect');
  const savedCountry = localStorage.getItem('sd_country');
  paysSelect.value = (savedCountry && PAYS_CONFIG[savedCountry]) ? savedCountry : 'CIV';
  function onPaysChange() {
    const p = PAYS_CONFIG[paysSelect.value];
    document.getElementById('donCurrencySymbol').textContent = p?.devise?.symbole || 'XOF';
    document.getElementById('donTel').placeholder = `${p?.indicatif || '+225'} 07 00 00 00`;
    loadPaymentMethods(paysSelect.value);
  }
  paysSelect.addEventListener('change', onPaysChange);
  onPaysChange();

  // ── Transparence commission plateforme ──
  function updateSplitHint() {
    const hintEl  = document.getElementById('donSplitHint');
    const orgHint = document.getElementById('donOrgHint');
    const numAgr  = document.getElementById('donOrgSelect').value;
    const montant = Number(document.getElementById('donMontant').value) || 0;
    if (!numAgr) {
      orgHint.textContent = '';
      hintEl.textContent = montant
        ? `100% de votre don (${montant.toLocaleString('fr-FR')} XOF) soutient directement la plateforme SoliDev.`
        : '';
      return;
    }
    orgHint.textContent = `Ce don sera versé à l'organisation choisie (une petite commission de plateforme s'applique).`;
    if (montant) {
      const pct        = 20; // affichage indicatif — le taux exact appliqué est confirmé après soumission
      const commission = Math.round(montant * pct / 100);
      const netOrg      = montant - commission;
      hintEl.textContent = `≈ ${netOrg.toLocaleString('fr-FR')} XOF pour l'organisation · `
        + `${commission.toLocaleString('fr-FR')} XOF (${pct}%) de commission pour la plateforme SoliDev.`;
    } else {
      hintEl.textContent = '';
    }
  }
  document.getElementById('donMontant').addEventListener('input', updateSplitHint);

  document.getElementById('donForm').onsubmit = async e => {
    e.preventDefault();
    const fd   = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.anonyme    = e.target.querySelector('[name="anonyme"]').checked;
    body.codeDevise = PAYS_CONFIG[paysSelect.value]?.devise?.code || 'XOF';
    if (!body.montant || body.montant < 100) {
      const msg = document.getElementById('donMsg');
      msg.style.display = 'block'; msg.className = 'msg error';
      msg.textContent   = 'Veuillez entrer un montant valide (minimum 100 XOF)';
      return;
    }
    const submitBtn = e.target.querySelector('[type="submit"]');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Envoi…';
    try {
      const res  = await fetch('/api/public/don', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const orgOpt   = document.getElementById('donOrgSelect').selectedOptions[0];
      const orgLabel = orgOpt?.dataset.name || orgOpt?.textContent || '';
      document.querySelector('.don-card').innerHTML = `
        <div class="pub-success">
          <div class="success-icon">💝</div>
          <h3>Merci pour votre générosité !</h3>
          <p>Votre don de <strong>${Number(body.montant).toLocaleString('fr-FR')} XOF</strong>
             a bien été enregistré. Référence : <strong>#${data.id}</strong><br>
             ${body.numAgr
               ? `<strong>${Number(data.montantOrg).toLocaleString('fr-FR')} XOF</strong> seront versés à <strong>${orgLabel}</strong>,
                  et <strong>${Number(data.montantPlateforme).toLocaleString('fr-FR')} XOF</strong> (${data.tauxCommission}%)
                  reviennent à la plateforme SoliDev en commission.`
               : `L'intégralité (<strong>${Number(data.montantPlateforme).toLocaleString('fr-FR')} XOF</strong>) soutient directement la plateforme SoliDev.`}
             <br><br>Notre équipe vous contactera sous 24h pour les modalités de versement.</p>
          <button class="btn btn-don-submit" onclick="landingNav('don')">Faire un autre don</button>
          <button class="btn btn-secondary" onclick="landingNav('landing')" style="margin-left:10px">← Accueil</button>
        </div>`;
    } catch(err) {
      const msg = document.getElementById('donMsg');
      msg.style.display = 'block'; msg.className = 'msg error';
      msg.textContent   = err.message;
      submitBtn.disabled    = false;
      submitBtn.textContent = '💝 Confirmer mon don';
    }
  };
});

function selectDonAmt(val) {
  document.querySelectorAll('.don-amt').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.don-amt[data-val="${val}"]`);
  if (btn) btn.classList.add('active');
  const inp = document.getElementById('donMontant');
  // Un événement réel (pas un simple appel direct) pour que les autres listeners liés au champ
  // (ex. le rappel de répartition commission plateforme / organisation) se déclenchent aussi.
  if (inp) { inp.value = val; inp.dispatchEvent(new Event('input', { bubbles: true })); }
}

function focusDonCustom() {
  document.querySelectorAll('.don-amt').forEach(b => b.classList.remove('active'));
  document.querySelector('.don-amt-custom')?.classList.add('active');
  document.getElementById('donMontant')?.focus();
}

function syncAmt(val) {
  const total = document.getElementById('donTotalVal');
  const symbol = document.getElementById('donCurrencySymbol')?.textContent || 'XOF';
  if (total) total.textContent = val ? `${Number(val).toLocaleString('fr-FR')} ${symbol}` : '—';
}
