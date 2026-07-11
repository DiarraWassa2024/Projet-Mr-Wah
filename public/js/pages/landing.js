// ============================================================
// SoliDev — Landing v3.0  One-pager public site
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
    // Section Adhésion
    sec_adh_tag: 'Rejoindre SoliDev',
    sec_adh_h:   'Adhésion',
    sec_adh_sub: "Inscrivez-vous en tant qu'individu ou enregistrez votre organisation.",
    t_individu:  'Individu',
    t_org:       'Organisation',
    org_asso:    'Association',
    org_ong:     'ONG',
    org_mutuelle:'Mutuelle',
    f_prenom:    'Prénom',
    f_nom:       'Nom de famille',
    f_email:     'Email',
    f_tel:       'Téléphone',
    f_ddn:       'Date de naissance',
    f_pays:      'Pays',
    f_ville:     'Ville',
    f_adresse:   'Adresse',
    f_org_nom:   "Nom de l'organisation",
    f_rep_nom:   'Nom du représentant',
    f_rep_prenom:'Prénom du représentant',
    f_rep_email: 'Email du représentant',
    f_rep_tel:   'Téléphone du représentant',
    f_agrement:  "Numéro d'agrément",
    f_doc:       "Document d'agrément (PDF)",
    f_submit:    'Soumettre la demande',
    f_sending:   'Envoi en cours…',
    s_adh_h:     'Demande envoyée !',
    s_adh_p:     "Votre demande d'adhésion a été reçue. Vous serez contacté sous 48h.",
    s_back:      'Soumettre une autre demande',
    // Section Besoins
    sec_bsn_tag: 'Expression communautaire',
    sec_bsn_h:   'Exprimer un besoin',
    sec_bsn_sub: "Partagez un besoin communautaire. Aucune inscription requise.",
    need_fin:    'Financement',
    need_mat:    'Matériel',
    need_form:   'Formation',
    need_jur:    'Juridique',
    need_san:    'Santé',
    need_aut:    'Autre',
    f_nom_bsn:   'Votre nom',
    f_email_bsn: 'Votre email',
    f_org_bsn:   'Organisation / Institution',
    f_desc:      'Description du besoin',
    f_desc_ph:   "Décrivez votre besoin en détail : contexte, population concernée, impact attendu…",
    f_submit_bsn:'Soumettre le besoin',
    s_bsn_h:     'Besoin enregistré !',
    s_bsn_p:     "Votre besoin a été transmis à notre équipe. Merci pour votre contribution.",
    // Section Connexion
    sec_cnx_tag: 'Espace membre',
    sec_cnx_h:   'Connexion',
    sec_cnx_sub: "Accédez à votre espace personnel ou à l'administration.",
    f_email_cnx: 'Adresse email',
    f_mdp:       'Mot de passe',
    f_cnx:       'Se connecter',
    f_cnx_ing:   'Connexion…',
    // Section Don
    sec_don_tag: 'Soutenez SoliDev',
    sec_don_h:   'Faire un don',
    sec_don_sub: "Votre soutien aide des milliers d'associations africaines à se structurer et prospérer.",
    f_montant:   'Montant personnalisé (FCFA)',
    f_cause:     'Cause',
    f_cause_sd:  'SoliDev (plateforme)',
    f_cause_educ:'Éducation',
    f_cause_san: 'Santé',
    f_cause_env: 'Environnement',
    f_message:   'Message (facultatif)',
    f_nom_don:   'Votre nom',
    f_email_don: 'Votre email',
    f_tel_don:   'Téléphone',
    f_moyen:     'Mode de paiement',
    f_moyen_mob: 'Mobile Money',
    f_moyen_vir: 'Virement',
    f_moyen_esp: 'Espèces',
    f_anon:      'Faire un don anonyme',
    f_submit_don:'Confirmer le don',
    s_don_h:     'Merci pour votre générosité !',
    s_don_p:     "Votre don a bien été enregistré. Vous recevrez un reçu par email.",
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
    sec_adh_sub: 'Register as an individual or enrol your organisation.',
    t_individu:  'Individual',
    t_org:       'Organisation',
    org_asso:    'Association',
    org_ong:     'NGO',
    org_mutuelle:'Mutual society',
    f_prenom:    'First name',
    f_nom:       'Last name',
    f_email:     'Email',
    f_tel:       'Phone',
    f_ddn:       'Date of birth',
    f_pays:      'Country',
    f_ville:     'City',
    f_adresse:   'Address',
    f_org_nom:   'Organisation name',
    f_rep_nom:   'Representative last name',
    f_rep_prenom:'Representative first name',
    f_rep_email: 'Representative email',
    f_rep_tel:   'Representative phone',
    f_agrement:  'Registration number',
    f_doc:       'Registration document (PDF)',
    f_submit:    'Submit application',
    f_sending:   'Sending…',
    s_adh_h:     'Application submitted!',
    s_adh_p:     "Your application has been received. You'll be contacted within 48h.",
    s_back:      'Submit another application',
    sec_bsn_tag: 'Community expression',
    sec_bsn_h:   'Express a need',
    sec_bsn_sub: "Share a community need. No registration required.",
    need_fin:    'Funding',
    need_mat:    'Equipment',
    need_form:   'Training',
    need_jur:    'Legal',
    need_san:    'Health',
    need_aut:    'Other',
    f_nom_bsn:   'Your name',
    f_email_bsn: 'Your email',
    f_org_bsn:   'Organisation / Institution',
    f_desc:      'Need description',
    f_desc_ph:   "Describe your need in detail: context, target population, expected impact…",
    f_submit_bsn:'Submit need',
    s_bsn_h:     'Need recorded!',
    s_bsn_p:     "Your need has been forwarded to our team. Thank you for your contribution.",
    sec_cnx_tag: 'Member space',
    sec_cnx_h:   'Sign in',
    sec_cnx_sub: "Access your personal space or the administration panel.",
    f_email_cnx: 'Email address',
    f_mdp:       'Password',
    f_cnx:       'Sign in',
    f_cnx_ing:   'Signing in…',
    sec_don_tag: 'Support SoliDev',
    sec_don_h:   'Make a donation',
    sec_don_sub: "Your support helps thousands of African associations to structure themselves and thrive.",
    f_montant:   'Custom amount (FCFA)',
    f_cause:     'Cause',
    f_cause_sd:  'SoliDev (platform)',
    f_cause_educ:'Education',
    f_cause_san: 'Health',
    f_cause_env: 'Environment',
    f_message:   'Message (optional)',
    f_nom_don:   'Your name',
    f_email_don: 'Your email',
    f_tel_don:   'Phone',
    f_moyen:     'Payment method',
    f_moyen_mob: 'Mobile Money',
    f_moyen_vir: 'Bank transfer',
    f_moyen_esp: 'Cash',
    f_anon:      'Make an anonymous donation',
    f_submit_don:'Confirm donation',
    s_don_h:     'Thank you for your generosity!',
    s_don_p:     "Your donation has been recorded. You'll receive a receipt by email.",
    ft_rights:   '© 2026 SoliDev. All rights reserved.',
    ft_africa:   'Pan-African platform · MIAGE 2026',
  },
};

// ── State ─────────────────────────────────────────────────────
let clockTimer        = null;
let activeCountryCode = 'CIV';
let currentLang       = 'fr';
let donAmount         = 5000;
let donCustom         = false;
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
  setupBesoinsForm();
  setupConnexionForm();
  setupDonForm();
  setupOrgSearch();
  applyLang(pays.lang);
  startClock(pays.timezone);
});

// ═══════════════════════════════════════════════════════════════
// HTML BUILDER
// ═══════════════════════════════════════════════════════════════
function buildOnePager(pays) {
  const t = SD_I18N[pays.lang] || SD_I18N.fr;
  return `
<!-- ── NAV ── -->
<nav class="lp-nav" id="lpNav">
  <a class="lp-nav-brand" href="#accueil">
    <div class="lp-nav-logo">SD</div>
    <span class="lp-nav-name">SoliDev</span>
  </a>
  <div class="lp-nav-links" id="lpNavLinks">
    <a class="lp-nav-link" href="#adhesion"  data-i18n="nav_adh">${t.nav_adh}</a>
    <a class="lp-nav-link" href="#besoins"   data-i18n="nav_bsn">${t.nav_bsn}</a>
    <a class="lp-nav-link accent" href="#connexion" data-i18n="nav_cnx">${t.nav_cnx}</a>
    <a class="lp-nav-link don-link" href="#don" data-i18n="nav_don">${t.nav_don}</a>
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
    <div class="lp-hero-badge" data-i18n="badge">${t.badge}</div>
    <h1>
      <span data-i18n="h1a">${t.h1a}</span><br>
      <span style="color:var(--c-gold)" data-i18n="h1b">${t.h1b}</span><br>
      <span data-i18n="h1c">${t.h1c}</span>
    </h1>
    <p class="lp-hero-desc" data-i18n="hero_desc">${t.hero_desc}</p>

    <div class="lp-hero-cards">
      <a class="lp-hero-card primary" href="#adhesion">
        <div class="lp-hero-card-icon">🤝</div>
        <div class="lp-hero-card-title" data-i18n="cta_adh">${t.cta_adh}</div>
        <div class="lp-hero-card-sub">Individu · Organisation</div>
      </a>
      <a class="lp-hero-card" href="#besoins">
        <div class="lp-hero-card-icon">💬</div>
        <div class="lp-hero-card-title" data-i18n="cta_bsn">${t.cta_bsn}</div>
        <div class="lp-hero-card-sub">Sans inscription</div>
      </a>
      <a class="lp-hero-card" href="#connexion">
        <div class="lp-hero-card-icon">🔐</div>
        <div class="lp-hero-card-title" data-i18n="cta_cnx">${t.cta_cnx}</div>
        <div class="lp-hero-card-sub">Espace adhérent</div>
      </a>
      <a class="lp-hero-card gold" href="#don">
        <div class="lp-hero-card-icon">💛</div>
        <div class="lp-hero-card-title" data-i18n="cta_don">${t.cta_don}</div>
        <div class="lp-hero-card-sub">Soutenez SoliDev</div>
      </a>
    </div>

    <div class="lp-org-search" id="lpOrgSearch">
      <div class="lp-org-search-box">
        <span class="lp-org-search-icon">🔍</span>
        <input type="text" id="lpOrgSearchInput" autocomplete="off"
               placeholder="${t.orgSearchPh || 'Rechercher une organisation déjà inscrite…'}">
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
     SECTION 1 — ADHÉSION
════════════════════════════════════════════════════ -->
<section class="lp-section alt lp-reveal" id="adhesion">
  <div class="lp-section-inner">
    <div class="lp-section-tag" data-i18n="sec_adh_tag">${t.sec_adh_tag}</div>
    <h2 class="lp-section-title" data-i18n="sec_adh_h">${t.sec_adh_h}</h2>
    <p  class="lp-section-sub"   data-i18n="sec_adh_sub">${t.sec_adh_sub}</p>

    <div class="adh-toggle-wrap lp-reveal" style="max-width:520px;margin:0 auto;">
      <button class="adh-toggle" onclick="landingNav('adhesion',{mode:'individu'})">
        <span class="adh-toggle-icon">👤</span>
        <span class="adh-toggle-label">Individu</span>
        <span class="adh-toggle-sub">Adhésion personnelle</span>
      </button>
      <button class="adh-toggle" onclick="landingNav('adhesion',{mode:'organisation'})">
        <span class="adh-toggle-icon">🏢</span>
        <span class="adh-toggle-label">Organisation</span>
        <span class="adh-toggle-sub">Association, ONG, Mutuelle</span>
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

    <div class="lp-form-card lp-reveal">
      <!-- Need type chips -->
      <div class="lp-need-types" id="needTypes">
        <div class="lp-need-chip active" data-type="Financement" onclick="selectNeedType(this)">
          <div class="lp-need-chip-icon">💰</div>
          <div class="lp-need-chip-label" data-i18n="need_fin">${t.need_fin}</div>
        </div>
        <div class="lp-need-chip" data-type="Matériel" onclick="selectNeedType(this)">
          <div class="lp-need-chip-icon">🔧</div>
          <div class="lp-need-chip-label" data-i18n="need_mat">${t.need_mat}</div>
        </div>
        <div class="lp-need-chip" data-type="Formation" onclick="selectNeedType(this)">
          <div class="lp-need-chip-icon">📚</div>
          <div class="lp-need-chip-label" data-i18n="need_form">${t.need_form}</div>
        </div>
        <div class="lp-need-chip" data-type="Juridique" onclick="selectNeedType(this)">
          <div class="lp-need-chip-icon">⚖️</div>
          <div class="lp-need-chip-label" data-i18n="need_jur">${t.need_jur}</div>
        </div>
        <div class="lp-need-chip" data-type="Santé" onclick="selectNeedType(this)">
          <div class="lp-need-chip-icon">🏥</div>
          <div class="lp-need-chip-label" data-i18n="need_san">${t.need_san}</div>
        </div>
        <div class="lp-need-chip" data-type="Autre" onclick="selectNeedType(this)">
          <div class="lp-need-chip-icon">✨</div>
          <div class="lp-need-chip-label" data-i18n="need_aut">${t.need_aut}</div>
        </div>
      </div>

      <div id="bsnAlert"></div>

      <form id="formBesoins">
        <input type="hidden" id="needTypeHidden" name="typeBesoin" value="Financement">
        <div class="lp-row">
          <div class="lp-field">
            <label>Votre nom <span class="req">*</span></label>
            <input class="lp-input" name="nom" required placeholder="Amina Traoré">
          </div>
          <div class="lp-field">
            <label>Email <span class="req">*</span></label>
            <input class="lp-input" name="email" type="email" required placeholder="amina@exemple.org">
          </div>
        </div>
        <div class="lp-field">
          <label>Organisation / Institution</label>
          <input class="lp-input" name="typeEntite" placeholder="Comité de village, Mairie, ONG…">
        </div>
        <div class="lp-field">
          <label>Description du besoin <span class="req">*</span></label>
          <textarea class="lp-textarea" name="description" required
            placeholder="Décrivez votre besoin en détail : contexte, population concernée, impact attendu…"></textarea>
        </div>
        <button type="submit" class="lp-btn lp-btn-primary" id="btnSubmitBsn">
          <span id="bsnBtnText">Soumettre le besoin</span>
        </button>
      </form>

      <div id="bsnSuccess" style="display:none">
        <div class="lp-success">
          <div class="lp-success-icon">✓</div>
          <h3 data-i18n="s_bsn_h">Besoin enregistré !</h3>
          <p data-i18n="s_bsn_p">Votre besoin a été transmis à notre équipe. Merci pour votre contribution.</p>
          <button class="lp-btn lp-btn-secondary" onclick="resetBsnForm()">
            Soumettre un autre besoin
          </button>
        </div>
      </div>
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

    <div class="lp-login-wrap">
      <div class="lp-form-card lp-reveal">
        <div class="lp-login-logo">
          <div class="lp-login-logo-icon">SD</div>
          <h3>SoliDev</h3>
          <p>Plateforme panafricaine des associations</p>
        </div>

        <div id="cnxAlert"></div>

        <form id="formConnexion">
          <div class="lp-field">
            <label>Email <span class="req">*</span></label>
            <div class="lp-input-icon">
              <span class="lp-field-ico">✉️</span>
              <input class="lp-input" name="email" type="email" required
                     placeholder="admin@solidev.org" autocomplete="email">
            </div>
          </div>
          <div class="lp-field">
            <label>Mot de passe <span class="req">*</span></label>
            <div class="lp-input-icon" style="position:relative">
              <span class="lp-field-ico">🔒</span>
              <input class="lp-input" name="password" type="password" id="cnxPwd" required
                     placeholder="••••••••" autocomplete="current-password">
              <button type="button" class="lp-eye-btn" onclick="togglePwd()">👁</button>
            </div>
          </div>
          <button type="submit" class="lp-btn lp-btn-primary" id="btnCnx">
            <span id="cnxBtnText">Se connecter</span>
          </button>
        </form>
      </div>
    </div>
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

    <div class="lp-form-card lp-reveal">
      <div id="donAlert"></div>

      <form id="formDon">
        <!-- Preset amounts -->
        <div class="lp-amounts" id="donAmounts">
          <button type="button" class="lp-amount-btn" data-amt="1000"  onclick="pickAmt(1000)">1 000<small>FCFA</small></button>
          <button type="button" class="lp-amount-btn active" data-amt="5000"  onclick="pickAmt(5000)">5 000<small>FCFA</small></button>
          <button type="button" class="lp-amount-btn" data-amt="10000" onclick="pickAmt(10000)">10 000<small>FCFA</small></button>
          <button type="button" class="lp-amount-btn" data-amt="custom" onclick="pickAmt('custom')">Autre<small>montant</small></button>
        </div>
        <div class="lp-field" id="customAmtField" style="display:none">
          <label>Montant personnalisé (FCFA) <span class="req">*</span></label>
          <input class="lp-input" name="montantCustom" type="number" min="100" placeholder="Ex: 25000" id="customAmtInput">
        </div>
        <input type="hidden" name="montant" id="donMontantHidden" value="5000">

        <div class="lp-row">
          <div class="lp-field">
            <label>Cause</label>
            <select class="lp-select" name="cause">
              <option value="SoliDev">SoliDev (plateforme)</option>
              <option value="Education">Éducation</option>
              <option value="Santé">Santé</option>
              <option value="Environnement">Environnement</option>
            </select>
          </div>
          <div class="lp-field">
            <label>Mode de paiement</label>
            <select class="lp-select" name="modePaiement">
              <option value="Mobile Money">Mobile Money</option>
              <option value="Virement">Virement</option>
              <option value="Espèces">Espèces</option>
            </select>
          </div>
        </div>

        <label class="lp-anon-check" id="anonCheck">
          <input type="checkbox" name="anonyme" id="donAnon">
          <span>Faire un don anonyme</span>
        </label>

        <div id="donIdentite">
          <div class="lp-row">
            <div class="lp-field">
              <label>Votre nom</label>
              <input class="lp-input" name="nom" placeholder="Kouakou Assi">
            </div>
            <div class="lp-field">
              <label>Email</label>
              <input class="lp-input" name="email" type="email" placeholder="votre@email.com">
            </div>
          </div>
          <div class="lp-field">
            <label>Téléphone</label>
            <input class="lp-input" name="tel" placeholder="+225 07 00 00 00">
          </div>
        </div>

        <div class="lp-field">
          <label>Message (facultatif)</label>
          <textarea class="lp-textarea" name="message" placeholder="Un mot d'encouragement…" style="min-height:80px"></textarea>
        </div>

        <button type="submit" class="lp-btn lp-btn-gold" id="btnDon">
          <span id="donBtnText">Confirmer le don</span>
        </button>
      </form>

      <div id="donSuccess" style="display:none">
        <div class="lp-success">
          <div class="lp-success-icon">💛</div>
          <h3 data-i18n="s_don_h">Merci pour votre générosité !</h3>
          <p  data-i18n="s_don_p">Votre don a bien été enregistré. Vous recevrez un reçu par email.</p>
          <div class="lp-success-ref" id="donRef"></div>
          <button class="lp-btn lp-btn-secondary" onclick="resetDonForm()">Faire un autre don</button>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── FOOTER ── -->
<footer class="lp-footer">
  <div class="lp-footer-inner">
    <div class="lp-footer-brand">
      <div class="lp-nav-logo" style="width:36px;height:36px;font-size:12px">SD</div>
      <div>
        <div class="lp-footer-brand-name">SoliDev</div>
        <div class="lp-footer-brand-sub">Solidarité &amp; Développement</div>
      </div>
    </div>
    <div class="lp-footer-links">
      <a class="lp-footer-link" href="#adhesion">Adhésion</a>
      <a class="lp-footer-link" href="#besoins">Besoins</a>
      <a class="lp-footer-link" href="#connexion">Connexion</a>
      <a class="lp-footer-link" href="#don">Don</a>
      <a class="lp-footer-link" href="javascript:void(0)" onclick="landingNav('login')">Administration</a>
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
  // Close on nav link click
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
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


// ── Besoins form ──────────────────────────────────────────────
function setupBesoinsForm() {
  const form = document.getElementById('formBesoins');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn  = document.getElementById('btnSubmitBsn');
    const text = document.getElementById('bsnBtnText');
    btn.disabled = true;
    text.innerHTML = '<span class="lp-spinner"></span>';
    clearAlert('bsnAlert');

    const fd = new FormData(form);
    const body = {
      nom:         fd.get('nom'),
      email:       fd.get('email'),
      typeEntite:  fd.get('typeEntite') || null,
      typeBesoin:  fd.get('typeBesoin'),
      description: fd.get('description'),
    };
    try {
      const res  = await fetch('/api/public/besoins', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur serveur');
      document.getElementById('formBesoins').style.display = 'none';
      document.getElementById('bsnSuccess').style.display = 'block';
    } catch(err) {
      showAlert('bsnAlert', err.message, 'error');
      btn.disabled = false;
      text.textContent = 'Soumettre le besoin';
    }
  });
}

function selectNeedType(el) {
  document.querySelectorAll('#needTypes .lp-need-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('needTypeHidden').value = el.dataset.type;
}

function resetBsnForm() {
  document.getElementById('bsnSuccess').style.display = 'none';
  document.getElementById('formBesoins').style.display = '';
  document.getElementById('formBesoins').reset();
  const btn = document.getElementById('btnSubmitBsn');
  if(btn) { btn.disabled = false; document.getElementById('bsnBtnText').textContent = 'Soumettre le besoin'; }
}

// ── Connexion form ────────────────────────────────────────────
function setupConnexionForm() {
  const form = document.getElementById('formConnexion');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn  = document.getElementById('btnCnx');
    const text = document.getElementById('cnxBtnText');
    btn.disabled = true;
    text.innerHTML = '<span class="lp-spinner"></span>';
    clearAlert('cnxAlert');

    const fd = new FormData(form);
    try {
      const res  = await fetch('/api/auth/login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Identifiants incorrects');
      localStorage.setItem('gpo_token', data.token);
      if (data.user) localStorage.setItem('gpo_user', JSON.stringify(data.user));
      landingNav('dashboard');
    } catch(err) {
      showAlert('cnxAlert', err.message, 'error');
      btn.disabled = false;
      text.textContent = 'Se connecter';
    }
  });
}

function togglePwd() {
  const inp = document.getElementById('cnxPwd');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ── Don form ──────────────────────────────────────────────────
function setupDonForm() {
  const form = document.getElementById('formDon');
  if (!form) return;

  // Anonymous toggle
  const anonChk   = document.getElementById('donAnon');
  const identite  = document.getElementById('donIdentite');
  anonChk && anonChk.addEventListener('change', () => {
    identite.style.display = anonChk.checked ? 'none' : '';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn  = document.getElementById('btnDon');
    const text = document.getElementById('donBtnText');
    btn.disabled = true;
    text.innerHTML = '<span class="lp-spinner"></span>';
    clearAlert('donAlert');

    // Resolve amount
    const montant = donCustom
      ? parseInt(document.getElementById('customAmtInput').value || 0)
      : donAmount;

    if (!montant || montant < 100) {
      showAlert('donAlert', 'Veuillez entrer un montant valide (minimum 100 FCFA)', 'error');
      btn.disabled = false;
      text.textContent = 'Confirmer le don';
      return;
    }

    const fd = new FormData(form);
    const body = {
      montant,
      cause:       fd.get('cause'),
      message:     fd.get('message') || null,
      nom:         anonChk && anonChk.checked ? null : (fd.get('nom') || null),
      email:       anonChk && anonChk.checked ? null : (fd.get('email') || null),
      tel:         anonChk && anonChk.checked ? null : (fd.get('tel') || null),
      modePaiement:fd.get('modePaiement'),
      anonyme:     anonChk && anonChk.checked ? 1 : 0,
    };
    try {
      const res  = await fetch('/api/public/don', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur serveur');
      const montantFormate = new Intl.NumberFormat('fr-FR').format(montant);
      document.getElementById('donRef').textContent = `${montantFormate} FCFA · Réf #${data.id||'DON-'+Date.now()}`;
      document.getElementById('formDon').style.display = 'none';
      document.getElementById('donSuccess').style.display = 'block';
    } catch(err) {
      showAlert('donAlert', err.message, 'error');
      btn.disabled = false;
      text.textContent = 'Confirmer le don';
    }
  });
}

function pickAmt(amt) {
  if (amt === 'custom') {
    donCustom = true;
    document.getElementById('customAmtField').style.display = '';
    document.getElementById('customAmtInput').focus();
  } else {
    donCustom = false;
    donAmount = amt;
    document.getElementById('customAmtField').style.display = 'none';
    document.getElementById('donMontantHidden').value = amt;
  }
  document.querySelectorAll('.lp-amount-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.amt === String(amt));
  });
}

function resetDonForm() {
  document.getElementById('donSuccess').style.display = 'none';
  document.getElementById('formDon').style.display = '';
  document.getElementById('formDon').reset();
  donAmount = 5000; donCustom = false;
  pickAmt(5000);
  const btn = document.getElementById('btnDon');
  if(btn) { btn.disabled = false; document.getElementById('donBtnText').textContent = 'Confirmer le don'; }
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

function showAlert(zoneId, msg, type='error') {
  const z = document.getElementById(zoneId);
  if (!z) return;
  z.innerHTML = `
    <div class="lp-alert lp-alert-${type}">
      <span class="lp-alert-icon">${type==='error'?'⚠️':'✓'}</span>
      <span>${msg}</span>
    </div>`;
}
function clearAlert(zoneId) {
  const z = document.getElementById(zoneId);
  if (z) z.innerHTML = '';
}

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
