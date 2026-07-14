router.register('login', () => {
  const app = document.getElementById('app');

  function render() {
    app.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <div class="auth-logo">
            <div class="logo-circle"><img src="/images/logo.svg" alt="SoliDev"></div>
            <h1>${i18n.t('appName')}</h1>
            <p>${i18n.t('platformDesc')}</p>
          </div>
          <form id="authForm" class="auth-form">
            <div class="form-group">
              <label>${i18n.t('loginField')}</label>
              <input type="text" id="email" required placeholder="admin">
            </div>
            <div class="form-group">
              <label>${i18n.t('password')}</label>
              <input type="password" id="password" required placeholder="••••••••">
            </div>
            <div id="authMsg" class="msg" style="display:none"></div>
            <button type="submit" class="btn btn-primary btn-block">
              ${i18n.t('login')}
            </button>
          </form>
          <p style="text-align:center;margin-top:12px">
            <button type="button" id="btnMotDePasseOublie" style="background:none;border:none;cursor:pointer;color:#64748b;font-family:inherit;font-size:12.5px">
              Mot de passe oublié ?
            </button>
          </p>
          <p style="text-align:center;margin-top:6px;font-size:13px">
            <button type="button" id="btnGoAdhesion" style="background:none;border:none;cursor:pointer;color:var(--primary);font-weight:600;font-family:inherit;font-size:13px">
              Pas encore de compte ? Adhérer à SoliDev →
            </button>
          </p>
          <div class="lang-menu lang-menu-center" id="loginLangMenu">
            <button class="lang-menu-btn" id="loginLangBtn">
              <span>${(i18n.available().find(l=>l.code===i18n.current())||{}).flag||''} ${i18n.current().toUpperCase()}</span>
              <span class="tb-arrow">▾</span>
            </button>
            <div class="lang-dropdown" id="loginLangDropdown">
              ${i18n.available().map(l => `<button class="lang-item ${i18n.current()===l.code?'active':''}" data-lang="${l.code}">${l.flag} ${l.label}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>`;

    document.getElementById('btnGoAdhesion').onclick = () => landingNav('adhesion');
    document.getElementById('btnMotDePasseOublie').onclick = () => ouvrirModalMotDePasseOublie();

    document.getElementById('loginLangBtn').addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('loginLangMenu').classList.toggle('open');
    });
    document.querySelectorAll('#loginLangDropdown .lang-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        await i18n.load(btn.dataset.lang);
        router.navigate('login');
      });
    });

    document.getElementById('authForm').onsubmit = async e => {
      e.preventDefault();
      const msg = document.getElementById('authMsg');
      try {
        await auth.login(document.getElementById('email').value, document.getElementById('password').value);
        await enterAppAfterLogin();
      } catch (err) {
        msg.style.display = 'block';
        msg.className = 'msg error';
        msg.textContent = err.message;
      }
    };
  }

  function ouvrirModalMotDePasseOublie() {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="mdpOublieModal">
        <div class="modal conf-modal">
          <h3>Mot de passe oublié</h3>
          <p style="color:#64748b;font-size:13px">Entrez votre identifiant ou votre email — si un compte correspond, un lien de réinitialisation valable 1 heure vous sera envoyé par email.</p>
          <div class="form-group" style="margin-top:12px">
            <input type="text" id="mdpOublieIdentifiant" placeholder="Identifiant ou email" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px">
          </div>
          <div id="mdpOublieMsg" class="msg" style="display:none;margin-top:10px"></div>
          <div class="conf-actions" style="margin-top:16px">
            <button class="btn btn-secondary" id="mdpOublieCancel">Annuler</button>
            <button class="btn btn-primary" id="mdpOublieOk">Envoyer le lien</button>
          </div>
        </div>
      </div>`);
    const close = () => document.getElementById('mdpOublieModal')?.remove();
    document.getElementById('mdpOublieCancel').onclick = close;
    document.getElementById('mdpOublieOk').onclick = async () => {
      const identifiant = document.getElementById('mdpOublieIdentifiant').value.trim();
      const msg = document.getElementById('mdpOublieMsg');
      if (!identifiant) return;
      const btn = document.getElementById('mdpOublieOk');
      btn.disabled = true; btn.textContent = 'Envoi…';
      try {
        const res = await fetch('/api/auth/mot-de-passe-oublie', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiant }),
        });
        const data = await res.json();
        msg.style.display = 'block';
        msg.className = 'msg ok';
        msg.textContent = data.message;
        btn.textContent = 'Envoyé ✓';
      } catch (e) {
        msg.style.display = 'block';
        msg.className = 'msg error';
        msg.textContent = 'Erreur — réessayez plus tard';
        btn.disabled = false; btn.textContent = 'Envoyer le lien';
      }
    };
  }

  render();
});
