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
                    <span class="don-currency">XOF</span>
                  </div>
                </div>
                <div class="form-group">
                  <label>Cause / Organisation bénéficiaire</label>
                  <select name="cause">
                    <option value="">Général — SoliDev</option>
                    <option value="sante">🏥 Santé communautaire</option>
                    <option value="education">📚 Éducation</option>
                    <option value="agriculture">🌾 Agriculture durable</option>
                    <option value="femmes">👩 Autonomisation des femmes</option>
                    <option value="eau">💧 Accès à l'eau</option>
                    <option value="urgence">🆘 Aide d'urgence</option>
                  </select>
                </div>
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
                  <label>Téléphone (Mobile Money)</label>
                  <input type="text" name="tel" placeholder="+225 07 00 00 00">
                </div>
                <div class="form-group">
                  <label>Mode de paiement</label>
                  <select name="modePaiement">
                    <option value="mobile_money">📱 Mobile Money</option>
                    <option value="orange_money">🟠 Orange Money</option>
                    <option value="wave">🌊 Wave</option>
                    <option value="virement">🏦 Virement bancaire</option>
                    <option value="especes">💵 Espèces (au siège)</option>
                  </select>
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

          <div id="donMsg" class="msg" style="display:none"></div>

          <div class="form-actions" style="margin-top:8px">
            <button type="button" class="btn btn-secondary" onclick="landingNav('landing')">Annuler</button>
            <button type="submit" class="btn btn-don-submit">💝 Confirmer mon don</button>
          </div>
        </form>
      </div>
    </div>`;

  document.getElementById('donForm').onsubmit = async e => {
    e.preventDefault();
    const fd   = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.anonyme = e.target.querySelector('[name="anonyme"]').checked;
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
      document.querySelector('.don-card').innerHTML = `
        <div class="pub-success">
          <div class="success-icon">💝</div>
          <h3>Merci pour votre générosité !</h3>
          <p>Votre don de <strong>${Number(body.montant).toLocaleString('fr-FR')} XOF</strong>
             a bien été enregistré. Référence : <strong>#${data.id}</strong><br><br>
             Notre équipe vous contactera sous 24h pour les modalités de versement.</p>
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
  if (inp) { inp.value = val; syncAmt(val); }
}

function focusDonCustom() {
  document.querySelectorAll('.don-amt').forEach(b => b.classList.remove('active'));
  document.querySelector('.don-amt-custom')?.classList.add('active');
  document.getElementById('donMontant')?.focus();
}

function syncAmt(val) {
  const total = document.getElementById('donTotalVal');
  if (total) total.textContent = val ? `${Number(val).toLocaleString('fr-FR')} XOF` : '—';
}
