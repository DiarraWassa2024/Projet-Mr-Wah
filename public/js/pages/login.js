router.register('login', () => {
  const app = document.getElementById('app');
  let isRegister = false;

  function render() {
    app.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <div class="auth-logo">
            <div class="logo-circle">GPO</div>
            <h1>${i18n.t('appName')}</h1>
            <p>${i18n.t('platformDesc')}</p>
          </div>
          <div class="auth-tabs">
            <button class="${!isRegister ? 'active' : ''}" id="tabLogin">${i18n.t('login')}</button>
            <button class="${isRegister ? 'active' : ''}" id="tabRegister">${i18n.t('register')}</button>
          </div>
          <form id="authForm" class="auth-form">
            ${isRegister ? `<div class="form-group">
              <label>${i18n.t('username')}</label>
              <input type="text" id="username" required placeholder="${i18n.t('username')}">
            </div>` : ''}
            <div class="form-group">
              <label>${i18n.t('email')}</label>
              <input type="email" id="email" required placeholder="admin@gpo.org">
            </div>
            <div class="form-group">
              <label>${i18n.t('password')}</label>
              <input type="password" id="password" required placeholder="••••••••">
            </div>
            <div id="authMsg" class="msg" style="display:none"></div>
            <button type="submit" class="btn btn-primary btn-block">
              ${isRegister ? i18n.t('register') : i18n.t('login')}
            </button>
          </form>
          <div class="lang-switch">
            <button onclick="i18n.load('fr');router.navigate('login')" class="${i18n.current()==='fr'?'active':''}">🇫🇷 FR</button>
            <button onclick="i18n.load('en');router.navigate('login')" class="${i18n.current()==='en'?'active':''}">🇬🇧 EN</button>
          </div>
        </div>
      </div>`;

    document.getElementById('tabLogin').onclick    = () => { isRegister = false; render(); };
    document.getElementById('tabRegister').onclick = () => { isRegister = true;  render(); };

    document.getElementById('authForm').onsubmit = async e => {
      e.preventDefault();
      const msg = document.getElementById('authMsg');
      try {
        if (isRegister) {
          await auth.register(
            document.getElementById('username').value,
            document.getElementById('email').value,
            document.getElementById('password').value
          );
          isRegister = false;
          msg.style.display = 'block';
          msg.className = 'msg success';
          msg.textContent = 'Compte créé ! Connectez-vous.';
          render(); return;
        }
        await auth.login(document.getElementById('email').value, document.getElementById('password').value);
        showShell();
        router.navigate('dashboard');
      } catch (err) {
        msg.style.display = 'block';
        msg.className = 'msg error';
        msg.textContent = err.message;
      }
    };
  }
  render();
});
