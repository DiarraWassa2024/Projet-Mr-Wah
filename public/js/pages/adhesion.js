// Change le logo et affiche le drapeau du pays sélectionné, alignés avec "SoliDev" en en-tête.
function updateHeaderBrand(code) {
  const logoBox = document.getElementById('adhLogoBox');
  const badge   = document.getElementById('adhFlagBadge');
  if (!logoBox || !badge) return;

  const p = code ? getPays(code) : null;
  if (p) {
    logoBox.innerHTML = `<img src="${p.armoirie}" alt="${p.nom}" class="adh-logo-armoirie">`;
    logoBox.classList.add('adh-logo-country');
    badge.style.display = 'flex';
    badge.innerHTML = `<img src="${p.drapeauSvg}" alt="${p.nom}" class="adh-flag-badge-img"><span>${p.nom}</span>`;
  } else {
    logoBox.innerHTML = '<img src="/images/logo.svg" alt="SoliDev" style="width:100%;height:100%;object-fit:cover">';
    logoBox.classList.remove('adh-logo-country');
    badge.style.display = 'none';
    badge.innerHTML = '';
  }
}

router.register('adhesion', async (params = {}) => {
  const mode = params.mode || (
    ['Association','ONG','Mutuelle'].includes(params.type) ? 'organisation' :
    params.type === 'Individu' ? 'individu' : 'individu'
  );
  const sousType = params.sousType || (
    ['Association','ONG','Mutuelle'].includes(params.type) ? params.type : 'Association'
  );

  let pays = [];
  try { pays = await api.get('/ref/pays'); } catch(e) {}
  function paysOpts(sel='') {
    return pays.map(p => `<option value="${p.id}" ${p.id===sel?'selected':''}>${p.lib}</option>`).join('');
  }

  const typeIcon = { Association:'🏛️', ONG:'🌍', Mutuelle:'🤝' };
  const FONCTIONS = ['Président', 'Trésorier', 'Secrétaire'];
  function fonctionOpts(sel = '') {
    return `<option value="">Choisir une fonction…</option>` +
      FONCTIONS.map(f => `<option value="${f}" ${f === sel ? 'selected' : ''}>${f}</option>`).join('');
  }

  if (!document.getElementById('app')) document.body.innerHTML = '<div id="app"></div>';
  document.body.className = '';

  function progressBar(step) {
    const steps = [
      { n:1, label:'Informations' },
      { n:2, label:'Organisation' },
      { n:3, label:'Fonction' },
      { n:4, label:'Confirmation' },
    ];
    return `<div class="adh-progress-bar">
      ${steps.map((s,i) => `
        <div class="adh-prog-step ${s.n < step ? 'done' : s.n === step ? 'active' : ''}">
          <div class="adh-prog-num">${s.n < step ? '✓' : s.n}</div>
          <span>${s.label}</span>
        </div>
        ${i < steps.length-1 ? `<div class="adh-prog-sep ${s.n < step ? 'done' : ''}"></div>` : ''}
      `).join('')}
    </div>`;
  }

  document.body.innerHTML = `
    <div class="pub-form-wrap">
      <button class="pub-form-back" onclick="landingNav('landing')">← Retour à l'accueil</button>

      <div class="pub-form-card adh-card">

        <div class="pub-form-logo">
          <div class="pub-form-brand">
            <div class="logo-sm" id="adhLogoBox"><img src="/images/logo.svg" alt="SoliDev" style="width:100%;height:100%;object-fit:cover"></div>
            <span>SoliDev</span>
          </div>
          <div class="adh-flag-badge" id="adhFlagBadge" style="display:none"></div>
        </div>

        <h2>Demande d'adhésion</h2>
        <p class="sub-desc">Choisissez votre profil pour commencer votre inscription sur la plateforme SoliDev.</p>

        <div class="adh-toggle-wrap">
          <button class="adh-toggle ${mode==='individu'?'active':''}"
                  onclick="landingNav('adhesion',{mode:'individu'})">
            <span class="adh-toggle-icon">👤</span>
            <span class="adh-toggle-label">Individu</span>
            <span class="adh-toggle-sub">Adhésion personnelle</span>
          </button>
          <button class="adh-toggle ${mode==='organisation'?'active':''}"
                  onclick="landingNav('adhesion',{mode:'organisation',sousType:'${sousType}'})">
            <span class="adh-toggle-icon">🏢</span>
            <span class="adh-toggle-label">Organisation</span>
            <span class="adh-toggle-sub">Association, ONG, Mutuelle</span>
          </button>
        </div>

        ${mode === 'organisation' ? `
        <div class="adh-soustype-wrap">
          <button class="adh-soustype ${sousType==='Association'?'active':''}"
                  onclick="landingNav('adhesion',{mode:'organisation',sousType:'Association'})">🏛️ Association</button>
          <button class="adh-soustype ${sousType==='ONG'?'active':''}"
                  onclick="landingNav('adhesion',{mode:'organisation',sousType:'ONG'})">🌍 ONG</button>
          <button class="adh-soustype ${sousType==='Mutuelle'?'active':''}"
                  onclick="landingNav('adhesion',{mode:'organisation',sousType:'Mutuelle'})">🤝 Mutuelle</button>
        </div>` : ''}

        <!-- ═══ STEP 1 ═══════════════════════════════════════════ -->
        <div id="step1-section">
          ${mode === 'individu' ? progressBar(1) : ''}

          <form id="adhesionForm" enctype="multipart/form-data">
            <input type="hidden" name="type" value="${mode==='individu'?'Individu':sousType}">
            <input type="hidden" name="mode" value="${mode}">

            ${mode === 'organisation' ? `

            <div class="adh-pays-banner">
              <div class="adh-pays-label">🌍 Pays où l'activité est exercée</div>
              <select name="pays" id="paysSelect" required class="adh-pays-select"
                      onchange="onPaysChange(this.value); updateHeaderBrand(this.value)">
                <option value="">Sélectionner le pays…</option>
                ${paysOpts()}
              </select>
            </div>
            <div id="paysInfoCard" style="display:none"></div>

            <div class="adh-section adh-section-org">
              <div class="adh-section-header adh-header-blue">
                <div class="adh-section-icon">${typeIcon[sousType]||'🏢'}</div>
                <div>
                  <div class="adh-section-title">Informations sur l'organisation</div>
                  <div class="adh-section-sub">Coordonnées et identité de votre structure (${sousType})</div>
                </div>
              </div>
              <div class="adh-section-body">
                <div class="form-row">
                  <div class="form-group">
                    <label>Numéro d'agrément</label>
                    <input type="text" name="numAgr" placeholder="Ex : AGR-2024-001">
                  </div>
                  <div class="form-group">
                    <label>Nom de l'organisation *</label>
                    <input type="text" name="nom" required
                           placeholder="Ex : ${sousType==='ONG'?'ONG Espoir Africain':'Association Entraide Mali'}">
                  </div>
                </div>
                <div class="form-group adh-upload-group">
                  <label>
                    🖼️ Logo de l'organisation
                    <span class="adh-upload-hint">(JPG, PNG, WEBP ou SVG — max 5 Mo, optionnel)</span>
                  </label>
                  <label class="adh-upload-zone" id="logoUploadZone">
                    <input type="file" name="logo" id="logoInput"
                           accept=".jpg,.jpeg,.png,.webp,.svg" onchange="previewLogoUpload(this)">
                    <img id="logoPreviewImg" style="display:none;width:64px;height:64px;object-fit:cover;border-radius:12px;margin:0 auto 8px">
                    <span class="adh-upload-icon" id="logoUploadIcon">🖼️</span>
                    <span class="adh-upload-text" id="logoUploadText">Cliquez ou déposez votre logo ici</span>
                    <span class="adh-upload-sub">Affiché sur votre profil, vos cartes et votre espace de gestion</span>
                  </label>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Ministère de tutelle</label>
                    <input type="text" name="ministere" id="ministereInput"
                           placeholder="Sélectionnez d'abord le pays…">
                  </div>
                  <div class="form-group">
                    <label>Siège social / Ville</label>
                    <input type="text" name="siege" placeholder="Ex : Abidjan, Plateau">
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Langue officielle</label>
                    <input type="text" id="langueInput" readonly
                           placeholder="Automatique selon le pays" class="input-readonly">
                  </div>
                  <div class="form-group">
                    <label>Devise</label>
                    <input type="text" id="deviseInput" readonly
                           placeholder="Automatique selon le pays" class="input-readonly">
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Date de création</label>
                    <input type="date" name="dateCrea" max="${new Date().toISOString().split('T')[0]}">
                    <p class="form-hint" style="margin-top:4px;color:#9ca3af;font-size:11px">Ne peut pas être une date future</p>
                  </div>
                  <div class="form-group">
                    <label>Téléphone</label>
                    <input type="text" name="tel" id="telOrgInput" placeholder="+225 07 00 00 00">
                  </div>
                </div>
                <div class="form-group">
                  <label>Email de contact *</label>
                  <input type="email" name="email" required placeholder="contact@organisation.org">
                </div>
                <div class="form-group">
                  <label>Objet social / Description</label>
                  <textarea name="description" rows="3"
                            placeholder="Décrivez brièvement les activités et la mission de votre organisation…"></textarea>
                </div>
                <div class="form-group adh-upload-group">
                  <label>
                    📎 Document d'agrément du Ministère de tutelle
                    <span class="adh-upload-hint">(PDF, JPG ou PNG — max 5 Mo)</span>
                  </label>
                  <label class="adh-upload-zone" id="uploadZone">
                    <input type="file" name="docAgrement" id="docAgrementInput"
                           accept=".pdf,.jpg,.jpeg,.png" onchange="previewUpload(this)">
                    <span class="adh-upload-icon">📄</span>
                    <span class="adh-upload-text" id="uploadText">Cliquez ou déposez le document ici</span>
                    <span class="adh-upload-sub">Arrêté ministériel, récépissé de déclaration, etc.</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="adh-section adh-section-rep">
              <div class="adh-section-header adh-header-purple">
                <div class="adh-section-icon">👤</div>
                <div>
                  <div class="adh-section-title">Informations sur le déclarant</div>
                  <div class="adh-section-sub">Identité du représentant légal signataire de la demande</div>
                </div>
              </div>
              <div class="adh-section-body">
                <div class="form-row">
                  <div class="form-group">
                    <label>Nom *</label>
                    <input type="text" name="repNom" required placeholder="Nom de famille">
                  </div>
                  <div class="form-group">
                    <label>Prénom(s) *</label>
                    <input type="text" name="repPrenom" required placeholder="Prénom(s)">
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Sexe *</label>
                    <select name="repSexe" required>
                      <option value="">— Sélectionner —</option>
                      <option value="Homme">Homme</option>
                      <option value="Femme">Femme</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Fonction au sein de l'organisation *</label>
                    <select name="repFonction" required>${fonctionOpts()}</select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Lieu d'habitation</label>
                    <input type="text" name="repAdresse" placeholder="Quartier, Ville">
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Téléphone</label>
                    <input type="text" name="repTel" id="repTelInput" placeholder="+225 07 00 00 00">
                  </div>
                  <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="repEmail" placeholder="representant@email.com">
                  </div>
                </div>
                <div class="adh-rep-note">
                  🔒 Ces informations sont confidentielles et utilisées uniquement pour vérifier
                  l'identité du représentant légal.
                </div>
              </div>
            </div>

            ` : `

            <div class="adh-pays-banner">
              <div class="adh-pays-label">🌍 Votre pays de résidence</div>
              <select name="pays" id="paysIndividu" required class="adh-pays-select"
                      onchange="onPaysChange(this.value, true); updateHeaderBrand(this.value)">
                <option value="">Sélectionner le pays…</option>
                ${paysOpts()}
              </select>
            </div>
            <div id="paysInfoCard" style="display:none;margin-bottom:12px"></div>

            <div class="adh-section adh-section-ind">
              <div class="adh-section-header adh-header-green">
                <div class="adh-section-icon">👤</div>
                <div>
                  <div class="adh-section-title">Vos informations personnelles</div>
                  <div class="adh-section-sub">Renseignez vos coordonnées pour constituer votre dossier de candidature</div>
                </div>
              </div>
              <div class="adh-section-body">

                <!-- Photo de profil -->
                <div class="adh-photo-row">
                  <label class="adh-avatar-upload" id="avatarUploadLabel">
                    <input type="file" name="photo" id="photoInput" accept="image/*"
                           style="display:none" onchange="previewAvatar(this)">
                    <div class="adh-avatar-circle" id="avatarPreview">
                      <span class="adh-avatar-icon">📷</span>
                      <span class="adh-avatar-text">Photo</span>
                    </div>
                  </label>
                  <div class="adh-photo-hint">
                    <strong>Photo de profil</strong>
                    <span>JPG, PNG — max 5 Mo (optionnel)</span>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label>Nom *</label>
                    <input type="text" name="nom" required placeholder="Nom de famille">
                  </div>
                  <div class="form-group">
                    <label>Prénom(s) *</label>
                    <input type="text" name="prenom" required placeholder="Prénom(s)">
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Sexe *</label>
                    <select name="sexe" required>
                      <option value="">— Sélectionner —</option>
                      <option value="Homme">Homme</option>
                      <option value="Femme">Femme</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Date de naissance</label>
                    <input type="date" name="dateNaiss" max="2010-12-31">
                    <p class="form-hint" style="margin-top:4px;color:#9ca3af;font-size:11px">Doit être antérieure au 31/12/2010</p>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Email *</label>
                    <input type="email" name="email" required placeholder="votre@email.com">
                  </div>
                  <div class="form-group">
                    <label>Téléphone</label>
                    <input type="text" name="tel" id="telIndInput" placeholder="+221 77 000 00 00">
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Ville</label>
                    <input type="text" name="ville" placeholder="Ex : Dakar, Abidjan…">
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Adresse / Quartier</label>
                    <input type="text" name="adresse" placeholder="Quartier, rue…">
                  </div>
                  <div class="form-group">
                    <label>Numéro CNI / Passeport</label>
                    <input type="text" name="numCNI" placeholder="Numéro de la pièce d'identité">
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Profession</label>
                    <input type="text" name="profession" placeholder="Ex : Enseignant, Ingénieur…">
                  </div>
                  <div class="form-group">
                    <label>Situation matrimoniale</label>
                    <select name="situationMatrimoniale">
                      <option value="">— Sélectionner —</option>
                      <option value="Célibataire">Célibataire</option>
                      <option value="Marié(e)">Marié(e)</option>
                      <option value="Divorcé(e)">Divorcé(e)</option>
                      <option value="Veuf/Veuve">Veuf/Veuve</option>
                      <option value="Union libre">Union libre</option>
                    </select>
                  </div>
                </div>

                <!-- Photo CNI -->
                <div class="form-group adh-upload-group">
                  <label>
                    🪪 Photo de la CNI / Passeport
                    <span class="adh-upload-hint">(JPG, PNG — max 5 Mo, optionnel)</span>
                  </label>
                  <label class="adh-upload-zone" id="cniUploadZone">
                    <input type="file" name="photoCNI" id="photoCNIInput"
                           accept="image/*,.pdf" onchange="previewCNI(this)">
                    <span class="adh-upload-icon">🪪</span>
                    <span class="adh-upload-text" id="cniUploadText">Cliquez ou déposez ici</span>
                    <span class="adh-upload-sub">Recto de votre pièce d'identité</span>
                  </label>
                </div>

                <div class="form-group">
                  <label>Motivation / Commentaire</label>
                  <textarea name="description" rows="3"
                            placeholder="Pourquoi souhaitez-vous adhérer à une organisation SoliDev ?"></textarea>
                </div>
              </div>
            </div>
            `}

            <div id="adhesionMsg" class="msg" style="display:none"></div>

            <div class="form-actions" style="margin-top:8px">
              <button type="button" class="btn btn-secondary" onclick="landingNav('landing')">Annuler</button>
              ${mode === 'individu'
                ? `<button type="button" id="indivNextBtn" class="btn btn-primary adh-submit-btn">
                     Soumettre le dossier à une organisation →
                   </button>`
                : `<button type="submit" class="btn btn-primary adh-submit-btn">📤 Soumettre la demande</button>`
              }
            </div>
          </form>
        </div><!-- /step1-section -->

        ${mode === 'individu' ? `

        <!-- ═══ STEP 2 : Sélecteur d'organisations ═══════════════ -->
        <div id="step2-section" style="display:none">
          ${progressBar(2)}

          <div class="org-step-header">
            <button id="backToFormBtn" class="btn btn-secondary org-back-btn">← Retour</button>
            <div class="org-step-info">
              <div class="org-step-title">Choisir une ou plusieurs organisations</div>
              <div id="orgStepDossier" class="org-step-sub"></div>
            </div>
          </div>

          <!-- Moteur de recherche 4 critères -->
          <div class="org-search-grid">
            <div class="org-search-field org-search-field-nom">
              <label class="org-field-label">Nom</label>
              <input id="orgSearch" class="org-search-input" type="search"
                     placeholder="Rechercher par nom…" autocomplete="off">
            </div>
            <div class="org-search-field">
              <label class="org-field-label">Ville</label>
              <input id="orgVilleFilter" class="org-search-input" type="search"
                     placeholder="Ville ou siège…" autocomplete="off">
            </div>
            <div class="org-search-field">
              <label class="org-field-label">Type</label>
              <select id="orgTypeFilter" class="org-search-input">
                <option value="">Tous types</option>
                <option value="Association">🏛️ Association</option>
                <option value="ONG">🌍 ONG</option>
                <option value="Mutuelle">🤝 Mutuelle</option>
              </select>
            </div>
            <div class="org-search-field">
              <label class="org-field-label">Pays</label>
              <select id="orgPaysFilter" class="org-search-input">
                <option value="">Tous pays</option>
                ${pays.map(p => `<option value="${p.id}">${p.lib}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Panel organisations sélectionnées -->
          <div id="orgSelectedPanel" class="org-selected-panel" style="display:none">
            <div class="org-selected-header">
              <span class="org-selected-title">
                ✅ Sélectionnées : <strong id="orgSelCount">0</strong>
              </span>
              <button id="clearAllOrgsBtn" class="org-clear-btn" type="button">
                Tout effacer
              </button>
            </div>
            <div id="orgSelectedList" class="org-selected-list"></div>
            <div class="org-selected-footer">
              <button id="sendDemandesBtn" class="btn btn-primary org-send-btn">
                📤 Envoyer les demandes d'adhésion
              </button>
            </div>
          </div>

          <div id="orgError" class="msg error" style="display:none;margin-top:8px"></div>
          <div id="orgResults" class="org-results">
            <div class="org-loading">⏳ Chargement des organisations…</div>
          </div>
          <div id="orgPagination"></div>

        </div><!-- /step2-section -->

        <!-- ═══ STEP 3 : Fonction souhaitée ═══════════════════════ -->
        <div id="step3-section" style="display:none">
          ${progressBar(3)}

          <div class="org-step-header">
            <button id="backToOrgsBtn" class="btn btn-secondary org-back-btn">← Retour</button>
            <div class="org-step-info">
              <div class="org-step-title">Choisissez la fonction que vous souhaitez occuper</div>
              <div id="fonctionStepSub" class="org-step-sub"></div>
            </div>
          </div>

          <div class="fonction-select-wrap">
            <label class="fonction-label">Fonction / Rôle *</label>
            <select id="fonctionSelect" class="fonction-select" required>
              <option value="">— Sélectionnez votre rôle —</option>
              <optgroup label="Rôles statutaires">
                <option>Président(e)</option>
                <option>Vice-président(e)</option>
                <option>Secrétaire général(e)</option>
                <option>Secrétaire</option>
                <option>Trésorier(ère)</option>
                <option>Membre du bureau</option>
                <option>Membre du comité directeur</option>
                <option>Membre du conseil d'administration</option>
              </optgroup>
              <optgroup label="Statuts d'adhésion">
                <option>Membre fondateur</option>
                <option>Membre actif</option>
                <option>Membre honoraire</option>
                <option>Membre bienfaiteur</option>
                <option>Membre d'honneur</option>
                <option>Membre adhérent simple</option>
                <option>Membre sympathisant</option>
              </optgroup>
              <optgroup label="Mutuelles">
                <option>Membre cotisant</option>
                <option>Ayant droit</option>
                <option>Membre participant</option>
              </optgroup>
              <optgroup label="ONG">
                <option>Bénévole</option>
                <option>Salarié</option>
                <option>Employé</option>
                <option>Membre du conseil scientifique</option>
                <option>Membre du conseil technique</option>
                <option>Partenaire institutionnel</option>
              </optgroup>
            </select>
            <p class="fonction-hint">
              Ce choix sera transmis à chacune des organisations sélectionnées.
            </p>
          </div>

          <div id="fonctionMsg" class="msg error" style="display:none;margin-top:8px"></div>

          <div class="form-actions" style="margin-top:20px">
            <button id="fonctionSubmitBtn" class="btn btn-primary adh-submit-btn">
              📤 Envoyer les demandes d'adhésion
            </button>
          </div>
        </div><!-- /step3-section -->

        <!-- ═══ STEP 4 : Confirmation ═══════════════════════════════ -->
        <div id="step4-section" style="display:none"></div>

        ` : ''}

      </div>
    </div>`;

  // ── File upload previews ────────────────────────────────────
  window.previewAvatar = function(input) {
    if (!input.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
      const circle = document.getElementById('avatarPreview');
      circle.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    };
    reader.readAsDataURL(input.files[0]);
  };

  window.previewCNI = function(input) {
    const text = document.getElementById('cniUploadText');
    const zone = document.getElementById('cniUploadZone');
    if (input.files?.[0]) {
      text.textContent = `✅ ${input.files[0].name}`;
      zone.classList.add('has-file');
    }
  };

  window.previewUpload = function(input) {
    const zone = document.getElementById('uploadZone');
    const text = document.getElementById('uploadText');
    if (input.files && input.files[0]) {
      const f  = input.files[0];
      const mb = (f.size / 1024 / 1024).toFixed(2);
      text.textContent = `✅ ${f.name} (${mb} Mo)`;
      zone.classList.add('has-file');
    }
  };

  window.previewLogoUpload = function(input) {
    const zone = document.getElementById('logoUploadZone');
    const text = document.getElementById('logoUploadText');
    const icon = document.getElementById('logoUploadIcon');
    const img  = document.getElementById('logoPreviewImg');
    if (input.files && input.files[0]) {
      const f  = input.files[0];
      const mb = (f.size / 1024 / 1024).toFixed(2);
      text.textContent = `✅ ${f.name} (${mb} Mo)`;
      zone.classList.add('has-file');
      const reader = new FileReader();
      reader.onload = ev => {
        img.src = ev.target.result;
        img.style.display = 'block';
        icon.style.display = 'none';
      };
      reader.readAsDataURL(f);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // ORGANISATION MODE — soumettre à l'API
  // ══════════════════════════════════════════════════════════════
  if (mode === 'organisation') {
    document.getElementById('adhesionForm').onsubmit = async e => {
      e.preventDefault();
      const fd     = new FormData(e.target);
      const paysEl = e.target.querySelector('[name="pays"]');
      if (paysEl) fd.append('libPays', paysEl.options[paysEl.selectedIndex]?.text || '');

      const msg       = document.getElementById('adhesionMsg');
      const submitBtn = e.target.querySelector('[type="submit"]');
      submitBtn.disabled    = true;
      submitBtn.textContent = 'Envoi en cours…';
      msg.style.display     = 'none';

      try {
        const res  = await fetch('/api/public/adhesion', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        const emailOrg = fd.get('email');
        document.querySelector('.adh-card').innerHTML = `
          <div class="pub-success">
            <div class="success-icon">✅</div>
            <h3>Demande envoyée — dernière étape : le paiement</h3>
            <p>${data.message}<br>
               Référence : <strong>#${data.id}</strong></p>
            <p style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 14px;font-size:12.5px;color:#7c2d12;margin:16px 0;text-align:left">
              ⚠️ <strong>Important :</strong> le document d'agrément fourni sera vérifié par notre équipe.
              S'il s'avère non authentique, votre organisation sera rejetée définitivement et
              <strong>aucun remboursement ne sera effectué</strong>, quel que soit le montant réglé ici.
              Si votre dossier est refusé pour un tout autre motif (document valide), <strong>80% du
              montant vous sera remboursé</strong> automatiquement.
            </p>
            <div id="orgPaymentWidget" style="text-align:left;margin-top:20px"></div>
          </div>`;

        renderPaymentWidget(document.getElementById('orgPaymentWidget'), {
          codePays: data.codePays,
          montant: data.montant,
          idPaiement: data.idPaiement,
          authenticated: false,
          email: emailOrg,
          onSuccess: () => {
            document.querySelector('.pub-success').insertAdjacentHTML('beforeend', `
              <p style="margin-top:16px;color:#059669">
                Votre cotisation est réglée. Votre dossier part maintenant en revue chez notre équipe —
                vous recevrez vos identifiants de connexion par email dès la validation.
              </p>
              <button class="btn btn-secondary" onclick="landingNav('landing')" style="margin-top:10px">← Accueil</button>`);
          },
        });
      } catch (err) {
        msg.style.display     = 'block';
        msg.className         = 'msg error';
        msg.textContent       = err.message;
        submitBtn.disabled    = false;
        submitBtn.textContent = '📤 Soumettre la demande';
      }
    };
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // INDIVIDU MODE — flow 3 étapes
  // ══════════════════════════════════════════════════════════════

  // Organisations pré-sélectionnées depuis la page d'accueil (liste déroulante) : soit un
  // tableau (navigation JS directe), soit une chaîne "12,34" (URL rechargée / partagée).
  const preselectedNumAgrs = Array.isArray(params.numAgrs)
    ? params.numAgrs
    : (params.numAgrs ? String(params.numAgrs).split(',').filter(Boolean) : []);

  let dossierData  = null;
  let selectedOrgs = new Set(preselectedNumAgrs);
  let orgMap       = {};
  let searchTimer  = null;
  let totalPages   = 1;

  // Récupère les informations des organisations pré-sélectionnées (peuvent ne pas figurer
  // sur la première page de résultats de loadOrgs()) afin que le panneau "sélectionnées"
  // les affiche correctement dès l'arrivée sur l'étape 2.
  async function loadPreselectedOrgDetails() {
    if (!selectedOrgs.size) return;
    try {
      const res  = await fetch('/api/public/organisations?all=1');
      const data = await res.json();
      (data.orgs || []).forEach(o => {
        if (selectedOrgs.has(String(o.NumAgr))) orgMap[o.NumAgr] = o;
      });
    } catch (_) { /* le panneau affichera juste le numéro d'agrément à défaut du nom */ }
  }

  // ── Étape 1 → Étape 2 ────────────────────────────────────────
  document.getElementById('indivNextBtn').addEventListener('click', () => {
    const form = document.getElementById('adhesionForm');
    const msg  = document.getElementById('adhesionMsg');
    msg.style.display = 'none';
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const fd      = new FormData(form);
    const paysEl  = form.querySelector('[name="pays"]');
    const libPays = paysEl?.options[paysEl.selectedIndex]?.text || '';

    dossierData = {
      nom:              (fd.get('nom')              || '').trim(),
      prenom:           (fd.get('prenom')           || '').trim(),
      email:            (fd.get('email')            || '').trim(),
      tel:              (fd.get('tel')              || '').trim(),
      codePays:         fd.get('pays')              || '',
      libPays,
      dateNaiss:        fd.get('dateNaiss')         || '',
      sexe:             fd.get('sexe')              || '',
      ville:            (fd.get('ville')            || '').trim(),
      adresse:          (fd.get('adresse')          || '').trim(),
      numCNI:           (fd.get('numCNI')           || '').trim(),
      profession:       (fd.get('profession')       || '').trim(),
      situationMatrimoniale: fd.get('situationMatrimoniale') || '',
      description:      fd.get('description')       || '',
      _photoFile:    form.querySelector('[name="photo"]')?.files?.[0]    || null,
      _photoCNIFile: form.querySelector('[name="photoCNI"]')?.files?.[0] || null,
    };

    showStep2();
  });

  // ── Afficher l'étape 2 ────────────────────────────────────────
  function showStep2() {
    document.getElementById('step1-section').style.display = 'none';
    const s2 = document.getElementById('step2-section');
    s2.style.display = '';
    document.getElementById('orgStepDossier').textContent =
      `Dossier de : ${dossierData.nom} ${dossierData.prenom}`;

    document.getElementById('backToFormBtn').addEventListener('click', showStep1);
    document.getElementById('orgSearch').addEventListener('input', debounceSearch);
    document.getElementById('orgVilleFilter').addEventListener('input', debounceSearch);
    document.getElementById('orgTypeFilter').addEventListener('change', () => loadOrgs(0));
    document.getElementById('orgPaysFilter').addEventListener('change', () => loadOrgs(0));
    document.getElementById('sendDemandesBtn').addEventListener('click', showStep3Fonction);
    document.getElementById('clearAllOrgsBtn').addEventListener('click', () => {
      selectedOrgs.clear();
      orgMap = {};
      document.querySelectorAll('.org-card.selected').forEach(c => {
        c.classList.remove('selected');
        c.querySelector('.org-card-check').textContent = '';
      });
      updateSelectedPanel();
    });
    document.getElementById('orgResults').addEventListener('click', e => {
      const card = e.target.closest('.org-card');
      if (card) toggleOrg(card.dataset.id, card);
    });

    if (selectedOrgs.size) {
      loadPreselectedOrgDetails().then(updateSelectedPanel);
    }
    loadOrgs(0);
  }

  // ── Retour à l'étape 1 ───────────────────────────────────────
  function showStep1() {
    selectedOrgs = new Set();
    orgMap       = {};
    document.getElementById('step2-section').style.display = 'none';
    document.getElementById('step1-section').style.display = '';
  }

  // ── Debounce recherche ────────────────────────────────────────
  function debounceSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadOrgs(0), 280);
  }

  // ── Charger les organisations ─────────────────────────────────
  async function loadOrgs(page) {
    const search = document.getElementById('orgSearch')?.value?.trim()      || '';
    const ville  = document.getElementById('orgVilleFilter')?.value?.trim() || '';
    const type   = document.getElementById('orgTypeFilter')?.value          || '';
    const paysF  = document.getElementById('orgPaysFilter')?.value          || '';
    const errEl  = document.getElementById('orgError');

    const qs = new URLSearchParams({ page });
    if (search) qs.set('search', search);
    if (ville)  qs.set('ville',  ville);
    if (type)   qs.set('type',   type);
    if (paysF)  qs.set('pays',   paysF);

    const resultsEl = document.getElementById('orgResults');
    if (page === 0) resultsEl.innerHTML = `<div class="org-loading">⏳ Chargement…</div>`;
    if (errEl) errEl.style.display = 'none';

    try {
      const res  = await fetch(`/api/public/organisations?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur réseau');

      const { orgs, total, pages } = data;
      totalPages = pages;
      orgs.forEach(o => { orgMap[o.NumAgr] = o; });

      // Empty state
      if (page === 0) {
        if (orgs.length === 0) {
          resultsEl.innerHTML = `
            <div class="org-empty">
              <div class="org-empty-icon">🔍</div>
              <p><strong>Aucune organisation trouvée</strong></p>
              <p>Essayez d'autres critères de recherche.</p>
            </div>`;
          document.getElementById('orgPagination').innerHTML = '';
          return;
        }
        resultsEl.innerHTML = '';
      }

      // Grid
      let grid = resultsEl.querySelector('.org-grid');
      if (!grid || page === 0) {
        grid = document.createElement('div');
        grid.className = 'org-grid';
        if (page === 0) resultsEl.innerHTML = '';
        resultsEl.appendChild(grid);
      }

      const typeColors = { Association:'#2563eb', ONG:'#059669', Mutuelle:'#d97706' };
      orgs.forEach(o => {
        const isSel = selectedOrgs.has(o.NumAgr);
        const col   = typeColors[o.TypeOrg] || '#6366f1';
        const card  = document.createElement('div');
        card.className  = `org-card${isSel ? ' selected' : ''}`;
        card.dataset.id = o.NumAgr;

        const villeStr = o.Ville  || '—';
        const paysStr  = o.Pays   || o.CodePays || '—';
        const locLine  = `${villeStr}, ${paysStr}`;

        card.innerHTML = `
          <div class="org-card-check">${isSel ? '✓' : ''}</div>
          <div class="org-card-body">
            <div class="org-card-name">${o.LibOrg}</div>
            <div class="org-card-location">📍 ${locLine}</div>
            <div class="org-card-meta">
              <span class="org-type-badge" style="background:${col}1a;color:${col}">${o.TypeOrg || 'Org'}</span>
            </div>
          </div>`;
        grid.appendChild(card);
      });

      // Pagination
      const pagEl = document.getElementById('orgPagination');
      pagEl.innerHTML = '';
      if (page + 1 < totalPages) {
        const remaining = total - (page + 1) * 20;
        const more = document.createElement('button');
        more.className   = 'btn btn-secondary org-load-more';
        more.textContent = `Voir ${remaining} de plus`;
        more.addEventListener('click', () => loadOrgs(page + 1));
        pagEl.appendChild(more);
      }
      const info = document.createElement('div');
      info.className   = 'org-total-count';
      info.textContent = `${total} organisation${total > 1 ? 's' : ''} active${total > 1 ? 's' : ''} sur la plateforme`;
      pagEl.appendChild(info);

    } catch (err) {
      if (errEl) { errEl.textContent = `⚠️ ${err.message}`; errEl.style.display = 'block'; }
      if (page === 0) resultsEl.innerHTML = '';
    }
  }

  // ── Sélectionner / désélectionner une org ────────────────────
  function toggleOrg(numAgr, card) {
    if (selectedOrgs.has(numAgr)) selectedOrgs.delete(numAgr);
    else                          selectedOrgs.add(numAgr);
    const sel = selectedOrgs.has(numAgr);
    card.classList.toggle('selected', sel);
    card.querySelector('.org-card-check').textContent = sel ? '✓' : '';
    updateSelectedPanel();
  }

  function updateSelectedPanel() {
    const n      = selectedOrgs.size;
    const panel  = document.getElementById('orgSelectedPanel');
    const count  = document.getElementById('orgSelCount');
    const list   = document.getElementById('orgSelectedList');
    if (!panel || !count || !list) return;

    panel.style.display = n > 0 ? '' : 'none';
    count.textContent = n;

    list.innerHTML = [...selectedOrgs].map(numAgr => {
      const o        = orgMap[numAgr] || {};
      const typeCol  = { Association:'#2563eb', ONG:'#059669', Mutuelle:'#d97706' }[o.TypeOrg] || '#6366f1';
      const villeStr = o.Ville || '—';
      const paysStr  = o.Pays  || o.CodePays || '—';
      return `
        <div class="org-sel-item" data-id="${numAgr}">
          <div class="org-sel-item-info">
            <span class="org-sel-item-name">${o.LibOrg || numAgr}</span>
            <span class="org-sel-item-loc">${villeStr}, ${paysStr}</span>
          </div>
          <span class="org-type-badge org-sel-badge"
                style="background:${typeCol}1a;color:${typeCol}">${o.TypeOrg || ''}</span>
          <button class="org-sel-remove" data-id="${numAgr}" title="Retirer">✕</button>
        </div>`;
    }).join('');

    list.querySelectorAll('.org-sel-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        selectedOrgs.delete(id);
        const card = document.querySelector(`.org-card[data-id="${id}"]`);
        if (card) {
          card.classList.remove('selected');
          card.querySelector('.org-card-check').textContent = '';
        }
        updateSelectedPanel();
      });
    });

    // Update send button label
    const sendBtn = document.getElementById('sendDemandesBtn');
    if (sendBtn) sendBtn.textContent = `Continuer → (${n} organisation${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''})`;
  }

  // ── Afficher l'étape 3 (choix de la fonction) ────────────────
  function showStep3Fonction() {
    if (selectedOrgs.size === 0) return;
    document.getElementById('step2-section').style.display = 'none';
    const s3 = document.getElementById('step3-section');
    s3.style.display = '';

    const n = selectedOrgs.size;
    document.getElementById('fonctionStepSub').textContent =
      `Demande pour ${n} organisation${n > 1 ? 's' : ''} — Dossier de : ${dossierData.nom} ${dossierData.prenom}`;

    document.getElementById('backToOrgsBtn').addEventListener('click', () => {
      s3.style.display = 'none';
      document.getElementById('step2-section').style.display = '';
    });

    const fonctionMsg = document.getElementById('fonctionMsg');
    document.getElementById('fonctionSubmitBtn').addEventListener('click', () => {
      const val = document.getElementById('fonctionSelect').value.trim();
      if (!val) {
        fonctionMsg.textContent = 'Veuillez sélectionner une fonction avant de continuer.';
        fonctionMsg.style.display = 'block';
        return;
      }
      fonctionMsg.style.display = 'none';
      dossierData.fonctionSouhaitee = val;
      sendMultiAdhesion();
    });
  }

  // ── Envoyer les demandes multi-org ───────────────────────────
  async function sendMultiAdhesion() {
    if (selectedOrgs.size === 0) return;
    const btn   = document.getElementById('fonctionSubmitBtn');
    const errEl = document.getElementById('fonctionMsg');
    btn.disabled    = true;
    btn.textContent = 'Envoi en cours…';
    if (errEl) { errEl.style.display = 'none'; }

    try {
      const fd = new FormData();
      const dossierPayload = { ...dossierData };
      delete dossierPayload._photoFile;
      delete dossierPayload._photoCNIFile;
      fd.append('dossier', JSON.stringify(dossierPayload));
      fd.append('orgs',    JSON.stringify(Array.from(selectedOrgs)));
      if (dossierData._photoFile)    fd.append('photo',    dossierData._photoFile);
      if (dossierData._photoCNIFile) fd.append('photoCNI', dossierData._photoCNIFile);

      const res = await fetch('/api/public/adhesion-multi', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showStep4(data);
    } catch (err) {
      btn.disabled    = false;
      btn.textContent = '📤 Envoyer les demandes d\'adhésion';
      if (errEl) { errEl.className = 'msg error'; errEl.textContent = `⚠️ ${err.message}`; errEl.style.display = 'block'; }
    }
  }

  // ── Afficher l'étape 4 (succès + suivi) ──────────────────────
  function showStep4(data) {
    document.getElementById('step3-section').style.display = 'none';
    const step4 = document.getElementById('step4-section');
    step4.style.display = '';

    const statusBadge = s =>
      s === 'Acceptée'
        ? `<span class="track-status-badge track-status-accepted">✅ Acceptée</span>`
        : s === 'Refusée'
          ? `<span class="track-status-badge track-status-refused">❌ Refusée</span>`
          : `<span class="track-status-badge track-status-pending">⏳ En attente</span>`;

    const rows = data.demandes.map(d => `
      <tr>
        <td><strong>${d.nomOrg}</strong></td>
        <td>${d.typeOrg || '—'}</td>
        <td>${d.siege  || '—'}</td>
        <td>${statusBadge(d.statut)}</td>
        <td style="font-size:11px;color:#94a3b8">#${d.id}</td>
      </tr>`).join('');

    const n = data.demandes.length;
    step4.innerHTML = `
      <div class="pub-success">
        ${progressBar(4)}
        <div class="success-icon">✅</div>
        <h3>${n} demande${n > 1 ? 's' : ''} envoyée${n > 1 ? 's' : ''} avec succès !</h3>
        <p style="margin:.6rem 0">
          Référence dossier : <span class="ref-badge">#${data.refDossier}</span>
        </p>
        <p style="color:#64748b;font-size:13px;margin:.4rem 0 .8rem">
          Chaque organisation traitera votre candidature indépendamment.<br>
          Vous serez contacté(e) par email à <strong>${dossierData.email}</strong>.
        </p>

        <div class="track-table-wrap">
          <table class="track-table">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Type</th>
                <th>Localisation</th>
                <th>Statut</th>
                <th>Réf.</th>
              </tr>
            </thead>
            <tbody id="trackTableBody">${rows}</tbody>
          </table>
        </div>

        <button id="refreshTrackBtn" class="btn btn-secondary"
                style="margin-top:12px;font-size:12px;padding:6px 14px">
          🔄 Rafraîchir les statuts
        </button>

        <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary"
                  onclick="landingNav('adhesion',{mode:'individu'})">Nouvelle demande</button>
          <button class="btn btn-secondary"
                  onclick="landingNav('landing')">← Accueil</button>
        </div>
      </div>`;

    document.getElementById('refreshTrackBtn').addEventListener('click', async () => {
      const btn = document.getElementById('refreshTrackBtn');
      btn.disabled = true; btn.textContent = '⏳ Mise à jour…';
      try {
        const res  = await fetch(`/api/public/mes-demandes?ref=${encodeURIComponent(data.refDossier)}`);
        const list = await res.json();
        if (!res.ok || !list.length) return;
        document.getElementById('trackTableBody').innerHTML = list.map(d => `
          <tr>
            <td><strong>${d.LibOrg || d.nomOrg}</strong></td>
            <td>${d.TypeOrg || '—'}</td>
            <td>${[d.SiegeOrg, d.LibPays].filter(Boolean).join(', ') || '—'}</td>
            <td>${statusBadge(d.statut)}</td>
            <td style="font-size:11px;color:#94a3b8">#${d.idDemande}</td>
          </tr>`).join('');
      } catch(_) {}
      btn.disabled = false; btn.textContent = '🔄 Rafraîchir les statuts';
    });
  }

});
