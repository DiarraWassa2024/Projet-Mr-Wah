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
          <p style="text-align:center;margin-top:18px;font-size:13px">
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
  render();
});
