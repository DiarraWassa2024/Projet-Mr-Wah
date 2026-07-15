/**
 * Configuration complète des pays gérés par la plateforme GPO/SoliDev.
 * Chargé globalement — disponible dans toutes les pages via window.PAYS_CONFIG.
 */
const PAYS_CONFIG = {
  CIV: {
    code:       'CIV',
    nom:        "Côte d'Ivoire",
    drapeau:    '🇨🇮',
    drapeauSvg: '/images/drapeaux/civ.svg',
    armoirie:   '/images/armoiries/civ.svg',
    langue:     'Français',
    nationalite: 'Ivoirienne',
    indicatif:  '+225',
    devise: {
      code:    'XOF',
      lib:     'Franc CFA BCEAO',
      symbole: 'F CFA',
    },
    ministere: {
      lib:    "Ministère de l'Intérieur et de la Sécurité",
      domaine: 'Intérieur',
    },
    latitude:  7.539989,
    longitude: -5.547080,
  },

  MLI: {
    code:       'MLI',
    nom:        'Mali',
    drapeau:    '🇲🇱',
    drapeauSvg: '/images/drapeaux/mli.svg',
    armoirie:   '/images/armoiries/mli.svg',
    langue:     'Français',
    nationalite: 'Malienne',
    indicatif:  '+223',
    devise: {
      code:    'XOF',
      lib:     'Franc CFA BCEAO',
      symbole: 'F CFA',
    },
    ministere: {
      lib:     "Ministère de l'Administration Territoriale et de la Décentralisation",
      domaine: 'Intérieur',
    },
    latitude:  17.570692,
    longitude: -3.996166,
  },

  BEN: {
    code:       'BEN',
    nom:        'Bénin',
    drapeau:    '🇧🇯',
    drapeauSvg: '/images/drapeaux/ben.svg',
    armoirie:   '/images/armoiries/ben.svg',
    langue:     'Français',
    nationalite: 'Béninoise',
    indicatif:  '+229',
    devise: {
      code:    'XOF',
      lib:     'Franc CFA BCEAO',
      symbole: 'F CFA',
    },
    ministere: {
      lib:     "Ministère de l'Intérieur et de la Sécurité Publique",
      domaine: 'Intérieur',
    },
    latitude:  9.307690,
    longitude: 2.315834,
  },

  BFA: {
    code:       'BFA',
    nom:        'Burkina Faso',
    drapeau:    '🇧🇫',
    drapeauSvg: '/images/drapeaux/bfa.svg',
    armoirie:   '/images/armoiries/bfa.svg',
    langue:     'Français',
    nationalite: 'Burkinabè',
    indicatif:  '+226',
    devise: {
      code:    'XOF',
      lib:     'Franc CFA BCEAO',
      symbole: 'F CFA',
    },
    ministere: {
      lib:     "Ministère de l'Administration Territoriale et de la Décentralisation",
      domaine: 'Intérieur',
    },
    latitude:  12.364566,
    longitude: -1.535150,
  },

  NGA: {
    code:       'NGA',
    nom:        'Nigeria',
    drapeau:    '🇳🇬',
    drapeauSvg: '/images/drapeaux/nga.svg',
    armoirie:   '/images/armoiries/nga.svg',
    langue:     'Anglais',
    nationalite: 'Nigériane',
    indicatif:  '+234',
    devise: {
      code:    'NGN',
      lib:     'Naira nigérian',
      symbole: '₦',
    },
    ministere: {
      lib:     "Ministère Fédéral du Budget et de la Planification Nationale",
      domaine: 'Budget',
    },
    latitude:  9.081999,
    longitude: 8.675277,
  },

  MDG: {
    code:       'MDG',
    nom:        'Madagascar',
    drapeau:    '🇲🇬',
    drapeauSvg: '/images/drapeaux/mdg.svg',
    armoirie:   '/images/armoiries/mdg.svg',
    langue:     'Français, Malgache',
    nationalite: 'Malgache',
    indicatif:  '+261',
    devise: {
      code:    'MGA',
      lib:     'Ariary malgache',
      symbole: 'Ar',
    },
    ministere: {
      lib:     "Ministère de l'Intérieur et de la Décentralisation",
      domaine: 'Intérieur',
    },
    latitude:  -18.766947,
    longitude: 46.869107,
  },
};

/**
 * Retourne la config d'un pays ou null si inconnu.
 * @param {string} code — CodePays (CIV, MLI, BEN, BFA, NGA, MDG)
 */
function getPays(code) {
  return PAYS_CONFIG[code] || null;
}

/**
 * Applique l'indicatif téléphonique dans un champ.
 * - Pré-remplit si le champ est vide ou contient un ancien indicatif auto-rempli
 * - Stoppe le remplacement automatique dès que l'utilisateur tape
 * @param {HTMLElement} el
 * @param {string} indicatif — ex. '+225'
 */
function applyIndicatif(el, indicatif) {
  if (!el) return;
  el.placeholder = `${indicatif} 07 00 00 00`;
  if (!el.value || el.dataset.autoIndicatif === '1') {
    el.value = indicatif + ' ';
    el.dataset.autoIndicatif = '1';
  }
  el.addEventListener('input', () => { el.dataset.autoIndicatif = '0'; }, { once: true });
}

/**
 * Pré-remplit la nationalité correspondant au pays sélectionné.
 * - Ne remplace pas une valeur déjà saisie manuellement par l'utilisateur
 * - Stoppe le remplacement automatique dès que l'utilisateur tape
 * @param {HTMLElement} el
 * @param {string} nationalite — ex. 'Ivoirienne'
 */
function applyNationalite(el, nationalite) {
  if (!el || !nationalite) return;
  if (!el.value || el.dataset.autoNationalite === '1') {
    el.value = nationalite;
    el.dataset.autoNationalite = '1';
  }
  el.addEventListener('input', () => { el.dataset.autoNationalite = '0'; }, { once: true });
}

/**
 * Injecte la carte visuelle d'un pays dans un conteneur donné.
 * @param {HTMLElement} container — élément #paysInfoCard ou équivalent
 * @param {object} p — objet PAYS_CONFIG[code]
 */
function renderPaysCard(container, p) {
  if (!container) return;
  container.innerHTML = `
    <div class="pays-card">
      <div class="pays-card-left">
        <img src="${p.drapeauSvg}" alt="Drapeau ${p.nom}" class="pays-drapeau-img">
        <img src="${p.armoirie}"   alt="Armoiries ${p.nom}" class="pays-armoirie-img">
      </div>
      <div class="pays-card-info">
        <div class="pays-card-nom">${p.drapeau} ${p.nom}</div>
        <div class="pays-card-details">
          <span class="pays-badge langue-badge">🗣️ ${p.langue}</span>
          <span class="pays-badge devise-badge">💱 ${p.devise.code} — ${p.devise.lib} (${p.devise.symbole})</span>
          <span class="pays-badge tel-badge">📞 ${p.indicatif}</span>
        </div>
        <div class="pays-card-min">
          <span class="pays-min-label">Ministère de tutelle :</span>
          <span class="pays-min-value">${p.ministere.lib}</span>
        </div>
      </div>
    </div>`;
  container.style.display = 'block';
}

/**
 * Callback déclenché par onchange sur un <select> de pays.
 * Remplit automatiquement ministère, indicatifs, langue, devise, drapeau, armoiries.
 *
 * @param {string}  code      — CodePays sélectionné
 * @param {boolean} individu  — true = formulaire individu (seul l'indicatif est rempli)
 * @param {object}  ids       — IDs des éléments à remplir (optionnel, défauts ci-dessous)
 */
window.onPaysChange = function(code, individu = false, ids = {}) {
  const p = getPays(code);

  const {
    cardId        = 'paysInfoCard',
    ministereId   = 'ministereInput',
    telOrgId      = 'telOrgInput',
    telRepId      = 'repTelInput',
    telIndId      = 'telIndInput',
    langueId      = 'langueInput',
    deviseId      = 'deviseInput',
    nationaliteId = 'nationaliteInput',
  } = ids;

  // Carte visuelle pays
  const card = document.getElementById(cardId);
  if (card) {
    if (p) renderPaysCard(card, p);
    else card.style.display = 'none';
  }

  if (!p) return;

  if (individu) {
    // Formulaire individu — indicatif, nationalité + carte
    applyIndicatif(document.getElementById(telIndId), p.indicatif);
    applyNationalite(document.getElementById(nationaliteId), p.nationalite);
  } else {
    // Formulaire organisation
    const ministereEl = document.getElementById(ministereId);
    if (ministereEl) {
      ministereEl.value       = p.ministere.lib;
      ministereEl.placeholder = p.ministere.lib;
    }
    const langueEl = document.getElementById(langueId);
    if (langueEl) { langueEl.value = p.langue; }

    const deviseEl = document.getElementById(deviseId);
    if (deviseEl) { deviseEl.value = `${p.devise.code} — ${p.devise.lib} (${p.devise.symbole})`; }

    applyIndicatif(document.getElementById(telOrgId), p.indicatif);
    applyIndicatif(document.getElementById(telRepId), p.indicatif);
  }
};
