// ============================================================
// SoliDev — Landing v4.0  Page d'accueil vitrine (chaque action → sa propre page)
// ============================================================

const PAYS_SOLIDEV = [
  { code:'CIV', nom:"Côte d'Ivoire", drapeau:'🇨🇮', devise:'XOF', lang:'fr', timezone:'Africa/Abidjan'       },
  { code:'MLI', nom:'Mali',           drapeau:'🇲🇱', devise:'XOF', lang:'fr', timezone:'Africa/Bamako'         },
  { code:'SEN', nom:'Sénégal',        drapeau:'🇸🇳', devise:'XOF', lang:'fr', timezone:'Africa/Dakar'          },
  { code:'BFA', nom:'Burkina Faso',   drapeau:'🇧🇫', devise:'XOF', lang:'fr', timezone:'Africa/Ouagadougou'    },
  { code:'BEN', nom:'Bénin',          drapeau:'🇧🇯', devise:'XOF', lang:'fr', timezone:'Africa/Porto-Novo'     },
  { code:'MDG', nom:'Madagascar',     drapeau:'🇲🇬', devise:'MGA', lang:'fr', timezone:'Indian/Antananarivo'   },
];

const SD_I18N = {
  fr: {
    badge:       '🌍 Afrique  •  Solidarité  •  Développement',
    h1a:         'La plateforme',
    h1b:         'panafricaine',
    h1c:         'des associations',
    hero_desc:   "Gestion centralisée des associations, ONG et mutuelles en Afrique. Adhésions, paiements, besoins communautaires et bien plus.",
    cta_adh:     'Adhérer',
    cta_bsn:     'Exprimer un besoin',
    cta_cnx:     'Se connecter',
    cta_don:     'Faire un don',
    stat1_n:     '6',    stat1_l: 'Pays',
    stat2_n:     '3',    stat2_l: "Types d'orgs",
    stat3_n:     '12+',  stat3_l: 'Modules',
    stat4_n:     '∞',    stat4_l: 'Associations',
    nav_adh:     'Adhésion',
    nav_bsn:     'Besoins',
    nav_cnx:     'Connexion',
    nav_don:     'Faire un don',
    sec_adh_tag: 'Rejoindre SoliDev',
    sec_adh_h:   'Adhésion',
    sec_adh_sub: "Inscrivez-vous en tant qu'individu ou enregistrez votre organisation — deux parcours dédiés, en quelques minutes.",
    sec_bsn_tag: 'Expression communautaire',
    sec_bsn_h:   'Exprimer un besoin',
    sec_bsn_sub: "Partagez un besoin communautaire auprès du réseau SoliDev, sans inscription préalable.",
    sec_cnx_tag: 'Espace membre',
    sec_cnx_h:   'Connexion',
    sec_cnx_sub: "Accédez à votre espace personnel, à celui de votre organisation, ou à l'administration.",
    sec_don_tag: 'Soutenez SoliDev',
    sec_don_h:   'Faire un don',
    sec_don_sub: "Votre soutien aide des milliers d'associations africaines à se structurer et prospérer.",
    ft_rights:   '© 2026 SoliDev. Tous droits réservés.',
    ft_africa:   'Plateforme panafricaine · MIAGE 2026',
  },
  en: {
    badge:       '🌍 Africa  •  Solidarity  •  Development',
    h1a:         'The pan-African',
    h1b:         'platform',
    h1c:         'for associations',
    hero_desc:   "Centralised management of associations, NGOs and mutual societies across Africa. Memberships, payments, community needs and more.",
    cta_adh:     'Join',
    cta_bsn:     'Express a need',
    cta_cnx:     'Sign in',
    cta_don:     'Make a donation',
    stat1_n:     '6',    stat1_l: 'Countries',
    stat2_n:     '3',    stat2_l: 'Org types',
    stat3_n:     '12+',  stat3_l: 'Modules',
    stat4_n:     '∞',    stat4_l: 'Associations',
    nav_adh:     'Membership',
    nav_bsn:     'Needs',
    nav_cnx:     'Sign in',
    nav_don:     'Donate',
    sec_adh_tag: 'Join SoliDev',
    sec_adh_h:   'Membership',
    sec_adh_sub: 'Register as an individual or enrol your organisation — two dedicated paths, a few minutes each.',
    sec_bsn_tag: 'Community expression',
    sec_bsn_h:   'Express a need',
    sec_bsn_sub: "Share a community need with the SoliDev network, no registration required.",
    sec_cnx_tag: 'Member space',
    sec_cnx_h:   'Sign in',
    sec_cnx_sub: "Access your personal space, your organisation's space, or the administration panel.",
    sec_don_tag: 'Support SoliDev',
    sec_don_h:   'Make a donation',
    sec_don_sub: "Your support helps thousands of African associations to structure themselves and thrive.",
    ft_rights:   '© 2026 SoliDev. All rights reserved.',
    ft_africa:   'Pan-African platform · MIAGE 2026',
  },
};

// ── State ─────────────────────────────────────────────────────
let clockTimer        = null;
let activeCountryCode = 'CIV';
let currentLang       = 'fr';
let revealObserver    = null;

// ── CSS injection ─────────────────────────────────────────────
function injectLandingCSS() {
  if (document.getElementById('lp-css')) return;
  const link = document.createElement('link');
  link.id   = 'lp-css';
  link.rel  = 'stylesheet';
  link.href = '/css/landing.css';
  document.head.appendChild(link);
}

// ── Route ─────────────────────────────────────────────────────
router.register('landing', () => {
  injectLandingCSS();
  activeCountryCode = detectCountryCode();
  const pays = PAYS_SOLIDEV.find(p => p.code === activeCountryCode) || PAYS_SOLIDEV[0];
  currentLang = pays.lang;

  document.body.className = 'lp-body';
  document.body.innerHTML = buildOnePager(pays);

  setupNavScroll();
  setupBurger();
  setupReveal();
  setupFlagBtns(pays.code);
  setupOrgSearch();
  applyLang(pays.lang);
  startClock(pays.timezone);
});

// ═══════════════════════════════════════════════════════════════
// EMBLÈME SVG — illustration originale « solidarité + développement »
// (réseau de personnes reliées, en cercle, autour d'un symbole de croissance)
// ═══════════════════════════════════════════════════════════════
function buildEmblemSVG() {
  const pts = [
    { x:165, y:100, c:'#2f8f7f' }, { x:146, y:146, c:'#c1703f' },
    { x:100, y:165, c:'#cf9a44' }, { x:54,  y:146, c:'#2f8f7f' },
    { x:35,  y:100, c:'#c1703f' }, { x:54,  y:54,  c:'#cf9a44' },
    { x:100, y:35,  c:'#2f8f7f' }, { x:146, y:54,  c:'#c1703f' },
  ];
  const spokes = pts.map(p => `<line x1="100" y1="100" x2="${p.x}" y2="${p.y}" stroke="#ffffff" stroke-width="1.2" opacity=".25"/>`).join('');
  const nodes  = pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="6.5" fill="${p.c}"/>`).join('');
  return `
  <svg class="lp-emblem" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Emblème SoliDev — réseau solidaire et croissance">
    <defs>
      <linearGradient id="embGradRing" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#2f8f7f"/>
        <stop offset="100%" stop-color="#cf9a44"/>
      </linearGradient>
      <linearGradient id="embGradCore" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2f8f7f"/>
        <stop offset="100%" stop-color="#145c56"/>
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="94" fill="none" stroke="url(#embGradRing)" stroke-width="1.6" opacity=".55"/>
    <circle cx="100" cy="100" r="65" fill="none" stroke="#ffffff" stroke-width="1" opacity=".18" stroke-dasharray="3 5"/>
    ${spokes}
    ${nodes}
    <circle cx="100" cy="100" r="30" fill="url(#embGradCore)"/>
    <g transform="translate(100,100)" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-11,10 C-11,-2 -5,-8 0,-16 C5,-8 11,-2 11,10"/>
      <line x1="0" y1="-16" x2="0" y2="12"/>
      <path d="M-11,10 h22" />
    </g>
  </svg>`;
}

// ═══════════════════════════════════════════════════════════════
// HTML BUILDER
// ═══════════════════════════════════════════════════════════════
function buildOnePager(pays) {
  const t = SD_I18N[pays.lang] || SD_I18N.fr;
  return `
<!-- ── NAV ── -->
<nav class="lp-nav" id="lpNav">
  <button class="lp-nav-brand" onclick="landingNav('landing')">
    <img src="/images/logo.svg" class="lp-nav-logo" alt="SoliDev">
    <span class="lp-nav-name">SoliDev</span>
  </button>
  <div class="lp-nav-links" id="lpNavLinks">
    <button class="lp-nav-link" onclick="landingNav('adhesion')" data-i18n="nav_adh">${t.nav_adh}</button>
    <button class="lp-nav-link" onclick="landingNav('expression-besoins')" data-i18n="nav_bsn">${t.nav_bsn}</button>
    <button class="lp-nav-link accent" onclick="landingNav('login')" data-i18n="nav_cnx">${t.nav_cnx}</button>
    <button class="lp-nav-link don-link" onclick="landingNav('don')" data-i18n="nav_don">${t.nav_don}</button>
  </div>
  <button class="lp-nav-burger" id="lpBurger" aria-label="Menu">☰</button>
</nav>

<!-- ── HERO ── -->
<section class="lp-hero" id="accueil">
  <div class="lp-hero-bg"></div>
  <div class="lp-hero-pattern"></div>
  <div class="lp-hero-shape"></div>
  <div class="lp-hero-shape"></div>
  <div class="lp-hero-shape"></div>

  <div class="lp-hero-content">
    <div class="lp-emblem-wrap">${buildEmblemSVG()}</div>
    <div class="lp-hero-badge" data-i18n="badge">${t.badge}</div>
    <h1>
      <span data-i18n="h1a">${t.h1a}</span><br>
      <span style="color:var(--c-gold)" data-i18n="h1b">${t.h1b}</span><br>
      <span data-i18n="h1c">${t.h1c}</span>
    </h1>
    <p class="lp-hero-desc" data-i18n="hero_desc">${t.hero_desc}</p>

    <div class="lp-hero-cards">
      <button class="lp-hero-card primary" onclick="landingNav('adhesion')">
        <div class="lp-hero-card-icon">🤝</div>
        <div class="lp-hero-card-title" data-i18n="cta_adh">${t.cta_adh}</div>
        <div class="lp-hero-card-sub">Individu · Organisation</div>
      </button>
      <button class="lp-hero-card" onclick="landingNav('expression-besoins')">
        <div class="lp-hero-card-icon">💬</div>
        <div class="lp-hero-card-title" data-i18n="cta_bsn">${t.cta_bsn}</div>
        <div class="lp-hero-card-sub">Sans inscription</div>
      </button>
      <button class="lp-hero-card" onclick="landingNav('login')">
        <div class="lp-hero-card-icon">🔐</div>
        <div class="lp-hero-card-title" data-i18n="cta_cnx">${t.cta_cnx}</div>
        <div class="lp-hero-card-sub">Espace adhérent</div>
      </button>
      <button class="lp-hero-card gold" onclick="landingNav('don')">
        <div class="lp-hero-card-icon">💛</div>
        <div class="lp-hero-card-title" data-i18n="cta_don">${t.cta_don}</div>
        <div class="lp-hero-card-sub">Soutenez SoliDev</div>
      </button>
    </div>

    <div class="lp-org-search" id="lpOrgSearch">
      <div class="lp-org-search-box">
        <span class="lp-org-search-icon">🔍</span>
        <input type="text" id="lpOrgSearchInput" autocomplete="off"
               placeholder="Rechercher une organisation déjà inscrite…">
      </div>
      <div class="lp-org-suggestions" id="lpOrgSuggestions" style="display:none"></div>
    </div>

    <div class="lp-hero-scroll">▼</div>
  </div>

  <!-- Country bar -->
  <div class="lp-country-bar">
    <div class="lp-flags" id="lpFlags">
      ${PAYS_SOLIDEV.map(p => `
        <button class="lp-flag-btn${p.code===pays.code?' active':''}"
                data-code="${p.code}" title="${p.nom}">${p.drapeau}</button>
      `).join('')}
    </div>
    <div class="lp-clock" id="lpClock">
      ${pays.drapeau} ${pays.nom} · <span id="lpClockTime">--:--:--</span> · ${pays.devise}
    </div>
  </div>
</section>

<!-- ── STATS ── -->
<div class="lp-stats-bar">
  <div class="lp-stats-inner">
    <div class="lp-stat"><div class="lp-stat-num" data-i18n="stat1_n">${t.stat1_n}</div><div class="lp-stat-lbl" data-i18n="stat1_l">${t.stat1_l}</div></div>
    <div class="lp-stat"><div class="lp-stat-num" data-i18n="stat2_n">${t.stat2_n}</div><div class="lp-stat-lbl" data-i18n="stat2_l">${t.stat2_l}</div></div>
    <div class="lp-stat"><div class="lp-stat-num" data-i18n="stat3_n">${t.stat3_n}</div><div class="lp-stat-lbl" data-i18n="stat3_l">${t.stat3_l}</div></div>
    <div class="lp-stat"><div class="lp-stat-num" data-i18n="stat4_n">${t.stat4_n}</div><div class="lp-stat-lbl" data-i18n="stat4_l">${t.stat4_l}</div></div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════
     SECTION 1 — ADHÉSION (2 cartes → page adhésion)
════════════════════════════════════════════════════ -->
<section class="lp-section alt lp-reveal" id="adhesion">
  <div class="lp-section-inner">
    <div class="lp-section-tag" data-i18n="sec_adh_tag">${t.sec_adh_tag}</div>
    <h2 class="lp-section-title" data-i18n="sec_adh_h">${t.sec_adh_h}</h2>
    <p  class="lp-section-sub"   data-i18n="sec_adh_sub">${t.sec_adh_sub}</p>

    <div class="lp-teaser-grid cols-2 lp-reveal">
      <button class="lp-teaser-card" onclick="landingNav('adhesion',{mode:'individu'})">
        <div class="lp-teaser-icon">👤</div>
        <div class="lp-teaser-title">Individu</div>
        <div class="lp-teaser-desc">Adhésion personnelle à une organisation déjà inscrite sur SoliDev.</div>
        <span class="lp-teaser-btn">Adhérer en tant qu'individu →</span>
      </button>
      <button class="lp-teaser-card terracotta" onclick="landingNav('adhesion',{mode:'organisation'})">
        <div class="lp-teaser-icon">🏢</div>
        <div class="lp-teaser-title">Organisation</div>
        <div class="lp-teaser-desc">Enregistrez votre association, ONG ou mutuelle sur la plateforme.</div>
        <span class="lp-teaser-btn">Enregistrer mon organisation →</span>
      </button>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════
     SECTION 2 — EXPRESSION DES BESOINS
════════════════════════════════════════════════════ -->
<section class="lp-section lp-reveal" id="besoins">
  <div class="lp-section-inner">
    <div class="lp-section-tag" data-i18n="sec_bsn_tag">${t.sec_bsn_tag}</div>
    <h2 class="lp-section-title" data-i18n="sec_bsn_h">${t.sec_bsn_h}</h2>
    <p  class="lp-section-sub"   data-i18n="sec_bsn_sub">${t.sec_bsn_sub}</p>

    <div class="lp-teaser-grid cols-1 lp-reveal">
      <button class="lp-teaser-card gold" onclick="landingNav('expression-besoins')">
        <div class="lp-teaser-icon">💬</div>
        <div class="lp-teaser-title">Décrire un besoin communautaire</div>
        <div class="lp-teaser-desc">Financement, matériel, formation, juridique, santé… Aucune inscription requise.</div>
        <span class="lp-teaser-btn">Exprimer un besoin →</span>
      </button>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════
     SECTION 3 — CONNEXION
════════════════════════════════════════════════════ -->
<section class="lp-section alt lp-reveal" id="connexion">
  <div class="lp-section-inner">
    <div class="lp-section-tag" data-i18n="sec_cnx_tag">${t.sec_cnx_tag}</div>
    <h2 class="lp-section-title" data-i18n="sec_cnx_h">${t.sec_cnx_h}</h2>
    <p  class="lp-section-sub"   data-i18n="sec_cnx_sub">${t.sec_cnx_sub}</p>

    <div class="lp-teaser-grid cols-1 lp-reveal">
      <button class="lp-teaser-card" onclick="landingNav('login')">
        <div class="lp-teaser-icon">🔐</div>
        <div class="lp-teaser-title">Accéder à mon espace</div>
        <div class="lp-teaser-desc">Adhérent, organisation ou administrateur — connectez-vous à votre espace personnel.</div>
        <span class="lp-teaser-btn">Se connecter →</span>
      </button>
    </div>
    <p style="text-align:center;margin-top:20px;font-size:13px">
      <button style="background:none;border:none;cursor:pointer;color:var(--c-indigo);font-weight:600;font-family:inherit;font-size:13px" onclick="landingNav('verification')">
        📱 Vous avez reçu un code de confirmation par SMS/WhatsApp ?
      </button>
    </p>
  </div>
</section>

<!-- ══════════════════════════════════════════════════
     SECTION 4 — DON
════════════════════════════════════════════════════ -->
<section class="lp-section lp-reveal" id="don">
  <div class="lp-section-inner">
    <div class="lp-section-tag" data-i18n="sec_don_tag">${t.sec_don_tag}</div>
    <h2 class="lp-section-title" data-i18n="sec_don_h">${t.sec_don_h}</h2>
    <p  class="lp-section-sub"   data-i18n="sec_don_sub">${t.sec_don_sub}</p>

    <div class="lp-teaser-grid cols-1 lp-reveal">
      <button class="lp-teaser-card gold" onclick="landingNav('don')">
        <div class="lp-teaser-icon">💛</div>
        <div class="lp-teaser-title">Soutenir SoliDev</div>
        <div class="lp-teaser-desc">Un don ponctuel ou récurrent, par mobile money, virement ou espèces.</div>
        <span class="lp-teaser-btn">Faire un don →</span>
      </button>
    </div>
  </div>
</section>

<!-- ── FOOTER ── -->
<footer class="lp-footer">
  <div class="lp-footer-inner">
    <div class="lp-footer-brand">
      <img src="/images/logo.svg" class="lp-nav-logo" style="width:36px;height:36px" alt="SoliDev">
      <div>
        <div class="lp-footer-brand-name">SoliDev</div>
        <div class="lp-footer-brand-sub">Solidarité &amp; Développement</div>
      </div>
    </div>
    <div class="lp-footer-links">
      <button class="lp-footer-link" onclick="landingNav('adhesion')">Adhésion</button>
      <button class="lp-footer-link" onclick="landingNav('expression-besoins')">Besoins</button>
      <button class="lp-footer-link" onclick="landingNav('login')">Connexion</button>
      <button class="lp-footer-link" onclick="landingNav('don')">Don</button>
      <button class="lp-footer-link" onclick="landingNav('login')">Administration</button>
    </div>
  </div>
  <div class="lp-footer-divider"></div>
  <p class="lp-footer-copy" data-i18n="ft_africa">${t.ft_africa} · ${t.ft_rights}</p>
</footer>
`;
}

// ═══════════════════════════════════════════════════════════════
// SETUP FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function setupNavScroll() {
  const nav = document.getElementById('lpNav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
}

function setupBurger() {
  const burger = document.getElementById('lpBurger');
  const links  = document.getElementById('lpNavLinks');
  if (!burger || !links) return;
  burger.addEventListener('click', (e) => {
    e.stopPropagation();
    links.classList.toggle('open');
    burger.textContent = links.classList.contains('open') ? '✕' : '☰';
  });
  document.addEventListener('click', () => {
    links.classList.remove('open');
    burger.textContent = '☰';
  });
  links.querySelectorAll('button').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open');
    burger.textContent = '☰';
  }));
}

function setupReveal() {
  if (revealObserver) revealObserver.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.lp-reveal').forEach(el => revealObserver.observe(el));
}

function setupFlagBtns(activeCode) {
  document.querySelectorAll('.lp-flag-btn').forEach(btn => {
    btn.addEventListener('click', () => selectCountry(btn.dataset.code));
  });
}

// ── Recherche d'organisation (instantanée, avec suggestions) ──────
function setupOrgSearch() {
  const input = document.getElementById('lpOrgSearchInput');
  const box   = document.getElementById('lpOrgSuggestions');
  if (!input || !box) return;

  let timer = null;
  let currentReq = 0;

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
    timer = setTimeout(() => runSearch(q), 250);
  });

  document.addEventListener('click', e => {
    if (!box.contains(e.target) && e.target !== input) box.style.display = 'none';
  });

  async function runSearch(q) {
    const reqId = ++currentReq;
    try {
      const res  = await fetch(`/api/public/organisations/suggest?q=${encodeURIComponent(q)}`);
      const rows = await res.json();
      if (reqId !== currentReq) return; // réponse obsolète (requête plus récente déjà lancée)
      renderSuggestions(rows);
    } catch (_) { box.style.display = 'none'; }
  }

  function renderSuggestions(rows) {
    if (!rows.length) {
      box.innerHTML = `<div class="lp-org-sugg-empty">Aucune organisation trouvée</div>`;
      box.style.display = 'block';
      return;
    }
    box.innerHTML = rows.map(o => `
      <button type="button" class="lp-org-sugg-item" data-numagr="${o.NumAgr}">
        <span class="lp-org-sugg-name">${o.LibOrg}</span>
        <span class="lp-org-sugg-meta">${o.LibTypOrg || ''}${o.SiegeOrg ? ' · ' + o.SiegeOrg : ''}</span>
      </button>
    `).join('');
    box.style.display = 'block';
    box.querySelectorAll('.lp-org-sugg-item').forEach(btn => {
      btn.addEventListener('click', () => {
        landingNav('adhesion', { mode: 'individu', numAgr: btn.dataset.numagr });
      });
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// ── Country detection ─────────────────────────────────────────
function detectCountryCode() {
  const saved = localStorage.getItem('sd_country');
  if (saved && PAYS_SOLIDEV.find(p => p.code === saved)) return saved;
  try {
    const tz    = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = PAYS_SOLIDEV.find(p => p.timezone === tz);
    if (match) return match.code;
  } catch (_) {}
  return 'CIV'; // tous les pays de la plateforme sont francophones
}

// ── Country selection ─────────────────────────────────────────
function selectCountry(code) {
  const pays = PAYS_SOLIDEV.find(p => p.code === code);
  if (!pays) return;
  activeCountryCode = code;
  currentLang       = pays.lang;
  localStorage.setItem('sd_country', code);

  document.querySelectorAll('.lp-flag-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.code === code)
  );

  const clockEl = document.getElementById('lpClock');
  if (clockEl) {
    clockEl.style.opacity = '0';
    setTimeout(() => {
      clockEl.innerHTML = `${pays.drapeau} ${pays.nom} · <span id="lpClockTime">--:--:--</span> · ${pays.devise}`;
      clockEl.style.opacity = '1';
    }, 200);
  }
  startClock(pays.timezone);
  applyLang(pays.lang);
}

// ── i18n ──────────────────────────────────────────────────────
function applyLang(lang) {
  currentLang = lang;
  const t = SD_I18N[lang] || SD_I18N.fr;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key] !== undefined) el.textContent = t[key];
  });
}

// ── Real-time clock ───────────────────────────────────────────
function startClock(timezone) {
  if (clockTimer) clearInterval(clockTimer);
  tickClock(timezone);
  clockTimer = setInterval(() => tickClock(timezone), 1000);
}

function tickClock(timezone) {
  const el = document.getElementById('lpClockTime');
  if (!el) { clearInterval(clockTimer); return; }
  el.textContent = new Date().toLocaleTimeString('fr-FR', {
    timeZone: timezone, hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false,
  });
}

// ── Navigation (global) ───────────────────────────────────────
function landingNav(route, params) {
  if (clockTimer) clearInterval(clockTimer);
  if (revealObserver) revealObserver.disconnect();
  document.body.className = '';
  document.body.innerHTML = '<div id="app"></div>';
  router.navigate(route, params || {});
}
