/* ── Toast global ──────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `gpo-toast gpo-toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// Initialise l'application après le chargement du DOM
document.addEventListener('DOMContentLoaded', async () => {
  // Charge la locale stockée (ou FR par défaut)
  await i18n.load(localStorage.getItem('gpo_lang') || 'fr');

  // Lien de paiement d'adhésion reçu par email (?paiement=ID sur la racine) — page publique, prioritaire
  const idPaiementLien = new URLSearchParams(location.search).get('paiement');
  if (idPaiementLien && location.pathname === '/') {
    router.navigate('paiement-adhesion', { idPaiement: idPaiementLien });
    return;
  }

  // Prépare le shell (si connecté) puis résout la route depuis l'URL courante
  // (gère les liens directs / le rafraîchissement de page sur n'importe quelle route)
  if (auth.isLoggedIn()) {
    const pending = await getPendingPayment();
    if (pending) { renderPaymentGate(pending); return; }
    showShell();
    // Un utilisateur connecté qui arrive sur la racine "/" voit le tableau de bord, pas la vitrine
    if (location.pathname === '/') { router.navigate('dashboard'); return; }
  }
  router.resolveInitialRoute();
});

/** Récupère le paiement de cotisation en attente de l'utilisateur connecté (ou null). */
async function getPendingPayment() {
  try { return await api.get('/paiements/mon-paiement-attente'); }
  catch (_) { return null; }
}

/** Après connexion : soit le paiement est en attente (gate), soit accès direct au tableau de bord. */
async function enterAppAfterLogin() {
  const pending = await getPendingPayment();
  if (pending) { renderPaymentGate(pending); return; }
  showShell();
  router.navigate('dashboard');
}

/** Écran plein — règlement de la cotisation avant accès à l'espace personnel. */
function renderPaymentGate(pay) {
  document.body.className = '';
  document.body.innerHTML = `
    <div class="pub-form-wrap">
      <button class="pub-form-back" onclick="doLogout()">🚪 Déconnexion</button>
      <div class="pub-form-card" style="max-width:460px">
        <div class="pub-form-logo">
          <div class="pub-form-brand"><img src="/images/logo.svg" class="logo-sm" alt="SoliDev"><span>SoliDev</span></div>
        </div>
        <h2 style="text-align:center;margin-bottom:4px">💳 Réglez votre cotisation</h2>
        <p style="text-align:center;color:#64748b;font-size:13px;margin-bottom:20px">
          Bienvenue ! Il ne reste qu'une étape avant d'accéder à votre espace personnel.
        </p>
        <div id="gatePaymentWidget"></div>
      </div>
    </div>`;

  renderPaymentWidget(document.getElementById('gatePaymentWidget'), {
    codePays: pay.CodePays,
    montant: pay.MontantPaiement,
    idPaiement: pay.IdPaiement,
    authenticated: true,
    onSuccess: () => {
      showToast('Paiement confirmé ! Bienvenue.', 'success');
      setTimeout(() => { showShell(); router.navigate('dashboard'); }, 1200);
    },
  });
}

function showShell() {
  const user = auth.getUser();
  if (!user) return;

  const isGestionnaire = user.role === 'gestionnaire';
  const isAdherent = user.role === 'adherent';

  // Couleur propre à chaque interface (admin/organisation/adhérent) — voir style.css
  // (body.role-gestionnaire / body.role-adherent, --primary et accents de sidebar).
  document.body.classList.remove('role-admin', 'role-gestionnaire', 'role-adherent');
  document.body.classList.add(isGestionnaire ? 'role-gestionnaire' : isAdherent ? 'role-adherent' : 'role-admin');
  const displayName = isGestionnaire ? (user.orgName || user.username)
                     : isAdherent    ? (user.adherentName || user.username)
                     : user.username;
  const roleLabel = isGestionnaire ? 'Organisation' : isAdherent ? 'Adhérent' : user.role;
  const initials = (displayName || 'U').charAt(0).toUpperCase();

  const navGestionnaire = `
          <div class="sb-group">
            <div class="sb-group-label">Principal</div>
            <a class="sb-item active" data-route="dashboard" href="#" onclick="nav('dashboard')">
              <span class="sb-icon si-blue">📊</span>
              <span>Tableau de bord</span>
            </a>
          </div>
          <div class="sb-group">
            <div class="sb-group-label">Mon espace</div>
            <a class="sb-item" data-route="mon-organisation" href="#" onclick="nav('mon-organisation')">
              <span class="sb-icon si-violet">🏢</span>
              <span>Mon organisation</span>
            </a>
            <a class="sb-item" data-route="demandes" href="#" onclick="nav('demandes')" id="demNav">
              <span class="sb-icon si-indigo">📨</span>
              <span>Demandes d'adhésion</span>
              <span class="sb-badge" id="demBadge" style="display:none"></span>
            </a>
            <a class="sb-item" data-route="paiements" href="#" onclick="nav('paiements')">
              <span class="sb-icon si-orange">💰</span>
              <span>Paiements</span>
            </a>
            <a class="sb-item" data-route="remboursements" href="#" onclick="nav('remboursements')">
              <span class="sb-icon si-red">↩️</span>
              <span>Remboursements</span>
            </a>
            <a class="sb-item" data-route="dettes" href="#" onclick="nav('dettes')">
              <span class="sb-icon si-amber">💳</span>
              <span>Dettes des membres</span>
            </a>
            <a class="sb-item" data-route="contenu" href="#" onclick="nav('contenu')">
              <span class="sb-icon si-teal">📰</span>
              <span>Mes actualités</span>
            </a>
            <a class="sb-item" data-route="opportunites" href="#" onclick="nav('opportunites')">
              <span class="sb-icon si-lime">🔍</span>
              <span>Recherche des opportunités</span>
            </a>
          </div>`;

  const navAdherent = `
          <div class="sb-group">
            <div class="sb-group-label">Principal</div>
            <a class="sb-item active" data-route="dashboard" href="#" onclick="nav('dashboard')">
              <span class="sb-icon si-blue">📊</span>
              <span>Tableau de bord</span>
            </a>
          </div>
          <div class="sb-group">
            <div class="sb-group-label">Mon espace</div>
            <a class="sb-item" data-route="paiements" href="#" onclick="nav('paiements')">
              <span class="sb-icon si-orange">💰</span>
              <span>Mes paiements</span>
            </a>
            <a class="sb-item" data-route="remboursements" href="#" onclick="nav('remboursements')">
              <span class="sb-icon si-red">↩️</span>
              <span>Mes remboursements</span>
            </a>
          </div>`;

  const navAdmin = `
          <!-- Principal -->
          <div class="sb-group">
            <div class="sb-group-label">Principal</div>
            <a class="sb-item active" data-route="dashboard" href="#" onclick="nav('dashboard')">
              <span class="sb-icon si-blue">📊</span>
              <span>Tableau de bord</span>
            </a>
          </div>

          <!-- Gestion (ordre : Individus, Organisations, Bénéficiaires, Demandes, Prestataires, Prestations, Habilitations) -->
          <div class="sb-group">
            <div class="sb-group-label">Gestion</div>
            <a class="sb-item sb-item-expand" data-route="adherents" href="#" onclick="nav('adherents')">
              <span class="sb-icon si-green">👥</span>
              <span class="sb-item-label">Individus</span>
              <span class="sb-caret" onclick="toggleSubgroup(event,'sub-adherents')">▾</span>
            </a>
            <div class="sb-subgroup" id="sub-adherents">
              <a class="sb-subitem" data-route="adherents-asso" href="#" onclick="navFilteredAdh('adherents','Association')">
                <span class="sb-dot" style="background:#3b82f6"></span>Associations
              </a>
              <a class="sb-subitem" data-route="adherents-ong" href="#" onclick="navFilteredAdh('adherents','ONG')">
                <span class="sb-dot" style="background:#10b981"></span>ONG
              </a>
              <a class="sb-subitem" data-route="adherents-mut" href="#" onclick="navFilteredAdh('adherents','Mutuelle')">
                <span class="sb-dot" style="background:#f59e0b"></span>Mutuelles
              </a>
            </div>
            <a class="sb-item sb-item-expand" data-route="organisations" href="#" onclick="nav('organisations')">
              <span class="sb-icon si-violet">🏢</span>
              <span class="sb-item-label">Toutes les organisations</span>
              <span class="sb-caret" onclick="toggleSubgroup(event,'sub-organisations')">▾</span>
            </a>
            <div class="sb-subgroup" id="sub-organisations">
              <a class="sb-subitem" data-route="organisations-asso" href="#" onclick="navFiltered('organisations','Association')">
                <span class="sb-dot" style="background:#3b82f6"></span>Associations
              </a>
              <a class="sb-subitem" data-route="organisations-ong" href="#" onclick="navFiltered('organisations','ONG')">
                <span class="sb-dot" style="background:#10b981"></span>ONG
              </a>
              <a class="sb-subitem" data-route="organisations-mut" href="#" onclick="navFiltered('organisations','Mutuelle')">
                <span class="sb-dot" style="background:#f59e0b"></span>Mutuelles
              </a>
            </div>
            <a class="sb-item" data-route="beneficiaires" href="#" onclick="nav('beneficiaires')">
              <span class="sb-icon si-amber">🤝</span>
              <span>Bénéficiaires</span>
            </a>
            <a class="sb-item" data-route="demandes" href="#" onclick="nav('demandes')" id="demNav">
              <span class="sb-icon si-indigo">📨</span>
              <span>Demandes d'adhésion</span>
              <span class="sb-badge" id="demBadge" style="display:none"></span>
            </a>
            <a class="sb-item" data-route="prestataires" href="#" onclick="nav('prestataires')">
              <span class="sb-icon si-red">🩺</span>
              <span>Prestataires</span>
            </a>
            <a class="sb-item" data-route="prestations" href="#" onclick="nav('prestations')">
              <span class="sb-icon si-red">🛠️</span>
              <span>Prestations</span>
            </a>
            <a class="sb-item" data-route="habilitation" href="#" onclick="nav('habilitation')">
              <span class="sb-icon si-rose">🔐</span>
              <span>Habilitations</span>
            </a>
          </div>

          <!-- Opérations -->
          <div class="sb-group">
            <div class="sb-group-label">Opérations</div>
            <a class="sb-item" data-route="paiements" href="#" onclick="nav('paiements')">
              <span class="sb-icon si-orange">💰</span>
              <span>Paiements</span>
            </a>
            <a class="sb-item" data-route="remboursements" href="#" onclick="nav('remboursements')">
              <span class="sb-icon si-red">↩️</span>
              <span>Remboursements</span>
            </a>
            <a class="sb-item" data-route="dettes" href="#" onclick="nav('dettes')">
              <span class="sb-icon si-amber">💳</span>
              <span>Dettes</span>
            </a>
            <a class="sb-item" data-route="evenements" href="#" onclick="nav('evenements')">
              <span class="sb-icon si-teal">📅</span>
              <span>Événements</span>
            </a>
            <a class="sb-item" data-route="besoins-admin" href="#" onclick="nav('besoins-admin')">
              <span class="sb-icon si-cyan">📋</span>
              <span>Expression des Besoins</span>
            </a>
            <a class="sb-item" data-route="opportunites" href="#" onclick="nav('opportunites')">
              <span class="sb-icon si-lime">🔍</span>
              <span>Recherche des opportunités</span>
            </a>
          </div>

          <!-- Administration -->
          <div class="sb-group">
            <div class="sb-group-label">Administration</div>
            <a class="sb-item" data-route="utilisateurs" href="#" onclick="nav('utilisateurs')">
              <span class="sb-icon si-slate">👤</span>
              <span>Utilisateurs</span>
            </a>
            <a class="sb-item" data-route="piste-audit" href="#" onclick="nav('piste-audit')">
              <span class="sb-icon si-stone">📜</span>
              <span>Piste d'audit</span>
            </a>
            <a class="sb-item" data-route="sauvegarde" href="#" onclick="nav('sauvegarde')">
              <span class="sb-icon si-sky">💾</span>
              <span>Sauvegarde / Restauration</span>
            </a>
            <a class="sb-item" data-route="impressions" href="#" onclick="nav('impressions')">
              <span class="sb-icon si-violet">🖨️</span>
              <span>Impressions</span>
            </a>
            <a class="sb-item" data-route="contenu" href="#" onclick="nav('contenu')">
              <span class="sb-icon si-teal">📰</span>
              <span>Contenu</span>
            </a>
            <a class="sb-item" data-route="db-admin" href="#" onclick="nav('db-admin')">
              <span class="sb-icon si-slate">🗄️</span>
              <span>Base de données</span>
            </a>
            <a class="sb-item" data-route="configuration" href="#" onclick="nav('configuration')">
              <span class="sb-icon si-amber">⚙️</span>
              <span>Configuration</span>
            </a>
          </div>`;

  document.body.innerHTML = `
    <div id="shell">
      <aside id="sidebar">
        <!-- Brand -->
        <div class="sb-brand">
          <img src="${isGestionnaire && user.orgLogo ? user.orgLogo : '/images/logo.svg'}" class="sb-logo" alt="${isGestionnaire ? (user.orgName||'Organisation') : 'SoliDev'}">
          <div>
            <span class="sb-name">SoliDev</span>
            <span class="sb-tagline" data-i18n="sbTagline">${i18n.t('sbTagline')}</span>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="sb-nav">${isGestionnaire ? navGestionnaire : isAdherent ? navAdherent : navAdmin}</nav>

        <!-- User card -->
        <div class="sb-footer">
          <div class="sb-user-card">
            ${user.photo
              ? `<img class="avatar" style="width:34px;height:34px;object-fit:cover;border-radius:50%" src="${user.photo}" alt="${displayName}">`
              : `<div class="avatar">${initials}</div>`
            }
            <div>
              <span class="sb-uname">${displayName}</span>
              <span class="sb-urole">${roleLabel}</span>
            </div>
            <div class="sb-online"></div>
          </div>
        </div>
      </aside>
      <div class="sidebar-overlay" id="sidebarOverlay" onclick="document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebarOverlay').classList.remove('active')"></div>
      <main id="main">
        <header id="topbar">
          <div class="tb-left">
            <button id="menuToggle" style="background:none;border:none;font-size:20px;display:none">☰</button>
            <h1 id="topTitle">SoliDev</h1>
          </div>
          <div class="tb-center">
            <span class="tb-username">${displayName}</span>
            <span class="tb-date-sep">·</span>
            <span class="tb-date" id="tbDate">${new Date().toLocaleDateString(i18n.current(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div class="tb-right">
            <!-- Notifications -->
            <div class="notif-menu" id="notifMenu">
              <button class="notif-menu-btn" onclick="toggleNotifMenu(event)" title="Notifications">
                🔔<span class="notif-badge" id="notifBadge" style="display:none">0</span>
              </button>
              <div class="notif-dropdown" id="notifDropdown">
                <div class="notif-dropdown-hd">
                  <span>Notifications</span>
                  <button class="notif-mark-all" onclick="marquerToutesNotifsLues()">Tout marquer lu</button>
                </div>
                <div class="notif-list" id="notifList">
                  <div class="notif-empty">Chargement…</div>
                </div>
              </div>
            </div>
            <!-- Lang menu -->
            <div class="lang-menu" id="langMenu">
              <button class="lang-menu-btn" onclick="toggleLangMenu(event)">
                <span>${(i18n.available().find(l=>l.code===i18n.current())||{}).flag||''} ${i18n.current().toUpperCase()}</span>
                <span class="tb-arrow">▾</span>
              </button>
              <div class="lang-dropdown" id="langDropdown">
                ${i18n.available().map(l => `<button class="lang-item ${i18n.current()===l.code?'active':''}" onclick="closeLangMenu();switchLang('${l.code}')">${l.flag} ${l.label}</button>`).join('')}
              </div>
            </div>
            <!-- User menu -->
            <div class="user-menu" id="userMenu">
              <button class="user-avatar-btn" onclick="toggleUserMenu(event)" title="${displayName}">
                ${user.photo
                  ? `<img class="user-photo" src="${user.photo}" alt="${displayName}">`
                  : `<div class="user-photo user-photo-init">${initials}</div>`
                }
                <span class="tb-arrow">▾</span>
              </button>
              <div class="user-dropdown" id="userDropdown">
                <div class="ud-header">
                  <div class="avatar" style="width:36px;height:36px;font-size:14px">${initials}</div>
                  <div>
                    <div class="ud-name">${displayName}</div>
                    <div class="ud-role">${roleLabel}</div>
                  </div>
                </div>
                <div class="ud-sep"></div>
                <button class="ud-item" onclick="closeUserMenu();nav('dashboard')">📊 Tableau de bord</button>
                <div class="ud-sep"></div>
                <button class="ud-item ud-logout" onclick="doLogout()">🚪 Déconnexion</button>
              </div>
            </div>
          </div>
        </header>
        <div id="app"></div>
      </main>
    </div>`;

  // Mobile menu toggle
  const menuBtn = document.getElementById('menuToggle');
  if (window.innerWidth <= 768) menuBtn.style.display = 'block';
  menuBtn?.addEventListener('click', () => {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    sb.classList.toggle('open');
    ov.classList.toggle('active', sb.classList.contains('open'));
  });

  // Pending demandes badge
  updatePendingBadge();

  // Notifications internes — chargement immédiat + rafraîchissement périodique
  refreshNotifications();
  if (_notifPoll) clearInterval(_notifPoll);
  _notifPoll = setInterval(refreshNotifications, 60000);
}

async function updatePendingBadge() {
  try {
    const stats = await api.get('/demandes/stats');
    const badge = document.getElementById('demBadge');
    if (!badge) return;
    if (stats.pending > 0) {
      badge.textContent = stats.pending;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  } catch(_) { /* silently ignore if not admin or error */ }
}

function nav(route) {
  router.navigate(route);
  document.getElementById('topTitle').textContent = i18n.t(route) || route;
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('active');
  document.querySelectorAll('.sb-item,.sb-subitem').forEach(a =>
    a.classList.toggle('active', a.dataset.route === route)
  );
}

function navFiltered(route, typeFilter) {
  sessionStorage.setItem('orgTypeFilter', typeFilter);
  const alias = route + '-' + typeFilter.toLowerCase().replace(/é/g,'e').replace(/[^a-z]/g,'').substring(0,4);
  document.querySelectorAll('.sb-item,.sb-subitem').forEach(a =>
    a.classList.toggle('active', a.dataset.route === 'organisations-' + typeFilter.substring(0,3).toLowerCase())
  );
  document.getElementById('topTitle').textContent = typeFilter + 's';
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sub-organisations')?.classList.add('open');
  router.navigate(route);
}

function navFilteredAdh(route, typeFilter) {
  sessionStorage.setItem('adhTypeFilter', typeFilter);
  document.querySelectorAll('.sb-item,.sb-subitem').forEach(a =>
    a.classList.toggle('active', a.dataset.route === 'adherents-' + typeFilter.substring(0,3).toLowerCase())
  );
  document.getElementById('topTitle').textContent = 'Individus — ' + typeFilter + 's';
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sub-adherents')?.classList.add('open');
  router.navigate(route);
}

function toggleSubgroup(e, id) {
  e.stopPropagation();
  e.preventDefault();
  document.getElementById(id)?.classList.toggle('open');
  e.currentTarget.classList.toggle('open');
}

async function switchLang(lang) {
  await i18n.load(lang);
  showShell();
  router.navigate(window._currentRoute || 'dashboard');
}

function toggleUserMenu(e) {
  e.stopPropagation();
  closeLangMenu();
  closeNotifMenu();
  document.getElementById('userMenu').classList.toggle('open');
}

function closeUserMenu() {
  document.getElementById('userMenu')?.classList.remove('open');
}

function toggleLangMenu(e) {
  e.stopPropagation();
  closeUserMenu();
  closeNotifMenu();
  document.getElementById('langMenu')?.classList.toggle('open');
}

function closeLangMenu() {
  document.getElementById('langMenu')?.classList.remove('open');
}

/* ── Notifications internes ──────────────────────────────────── */
function toggleNotifMenu(e) {
  e.stopPropagation();
  closeUserMenu();
  closeLangMenu();
  document.getElementById('notifMenu')?.classList.toggle('open');
}

function closeNotifMenu() {
  document.getElementById('notifMenu')?.classList.remove('open');
}

function fmtNotifDate(d) {
  const diffMin = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffMin < 1440) return `il y a ${Math.round(diffMin / 60)} h`;
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

async function refreshNotifications() {
  const badge = document.getElementById('notifBadge');
  const list  = document.getElementById('notifList');
  if (!badge || !list) return;
  try {
    const data = await api.get('/notifications');
    if (data.nonLu > 0) { badge.style.display = ''; badge.textContent = data.nonLu > 9 ? '9+' : data.nonLu; }
    else badge.style.display = 'none';

    list.innerHTML = (data.notifications || []).map(n => `
      <div class="notif-item${n.lu ? '' : ' notif-unread'}" onclick="ouvrirNotif(${n.idNotification}, ${n.lien ? `'${n.lien}'` : 'null'})">
        <div class="notif-item-titre">${n.titre}</div>
        ${n.contenu ? `<div class="notif-item-contenu">${n.contenu}</div>` : ''}
        <div class="notif-item-date">${fmtNotifDate(n.dateEnvoi)}</div>
      </div>`).join('') || `<div class="notif-empty">Aucune notification</div>`;
  } catch (_) { /* utilisateur non connecté ou route indisponible — silencieux */ }
}

async function ouvrirNotif(id, lien) {
  try { await api.put(`/notifications/${id}/lu`); } catch (_) {}
  closeNotifMenu();
  refreshNotifications();
  if (lien) nav(lien.replace(/^\//, ''));
}

async function marquerToutesNotifsLues() {
  try { await api.put('/notifications/lu-tout'); } catch (_) {}
  refreshNotifications();
}

let _notifPoll = null;

document.addEventListener('click', () => {
  closeUserMenu();
  closeNotifMenu();
  document.querySelectorAll('.lang-menu.open').forEach(el => el.classList.remove('open'));
});

function doLogout() {
  auth.logout();
}
