// ============================================================
// SoliDev — Carte géographique des organisations
// Affiche les organisations actives sur une carte, groupées par pays et localisées dans
// leur pays à partir de leur ville de siège (aucune coordonnée précise n'étant enregistrée,
// on rapproche la ville déclarée d'une liste de villes connues ; à défaut, l'organisation est
// positionnée près du centre de son pays).
// ============================================================

// Coordonnées approximatives des principales villes de chaque pays géré par la plateforme.
const CARTE_VILLES = {
  CIV: [
    { nom: 'Abidjan',      lat: 5.3600,  lng: -4.0083 },
    { nom: 'Yamoussoukro', lat: 6.8276,  lng: -5.2893 },
    { nom: 'Bouake',       lat: 7.6900,  lng: -5.0300 },
    { nom: 'San Pedro',    lat: 4.7485,  lng: -6.6363 },
    { nom: 'Korhogo',      lat: 9.4580,  lng: -5.6296 },
    { nom: 'Daloa',        lat: 6.8770,  lng: -6.4502 },
  ],
  MLI: [
    { nom: 'Bamako',  lat: 12.6392, lng: -8.0029 },
    { nom: 'Sikasso', lat: 11.3176, lng: -5.6660 },
    { nom: 'Mopti',   lat: 14.4843, lng: -4.1826 },
    { nom: 'Segou',   lat: 13.4317, lng: -6.2157 },
    { nom: 'Kayes',   lat: 14.4469, lng: -11.4432 },
  ],
  BEN: [
    { nom: 'Cotonou',    lat: 6.3703, lng: 2.3912 },
    { nom: 'PortoNovo',  lat: 6.4969, lng: 2.6289 },
    { nom: 'Porto Novo', lat: 6.4969, lng: 2.6289 },
    { nom: 'Parakou',    lat: 9.3372, lng: 2.6303 },
    { nom: 'Abomey',     lat: 7.1826, lng: 1.9910 },
  ],
  BFA: [
    { nom: 'Ouagadougou',    lat: 12.3714, lng: -1.5197 },
    { nom: 'Bobo-Dioulasso', lat: 11.1771, lng: -4.2979 },
    { nom: 'Koudougou',      lat: 12.2530, lng: -2.3620 },
  ],
  NGA: [
    { nom: 'Lagos',         lat: 6.5244, lng: 3.3792 },
    { nom: 'Abuja',         lat: 9.0765, lng: 7.3986 },
    { nom: 'Kano',          lat: 12.0022, lng: 8.5920 },
    { nom: 'Ibadan',        lat: 7.3775, lng: 3.9470 },
    { nom: 'Port Harcourt', lat: 4.8156, lng: 7.0498 },
  ],
  MDG: [
    { nom: 'Antananarivo', lat: -18.8792, lng: 47.5079 },
    { nom: 'Toamasina',    lat: -18.1492, lng: 49.4023 },
    { nom: 'Fianarantsoa', lat: -21.4536, lng: 47.0854 },
    { nom: 'Mahajanga',    lat: -15.7167, lng: 46.3167 },
  ],
};

const CARTE_ACCENTS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
function carteNormaliser(s) {
  return (s || '')
    .normalize('NFD').replace(CARTE_ACCENTS_RE, '')
    .toLowerCase().replace(/[^a-z]/g, '');
}

/** Rapproche le texte de siège déclaré (souvent "Ville, Pays" ou plusieurs villes) d'une ville
 * connue du pays ; à défaut, renvoie un point dispersé autour du centre du pays pour éviter que
 * les organisations non reconnues s'empilent toutes au même endroit. */
function carteLocaliser(siegeOrg, codePays) {
  const villes = CARTE_VILLES[codePays] || [];
  const texteNorm = carteNormaliser(siegeOrg);
  if (texteNorm) {
    const trouvee = villes.find(v => texteNorm.includes(carteNormaliser(v.nom)));
    if (trouvee) return { lat: trouvee.lat, lng: trouvee.lng, ville: trouvee.nom, approx: false };
  }
  const pays = getPays(codePays);
  if (!pays) return null;
  // Dispersion légère et déterministe (basée sur le nom du siège) autour du centre du pays.
  const seed = [...(siegeOrg || codePays)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const jitter = (n) => ((n % 100) / 100 - 0.5) * 1.2;
  return {
    lat: pays.latitude + jitter(seed),
    lng: pays.longitude + jitter(seed * 7),
    ville: siegeOrg || pays.nom,
    approx: true,
  };
}

const CARTE_TYPE_COLORS = { Association: '#2563eb', ONG: '#059669', Mutuelle: '#d97706' };

router.register('carte', async (params = {}) => {
  // Un pays peut être présélectionné en arrivant depuis la page d'accueil (clic sur un drapeau) —
  // sinon on affiche tous les pays par défaut.
  const paysInitial = params.pays && CARTE_VILLES[params.pays] ? params.pays : '';

  document.body.className = '';
  document.body.innerHTML = `
    <div class="pub-form-wrap" style="max-width:1100px">
      <button class="pub-form-back" onclick="landingNav('landing')">← Retour à l'accueil</button>
      <div class="pub-form-card" style="padding:24px 28px">
        <div class="pub-form-logo">
          <img src="/images/logo.svg" class="logo-sm" alt="SoliDev">
          <span>SoliDev</span>
        </div>
        <h2>🗺️ Carte des organisations</h2>
        <p class="sub-desc">
          Découvrez les organisations inscrites sur SoliDev, pays par pays, et leur localisation approximative.
        </p>

        <div class="entity-tabs" id="cartePaysTabs" style="flex-wrap:wrap">
          <button class="entity-tab${paysInitial === '' ? ' active' : ''}" data-pays="">🌍 Tous les pays</button>
          ${Object.keys(CARTE_VILLES).map(code => {
            const p = getPays(code);
            return `<button class="entity-tab${paysInitial === code ? ' active' : ''}" data-pays="${code}">${p ? p.drapeau : ''} ${p ? p.nom : code}</button>`;
          }).join('')}
        </div>

        <div id="carteMap" style="height:440px;border-radius:14px;overflow:hidden;margin-top:16px;border:1px solid #e5e7eb"></div>
        <p class="fonction-hint" style="margin-top:8px">
          📍 Position exacte lorsque la ville de siège est reconnue, sinon position approximative dans le pays.
        </p>

        <div id="carteMsg" class="msg error" style="display:none;margin-top:12px"></div>

        <div id="carteListeParPays" style="margin-top:24px"></div>
      </div>
    </div>
  `;

  const msgEl = document.getElementById('carteMsg');
  let organisations = [];
  try {
    const { orgs } = await api.get('/public/organisations?all=1');
    organisations = orgs || [];
  } catch (err) {
    msgEl.textContent = '⚠️ Impossible de charger les organisations pour le moment.';
    msgEl.style.display = 'block';
  }

  // Localise chaque organisation une seule fois (évite de refaire le calcul à chaque filtre).
  const points = organisations.map(o => {
    const loc = carteLocaliser(o.Ville, o.CodePays);
    return loc ? { ...o, ...loc } : null;
  }).filter(Boolean);

  const map = L.map('carteMap', { scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map);

  let markersLayer = L.layerGroup().addTo(map);

  function fmtOrg(o) {
    const col = CARTE_TYPE_COLORS[o.TypeOrg] || '#6366f1';
    const pays = getPays(o.CodePays);
    return `
      <div style="min-width:200px">
        <div style="font-weight:700;margin-bottom:4px">${o.LibOrg}</div>
        <span style="background:${col}1a;color:${col};font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px">${o.TypeOrg || 'Organisation'}</span>
        <div style="margin-top:6px;font-size:12.5px;color:#6b7280">
          📍 ${o.ville}${o.approx ? ' (position approximative)' : ''}<br>
          ${pays ? pays.drapeau + ' ' + pays.nom : (o.Pays || o.CodePays)}
        </div>
      </div>`;
  }

  function renderMarkers(codePaysFiltre) {
    markersLayer.clearLayers();
    const filtres = codePaysFiltre ? points.filter(p => p.CodePays === codePaysFiltre) : points;

    filtres.forEach(o => {
      L.circleMarker([o.lat, o.lng], {
        radius: 8,
        color: CARTE_TYPE_COLORS[o.TypeOrg] || '#6366f1',
        fillColor: CARTE_TYPE_COLORS[o.TypeOrg] || '#6366f1',
        fillOpacity: o.approx ? 0.45 : 0.85,
        weight: 2,
      }).bindPopup(fmtOrg(o)).addTo(markersLayer);
    });

    if (filtres.length) {
      // Sur un seul pays, on plafonne un peu plus le zoom qu'en vue "tous les pays" : avec une
      // ou deux organisations, la carte doit encore se lire comme celle du pays, pas d'une seule ville.
      const bounds = L.latLngBounds(filtres.map(o => [o.lat, o.lng]));
      map.fitBounds(bounds.pad(0.3), { maxZoom: codePaysFiltre ? 6 : 8 });
    } else if (codePaysFiltre) {
      // Un pays précis est sélectionné mais n'a encore aucune organisation : on affiche quand
      // même la carte de CE pays (centrée dessus) plutôt qu'une vue du monde hors de propos.
      const pays = getPays(codePaysFiltre);
      map.setView(pays ? [pays.latitude, pays.longitude] : [10, 0], pays ? 6 : 3);
    } else {
      map.setView([10, 0], 3);
    }
  }

  function renderListe(codePaysFiltre) {
    const parPays = {};
    (codePaysFiltre ? organisations.filter(o => o.CodePays === codePaysFiltre) : organisations)
      .forEach(o => { (parPays[o.CodePays] = parPays[o.CodePays] || []).push(o); });

    const listeEl = document.getElementById('carteListeParPays');
    const codes = Object.keys(parPays);
    if (!codes.length) {
      listeEl.innerHTML = `<div class="dem-empty"><div class="dem-empty-icon">📭</div><p>Aucune organisation trouvée</p></div>`;
      return;
    }

    listeEl.innerHTML = codes.map(code => {
      const pays = getPays(code);
      const orgsDuPays = parPays[code];
      return `
        <div style="margin-bottom:22px">
          <div style="font-weight:700;font-size:15px;margin-bottom:10px;display:flex;align-items:center;gap:8px">
            ${pays ? pays.drapeau : ''} ${pays ? pays.nom : code}
            <span style="font-weight:500;color:#9ca3af;font-size:12.5px">(${orgsDuPays.length} organisation${orgsDuPays.length > 1 ? 's' : ''})</span>
          </div>
          <div class="org-grid">
            ${orgsDuPays.map(o => {
              const col = CARTE_TYPE_COLORS[o.TypeOrg] || '#6366f1';
              return `
              <div class="org-card">
                <div class="org-card-body">
                  <div class="org-card-name">${o.LibOrg}</div>
                  <div class="org-card-location">📍 ${o.Ville || '—'}</div>
                  <div class="org-card-meta">
                    <span class="org-type-badge" style="background:${col}1a;color:${col}">${o.TypeOrg || 'Org'}</span>
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');
  }

  renderMarkers(paysInitial);
  renderListe(paysInitial);

  document.getElementById('cartePaysTabs').addEventListener('click', e => {
    const btn = e.target.closest('.entity-tab');
    if (!btn) return;
    document.querySelectorAll('#cartePaysTabs .entity-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const code = btn.dataset.pays;
    renderMarkers(code);
    renderListe(code);
  });

  // Le conteneur de la carte est créé avec `display` géré par le layout — Leaflet a besoin d'un
  // recalcul de sa taille une fois le CSS appliqué, sinon les tuiles peuvent apparaître tronquées.
  setTimeout(() => map.invalidateSize(), 200);
});
